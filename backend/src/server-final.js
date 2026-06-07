const Fastify = require('fastify')
const cors = require('@fastify/cors')
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Baileys } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode')
const pino = require('pino')

dotenv.config()

const fastify = Fastify({
  logger: true,
})

const prisma = new PrismaClient()

fastify.register(cors, { origin: '*' })

// ─────────────────────────────────────────────────────────────────────────
// WHATSAPP STATE
// ─────────────────────────────────────────────────────────────────────────

let whatsappState = {
  connected: false,
  ready: false,
  qrCode: null,
  qrCodeDataURL: null,
  error: null,
  sock: null,
}

let metrics = {
  startTime: Date.now(),
  requests: 0,
  errors: 0,
  messagesProcessed: 0,
  messagesSent: 0,
}

// ─────────────────────────────────────────────────────────────────────────
// BAILEYS INTEGRATION
// ─────────────────────────────────────────────────────────────────────────

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, ConnectionState } = require('@whiskeysockets/baileys')

async function initializeBaileys() {
  try {
    const authDir = path.join(__dirname, '../.whatsapp_auth')
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const logger = pino({ level: 'error' })

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger,
      browser: ['APS EDU', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      maxMsToWaitForConnection: 30000,
    })

    // Handle QR Code
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log('📱 QR CODE GERADO - Escaneie com seu WhatsApp!')
        whatsappState.qrCode = qr
        try {
          whatsappState.qrCodeDataURL = await qrcode.toDataURL(qr)
        } catch (err) {
          console.error('Erro ao gerar QR code:', err)
        }
      }

      if (connection === 'connecting') {
        console.log('⏳ Conectando ao WhatsApp...')
        whatsappState.connected = false
        whatsappState.ready = false
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp conectado!')
        whatsappState.connected = true
        whatsappState.qrCode = null
        whatsappState.qrCodeDataURL = null
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        if (shouldReconnect) {
          console.log('🔄 Tentando reconectar...')
          setTimeout(() => initializeBaileys(), 3000)
        } else {
          console.log('❌ Desconectado')
          whatsappState.connected = false
        }
      }
    })

    // Handle messages
    sock.ev.on('messages.upsert', async (m) => {
      console.log(`📨 Mensagem recebida: ${m.messages.length}`)
      for (const msg of m.messages) {
        if (!msg.message) continue

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        const from = msg.key.remoteJid
        const fromMe = msg.key.fromMe

        console.log(`📱 De: ${from} | Mensagem: ${text}`)

        metrics.messagesProcessed++

        // Responder automaticamente
        if (!fromMe) {
          try {
            await sock.sendMessage(from, {
              text: `Olá! Recebi sua mensagem: "${text}"\n\nEsta é uma resposta automática da plataforma APS EDU.`,
            })
            metrics.messagesSent++
            console.log(`✅ Resposta enviada para ${from}`)
          } catch (err) {
            console.error('Erro ao enviar resposta:', err)
          }
        }
      }
    })

    // Save credentials
    sock.ev.on('creds.update', saveCreds)

    // Ready event
    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        whatsappState.ready = true
        console.log('🚀 WhatsApp pronto para usar!')
      }
    })

    whatsappState.sock = sock
    return sock
  } catch (error) {
    console.error('Erro ao inicializar Baileys:', error)
    whatsappState.error = error.message
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HEALTH ROUTES
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/health', async (request, reply) => {
  metrics.requests++
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - metrics.startTime,
    whatsapp: {
      connected: whatsappState.connected,
      ready: whatsappState.ready,
    },
    database: 'sqlite',
    redis: 'fallback-memory',
  }
})

fastify.get('/health/whatsapp', async (request, reply) => {
  metrics.requests++
  return {
    status: whatsappState.connected ? 'connected' : 'disconnected',
    connected: whatsappState.connected,
    ready: whatsappState.ready,
    hasQRCode: !!whatsappState.qrCode,
    error: whatsappState.error,
    timestamp: new Date().toISOString(),
  }
})

