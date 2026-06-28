const { authenticate } = require('../../shared/middleware/auth.middleware')
const { createCalendarEvent, listCalendarEvents } = require('../integrations/integrations.service')

module.exports = async function (fastify) {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const from = request.query.from || new Date().toISOString()
    const to = request.query.to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    try {
      return { events: await listCalendarEvents(request.currentUser.id, from, to) }
    } catch (error) {
      return reply.code(400).send({ error: error.message })
    }
  })

  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return reply.code(201).send(await createCalendarEvent(request.currentUser.id, request.body || {}))
    } catch (error) {
      return reply.code(400).send({ error: error.message })
    }
  })
}
