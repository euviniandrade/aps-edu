const prisma = require('../../shared/config/prisma')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const gamificationService = require('../gamification/gamification.service')
const notificationService = require('../notifications/notifications.service')

module.exports = async function (fastify) {
  const managerSlugs = ['admin', 'director', 'vice_director']

  // GET /api/events
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { status, unitId, page = 1, limit = 20 } = request.query
    const user = request.currentUser
    const isAdmin = ['admin', 'director'].includes(user.role.slug)

    const where = {}
    if (status) where.status = status
    if (unitId && isAdmin) where.unitId = unitId
    if (!isAdmin) where.OR = [
      { unitId: user.unitId },
      { responsibles: { some: { userId: user.id } } }
    ]

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          unit: { select: { id: true, name: true } },
          responsibles: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          _count: { select: { timeline: true, photos: true, tasks: true } }
        },
        orderBy: { startDate: 'asc' },
        skip: (page - 1) * limit,
        take: Number(limit)
      }),
      prisma.event.count({ where })
    ])

    return reply.send({ events, total, page: Number(page), limit: Number(limit) })
  })

  // GET /api/events/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const event = await prisma.event.findUnique({
      where: { id: request.params.id },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        unit: true,
        responsibles: { include: { user: { select: { id: true, name: true, avatarUrl: true, role: { select: { name: true } } } } } },
        timeline: { orderBy: { order: 'asc' } },
        photos: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    })
    if (!event) return reply.code(404).send({ error: 'Evento não encontrado' })
    return reply.send(event)
  })

  // POST /api/events
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    if (!managerSlugs.includes(user.role.slug)) {
      return reply.code(403).send({ error: 'Apenas gestores podem criar eventos' })
    }

    const { name, description, startDate, endDate, location, unitId, responsibleIds, timeline } = request.body

    const event = await prisma.event.create({
      data: {
        name, description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        unitId: unitId || user.unitId,
        createdById: user.id,
        responsibles: responsibleIds?.length ? {
          create: responsibleIds.map(uid => ({ userId: uid }))
        } : undefined,
        timeline: timeline?.length ? {
          create: timeline.map((t, i) => ({
            title: t.title,
            description: t.description,
            scheduledAt: new Date(t.scheduledAt),
            createdById: user.id,
            order: i
          }))
        } : undefined
      },
      include: {
        unit: true,
        responsibles: { include: { user: { select: { id: true, name: true, fcmToken: true } } } },
        timeline: true
      }
    })

    // Gamificação
    await gamificationService.addPoints(user.id, 'event_created')

    // Notificar responsáveis
    for (const resp of event.responsibles) {
      await notificationService.send({
        userId: resp.user.id,
        type: 'event',
        title: 'Você foi adicionado como responsável',
        body: `Evento: ${event.name} — ${new Date(event.startDate).toLocaleDateString('pt-BR')}`,
        data: { eventId: event.id },
        fcmToken: resp.user.fcmToken
      })
    }

    return reply.code(201).send(event)
  })

  // PUT /api/events/:id
  fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const event = await prisma.event.findUnique({ where: { id: request.params.id } })
    if (!event) return reply.code(404).send({ error: 'Evento não encontrado' })

    const canEdit = managerSlugs.includes(user.role.slug) || event.createdById === user.id
    if (!canEdit) return reply.code(403).send({ error: 'Sem permissão' })

    const { name, description, status, startDate, endDate, location, progressPercent } = request.body

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(location && { location }),
        ...(progressPercent !== undefined && { progressPercent })
      }
    })

    return reply.send(updated)
  })

  // PUT /api/events/:id/timeline/:timelineId
  fastify.put('/:id/timeline/:timelineId', { preHandler: [authenticate] }, async (request, reply) => {
    const { completedAt, title, description } = request.body
    const updated = await prisma.eventTimeline.update({
      where: { id: request.params.timelineId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null })
      }
    })

    // Recalcular progresso do evento
    const allItems = await prisma.eventTimeline.findMany({ where: { eventId: request.params.id } })
    if (allItems.length > 0) {
      const doneCount = allItems.filter(t => t.id === updated.id ? !!completedAt : !!t.completedAt).length
      const progress = Math.round((doneCount / allItems.length) * 100)
      await prisma.event.update({ where: { id: request.params.id }, data: { progressPercent: progress } })
    }

    return reply.send(updated)
  })

  // POST /api/events/:id/timeline
  fastify.post('/:id/timeline', { preHandler: [authenticate] }, async (request, reply) => {
    const { title, description, scheduledAt } = request.body
    const count = await prisma.eventTimeline.count({ where: { eventId: request.params.id } })
    const item = await prisma.eventTimeline.create({
      data: {
        eventId: request.params.id,
        title, description,
        scheduledAt: new Date(scheduledAt),
        createdById: request.currentUser.id,
        order: count
      }
    })
    return reply.code(201).send(item)
  })

  // POST /api/events/:id/photos
  fastify.post('/:id/photos', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Arquivo obrigatório' })

    const fileName = `events/${request.params.id}/${Date.now()}_${data.filename}`
    // Em produção: upload para Firebase Storage
    const url = `/uploads/${fileName}`

    const photo = await prisma.eventPhoto.create({
      data: {
        eventId: request.params.id,
        url,
        caption: request.body?.caption || null,
        uploadedBy: request.currentUser.id
      }
    })
    return reply.code(201).send(photo)
  })

  // GET /api/events/:id/report — Relatório final do evento
  fastify.get('/:id/report', { preHandler: [authenticate] }, async (request, reply) => {
    const event = await prisma.event.findUnique({
      where: { id: request.params.id },
      include: {
        unit: true,
        createdBy: { select: { name: true, role: { select: { name: true } } } },
        responsibles: { include: { user: { select: { name: true, role: { select: { name: true } } } } } },
        timeline: { orderBy: { order: 'asc' } },
        tasks: { include: { assignedTo: { select: { name: true } } } },
        _count: { select: { photos: true } }
      }
    })
    if (!event) return reply.code(404).send({ error: 'Evento não encontrado' })

    const completedTimeline = event.timeline.filter(t => !!t.completedAt).length
    const completedTasks = event.tasks.filter(t => t.status === 'completed').length

    return reply.send({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        status: event.status,
        progressPercent: event.progressPercent,
        unit: event.unit.name,
        createdBy: `${event.createdBy.name} (${event.createdBy.role.name})`
      },
      responsibles: event.responsibles.map(r => `${r.user.name} — ${r.user.role.name}`),
      timeline: {
        total: event.timeline.length,
        completed: completedTimeline,
        completionRate: event.timeline.length > 0 ? Math.round((completedTimeline / event.timeline.length) * 100) : 0,
        items: event.timeline
      },
      tasks: {
        total: event.tasks.length,
        completed: completedTasks,
        completionRate: event.tasks.length > 0 ? Math.round((completedTasks / event.tasks.length) * 100) : 0
      },
      photos: event._count.photos,
      generatedAt: new Date().toISOString()
    })
  })
}