// ─────────────────────────────────────────────────────────────────────────
// WHATSAPP QR CODE ROUTE
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/whatsapp/qr', async (request, reply) => {
  metrics.requests++

  if (!whatsappState.qrCodeDataURL) {
    return reply.code(404).send({
      error: 'QR code not available',
      connected: whatsappState.connected,
      ready: whatsappState.ready,
    })
  }

  return {
    qrCode: whatsappState.qrCodeDataURL,
    status: 'waiting',
    instruction: 'Escaneie o QR code com seu WhatsApp',
  }
})

fastify.get('/whatsapp/qr-html', async (request, reply) => {
  metrics.requests++

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp - Conectar</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          text-align: center;
        }
        h1 { color: #667eea; margin-bottom: 10px; font-size: 2em; }
        p { color: #666; margin-bottom: 30px; font-size: 1.1em; }
        #qr-container {
          background: #f5f5f5;
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 30px;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #qr-image {
          max-width: 100%;
          height: auto;
        }
        .status {
          padding: 12px 20px;
          border-radius: 10px;
          margin-top: 20px;
          font-weight: 600;
        }
        .status-waiting { background: #fff3cd; color: #856404; }
        .status-connected { background: #d4edda; color: #155724; }
        .loading { animation: pulse 2s infinite; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .instructions {
          text-align: left;
          background: #f9f9f9;
          padding: 20px;
          border-radius: 10px;
          margin-top: 20px;
        }
        .instructions h3 { color: #667eea; margin-bottom: 10px; }
        .instructions ol { margin-left: 20px; }
        .instructions li { margin-bottom: 8px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📱 Conectar WhatsApp</h1>
        <p>Escaneie o QR code com seu celular</p>

        <div id="qr-container" class="loading">
          <div id="qr-image">Gerando QR code...</div>
        </div>

        <div id="status" class="status status-waiting">⏳ Aguardando escaneamento...</div>

        <div class="instructions">
          <h3>Como conectar:</h3>
          <ol>
            <li>Abra <strong>WhatsApp</strong> no seu celular</li>
            <li>Vá em <strong>Configurações</strong></li>
            <li>Clique em <strong>Dispositivos vinculados</strong></li>
            <li>Clique em <strong>Vincular um dispositivo</strong></li>
            <li>Aponte a câmera para o QR code</li>
            <li>Pronto! Você está conectado! ✅</li>
          </ol>
        </div>
      </div>

      <script>
        async function loadQRCode() {
          try {
            const response = await fetch('/whatsapp/qr')
            if (!response.ok) throw new Error('QR code not available')

            const data = await response.json()
            const img = document.getElementById('qr-image')
            img.innerHTML = '<img src="' + data.qrCode + '" alt="QR Code">'
          } catch (error) {
            document.getElementById('qr-image').innerHTML = '<p style="color: #999;">QR code indisponível</p>'
          }
        }

        async function checkStatus() {
          try {
            const response = await fetch('/health/whatsapp')
            const data = await response.json()

            const statusDiv = document.getElementById('status')
            if (data.connected) {
              statusDiv.className = 'status status-connected'
              statusDiv.innerHTML = '✅ Conectado com sucesso!'
              setTimeout(() => {
                window.location.href = '/dashboard-ui'
              }, 2000)
            } else if (data.hasQRCode) {
              statusDiv.className = 'status status-waiting'
              statusDiv.innerHTML = '⏳ Aguardando escaneamento...'
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error)
          }
        }

        // Carregar QR code ao iniciar
        loadQRCode()

        // Verificar status a cada 2 segundos
        setInterval(() => {
          loadQRCode()
          checkStatus()
        }, 2000)
      </script>
    </body>
    </html>
  `

  reply.type('text/html').send(html)
})

// ─────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────

fastify.post('/messages/send', async (request, reply) => {
  try {
    metrics.requests++
    const { chatId, text } = request.body

    if (!chatId || !text) {
      metrics.errors++
      return reply.code(400).send({ error: 'chatId and text required' })
    }

    if (!whatsappState.sock || !whatsappState.connected) {
      metrics.errors++
      return reply.code(503).send({ error: 'WhatsApp not connected' })
    }

    // Enviar mensagem
    const result = await whatsappState.sock.sendMessage(chatId, { text })
    metrics.messagesSent++

    return {
      success: true,
      chatId,
      message: text,
      messageKey: result.key,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/dashboard', async (request, reply) => {
  metrics.requests++
  const uptime = Date.now() - metrics.startTime

  return {
    system: {
      uptime: formatUptime(uptime),
      timestamp: new Date().toISOString(),
    },
    requests: {
      total: metrics.requests,
      errors: metrics.errors,
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) : 0,
    },
    messages: {
      processed: metrics.messagesProcessed,
      sent: metrics.messagesSent,
    },
    cache: {
      type: 'memory-stub',
      status: 'active',
    },
    whatsapp: {
      connected: whatsappState.connected,
      ready: whatsappState.ready,
      status: whatsappState.connected ? 'ready' : 'disconnected',
    },
  }
})

fastify.get('/dashboard-ui', async (request, reply) => {
  const filePath = path.join(__dirname, 'dashboard-visual.html')
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    reply.type('text/html').send(content)
  } catch (error) {
    return reply.code(404).send({ error: 'Dashboard not found' })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/kb/search', async (request, reply) => {
  metrics.requests++
  const { q, limit = 5 } = request.query

  if (!q) {
    metrics.errors++
    return reply.code(400).send({ error: 'Query required' })
  }

  return [
    {
      id: '1',
      title: 'Como fazer pagamento',
      content: 'Você pode pagar via PIX, cartão ou boleto',
      category: 'pagamento',
    },
  ]
})

fastify.post('/kb/article', async (request, reply) => {
  metrics.requests++
  const { title, content, category } = request.body

  if (!title || !content || !category) {
    metrics.errors++
    return reply.code(400).send({ error: 'title, content and category required' })
  }

  return {
    id: Date.now().toString(),
    title,
    content,
    category,
    createdAt: new Date().toISOString(),
  }
})

// ─────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/', async (request, reply) => {
  metrics.requests++

  return {
    name: 'APS EDU WhatsApp CRM',
    version: '1.0.0',
    status: 'running',
    whatsapp: {
      connected: whatsappState.connected,
      ready: whatsappState.ready,
    },
    endpoints: {
      health: '/health',
      dashboard: '/dashboard',
      whatsappQR: '/whatsapp/qr-html',
      messages: '/messages/send',
      kb: '/kb/search',
    },
  }
})

// ─────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// ─────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    const PORT = process.env.PORT || 3000
    const HOST = process.env.HOST || '0.0.0.0'

    // Inicializar WhatsApp
    console.log('📱 Inicializando WhatsApp...')
    await initializeBaileys()

    await fastify.listen({ port: PORT, host: HOST })

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log('  🚀 APS EDU - WhatsApp CRM')
    console.log('═══════════════════════════════════════════════════')
    console.log('')
    console.log('📍 Acessos:')
    console.log(`  • Dashboard:  http://localhost:${PORT}/dashboard-ui`)
    console.log(`  • QR Code:    http://localhost:${PORT}/whatsapp/qr-html`)
    console.log(`  • Health:     http://localhost:${PORT}/health`)
    console.log(`  • API Root:   http://localhost:${PORT}`)
    console.log('')
    console.log('📱 Status WhatsApp: Aguardando conexão...')
    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log('')
  } catch (error) {
    console.error('❌ Erro ao iniciar:', error)
    process.exit(1)
  }
}

start()

process.on('SIGTERM', async () => {
  console.log('SIGTERM - Encerrando...')
  if (whatsappState.sock) await whatsappState.sock.end()
  await fastify.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT - Encerrando...')
  if (whatsappState.sock) await whatsappState.sock.end()
  await fastify.close()
  process.exit(0)
})
