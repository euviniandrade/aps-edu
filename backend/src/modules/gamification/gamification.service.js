const prisma = require('../../shared/config/prisma')
const redis = require('../../shared/config/redis')

const POINTS = {
  task_created: 5,
  task_completed_on_time: 50,
  task_completed_late: 20,
  checklist_item: 3,
  evidence_uploaded: 10,
  comment_posted: 3,
  announcement_read: 5,
  announcement_urgent_read: 15,
  event_created: 20,
  event_participated: 30,
  daily_login: 10
}

const LEVELS = [
  { level: 1, name: 'Iniciante', minPoints: 0 },
  { level: 2, name: 'Colaborador', minPoints: 200 },
  { level: 3, name: 'Comprometido', minPoints: 500 },
  { level: 4, name: 'Dedicado', minPoints: 1000 },
  { level: 5, name: 'Destaque', minPoints: 2000 },
  { level: 6, name: 'Especialista', minPoints: 3500 },
  { level: 7, name: 'Referência', minPoints: 6000 },
  { level: 8, name: 'Excelência', minPoints: 10000 }
]

function calculateLevel(points) {
  const lvl = [...LEVELS].reverse().find(l => points >= l.minPoints) || LEVELS[0]
  const next = LEVELS.find(l => l.minPoints > points)
  return {
    ...lvl,
    nextLevel: next || null,
    pointsToNext: next ? next.minPoints - points : 0,
    progress: next ? Math.round(((points - lvl.minPoints) / (next.minPoints - lvl.minPoints)) * 100) : 100
  }
}

async function addPoints(userId, action) {
  const pts = POINTS[action] || 0
  if (!pts) return

  const updates = { points: { increment: pts } }
  if (action === 'comment_posted') updates.commentsPosted = { increment: 1 }
  if (action === 'evidence_uploaded') updates.evidencesUploaded = { increment: 1 }
  if (action === 'announcement_read') updates.announcementsRead = { increment: 1 }
  if (action === 'event_created') updates.eventsCreated = { increment: 1 }
  if (action === 'task_created') updates.tasksCreated = { increment: 1 }

  const userPoints = await prisma.userPoints.upsert({
    where: { userId },
    create: { userId, points: pts },
    update: updates
  })

  // Atualizar ranking no Redis
  await redis.zadd('ranking:global', userPoints.points, userId)

  // Verificar selos após cada ação
  await checkBadges(userId, userPoints)

  return userPoints
}

async function taskCompleted(userId, onTime) {
  const action = onTime ? 'task_completed_on_time' : 'task_completed_late'
  const pts = POINTS[action]

  const userPoints = await prisma.userPoints.upsert({
    where: { userId },
    create: { userId, points: pts, tasksCompleted: 1, tasksOnTime: onTime ? 1 : 0 },
    update: {
      points: { increment: pts },
      tasksCompleted: { increment: 1 },
      tasksOnTime: onTime ? { increment: 1 } : undefined
    }
  })

  await redis.zadd('ranking:global', userPoints.points, userId)
  await checkBadges(userId, userPoints)

  // Ranking semanal
  const weekKey = getWeekKey()
  await redis.zincrby(`ranking:week:${weekKey}`, pts, userId)

  return userPoints
}

async function registerDailyLogin(userId) {
  const today = new Date().toDateString()
  const userPoints = await prisma.userPoints.findUnique({ where: { userId } })

  if (!userPoints) {
    await prisma.userPoints.create({ data: { userId, points: POINTS.daily_login, loginStreak: 1, lastLoginDate: new Date() } })
    return
  }

  const lastDate = userPoints.lastLoginDate ? new Date(userPoints.lastLoginDate).toDateString() : null
  if (lastDate === today) return // já logou hoje

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const isConsecutive = lastDate === yesterday.toDateString()

  const newStreak = isConsecutive ? userPoints.loginStreak + 1 : 1

  await prisma.userPoints.update({
    where: { userId },
    data: {
      points: { increment: POINTS.daily_login },
      loginStreak: newStreak,
      lastLoginDate: new Date()
    }
  })

  // Bônus streak 7 dias
  if (newStreak % 7 === 0) {
    await prisma.userPoints.update({
      where: { userId },
      data: { points: { increment: 50 } }
    })
  }
}

async function checkBadges(userId, userPoints) {
  try {
    const allBadges = await prisma.badge.findMany()
    const earnedBadges = await prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } })
    const earnedIds = new Set(earnedBadges.map(b => b.badgeId))

    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue

      const rule = badge.unlockRule
      const earned = await evaluateRule(rule, userId, userPoints)

      if (earned) {
        await prisma.userBadge.create({ data: { userId, badgeId: badge.id } })
        await prisma.userPoints.update({
          where: { userId },
          data: { points: { increment: badge.pointsReward } }
        })

        // Notificação de novo selo
        const notificationService = require('../notifications/notifications.service')
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } })
        await notificationService.send({
          userId,
          type: 'badge',
          title: `🏅 Novo selo conquistado!`,
          body: `Você desbloqueou: ${badge.name}`,
          data: { badgeId: badge.id },
          fcmToken: user?.fcmToken
        })
      }
    }
  } catch (err) {
    console.error('Erro ao verificar selos:', err.message)
  }
}

async function evaluateRule(rule, userId, userPoints) {
  if (!rule || !rule.type) return false

  switch (rule.type) {
    case 'tasks_completed':
      return userPoints.tasksCompleted >= rule.count

    case 'tasks_on_time':
      return userPoints.tasksOnTime >= rule.count

    case 'tasks_created':
      return userPoints.tasksCreated >= rule.count

    case 'events_created':
      return userPoints.eventsCreated >= rule.count

    case 'events_participated':
      return userPoints.eventsParticipated >= rule.count

    case 'announcements_published':
      return userPoints.announcementsPublished >= rule.count

    case 'comments_posted':
      return userPoints.commentsPosted >= rule.count

    case 'evidences_uploaded':
      return userPoints.evidencesUploaded >= rule.count

    case 'login_streak':
      return userPoints.loginStreak >= rule.days

    case 'rank_position': {
      const rank = await redis.zrevrank('ranking:global', userId)
      return rank !== null && rank < rule.position
    }

    case 'total_points':
      return userPoints.points >= rule.points

    case 'composite': {
      const results = await Promise.all(rule.rules.map(r => evaluateRule(r, userId, userPoints)))
      return rule.operator === 'AND' ? results.every(Boolean) : results.some(Boolean)
    }

    default:
      return false
  }
}

async function getRanking(scope = 'global', unitId = null, limit = 20) {
  let key = 'ranking:global'
  if (scope === 'week') key = `ranking:week:${getWeekKey()}`
  if (scope === 'month') key = `ranking:month:${getMonthKey()}`

  const raw = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES')
  const ranking = []

  for (let i = 0; i < raw.length; i += 2) {
    const userId = raw[i]
    const score = Number(raw[i + 1])
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true, unit: { select: { name: true } }, role: { select: { name: true } } }
    })
    if (user) ranking.push({ position: i / 2 + 1, user, points: score })
  }

  return ranking
}

function getWeekKey() {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}_w${week}`
}

function getMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}_m${d.getMonth() + 1}`
}

module.exports = {
  addPoints,
  taskCompleted,
  registerDailyLogin,
  checkBadges,
  calculateLevel,
  getRanking,
  LEVELS,
  POINTS
}
