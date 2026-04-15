const bcrypt = require('bcryptjs')
const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')

module.exports = async function (fastify) {
  // GET /api/users
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { unitId, roleId, search, page = 1, limit = 50 } = request.query
    const user = request.currentUser
    const isAdmin = ['admin', 'director'].includes(user.role.slug)

    const where = {
      isActive: true,
      ...(isAdmin ? {} : { unitId: user.unitId }),
      ...(unitId && isAdmin ? { unitId } : {}),
      ...(roleId ? { roleId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {})
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        role: { select: { id: true, name: true, slug: true } },
        unit: { select: { id: true, name: true, city: true } },
        userPoints: { select: { points: true, tasksCompleted: true } },
        createdAt: true
      },
      orderBy: { name: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    })

    return reply.send(users)
  })

  // GET /api/users/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true, isActive: true,
        role: { select: { id: true, name: true, slug: true, permissions: true } },
        unit: { select: { id: true, name: true, city: true, type: true } },
        userPoints: true,
        userBadges: { include: { badge: true }, orderBy: { earnedAt: 'desc' }, take: 10 },
        createdAt: true
      }
    })
    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado' })
    return reply.send(user)
  })

  // POST /api/users — Criar usuário (admin)
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Apenas administradores podem criar usuários' })
    }

    const { name, email, password, phone, roleId, unitId } = request.body
    if (!name || !email || !password || !roleId || !unitId) {
      return reply.code(400).send({ error: 'Campos obrigatórios: name, email, password, roleId, unitId' })
    }

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (exists) return reply.code(409).send({ error: 'Email já cadastrado' })

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash, phone, roleId, unitId },
      select: {
        id: true, name: true, email: true, phone: true,
        role: { select: { name: true, slug: true } },
        unit: { select: { name: true } }
      }
    })

    return reply.code(201).send(user)
  })

  // PUT /api/users/:id
  fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const requestUser = request.currentUser
    const isAdmin = ['admin'].includes(requestUser.role.slug)
    const isSelf = requestUser.id === request.params.id

    if (!isAdmin && !isSelf) return reply.code(403).send({ error: 'Sem permissão' })

    const { name, phone, avatarUrl, roleId, unitId, isActive } = request.body

    const data = {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(isAdmin && roleId ? { roleId } : {}),
      ...(isAdmin && unitId ? { unitId } : {}),
      ...(isAdmin && isActive !== undefined ? { isActive } : {})
    }

    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data,
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        role: { select: { name: true, slug: true } },
        unit: { select: { name: true } }
      }
    })

    return reply.send(updated)
  })

  // PUT /api/users/:id/change-password
  fastify.put('/:id/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.currentUser.id !== request.params.id) {
      return reply.code(403).send({ error: 'Você só pode alterar sua própria senha' })
    }

    const { currentPassword, newPassword } = request.body
    const user = await prisma.user.findUnique({ where: { id: request.params.id } })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return reply.code(400).send({ error: 'Senha atual incorreta' })

    await prisma.user.update({
      where: { id: request.params.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) }
    })

    return reply.send({ message: 'Senha alterada com sucesso' })
  })
}
