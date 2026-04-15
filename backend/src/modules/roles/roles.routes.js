const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')

module.exports = async function (fastify) {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
    return reply.send(roles)
  })
}
