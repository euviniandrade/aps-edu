const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const gamificationService = require('../gamification/gamification.service')
const notificationService = require('../notifications/notifications.service')

module.exports = async function (fastify) {
  // GET /api/announcements
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { page = 1, limit = 20, type } = request.query

    const now = new Date()

    const announcements = await prisma.announcement.findMany({
      where: {
        publishAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ],
        AND: [
          {
            OR: [
              { targetRoles: { none: {} } },
              { targetRoles: { some: { roleId: user.roleId } } }
            ]
          },
          {
            OR: [
              { targetUnits: { none: {} } },
              { targetUnits: { some: { unitId: user.unitId } } }
            ]
          }
        ],
        ...(type && { type })
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        reads: { where: { userId: user.id }, select: { readAt: true } },
        _count: { select: { reads: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    })

    return reply.send(announcements.map(a => ({
      ...a,
      isRead: a.reads.length > 0,
      readAt: a.reads[0]?.readAt || null,
      totalReads: a._count.reads
    })))
  })

  // POST /api/announcements
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    if (!['admin', 'director'].includes(user.role.slug)) {
      return reply.code(403).send({ error: 'Apenas administradores podem publicar avisos' })
    }

    const { title, content, type, targetRoleIds, targetUnitIds, publishAt, expiresAt } = request.body

    const announcement = await prisma.announcement.create({
      data: {
        title, content,
        type: type || 'info',
        authorId: user.id,
        publishAt: publishAt ? new Date(publishAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetRoles: targetRoleIds?.length ? {
          create: targetRoleIds.map(rid => ({ roleId: rid }))
        } : undefined,
        targetUnits: targetUnitIds?.length ? {
          create: targetUnitIds.map(uid => ({ unitId: uid }))
        } : undefined
      },
      include: {
        author: { select: { id: true, name: true } },
        targetRoles: { include: { role: true } },
        targetUnits: { include: { unit: true } }
      }
    })

    // Notificar usuários segmentados
    const targetUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        AND: [
          targetRoleIds?.length ? { roleId: { in: targetRoleIds } } : {},
          targetUnitIds?.length ? { unitId: { in: targetUnitIds } } : {}
        ]
      },
      select: { id: true, fcmToken: true }
    })

    for (const u of targetUsers) {
      await notificationService.send({
        userId: u.id,
        type: 'announcement',
        title: `📣 ${announcement.title}`,
        body: announcement.content.substring(0, 100),
        data: { announcementId: announcement.id },
        fcmToken: u.fcmToken
      })
    }

    return reply.code(201).send(announcement)
  })

  // POST /api/announcements/:id/read — Confirmar leitura
  fastify.post('/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.currentUser.id
    const announcementId = request.params.id

    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: {}
    })

    await gamificationService.addPoints(userId, 'announcement_read')
    return reply.send({ message: 'Leitura confirmada' })
  })

  // GET /api/announcements/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const announcement = await prisma.announcement.findUnique({
      where: { id: request.params.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        reads: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { readAt: 'desc' }
        },
        targetRoles: { include: { role: true } },
        targetUnits: { include: { unit: true } },
        _count: { select: { reads: true } }
      }
    })
    if (!announcement) return reply.code(404).send({ error: 'Aviso não encontrado' })
    return reply.send(announcement)
  })

  // DELETE /api/announcements/:id
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin', 'director'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Sem permissão' })
    }
    await prisma.announcement.delete({ where: { id: request.params.id } })
    return reply.send({ message: 'Aviso excluído' })
  })
}
