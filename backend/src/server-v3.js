const Fastify = require('fastify')
const cors = require('@fastify/cors')
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode')

// PARTE 1 & 2 Services
const cacheService = require('./services/cache.service')
const jobsService = require('./services/jobs.service')
const pollingService = require('./services/polling.service')
const syncService = require('./services/sync.service')

// PARTE 3 Services
const aiContextService = require('./services/ai-context.service')
const knowledgeBaseService = require('./services/knowledge-base.service')
const guardrailsService = require('./services/ai-guardrails.service')
const fallbackService = require('./services/ai-fallback.service')
const monitoringService = require('./services/monitoring.service')
const alertsService = require('./services/alerts.service')

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
      alertsService.sendAlert('Circuit Breaker Ativado', 'Muitas falhas consecutivas', 'CRITICAL')
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
    await alertsService.alertConnectionFailure('Máximo de tentativas de reconexão atingido')
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

    client.on('ready', async () => {
      console.log('✅ WhatsApp conectado!')
      whatsappState.connected = true
      whatsappState.ready = true
      whatsappState.qrCode = null
      whatsappState.qrCodeDataURL = null
      whatsappState.reconnectAttempt = 0
      circuitBreaker.recordSuccess()
      metrics.reconnectCount = 0
      await alertsService.alertConnectionRecovered()
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
      monitoringService.recordMessage('received')

      // Guardrails: validar input
      const validation = guardrailsService.validateInput(message.body)
      if (!validation.valid) {
        console.warn(`⚠️ Mensagem bloqueada: ${validation.reason}`)
        return
      }

      // Cache conversa
      await cacheService.setConversation(message.from, {
        lastMessage: message.body,
        timestamp: Date.now(),
      })

      // Salvar contexto
      await aiContextService.saveMessage(message.from, message.body, message.from)

      try {
        // Tentar resposta com IA (seria chamado aqui em produção)
        // Por agora, usar fallback
        let response = fallbackService.getFallbackResponse('inbox')

        // Sanitizar output
        response = guardrailsService.validateOutput(response)

        await message.reply(response)
        metrics.messagesSent++
        monitoringService.recordMessage('sent')
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

      // Alertar se taxa de erro alta
      const metrics_obj = monitoringService.getMetrics()
      if (parseFloat(metrics_obj.errorRate) > 5) {
        alertsService.alertHighErrorRate(parseFloat(metrics_obj.errorRate))
      }
    }
  }, 30000)
}

// ─────────────────────────────────────────────────────────────────────────
// HEALTH ROUTES
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/health', async (request, reply) => {
  metrics.requests++
  monitoringService.recordRequest('/health', 200, 1)
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
  monitoringService.recordRequest('/health/whatsapp', 200, 1)
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

// ─────────────────────────────────────────────────────────────────────────
// PARTE 2 ROUTES
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/health/cache', async (request, reply) => {
  metrics.requests++
  return cacheService.getStatus()
})

fastify.get('/health/jobs', async (request, reply) => {
  metrics.requests++
  return await jobsService.getAllQueueStats()
})

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

    // Validar com guardrails
    const validation = guardrailsService.validateInput(text)
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.reason })
    }

    const result = await whatsappState.client.sendMessage(chatId, text)
    metrics.messagesSent++
    monitoringService.recordMessage('sent')

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
// PARTE 3 ROUTES
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/ai/kb/search', async (request, reply) => {
  metrics.requests++
  const { q } = request.query

  if (!q) {
    return reply.code(400).send({ error: 'Query required' })
  }

  const results = knowledgeBaseService.searchByKeyword(q)
  return { query: q, results, count: results.length }
})

fastify.get('/ai/kb/stats', async (request, reply) => {
  metrics.requests++
  return knowledgeBaseService.getStats()
})

