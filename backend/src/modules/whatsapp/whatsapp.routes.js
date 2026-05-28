const whatsappService = require('./whatsapp.service')

// Autenticação via API Key compartilhada (Vercel → Oracle VM).
// Não depende de JWT nem de banco de dados.
const WA_KEY = process.env.WHATSAPP_API_KEY

async function apiKeyAuth(request, reply) {
  if (!WA_KEY) return // Se não configurado, permite (modo dev)
  const key = request.headers['x-wa-key']
  if (key !== WA_KEY) {
    return reply.code(401).send({ error: 'Não autorizado' })
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

  fastify.get('/status', { preHandler: [apiKeyAuth] }, async () => whatsappService.getState())

  fastify.post('/start', { preHandler: [apiKeyAuth] }, async () => whatsappService.start())

  fastify.post('/automation', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.updateAutomation(request.body || {})
  })

  fastify.post('/training', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.addTraining(request.body?.text)
  })

  fastify.post('/handoff', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.handoff(request.body?.chatId)
  })

  fastify.post('/resume-auto', { preHandler: [apiKeyAuth] }, async () => {
    return whatsappService.resumeAuto()
  })

  fastify.get('/chats', { preHandler: [apiKeyAuth] }, async (request) => {
    const { limit = 30 } = request.query
    return whatsappService.listChats(limit)
  })

  fastify.get('/messages', { preHandler: [apiKeyAuth] }, async (request) => {
    const { chatId, limit = 50 } = request.query
    if (!chatId) return []
    return whatsappService.getMessages(chatId, Number(limit))
  })

  fastify.post('/send', { preHandler: [apiKeyAuth] }, async (request, reply) => {
    try {
      const result = await whatsappService.sendMessage(request.body || {})
      return reply.send(result)
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message })
    }
  })

  // CRM — lista todos os contatos com dados CRM
  fastify.get('/contacts', { preHandler: [apiKeyAuth] }, async () => {
    return whatsappService.listCrmContacts()
  })

  // Catálogo completo — todos os contatos do celular + quem conversou
  fastify.get('/phonebook', { preHandler: [apiKeyAuth] }, async () => {
    return whatsappService.listPhonebook()
  })

  // CRM — busca dados de um contato específico
  fastify.get('/crm/:chatId', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.getCrm(request.params.chatId)
  })

  // CRM — salva/atualiza dados de um contato (stage, tags, score, notes)
  fastify.post('/crm/:chatId', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.saveCrm(request.params.chatId, request.body || {})
  })

  // SSE — eventos em tempo real (estado + mensagens recebidas)
  fastify.get('/events', { preHandler: [apiKeyAuth] }, async (request, reply) => {
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
