require('dotenv').config()
const path = require('path')
const fs = require('fs')
const fastify = require('fastify')({ logger: true })

// Garante que a pasta de uploads existe ao iniciar
const uploadsDir = path.join(process.cwd(), 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })

// Plugins
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || '*',
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

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' })
    console.log(`\n🚀 APS EDU API rodando em http://localhost:${process.env.PORT || 3000}`)
    console.log(`📚 Documentação em http://localhost:${process.env.PORT || 3000}/docs\n`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
