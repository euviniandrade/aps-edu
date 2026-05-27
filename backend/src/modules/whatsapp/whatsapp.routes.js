const { authenticate } = require('../../shared/middleware/auth.middleware')
const whatsappService = require('./whatsapp.service')

module.exports = async function (fastify) {
  fastify.get('/status', { preHandler: [authenticate] }, async () => whatsappService.getState())

  fastify.post('/start', { preHandler: [authenticate] }, async () => whatsappService.start())

  fastify.post('/automation', { preHandler: [authenticate] }, async (request) => {
    return whatsappService.updateAutomation(request.body || {})
  })

  fastify.post('/training', { preHandler: [authenticate] }, async (request) => {
    return whatsappService.addTraining(request.body?.text)
  })

  fastify.post('/handoff', { preHandler: [authenticate] }, async (request) => {
    return whatsappService.handoff(request.body?.chatId)
  })

  fastify.post('/resume-auto', { preHandler: [authenticate] }, async () => {
    return whatsappService.resumeAuto()
  })

  fastify.get('/chats', { preHandler: [authenticate] }, async (request) => {
    const { limit = 30 } = request.query
    return whatsappService.listChats(limit)
  })

  fastify.get('/messages', { preHandler: [authenticate] }, async (request) => {
    const { chatId, limit = 50 } = request.query
    if (!chatId) return []
    return whatsappService.getMessages(chatId, Number(limit))
  })

  fastify.post('/send', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const result = await whatsappService.sendMessage(request.body || {})
      return reply.send(result)
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message })
    }
  })

  // SSE — eventos em tempo real (estado + mensagens recebidas)
  fastify.get('/events', { preHandler: [authenticate] }, async (request, reply) => {
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (event, data) => {
      try {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {}
    }

    // Estado inicial imediato
    send('state', whatsappService.getState())

    const onMessage = (data) => send('message', data)
    const onState = (data) => send('state', data)

    whatsappService.emitter.on('message', onMessage)
    whatsappService.emitter.on('state', onState)

    const keepalive = setInterval(() => {
      try { raw.write(': keepalive\n\n') } catch {}
    }, 25000)

    await new Promise((resolve) => {
      request.raw.on('close', resolve)
      request.raw.on('error', resolve)
    })

    clearInterval(keepalive)
    whatsappService.emitter.off('message', onMessage)
    whatsappService.emitter.off('state', onState)
  })
}
