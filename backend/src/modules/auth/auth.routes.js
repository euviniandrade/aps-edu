const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const gamificationService = require('../gamification/gamification.service')

module.exports = async function (fastify) {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email e senha são obrigatórios' })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true, unit: true }
    })

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'Credenciais inválidas' })
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash)
    if (!validPassword) {
      return reply.code(401).send({ error: 'Credenciais inválidas' })
    }

    // Registrar login diário (gamificação)
    await gamificationService.registerDailyLogin(user.id)

    const accessToken = fastify.jwt.sign(
      { id: user.id, email: user.email, role: user.role.slug },
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    )

    const refreshTokenValue = uuidv4()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt }
    })

    return reply.send({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: { id: user.role.id, name: user.role.name, slug: user.role.slug, permissions: user.role.permissions },
        unit: { id: user.unit.id, name: user.unit.name, city: user.unit.city }
      }
    })
  })

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body
    if (!refreshToken) return reply.code(400).send({ error: 'Refresh token obrigatório' })

    const token = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { role: true } } }
    })

    if (!token || token.expiresAt < new Date() || !token.user.isActive) {
      return reply.code(401).send({ error: 'Refresh token inválido ou expirado' })
    }

    const accessToken = fastify.jwt.sign(
      { id: token.user.id, email: token.user.email, role: token.user.role.slug },
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    )

    return reply.send({ accessToken })
  })

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const { refreshToken } = request.body
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }
    return reply.send({ message: 'Logout realizado com sucesso' })
  })

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const points = await prisma.userPoints.findUnique({ where: { userId: user.id } })
    const badgesCount = await prisma.userBadge.count({ where: { userId: user.id } })

    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: { id: user.role.id, name: user.role.name, slug: user.role.slug, permissions: user.role.permissions },
      unit: { id: user.unit.id, name: user.unit.name, city: user.unit.city },
      points: points?.points || 0,
      level: gamificationService.calculateLevel(points?.points || 0),
      badgesCount,
      tasksCompleted: points?.tasksCompleted || 0,
      tasksOnTime: points?.tasksOnTime || 0
    })
  })

  // POST /api/auth/forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body
    const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase() } })
    // Sempre retorna sucesso por segurança
    if (user) {
      // TODO: enviar email com link de reset
      console.log(`Reset de senha solicitado para: ${email}`)
    }
    return reply.send({ message: 'Se o email existir, você receberá as instruções em breve' })
  })

  // PUT /api/auth/update-fcm-token
  fastify.put('/update-fcm-token', { preHandler: [authenticate] }, async (request, reply) => {
    const { fcmToken } = request.body
    await prisma.user.update({
      where: { id: request.currentUser.id },
      data: { fcmToken }
    })
    return reply.send({ message: 'Token FCM atualizado' })
  })
}
