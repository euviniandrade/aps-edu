const whatsappService = require('./whatsapp.service')

// Autenticação leve: verifica apenas assinatura JWT, sem acesso ao banco.
// Necessário porque o banco de dados pode não estar disponível nesta VM.
async function jwtOnly(request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.code(401).send({ error: 'Token inválido ou expirado' })
  }
}

module.exports = async function (fastify) {
  // Endpoint público — retorna QR como imagem PNG sem cache
  fastify.get('/qr', async (request, reply) => {
    const st = whatsappService.getState()
    if (!st.qrDataUrl) {
      return reply.code(404).send({ error: 'QR não disponível. WhatsApp já conectado ou ainda iniciando.' })
    }
    const base64 = st.qrDataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .header('Pragma', 'no-cache')
      .send(buffer)
  })

  fastify.get('/status', { preHandler: [jwtOnly] }, async () => whatsappService.getState())

  fastify.post('/start', { preHandler: [jwtOnly] }, async () => whatsappService.start())

  fastify.post('/automation', { preHandler: [jwtOnly] }, async (request) => {
    return whatsappService.updateAutomation(request.body || {})
  })

  fastify.post('/training', { preHandler: [jwtOnly] }, async (request) => {
    return whatsappService.addTraining(request.body?.text)
  })

  fastify.post('/handoff', { preHandler: [jwtOnly] }, async (request) => {
    return whatsappService.handoff(request.body?.chatId)
  })

  fastify.post('/resume-auto', { preHandler: [jwtOnly] }, async () => {
    return whatsappService.resumeAuto()
  })

  fastify.get('/chats', { preHandler: [jwtOnly] }, async (request) => {
    const { limit = 30 } = request.query
    return whatsappService.listChats(limit)
  })

  fastify.get('/messages', { preHandler: [jwtOnly] }, async (request) => {
    const { chatId, limit = 50 } = request.query
    if (!chatId) return []
    return whatsappService.getMessages(chatId, Number(limit))
  })

  fastify.post('/send', { preHandler: [jwtOnly] }, async (request, reply) => {
    try {
      const result = await whatsappService.sendMessage(request.body || {})
      return reply.send(result)
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message })
    }
  })

  // SSE — eventos em tempo real (estado + mensagens recebidas)
  fastify.get('/events', { preHandler: [jwtOnly] }, async (request, reply) => {
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
