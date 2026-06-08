const Fastify = require('fastify')
const cors = require('@fastify/cors')
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode')

// Services
const cacheService = require('./services/cache.service')
const jobsService = require('./services/jobs.service')
const pollingService = require('./services/polling.service')
const syncService = require('./services/sync.service')

dotenv.config()

const fastify = Fastify({ logger: true })
fastify.register(cors, { origin: '*' })

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

let circuitBreaker = {
  failureCount: 0,
  failureThreshold: 10,
  resetTimeout: 60000,
  isOpen: false,

  recordFailure() {
    this.failureCount++
    if (this.failureCount >= this.failureThreshold) {
      this.isOpen = true
      metrics.circuitBreakerOpen = true
      console.error('🔴 CIRCUIT BREAKER ABERTO')
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
    console.log('🟢 CIRCUIT BREAKER RESET')
  },

  canAttempt() {
    return !this.isOpen
  },
}

function calculateBackoffDelay(attempt) {
  const delayMs = Math.min(1000 * Math.pow(2, attempt), 60000)
  const jitter = delayMs * 0.2 * (Math.random() - 0.5)
  return Math.max(delayMs + jitter, 1000)
}

async function reconnectWithBackoff(attempt = 0) {
  if (attempt >= whatsappState.maxReconnectAttempts) {
    console.error(`❌ Máximo de tentativas atingido`)
    circuitBreaker.recordFailure()
    return
  }

  if (!circuitBreaker.canAttempt()) {
    console.log('⏳ Circuit breaker aberto')
    return
  }

  const delay = calculateBackoffDelay(attempt)
  console.log(`⏳ Reconectando em ${Math.round(delay / 1000)}s (${attempt + 1}/${whatsappState.maxReconnectAttempts})`)

  setTimeout(() => {
    whatsappState.reconnectAttempt = attempt + 1
    initializeClient().catch(err => {
      console.error('Erro na reconexão:', err)
      reconnectWithBackoff(attempt + 1)
    })
  }, delay)
}

async function initializeClient() {
  try {
    console.log('📱 Inicializando WhatsApp Web JS...')

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: 'aps-edu-crm' }),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true },
    })

    client.on('qr', async (qr) => {
      const now = Date.now()
      whatsappState.lastQRTime = now
      whatsappState.qrCode = qr
      console.log('📱 QR CODE GERADO')

      try {
        whatsappState.qrCodeDataURL = await qrcode.toDataURL(qr)
      } catch (err) {
        console.error('Erro ao gerar QR code:', err)
      }

      setTimeout(() => {
        if (whatsappState.lastQRTime === now && !whatsappState.connected) {
          console.log('🔄 QR CODE EXPIRADO')
          whatsappState.qrCode = null
          whatsappState.qrCodeDataURL = null
        }
      }, 60000)
    })

    client.on('ready', () => {
      console.log('✅ WhatsApp conectado!')
      whatsappState.connected = true
      whatsappState.ready = true
      whatsappState.qrCode = null
      whatsappState.qrCodeDataURL = null
      whatsappState.reconnectAttempt = 0
      circuitBreaker.recordSuccess()
      metrics.reconnectCount = 0
    })

    client.on('authenticated', () => {
      console.log('🔐 Autenticado')
      whatsappState.connected = true
    })

    client.on('auth_failure', (msg) => {
      console.error('❌ Falha de autenticação:', msg)
      whatsappState.error = msg
      circuitBreaker.recordFailure()
    })

    client.on('disconnected', () => {
      console.log('❌ Desconectado')
      whatsappState.connected = false
      whatsappState.ready = false
      metrics.reconnectCount++
      if (whatsappState.reconnectAttempt < whatsappState.maxReconnectAttempts) {
        reconnectWithBackoff(whatsappState.reconnectAttempt)
      }
    })

    client.on('message', async (message) => {
      console.log(`📨 Mensagem: ${message.body.substring(0, 50)}...`)
      metrics.messagesProcessed++

      // Cache conversa
      await cacheService.setConversation(message.from, {
        lastMessage: message.body,
        timestamp: Date.now(),
      })

      try {
        await message.reply('Olá! Recebi sua mensagem. Esta é uma resposta automática da plataforma APS EDU.')
        metrics.messagesSent++
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

function startHealthCheck() {
  setInterval(() => {
    if (whatsappState.client) {
      const status = whatsappState.connected ? '✅ OK' : '⚠️ OFFLINE'
      console.log(`[HEALTH] WhatsApp: ${status} | Circuit Breaker: ${circuitBreaker.isOpen ? '🔴 OPEN' : '🟢 CLOSED'}`)
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
    whatsapp: { connected: whatsappState.connected, ready: whatsappState.ready },
    cache: cacheService.getStatus(),
    jobs: await jobsService.getAllQueueStats(),
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
    metrics: {
      reconnectCount: metrics.reconnectCount,
      messagesProcessed: metrics.messagesProcessed,
      messagesSent: metrics.messagesSent,
    },
    timestamp: new Date().toISOString(),
  }
})

fastify.get('/health/cache', async (request, reply) => {
  metrics.requests++
  return cacheService.getStatus()
})

fastify.get('/health/jobs', async (request, reply) => {
  metrics.requests++
  return await jobsService.getAllQueueStats()
})

// ─────────────────────────────────────────────────────────────────────────
// QR CODE ROUTES
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/whatsapp/qr', async (request, reply) => {
  metrics.requests++

  if (!whatsappState.qrCodeDataURL) {
    return reply.code(404).send({
      error: 'QR code not available',
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
        p { color: #666; margin-bottom: 30px; }
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
        .status {
          padding: 12px 20px;
          border-radius: 10px;
          margin-top: 20px;
          font-weight: 600;
        }
        .status-waiting { background: #fff3cd; color: #856404; }
        .status-connected { background: #d4edda; color: #155724; }
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
        <div id="qr-container">
          <div id="qr-image">Gerando QR code...</div>
        </div>
        <div id="status" class="status status-waiting">⏳ Aguardando escaneamento...</div>
        <div class="instructions">
          <h3>Como conectar:</h3>
          <ol>
            <li>Abra <strong>WhatsApp</strong> no seu celular</li>
            <li>Vá em <strong>Configurações → Dispositivos Vinculados</strong></li>
            <li>Clique em <strong>Vincular um Dispositivo</strong></li>
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
            }
          } catch (error) {
            console.error('Erro:', error)
          }
        }

        loadQRCode()
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
// MESSAGES & JOBS
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

    // Enviar via job queue
    const jobId = await jobsService.sendMessage(chatId, text)

    // Tentar envio direto também
    try {
      const result = await whatsappState.client.sendMessage(chatId, text)
      metrics.messagesSent++

      // Cache
      await cacheService.setConversation(chatId, {
        lastMessage: text,
        timestamp: Date.now(),
      })

      return {
        success: true,
        chatId,
        message: text,
        messageId: result.id,
        jobId,
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err)
      throw err
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.get('/jobs/:queue/:jobId', async (request, reply) => {
  metrics.requests++
  const { queue, jobId } = request.params

  const status = await jobsService.getJobStatus(queue, jobId)
  if (!status) {
    return reply.code(404).send({ error: 'Job not found' })
  }

  return status
})

fastify.get('/jobs/stats', async (request, reply) => {
  metrics.requests++
  return await jobsService.getAllQueueStats()
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
    cache: cacheService.getStatus(),
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
// ROOT
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/', async (request, reply) => {
  metrics.requests++

  return {
    name: 'APS EDU WhatsApp CRM',
    version: '2.0.0',
    parte: 'PARTE 1 + PARTE 2',
    library: 'whatsapp-web.js + Redis + BullMQ',
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
      jobs: '/jobs/stats',
      cache: '/health/cache',
    },
  }
})

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

const start = async () => {
  try {
    const PORT = process.env.PORT || 3000
    const HOST = process.env.HOST || '0.0.0.0'

    // Inicializar serviços
    console.log('📦 Inicializando serviços da PARTE 2...')
    await cacheService.initialize()
    await jobsService.initialize()
    pollingService.cleanupDeduplication()

    // Inicializar WhatsApp
    console.log('📱 Inicializando WhatsApp...')
    await initializeClient()

    // Health check
    startHealthCheck()

    await fastify.listen({ port: PORT, host: HOST })

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log('  🚀 APS EDU - WhatsApp CRM')
    console.log('  Versão 2.0 (PARTE 1 + PARTE 2)')
    console.log('═══════════════════════════════════════════════════')
    console.log('')
    console.log('📍 Acessos:')
    console.log(`  • Dashboard:  http://localhost:${PORT}/dashboard-ui`)
    console.log(`  • QR Code:    http://localhost:${PORT}/whatsapp/qr-html`)
    console.log(`  • Health:     http://localhost:${PORT}/health`)
    console.log(`  • API Root:   http://localhost:${PORT}`)
    console.log('')
    console.log('📦 Serviços:')
    console.log('  ✅ Cache (Redis/Memory)')
    console.log('  ✅ Jobs (BullMQ)')
    console.log('  ✅ Polling (SSE Fallback)')
    console.log('  ✅ Sync')
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
