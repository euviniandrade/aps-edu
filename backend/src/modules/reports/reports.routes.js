const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const gamificationService = require('../gamification/gamification.service')

module.exports = async function (fastify) {
  // GET /api/reports/user/:userId
  fastify.get('/user/:userId', { preHandler: [authenticate] }, async (request, reply) => {
    const requestUser = request.currentUser
    const targetId = request.params.userId
    const canViewOthers = ['admin', 'director', 'vice_director'].includes(requestUser.role.slug)

    if (targetId !== requestUser.id && !canViewOthers) {
      return reply.code(403).send({ error: 'Sem permissão para ver relatório de outro usuário' })
    }

    const { startDate, endDate } = request.query
    const dateFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)
    const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

    const [user, userPoints, tasks, badges, events] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetId },
        include: { role: true, unit: true }
      }),
      prisma.userPoints.findUnique({ where: { userId: targetId } }),
      prisma.task.findMany({
        where: { assignedToId: targetId, ...createdAtFilter },
        select: { status: true, dueDate: true, updatedAt: true, priority: true }
      }),
      prisma.userBadge.findMany({
        where: { userId: targetId },
        include: { badge: { select: { name: true, category: true, level: true } } },
        orderBy: { earnedAt: 'desc' }
      }),
      prisma.eventResponsible.count({ where: { userId: targetId } })
    ])

    if (!user) return reply.code(404).send({ error: 'Usuário não encontrado' })

    const completed = tasks.filter(t => t.status === 'completed').length
    const onTime = tasks.filter(t => t.status === 'completed' && t.dueDate && new Date(t.updatedAt) <= new Date(t.dueDate)).length
    const overdue = tasks.filter(t => t.status === 'overdue' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed')).length

    return reply.send({
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name, unit: user.unit.name },
      period: { startDate: startDate || null, endDate: endDate || null },
      tasks: {
        total: tasks.length,
        completed,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        overdue,
        completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
        onTimeRate: completed > 0 ? Math.round((onTime / completed) * 100) : 0
      },
      gamification: {
        points: userPoints?.points || 0,
        level: gamificationService.calculateLevel(userPoints?.points || 0),
        loginStreak: userPoints?.loginStreak || 0,
        badgesEarned: badges.length,
        badges: badges.slice(0, 5)
      },
      events: { participated: events },
      generatedAt: new Date().toISOString()
    })
  })

  // GET /api/reports/unit/:unitId
  fastify.get('/unit/:unitId', { preHandler: [authenticate] }, async (request, reply) => {
    const requestUser = request.currentUser
    const canView = ['admin', 'director'].includes(requestUser.role.slug) ||
      requestUser.unitId === request.params.unitId

    if (!canView) return reply.code(403).send({ error: 'Sem permissão' })

    const { startDate, endDate } = request.query
    const dateFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const unit = await prisma.unit.findUnique({ where: { id: request.params.unitId } })
    if (!unit) return reply.code(404).send({ error: 'Unidade não encontrada' })

    const where = { unitId: request.params.unitId, ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) }

    const [tasks, users, events] = await Promise.all([
      prisma.task.findMany({ where, select: { status: true, dueDate: true, updatedAt: true, assignedToId: true } }),
      prisma.user.findMany({
        where: { unitId: request.params.unitId, isActive: true },
        include: { userPoints: true, role: true }
      }),
      prisma.event.findMany({
        where: { unitId: request.params.unitId },
        select: { status: true, progressPercent: true }
      })
    ])

    const completed = tasks.filter(t => t.status === 'completed').length
    const topUsers = users
      .sort((a, b) => (b.userPoints?.points || 0) - (a.userPoints?.points || 0))
      .slice(0, 5)
      .map(u => ({
        id: u.id, name: u.name, role: u.role.name,
        points: u.userPoints?.points || 0,
        tasksCompleted: u.userPoints?.tasksCompleted || 0
      }))

    return reply.send({
      unit: { id: unit.id, name: unit.name, city: unit.city },
      period: { startDate: startDate || null, endDate: endDate || null },
      tasks: {
        total: tasks.length,
        completed,
        overdue: tasks.filter(t => t.status === 'overdue').length,
        completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
      },
      users: { total: users.length, topPerformers: topUsers },
      events: {
        total: events.length,
        completed: events.filter(e => e.status === 'completed').length,
        avgProgress: events.length > 0 ? Math.round(events.reduce((s, e) => s + e.progressPercent, 0) / events.length) : 0
      },
      generatedAt: new Date().toISOString()
    })
  })

  // GET /api/reports/dashboard — Relatório geral (admin)
  fastify.get('/dashboard', { preHandler: [authenticate] }, async (request, reply) => {
    if (!['admin', 'director'].includes(request.currentUser.role.slug)) {
      return reply.code(403).send({ error: 'Acesso restrito a administradores' })
    }

    const [taskStats, eventStats, userStats, lowEngagementUnits] = await Promise.all([
      prisma.task.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.event.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.unit.findMany({
        include: {
          users: {
            include: { userPoints: true },
            where: { isActive: true }
          }
        }
      })
    ])

    const taskSummary = {}
    taskStats.forEach(t => { taskSummary[t.status] = t._count.id })

    const eventSummary = {}
    eventStats.forEach(e => { eventSummary[e.status] = e._count.id })

    const unitsWithEngagement = lowEngagementUnits.map(unit => {
      const avgPoints = unit.users.length > 0
        ? unit.users.reduce((s, u) => s + (u.userPoints?.points || 0), 0) / unit.users.length
        : 0
      return { id: unit.id, name: unit.name, userCount: unit.users.length, avgPoints: Math.round(avgPoints) }
    }).sort((a, b) => a.avgPoints - b.avgPoints)

    return reply.send({
      tasks: taskSummary,
      events: eventSummary,
      totalActiveUsers: userStats,
      unitsRanking: unitsWithEngagement,
      alerts: {
        lowEngagementUnits: unitsWithEngagement.filter(u => u.avgPoints < 100),
        overdueTasksCount: taskSummary['overdue'] || 0
      },
      generatedAt: new Date().toISOString()
    })
  })
}
