const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')

module.exports = async function (fastify) {
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const units = await prisma.unit.findMany({ orderBy: { name: 'asc' } })
    return reply.send(units)
  })

  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Sem permissão' })
    }
    const { name, city, type, region } = request.body
    const unit = await prisma.unit.create({ data: { name, city, type: type || 'school', region } })
    return reply.code(201).send(unit)
  })

  fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Sem permissão' })
    }
    const { name, city, type, region } = request.body
    const unit = await prisma.unit.update({
      where: { id: request.params.id },
      data: { ...(name && { name }), ...(city && { city }), ...(type && { type }), ...(region !== undefined && { region }) }
    })
    return reply.send(unit)
  })
}
