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

  fastify.post('/send', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const result = await whatsappService.sendMessage(request.body || {})
      return reply.send(result)
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message })
    }
  })
}
