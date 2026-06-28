const { authenticate } = require('../../shared/middleware/auth.middleware')
const { createDriveFolder } = require('../integrations/integrations.service')

module.exports = async function (fastify) {
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      return reply.code(201).send(await createDriveFolder(request.currentUser.id, request.body || {}))
    } catch (error) {
      return reply.code(400).send({ error: error.message })
    }
  })
}