fastify.post('/ai/chat', async (request, reply) => {
  try {
    metrics.requests++
    const { chatId, message } = request.body

    if (!chatId || !message) {
      return reply.code(400).send({ error: 'chatId and message required' })
    }

    // Validar input
    const validation = guardrailsService.validateInput(message)
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.reason })
    }

    // Registrar request de IA
    const startTime = Date.now()

    try {
      // Em produção, chamaria aqui a OpenAI/Claude
      // Por agora, usar fallback
      const response = fallbackService.getFallbackResponse('inbox')
      const sanitized = guardrailsService.validateOutput(response)

      const duration = Date.now() - startTime
      monitoringService.recordAIRequest(true, duration, message.length, sanitized.length)

      return {
        success: true,
        chatId,
        input: message,
        response: sanitized,
        source: 'fallback',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const duration = Date.now() - startTime
      monitoringService.recordAIRequest(false, duration, message.length, 0)
      await alertsService.alertAIFailure(error)

      return reply.code(500).send({ error: 'AI service unavailable' })
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.get('/monitoring/metrics', async (request, reply) => {
  metrics.requests++
  return monitoringService.getMetrics()
})

fastify.get('/monitoring/events', async (request, reply) => {
  metrics.requests++
  const { limit = 100 } = request.query
  return { events: monitoringService.getEvents(parseInt(limit)) }
})

fastify.post('/alerts/test', async (request, reply) => {
  metrics.requests++
  const result = await alertsService.sendAlert('Test Alert', 'Sistema funcionando normalmente', 'INFO')
  return { success: result, message: 'Alert sent' }
})

// ─────────────────────────────────────────────────────────────────────────
// QR CODE ROUTE
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
      <title>APS EDU - WhatsApp CRM</title>
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
        .badge { display: inline-block; background: #d4edda; color: #155724; padding: 8px 12px; border-radius: 20px; font-size: 0.9em; margin-bottom: 20px; font-weight: 600; }
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
        <h1>📱 APS EDU WhatsApp CRM</h1>
        <div class="badge">Versão 3.0 - COMPLETA</div>
        <p>Escaneie o QR code com seu celular</p>
        <div id="qr-container">
          <div id="qr-image">Gerando QR code...</div>
        </div>
        <div class="instructions">
          <h3>Como conectar:</h3>
          <ol>
            <li>Abra <strong>WhatsApp</strong> no seu celular</li>
            <li>Vá em <strong>Configurações → Dispositivos Vinculados</strong></li>
            <li>Clique em <strong>Vincular um Dispositivo</strong></li>
            <li>Aponte a câmera para o QR code</li>
            <li>Pronto! ✅</li>
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

        loadQRCode()
        setInterval(loadQRCode, 2000)
      </script>
    </body>
    </html>
  `

  reply.type('text/html').send(html)
})

// ─────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/dashboard', async (request, reply) => {
  metrics.requests++
  const uptime = Date.now() - metrics.startTime
  const monitoringMetrics = monitoringService.getMetrics()

  return {
    system: {
      uptime: monitoringMetrics.uptime,
      timestamp: new Date().toISOString(),
    },
    requests: {
      total: monitoringMetrics.requests,
      errors: monitoringMetrics.errors,
      errorRate: monitoringMetrics.errorRate,
    },
    messages: {
      processed: monitoringMetrics.messages.received,
      sent: monitoringMetrics.messages.sent,
    },
    cache: cacheService.getStatus(),
    ai: monitoringMetrics.ai,
    whatsapp: {
      connected: whatsappState.connected,
      ready: whatsappState.ready,
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
// CHAT PANEL (NOVO!)
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/chat', async (request, reply) => {
  const filePath = path.join(__dirname, 'chat-panel.html')
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    reply.type('text/html').send(content)
  } catch (error) {
    return reply.code(404).send({ error: 'Chat panel not found' })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/', async (request, reply) => {
  metrics.requests++

  return {
    name: 'APS EDU WhatsApp CRM',
    version: '3.0.0',
    partes: 'PARTE 1 (Estabilidade) + PARTE 2 (Performance) + PARTE 3 (IA)',
    status: 'running',
    features: [
      '✅ WhatsApp Integration (whatsapp-web.js)',
      '✅ Exponential Backoff & Circuit Breaker',
      '✅ Redis Cache (Memory Fallback)',
      '✅ BullMQ Job Queues',
      '✅ AI Context & Knowledge Base',
      '✅ Input/Output Guardrails',
      '✅ Real-time Monitoring',
      '✅ Alert System',
    ],
    whatsapp: {
      connected: whatsappState.connected,
      ready: whatsappState.ready,
    },
    endpoints: {
      health: '/health',
      dashboard: '/dashboard-ui',
      qr: '/whatsapp/qr-html',
      messages: '/messages/send',
      ai: '/ai/chat',
      kb: '/ai/kb/search',
      monitoring: '/monitoring/metrics',
    },
  }
})

const start = async () => {
  try {
    const PORT = process.env.PORT || 3000
    const HOST = process.env.HOST || '0.0.0.0'

    console.log('📦 Inicializando todos os serviços...')
    await cacheService.initialize()
    await jobsService.initialize()
    pollingService.cleanupDeduplication()

    console.log('📱 Inicializando WhatsApp...')
    await initializeClient()

    startHealthCheck()

    await fastify.listen({ port: PORT, host: HOST })

    console.log('')
    console.log('════════════════════════════════════════════════════')
    console.log('  🚀 APS EDU - WhatsApp CRM')
    console.log('  Versão 3.0 (COMPLETA - PARTE 1 + 2 + 3)')
    console.log('════════════════════════════════════════════════════')
    console.log('')
    console.log('📍 Acessos:')
    console.log(`  • Chat Panel: http://localhost:${PORT}/chat`)
    console.log(`  • Dashboard:  http://localhost:${PORT}/dashboard-ui`)
    console.log(`  • QR Code:    http://localhost:${PORT}/whatsapp/qr-html`)
    console.log(`  • API:        http://localhost:${PORT}`)
    console.log('')
    console.log('📦 Serviços Ativos:')
    console.log('  ✅ Cache (Redis/Memory)')
    console.log('  ✅ Jobs (BullMQ)')
    console.log('  ✅ Polling (SSE Fallback)')
    console.log('  ✅ Sync (Auto)')
    console.log('  ✅ AI Context & Knowledge Base')
    console.log('  ✅ Guardrails & Fallback')
    console.log('  ✅ Monitoring & Alerts')
    console.log('')
    console.log('════════════════════════════════════════════════════')
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
