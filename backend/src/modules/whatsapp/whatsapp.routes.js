const { authenticate } = require('../../shared/middleware/auth.middleware')
const whatsappService = require('./whatsapp.service')

module.exports = async function (fastify) {
  fastify.get('/status', { preHandler: [authenticate] }, async () => whatsappService.getState())

  fastify.post('/start', { preHandler: [authenticate] }, async () => whatsappService.start())

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
