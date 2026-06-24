const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const wa = require('./whatsapp.service')

module.exports = async function (fastify) {
  // ─── Status & QR ──────────────────────────────────────────────────────────

  fastify.get('/status', { preHandler: [authenticate] }, async (req, reply) => {
    return reply.send(wa.getStatus())
  })

  fastify.post('/connect', { preHandler: [authenticate] }, async (req, reply) => {
    const { status } = wa.getStatus()
    if (status === 'connected') return reply.send({ message: 'Já conectado' })
    wa.connect().catch(console.error)
    return reply.send({ message: 'Conectando...' })
  })

  fastify.post('/disconnect', { preHandler: [authenticate] }, async (req, reply) => {
    await wa.disconnect()
    return reply.send({ message: 'Desconectado' })
  })

  // ─── SSE (eventos em tempo real) ──────────────────────────────────────────
  // EventSource não suporta headers — autentica via query ?token=...

  fastify.get('/events', async (req, reply) => {
    const token = req.query.token
    if (token) {
      try {
        req.user = fastify.jwt.verify(token)
      } catch {
        return reply.code(401).send({ error: 'Token inválido' })
      }
    }
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')
    reply.raw.flushHeaders?.()

    wa.addSSEClient(reply)

    // Heartbeat
    const hb = setInterval(() => {
      try { reply.raw.write(': heartbeat\n\n') } catch { clearInterval(hb) }
    }, 25000)

    req.raw.on('close', () => clearInterval(hb))
    return reply
  })

  // ─── Leads ────────────────────────────────────────────────────────────────

  fastify.get('/leads', { preHandler: [authenticate] }, async (req, reply) => {
    const { stage, search, page = 1, limit = 50 } = req.query

    const where = {}
    if (stage) where.stage = stage
    if (search) {
      where.OR = [
        { contactName: { contains: search } },
        { phoneNumber: { contains: search } }
      ]
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          _count: { select: { conversations: true } },
          labels: true
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.lead.count({ where })
    ])

    return reply.send({ leads, total })
  })

  fastify.get('/leads/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        labels: true,
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
        conversations: {
          where: { archived: false },
          orderBy: { updatedAt: 'desc' },
          take: 5
        }
      }
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })
    return reply.send(lead)
  })

  fastify.patch('/leads/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { stage, contactName, score, customData } = req.body
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(stage !== undefined ? { stage } : {}),
        ...(contactName !== undefined ? { contactName } : {}),
        ...(score !== undefined ? { score } : {}),
        ...(customData !== undefined ? { customData: JSON.stringify(customData) } : {})
      }
    })
    return reply.send(lead)
  })

  // ─── Conversations ────────────────────────────────────────────────────────

  fastify.get('/conversations', { preHandler: [authenticate] }, async (req, reply) => {
    const { leadId, page = 1, limit = 20 } = req.query
    const where = { archived: false }
    if (leadId) where.leadId = leadId

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        lead: { select: { id: true, phoneNumber: true, contactName: true, stage: true } },
        messages: { orderBy: { timestamp: 'desc' }, take: 1 }
      },
      orderBy: { lastMessageAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    })

    return reply.send(conversations)
  })

  fastify.get('/conversations/:id/messages', { preHandler: [authenticate] }, async (req, reply) => {
    const { page = 1, limit = 50 } = req.query

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { timestamp: 'asc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    })

    return reply.send(messages)
  })

  // ─── Send messages ────────────────────────────────────────────────────────

  fastify.post('/messages/send', { preHandler: [authenticate] }, async (req, reply) => {
    const { phone, text } = req.body
    if (!phone || !text) return reply.code(400).send({ error: 'phone e text são obrigatórios' })

    try {
      await wa.sendMessage(phone, text)
      return reply.send({ ok: true })
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }
  })

  fastify.post('/messages/reply/:conversationId', { preHandler: [authenticate] }, async (req, reply) => {
    const { text } = req.body
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
      include: { lead: true }
    })
    if (!conversation) return reply.code(404).send({ error: 'Conversa não encontrada' })

    try {
      await wa.sendMessage(conversation.lead.phoneNumber, text)
      return reply.send({ ok: true })
    } catch (err) {
      return reply.code(503).send({ error: err.message })
    }
  })

  // ─── Bulk messages ────────────────────────────────────────────────────────

  fastify.post('/messages/bulk', { preHandler: [authenticate] }, async (req, reply) => {
    const { phones, content, title } = req.body
    if (!phones?.length || !content) {
      return reply.code(400).send({ error: 'phones[] e content são obrigatórios' })
    }

    // Start async, return immediately
    const userId = req.currentUser.id
    wa.sendBulk(userId, phones, content, title).catch(console.error)

    return reply.send({ message: 'Envio em massa iniciado', total: phones.length })
  })

  fastify.get('/messages/bulk', { preHandler: [authenticate] }, async (req, reply) => {
    const bulks = await prisma.bulkMessage.findMany({
      where: { userId: req.currentUser.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    return reply.send(bulks)
  })

  // ─── Bot rules ────────────────────────────────────────────────────────────

  fastify.get('/bot/rules', { preHandler: [authenticate] }, async (req, reply) => {
    const rules = await prisma.botRule.findMany({ orderBy: { priority: 'desc' } })
    return reply.send(rules)
  })

  fastify.post('/bot/rules', { preHandler: [authenticate] }, async (req, reply) => {
    const { trigger, response, priority } = req.body
    if (!trigger || !response) return reply.code(400).send({ error: 'trigger e response são obrigatórios' })
    const rule = await prisma.botRule.create({
      data: { trigger, response, priority: priority || 0 }
    })
    return reply.code(201).send(rule)
  })

  fastify.patch('/bot/rules/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const rule = await prisma.botRule.update({
      where: { id: req.params.id },
      data: req.body
    })
    return reply.send(rule)
  })

  fastify.delete('/bot/rules/:id', { preHandler: [authenticate] }, async (req, reply) => {
    await prisma.botRule.delete({ where: { id: req.params.id } })
    return reply.send({ ok: true })
  })

  // ─── Scheduled messages ───────────────────────────────────────────────────

  fastify.get('/scheduled', { preHandler: [authenticate] }, async (req, reply) => {
    const messages = await prisma.scheduledMessage.findMany({
      where: { status: 'pending' },
      orderBy: { scheduledAt: 'asc' }
    })
    return reply.send(messages)
  })

  fastify.post('/scheduled', { preHandler: [authenticate] }, async (req, reply) => {
    const { phoneNumber, content, scheduledAt } = req.body
    if (!phoneNumber || !content || !scheduledAt) {
      return reply.code(400).send({ error: 'phoneNumber, content e scheduledAt são obrigatórios' })
    }
    const msg = await prisma.scheduledMessage.create({
      data: { phoneNumber, content, scheduledAt: new Date(scheduledAt) }
    })
    return reply.code(201).send(msg)
  })

  fastify.delete('/scheduled/:id', { preHandler: [authenticate] }, async (req, reply) => {
    await prisma.scheduledMessage.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' }
    })
    return reply.send({ ok: true })
  })

  // ─── Analytics ────────────────────────────────────────────────────────────

  fastify.get('/analytics', { preHandler: [authenticate] }, async (req, reply) => {
    const [totalLeads, totalMessages, byStage, recent] = await Promise.all([
      prisma.lead.count(),
      prisma.message.count(),
      prisma.lead.groupBy({ by: ['stage'], _count: { id: true } }),
      prisma.message.count({
        where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }
      })
    ])

    return reply.send({
      totalLeads,
      totalMessages,
      messagesLast7Days: recent,
      byStage: byStage.map(s => ({ stage: s.stage, count: s._count.id }))
    })
  })

  // ─── Knowledge base ───────────────────────────────────────────────────────

  fastify.get('/knowledge', { preHandler: [authenticate] }, async (req, reply) => {
    const items = await prisma.knowledgeBase.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send(items)
  })

  fastify.post('/knowledge', { preHandler: [authenticate] }, async (req, reply) => {
    const { title, content, category } = req.body
    if (!title || !content || !category) {
      return reply.code(400).send({ error: 'title, content e category são obrigatórios' })
    }
    const item = await prisma.knowledgeBase.create({ data: { title, content, category } })
    return reply.code(201).send(item)
  })

  fastify.delete('/knowledge/:id', { preHandler: [authenticate] }, async (req, reply) => {
    await prisma.knowledgeBase.delete({ where: { id: req.params.id } })
    return reply.send({ ok: true })
  })
}
