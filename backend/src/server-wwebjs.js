const Fastify = require('fastify')
const cors = require('@fastify/cors')
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode')

dotenv.config()

const fastify = Fastify({
  logger: true,
})

const prisma = require('@prisma/client').PrismaClient ? new (require('@prisma/client').PrismaClient)() : null

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
  client: null,
  reconnectAttempt: 0,
  maxReconnectAttempts: 7,
  lastQRTime: null,
}

let metrics = {
  startTime: Date.now(),
  requests: 0,
  errors: 0,
  messagesProcessed: 0,
  messagesSent: 0,
  reconnectCount: 0,
  circuitBreakerOpen: false,
}

// ─────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER PATTERN
// ─────────────────────────────────────────────────────────────────────────
let circuitBreaker = {
  failureCount: 0,
  failureThreshold: 10,
  resetTimeout: 60000,
  isOpen: false,
  lastFailureTime: null,

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.failureThreshold) {
      this.isOpen = true
      metrics.circuitBreakerOpen = true
      console.error('🔴 CIRCUIT BREAKER ABERTO - Muitas falhas consecutivas')
      setTimeout(() => this.reset(), this.resetTimeout)
    }
  },

  recordSuccess() {
    this.failureCount = 0
    this.isOpen = false
    metrics.circuitBreakerOpen = false
    whatsappState.reconnectAttempt = 0
  },

  reset() {
    this.failureCount = 0
    this.isOpen = false
    metrics.circuitBreakerOpen = false
    console.log('🟢 CIRCUIT BREAKER RESET - Tentando novamente')
  },

  canAttempt() {
    return !this.isOpen
  },
}

// ─────────────────────────────────────────────────────────────────────────
// EXPONENTIAL BACKOFF
// ─────────────────────────────────────────────────────────────────────────
function calculateBackoffDelay(attempt) {
  const delayMs = Math.min(1000 * Math.pow(2, attempt), 60000)
  const jitter = delayMs * 0.2 * (Math.random() - 0.5)
  return Math.max(delayMs + jitter, 1000)
}

// ─────────────────────────────────────────────────────────────────────────
// WHATSAPP-WEB.JS CLIENT
// ─────────────────────────────────────────────────────────────────────────

async function initializeClient() {
  try {
    console.log('📱 Inicializando WhatsApp Web JS...')

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'aps-edu-crm',
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      },
    })

    // QR Code Event
    client.on('qr', async (qr) => {
      const now = Date.now()
      whatsappState.lastQRTime = now
      whatsappState.qrCode = qr
      console.log('📱 QR CODE GERADO - Escaneie com seu WhatsApp!')

      try {
        whatsappState.qrCodeDataURL = await qrcode.toDataURL(qr)
        console.log('✅ QR Code convertido para imagem')
      } catch (err) {
        console.error('Erro ao gerar QR code:', err)
      }

      // Auto-refresh QR após 60 segundos
      setTimeout(() => {
        if (whatsappState.lastQRTime === now && !whatsappState.connected) {
          console.log('🔄 QR CODE EXPIRADO - Aguardando novo...')
          whatsappState.qrCode = null
          whatsappState.qrCodeDataURL = null
        }
      }, 60000)
    })

    // Ready Event
    client.on('ready', () => {
      console.log('✅ WhatsApp conectado e pronto!')
      whatsappState.connected = true
      whatsappState.ready = true
      whatsappState.qrCode = null
      whatsappState.qrCodeDataURL = null
      whatsappState.reconnectAttempt = 0
      circuitBreaker.recordSuccess()
      metrics.reconnectCount = 0
    })

    // Authenticated Event
    client.on('authenticated', () => {
      console.log('🔐 Autenticado com sucesso!')
      whatsappState.connected = true
    })

    // Auth Failure Event
    client.on('auth_failure', (msg) => {
      console.error('❌ Falha de autenticação:', msg)
      whatsappState.error = msg
      circuitBreaker.recordFailure()
    })

    // Disconnected Event
    client.on('disconnected', () => {
      console.log('❌ Desconectado do WhatsApp')
      whatsappState.connected = false
      whatsappState.ready = false
      metrics.reconnectCount++
      if (whatsappState.reconnectAttempt < whatsappState.maxReconnectAttempts) {
        reconnectWithBackoff(whatsappState.reconnectAttempt)
      }
    })

    // Message Event
    client.on('message', async (message) => {
      console.log(`📨 Mensagem de ${message.from}: ${message.body}`)
      metrics.messagesProcessed++

      // Responder automaticamente
      try {
        await message.reply('Olá! Recebi sua mensagem. Esta é uma resposta automática da plataforma APS EDU.')
        metrics.messagesSent++
        console.log(`✅ Resposta enviada`)
      } catch (err) {
        console.error('Erro ao enviar resposta:', err)
      }
    })

    whatsappState.client = client
    await client.initialize()
    return client
  } catch (error) {
    console.error('Erro ao inicializar cliente:', error)
    whatsappState.error = error.message
    circuitBreaker.recordFailure()
    throw error
  }
}

