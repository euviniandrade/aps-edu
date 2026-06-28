const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const notificationService = require('./notifications.service')

module.exports = async function (fastify) {
  // GET /api/notifications
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { page = 1, limit = 30, unreadOnly } = request.query
    const userId = request.currentUser.id

    const where = { userId, ...(unreadOnly === 'true' ? { isRead: false } : {}) }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } })
    ])

    return reply.send({ notifications, total, unreadCount, page: Number(page) })
  })

  // PUT /api/notifications/:id/read
  fastify.put('/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    await notificationService.markRead(request.params.id, request.currentUser.id)
    return reply.send({ message: 'Notificação marcada como lida' })
  })

  // PUT /api/notifications/read-all
  fastify.put('/read-all', { preHandler: [authenticate] }, async (request, reply) => {
    await notificationService.markAllRead(request.currentUser.id)
    return reply.send({ message: 'Todas as notificações marcadas como lidas' })
  })
}
