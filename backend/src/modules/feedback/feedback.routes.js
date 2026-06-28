const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')

module.exports = async function (fastify) {
  // POST /api/feedback
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { category, content, isAnonymous } = request.body

    if (!category || !content) {
      return reply.code(400).send({ error: 'Categoria e conteúdo são obrigatórios' })
    }

    const feedback = await prisma.feedback.create({
      data: {
        category,
        content,
        isAnonymous: isAnonymous || false,
        userId: isAnonymous ? null : request.currentUser.id,
        status: 'pending'
      }
    })

    return reply.code(201).send({ message: 'Feedback enviado com sucesso!', id: feedback.id })
  })

  // GET /api/feedback — Apenas admins
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin', 'director'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Acesso negado' })
    }

    const { status, category, page = 1, limit = 20 } = request.query
    const where = {}
    if (status) where.status = status
    if (category) where.category = category

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: { select: { name: true } }, unit: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.feedback.count({ where })
    ])

    return reply.send({
      feedbacks: feedbacks.map(f => ({
        ...f,
        user: f.isAnonymous ? null : f.user
      })),
      total
    })
  })

  // PUT /api/feedback/:id — Admin responde/muda status
  fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin', 'director'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Acesso negado' })
    }

    const { status, response } = request.body
    const updated = await prisma.feedback.update({
      where: { id: request.params.id },
      data: {
        ...(status && { status }),
        ...(response !== undefined && { response })
      }
    })

    return reply.send(updated)
  })
}