async function reconnectWithBackoff(attempt = 0) {
  if (attempt >= whatsappState.maxReconnectAttempts) {
    console.error(`❌ Máximo de tentativas atingido (${whatsappState.maxReconnectAttempts})`)
    circuitBreaker.recordFailure()
    return
  }

  if (!circuitBreaker.canAttempt()) {
    console.log('⏳ Circuit breaker aberto - aguardando reset...')
    return
  }

  const delay = calculateBackoffDelay(attempt)
  console.log(`⏳ Reconectando em ${Math.round(delay / 1000)}s (tentativa ${attempt + 1}/${whatsappState.maxReconnectAttempts})`)

  setTimeout(() => {
    whatsappState.reconnectAttempt = attempt + 1
    initializeClient().catch(err => {
      console.error('Erro na reconexão:', err)
      reconnectWithBackoff(attempt + 1)
    })
  }, delay)
}

// ─────────────────────────────────────────────────────────────────────────
// HEALTH CHECK PERIÓDICO
// ─────────────────────────────────────────────────────────────────────────
function startHealthCheck() {
  setInterval(() => {
    if (whatsappState.client) {
      const status = whatsappState.connected ? '✅ OK' : '⚠️ OFFLINE'
      console.log(`[HEALTH] WhatsApp: ${status} | Circuit Breaker: ${circuitBreaker.isOpen ? '🔴 OPEN' : '🟢 CLOSED'} | Reconexões: ${metrics.reconnectCount}`)
    }
  }, 30000)
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
    hasQRCode: !!whatsappState.qrCodeDataURL,
    error: whatsappState.error,
    reconnectAttempt: whatsappState.reconnectAttempt,
    maxReconnectAttempts: whatsappState.maxReconnectAttempts,
    circuitBreakerOpen: circuitBreaker.isOpen,
    circuitBreakerFailures: circuitBreaker.failureCount,
    metrics: {
      reconnectCount: metrics.reconnectCount,
      messagesProcessed: metrics.messagesProcessed,
      messagesSent: metrics.messagesSent,
    },
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
      message: 'Aguardando QR code...',
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
            img.innerHTML = '<img src="' + data.qrCode + '" alt="QR Code" style="width: 300px; height: 300px;">'
          } catch (error) {
            document.getElementById('qr-image').innerHTML = '<p style="color: #999;">Aguardando QR code...</p>'
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

    if (!whatsappState.client || !whatsappState.connected) {
      metrics.errors++
      return reply.code(503).send({ error: 'WhatsApp not connected' })
    }

    const result = await whatsappState.client.sendMessage(chatId, text)
    metrics.messagesSent++

    return {
      success: true,
      chatId,
      message: text,
      messageId: result.id,
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
  const { q } = request.query

  if (!q) {
    metrics.errors++
    return reply.code(400).send({ error: 'Query required' })
  }

  return [
    {
      id: '1',
      title: 'Como usar a plataforma',
      content: 'Guia completo de como usar o WhatsApp CRM',
      category: 'tutorial',
    },
  ]
})

// ─────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/', async (request, reply) => {
  metrics.requests++

  return {
    name: 'APS EDU WhatsApp CRM',
    version: '1.0.0',
    library: 'whatsapp-web.js',
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

    // Inicializar WhatsApp Web JS
    console.log('📱 Inicializando WhatsApp com whatsapp-web.js...')
    await initializeClient()

    // Iniciar health check periódico
    startHealthCheck()

    await fastify.listen({ port: PORT, host: HOST })

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log('  🚀 APS EDU - WhatsApp CRM (whatsapp-web.js)')
    console.log('═══════════════════════════════════════════════════')
    console.log('')
    console.log('📍 Acessos:')
    console.log(`  • Dashboard:  http://localhost:${PORT}/dashboard-ui`)
    console.log(`  • QR Code:    http://localhost:${PORT}/whatsapp/qr-html`)
    console.log(`  • Health:     http://localhost:${PORT}/health`)
    console.log(`  • API Root:   http://localhost:${PORT}`)
    console.log('')
    console.log('📱 Status WhatsApp: Aguardando QR code...')
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
  if (whatsappState.client) await whatsappState.client.destroy()
  await fastify.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT - Encerrando...')
  if (whatsappState.client) await whatsappState.client.destroy()
  await fastify.close()
  process.exit(0)
})
