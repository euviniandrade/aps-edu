const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const gamificationService = require('./gamification.service')

module.exports = async function (fastify) {
  // GET /api/gamification/ranking
  fastify.get('/ranking', { preHandler: [authenticate] }, async (request, reply) => {
    const { scope = 'global', limit = 20 } = request.query
    const ranking = await gamificationService.getRanking(scope, null, Number(limit))

    // Posição do usuário atual
    const redis = require('../../shared/config/redis')
    const key = scope === 'global' ? 'ranking:global' : `ranking:${scope}:${scope}`
    const myRank = await redis.zrevrank('ranking:global', request.currentUser.id)

    return reply.send({ ranking, myPosition: myRank !== null ? myRank + 1 : null })
  })

  // GET /api/gamification/my-stats
  fastify.get('/my-stats', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.currentUser.id
    const userPoints = await prisma.userPoints.findUnique({ where: { userId } })
    const badges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' }
    })
    const totalBadges = await prisma.badge.count()

    return reply.send({
      points: userPoints?.points || 0,
      level: gamificationService.calculateLevel(userPoints?.points || 0),
      stats: {
        tasksCompleted: userPoints?.tasksCompleted || 0,
        tasksOnTime: userPoints?.tasksOnTime || 0,
        tasksCreated: userPoints?.tasksCreated || 0,
        eventsParticipated: userPoints?.eventsParticipated || 0,
        loginStreak: userPoints?.loginStreak || 0,
        commentsPosted: userPoints?.commentsPosted || 0,
        evidencesUploaded: userPoints?.evidencesUploaded || 0,
        announcementsRead: userPoints?.announcementsRead || 0
      },
      badges: {
        earned: badges,
        total: totalBadges,
        percentage: totalBadges > 0 ? Math.round((badges.length / totalBadges) * 100) : 0
      }
    })
  })

  // GET /api/gamification/badges
  fastify.get('/badges', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.currentUser.id
    const { category } = request.query

    const allBadges = await prisma.badge.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { order: 'asc' }]
    })

    const earnedBadges = await prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true }
    })

    const earnedMap = new Map(earnedBadges.map(b => [b.badgeId, b.earnedAt]))
    const userPoints = await prisma.userPoints.findUnique({ where: { userId } })

    return reply.send(allBadges.map(badge => ({
      ...badge,
      earned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) || null
    })))
  })

  // POST /api/gamification/badges/:badgeId/grant — Admin concede selo manualmente
  fastify.post('/badges/:badgeId/grant', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin', 'director'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Apenas admins podem conceder selos manualmente' })
    }

    const { userId } = request.body
    const badge = await prisma.badge.findUnique({ where: { id: request.params.badgeId } })
    if (!badge) return reply.code(404).send({ error: 'Selo não encontrado' })

    const exists = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } }
    })
    if (exists) return reply.code(409).send({ error: 'Usuário já possui este selo' })

    await prisma.userBadge.create({ data: { userId, badgeId: badge.id } })
    await prisma.userPoints.upsert({
      where: { userId },
      create: { userId, points: badge.pointsReward },
      update: { points: { increment: badge.pointsReward } }
    })

    return reply.code(201).send({ message: `Selo "${badge.name}" concedido com sucesso` })
  })
}
