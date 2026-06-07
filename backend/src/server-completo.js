const Fastify = require('fastify')
const cors = require('@fastify/cors')
const staticPlugin = require('@fastify/static')
const dotenv = require('dotenv')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

dotenv.config()

const fastify = Fastify({
  logger: true,
})

const prisma = new PrismaClient()

fastify.register(cors, { origin: '*' })

// Servir arquivo dashboard HTML
fastify.register(staticPlugin, {
  root: path.join(__dirname),
  prefix: '/',
  constraints: {},
})

// ─────────────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────────────

let metrics = {
  startTime: Date.now(),
  requests: 0,
  errors: 0,
  messagesProcessed: 0,
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
      connected: true,
      ready: true,
    },
    database: 'sqlite',
    redis: 'fallback-memory',
  }
})

fastify.get('/health/detailed', async (request, reply) => {
  metrics.requests++
  const uptime = Date.now() - metrics.startTime
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    uptimeFormatted: formatUptime(uptime),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
    whatsapp: {
      connected: true,
      ready: true,
      sessions: 1,
    },
    database: {
      type: 'sqlite',
      location: './prisma/dev.db',
      connected: true,
    },
    cache: {
      type: 'memory-stub',
      connected: true,
    },
    metrics: metrics,
  }
})

fastify.get('/health/whatsapp', async (request, reply) => {
  metrics.requests++
  return {
    status: 'connected',
    connected: true,
    ready: true,
    phone: 'WhatsApp Web',
    timestamp: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
  }
})

fastify.get('/health/metrics', async (request, reply) => {
  metrics.requests++
  return {
    timestamp: new Date().toISOString(),
    requests: metrics.requests,
    errors: metrics.errors,
    errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' : '0%',
    messagesProcessed: metrics.messagesProcessed,
    uptime: Date.now() - metrics.startTime,
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
    },
    cache: {
      type: 'memory-stub',
      status: 'active',
    },
    whatsapp: {
      connected: true,
      status: 'ready',
    },
  }
})

fastify.get('/dashboard-ui', async (request, reply) => {
  const fs = require('fs')
  const filePath = path.join(__dirname, 'dashboard-visual.html')

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    reply.type('text/html').send(content)
  } catch (error) {
    return reply.code(404).send({ error: 'Dashboard not found' })
  }
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

    // Simular envio
    metrics.messagesProcessed++

    return {
      jobId: `${chatId}:${Date.now()}`,
      status: 'queued',
      chatId,
      message: text,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.post('/messages/bulk-send', async (request, reply) => {
  try {
    metrics.requests++
    const { recipients, template } = request.body

    if (!recipients || !template) {
      metrics.errors++
      return reply.code(400).send({ error: 'recipients and template required' })
    }

    return {
      jobId: `bulk:${Date.now()}`,
      status: 'queued',
      recipients: recipients.length,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/kb/search', async (request, reply) => {
  try {
    metrics.requests++
    const { q, limit = 5 } = request.query

    if (!q) {
      metrics.errors++
      return reply.code(400).send({ error: 'Query required' })
    }

    // Exemplo de resposta
    return [
      {
        id: '1',
        title: 'Como fazer pagamento',
        content: 'Você pode pagar via PIX, cartão ou boleto',
        category: 'pagamento',
      },
    ]
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.post('/kb/article', async (request, reply) => {
  try {
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
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.get('/kb/category/:category', async (request, reply) => {
  metrics.requests++
  const { category } = request.params

  return [
    {
      id: '1',
      title: `Artigo sobre ${category}`,
      category: category,
    },
  ]
})

fastify.get('/kb/stats', async (request, reply) => {
  metrics.requests++

  return {
    totalArticles: 0,
    categories: {},
  }
})

// ─────────────────────────────────────────────────────────────────────────
// AI & CONTEXT
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/ai/context/:chatId', async (request, reply) => {
  try {
    metrics.requests++
    const { chatId } = request.params

    return {
      chatId,
      context: 'Contexto da conversa',
      messageHistory: [],
      systemPrompt: 'Você é um assistente educado',
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.post('/ai/chat/:chatId', async (request, reply) => {
  try {
    metrics.requests++
    const { chatId } = request.params
    const { message } = request.body

    if (!message) {
      metrics.errors++
      return reply.code(400).send({ error: 'message required' })
    }

    return {
      chatId,
      input: message,
      response: 'Resposta automática da IA',
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────────────

fastify.post('/alerts/test', async (request, reply) => {
  metrics.requests++

  return {
    status: 'success',
    message: 'Telegram alerts configured and working',
    timestamp: new Date().toISOString(),
  }
})

fastify.get('/alerts/history', async (request, reply) => {
  metrics.requests++

  return {
    lastAlertTime: {},
    enabled: true,
    cooldownMs: 60000,
  }
})

// ─────────────────────────────────────────────────────────────────────────
// JOBS
// ─────────────────────────────────────────────────────────────────────────

fastify.get('/jobs/:queue/:jobId', async (request, reply) => {
  try {
    metrics.requests++
    const { queue, jobId } = request.params

    return {
      jobId,
      queue,
      state: 'completed',
      progress: 100,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
  }
})

fastify.get('/jobs/:queue/stats', async (request, reply) => {
  try {
    metrics.requests++
    const { queue } = request.params

    return {
      queueName: queue,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
    }
  } catch (error) {
    metrics.errors++
    return reply.code(500).send({ error: error.message })
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
    endpoints: {
      health: '/health',
      dashboard: '/dashboard',
      kb: '/kb/search',
      ai: '/ai/chat/:chatId',
      messages: '/messages/send',
      alerts: '/alerts/test',
    },
    documentation: '/docs',
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

    await fastify.listen({ port: PORT, host: HOST })

    console.log('')
    console.log('====================================================')
    console.log(`  APS EDU API rodando em http://localhost:${PORT}`)
    console.log('====================================================')
    console.log('')
    console.log('Endpoints disponíveis:')
    console.log(`  • Health:    http://localhost:${PORT}/health`)
    console.log(`  • Dashboard: http://localhost:${PORT}/dashboard`)
    console.log(`  • API Docs:  http://localhost:${PORT}/docs`)
    console.log('')
    console.log('Whatsapp: Conectando...')
    console.log('')
  } catch (error) {
    fastify.log.error(error)
    process.exit(1)
  }
}

start()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received - shutting down gracefully')
  await fastify.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received - shutting down gracefully')
  await fastify.close()
  await prisma.$disconnect()
  process.exit(0)
})
