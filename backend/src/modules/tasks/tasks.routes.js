const prisma = require('../../shared/config/prisma')
const { authenticate, authorizeAdmin } = require('../../shared/middleware/auth.middleware')
const gamificationService = require('../gamification/gamification.service')
const notificationService = require('../notifications/notifications.service')

module.exports = async function (fastify) {
  const adminSlugs = ['admin', 'director', 'vice_director', 'coordinator']

  // GET /api/tasks
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const { status, priority, unitId, assignedTo, page = 1, limit = 20 } = request.query
    const isAdmin = ['admin', 'director'].includes(user.role.slug)

    const where = {}
    if (!isAdmin) where.OR = [{ assignedToId: user.id }, { createdById: user.id }, { unitId: user.unitId }]
    if (status) where.status = status
    if (priority) where.priority = priority
    if (unitId && isAdmin) where.unitId = unitId
    if (assignedTo) where.assignedToId = assignedTo

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
          unit: { select: { id: true, name: true } },
          _count: { select: { checklists: true, comments: true, evidences: true } }
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        skip: (page - 1) * limit,
        take: Number(limit)
      }),
      prisma.task.count({ where })
    ])

    return reply.send({ tasks, total, page: Number(page), limit: Number(limit) })
  })

  // GET /api/tasks/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const task = await prisma.task.findUnique({
      where: { id: request.params.id },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true, role: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true, role: { select: { name: true } } } },
        unit: true,
        checklists: { orderBy: { order: 'asc' } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        },
        evidences: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } }
        }
      }
    })
    if (!task) return reply.code(404).send({ error: 'Tarefa não encontrada' })
    return reply.send(task)
  })

  // POST /api/tasks
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    if (!adminSlugs.includes(user.role.slug)) {
      return reply.code(403).send({ error: 'Apenas gestores podem criar tarefas' })
    }

    const { title, description, priority, dueDate, assignedToId, unitId, eventId, checklists } = request.body

    const task = await prisma.task.create({
      data: {
        title, description, priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId, unitId: unitId || user.unitId,
        eventId, createdById: user.id,
        checklists: checklists?.length ? {
          create: checklists.map((c, i) => ({ title: c.title, order: i }))
        } : undefined
      },
      include: {
        assignedTo: { select: { id: true, name: true, fcmToken: true } },
        unit: { select: { id: true, name: true } }
      }
    })

    // Gamificação: pontos por tarefa criada
    await gamificationService.addPoints(user.id, 'task_created')

    // Notificação para responsável
    if (task.assignedTo) {
      await notificationService.send({
        userId: task.assignedTo.id,
        type: 'task',
        title: 'Nova tarefa atribuída',
        body: `Você tem uma nova tarefa: ${task.title}`,
        data: { taskId: task.id },
        fcmToken: task.assignedTo.fcmToken
      })
    }

    return reply.code(201).send(task)
  })

  // PUT /api/tasks/:id
  fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const task = await prisma.task.findUnique({ where: { id: request.params.id } })
    if (!task) return reply.code(404).send({ error: 'Tarefa não encontrada' })

    const canEdit = ['admin', 'director'].includes(user.role.slug) ||
      task.createdById === user.id || task.assignedToId === user.id

    if (!canEdit) return reply.code(403).send({ error: 'Sem permissão para editar esta tarefa' })

    const { title, description, status, priority, progressPercent, dueDate, assignedToId } = request.body
    const wasCompleted = task.status === 'completed'
    const isNowCompleted = status === 'completed'

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(progressPercent !== undefined && { progressPercent }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assignedToId !== undefined && { assignedToId })
      }
    })

    // Gamificação: pontos ao concluir
    if (!wasCompleted && isNowCompleted) {
      const onTime = task.dueDate ? new Date() <= new Date(task.dueDate) : true
      await gamificationService.taskCompleted(user.id, onTime)
    }

    return reply.send(updated)
  })

  // DELETE /api/tasks/:id
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.currentUser
    const task = await prisma.task.findUnique({ where: { id: request.params.id } })
    if (!task) return reply.code(404).send({ error: 'Tarefa não encontrada' })

    const canDelete = ['admin', 'director'].includes(user.role.slug) || task.createdById === user.id
    if (!canDelete) return reply.code(403).send({ error: 'Sem permissão para excluir esta tarefa' })

    await prisma.task.delete({ where: { id: task.id } })
    return reply.send({ message: 'Tarefa excluída com sucesso' })
  })

  // POST /api/tasks/:id/checklists
  fastify.post('/:id/checklists', { preHandler: [authenticate] }, async (request, reply) => {
    const { title } = request.body
    const count = await prisma.taskChecklist.count({ where: { taskId: request.params.id } })
    const item = await prisma.taskChecklist.create({
      data: { taskId: request.params.id, title, order: count }
    })
    return reply.code(201).send(item)
  })

  // PUT /api/tasks/:id/checklists/:checkId
  fastify.put('/:id/checklists/:checkId', { preHandler: [authenticate] }, async (request, reply) => {
    const { isCompleted, title } = request.body
    const updated = await prisma.taskChecklist.update({
      where: { id: request.params.checkId },
      data: { ...(isCompleted !== undefined && { isCompleted }), ...(title && { title }) }
    })

    // Atualizar progresso da tarefa automaticamente
    const all = await prisma.taskChecklist.findMany({ where: { taskId: request.params.id } })
    if (all.length > 0) {
      const done = all.filter(c => c.id === updated.id ? isCompleted : c.isCompleted).length
      const progress = Math.round((done / all.length) * 100)
      await prisma.task.update({ where: { id: request.params.id }, data: { progressPercent: progress } })
    }

    // Gamificação: pontos por evidência de progresso
    if (isCompleted) {
      await gamificationService.addPoints(request.currentUser.id, 'checklist_item')
    }

    return reply.send(updated)
  })

  // POST /api/tasks/:id/comments
  fastify.post('/:id/comments', { preHandler: [authenticate] }, async (request, reply) => {
    const { content } = request.body
    const comment = await prisma.taskComment.create({
      data: { taskId: request.params.id, userId: request.currentUser.id, content },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    })
    await gamificationService.addPoints(request.currentUser.id, 'comment_posted')
    return reply.code(201).send(comment)
  })

  // POST /api/tasks/:id/evidences
  fastify.post('/:id/evidences', { preHandler: [authenticate] }, async (request, reply) => {
    const fs = require('fs')
    const path = require('path')

    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'Arquivo obrigatório' })

    const fileBuffer = await data.toBuffer()
    if (!fileBuffer || fileBuffer.length === 0) return reply.code(400).send({ error: 'Arquivo vazio' })

    // Salvar em disco: uploads/tasks/:taskId/
    const safeFilename = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${Date.now()}_${safeFilename}`
    const uploadDir = path.join(process.cwd(), 'uploads', 'tasks', request.params.id)
    fs.mkdirSync(uploadDir, { recursive: true })
    fs.writeFileSync(path.join(uploadDir, fileName), fileBuffer)

    const fileType = data.mimetype.startsWith('image/') ? 'image' : 'document'
    const fileUrl = `/uploads/tasks/${request.params.id}/${fileName}`

    const evidence = await prisma.taskEvidence.create({
      data: {
        taskId: request.params.id,
        userId: request.currentUser.id,
        fileUrl,
        fileName: data.filename,
        fileType,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    })

    await gamificationService.addPoints(request.currentUser.id, 'evidence_uploaded')
    return reply.code(201).send(evidence)
  })
}
