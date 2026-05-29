/**
 * Servidor WhatsApp standalone — roda localmente no Windows.
 * Não precisa de banco de dados, Redis ou JWT.
 * Autenticação via API Key (header X-WA-Key).
 */
require('dotenv').config({ path: '.env.local' })

const path   = require('path')
const fastify = require('fastify')({ logger: false })

// CORS — aceita chamadas do Vercel e localhost
fastify.register(require('@fastify/cors'), {
  origin: (origin, cb) => cb(null, true),
  credentials: true,
})

// Rotas WhatsApp em /api/whatsapp/*
fastify.register(require('./src/modules/whatsapp/whatsapp.routes'), {
  prefix: '/api/whatsapp',
})

// Health check simples
fastify.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }))

const PORT = Number(process.env.PORT) || 3000

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) { console.error(err); process.exit(1) }
  console.log('')
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   🤖 APS-EDU WhatsApp Server — RODANDO       ║')
  console.log(`║   Local: http://localhost:${PORT}                ║`)
  console.log('║   Escaneie o QR no terminal ou no painel     ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')

  // Inicia WhatsApp automaticamente ao subir
  const whatsappService = require('./src/modules/whatsapp/whatsapp.service')
  whatsappService.start().catch(err => console.error('[WhatsApp] Erro ao iniciar:', err.message))
})
