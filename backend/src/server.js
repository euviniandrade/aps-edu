require('dotenv').config()
const path = require('path')
const fs = require('fs')
const fastify = require('fastify')({ logger: true })
const whatsappService = require('./modules/whatsapp/whatsapp.service')
const whatsappSync = require('./modules/whatsapp/whatsapp-sync.service')

// Garante que a pasta de uploads existe ao iniciar
const uploadsDir = path.join(process.cwd(), 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

// Plugins
fastify.register(require('@fastify/cors'), {
  origin: (origin, cb) => cb(null, true),
  credentials: true
})

fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET
})

fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
})

// Servir arquivos enviados pelos usuários (fotos, documentos)
fastify.register(require('@fastify/static'), {
  root: uploadsDir,
  prefix: '/uploads/',
  decorateReply: false,
})

// Swagger docs
fastify.register(require('@fastify/swagger'), {
  openapi: {
    info: { title: 'APS EDU API', version: '1.0.0' }
  }
})
fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs'
})

// Routes
fastify.register(require('./modules/auth/auth.routes'), { prefix: '/api/auth' })
fastify.register(require('./modules/users/users.routes'), { prefix: '/api/users' })
fastify.register(require('./modules/tasks/tasks.routes'), { prefix: '/api/tasks' })
fastify.register(require('./modules/events/events.routes'), { prefix: '/api/events' })
fastify.register(require('./modules/announcements/announcements.routes'), { prefix: '/api/announcements' })
fastify.register(require('./modules/gamification/gamification.routes'), { prefix: '/api/gamification' })
fastify.register(require('./modules/notifications/notifications.routes'), { prefix: '/api/notifications' })
fastify.register(require('./modules/reports/reports.routes'), { prefix: '/api/reports' })
fastify.register(require('./modules/feedback/feedback.routes'), { prefix: '/api/feedback' })
fastify.register(require('./modules/roles/roles.routes'), { prefix: '/api/roles' })
fastify.register(require('./modules/units/units.routes'), { prefix: '/api/units' })
fastify.register(require('./modules/ai/ai.routes'), { prefix: '/api/ai' })
fastify.register(require('./modules/whatsapp/whatsapp.routes'), { prefix: '/api/whatsapp' })

// Servir CRM HTML
fastify.get('/crm', async (request, reply) => {
  const crmPath = path.join(__dirname, 'crm.html')
  const crmHtml = fs.readFileSync(crmPath, 'utf-8')

  // Se temos QR code, injeta diretamente no HTML
  const state = whatsappService.getState()
  let html = crmHtml

  if (state.qrDataUrl) {
    // Substitui a src vazia pela data URL do QR code
    html = html.replace(
      'id="qrImg" src=""',
      `id="qrImg" src="${state.qrDataUrl}"`
    )
  }

  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate')
  reply.header('Pragma', 'no-cache')
  reply.type('text/html')
  return html
})

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })
    if (process.env.WHATSAPP_ENABLED === 'true') {
      whatsappService.start().catch(err => fastify.log.error(err, 'Erro ao iniciar WhatsApp'))
    }
    console.log(`\n🚀 APS EDU API rodando em http://localhost:${process.env.PORT || 3000}`)
    console.log(`📚 Documentação em http://localhost:${process.env.PORT || 3000}/docs\n`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
