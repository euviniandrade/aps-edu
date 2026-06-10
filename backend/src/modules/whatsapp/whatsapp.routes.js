const whatsappService = require('./whatsapp.service')
const cacheService = require('./services/cache.service')
const jobsService = require('./services/jobs.service')
const monitoringService = require('./services/monitoring.service')
const aiContextService = require('./services/ai-context.service')
const aiGuardrailsService = require('./services/ai-guardrails.service')
const aiResponseService = require('./services/ai-fallback.service')
const prisma = require('../../shared/config/prisma')

// Autenticação via API Key compartilhada (Vercel → Oracle VM).
// Não depende de JWT nem de banco de dados.
const WA_KEY = process.env.WHATSAPP_API_KEY

async function apiKeyAuth(request, reply) {
  if (!WA_KEY) return // Se não configurado, permite (modo dev)
  const key = request.headers['x-wa-key']
  if (key !== WA_KEY) {
    return reply.code(401).send({ error: 'Não autorizado' })
  }
}

module.exports = async function (fastify) {
  // Endpoint público — retorna QR como imagem PNG sem cache
  fastify.get('/qr', async (request, reply) => {
    const st = whatsappService.getState()
    if (!st.qrDataUrl) {
      return reply.code(404).send({ error: 'QR não disponível. WhatsApp já conectado ou ainda iniciando.' })
    }
    const base64 = st.qrDataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .header('Pragma', 'no-cache')
      .send(buffer)
  })

  fastify.get('/status', { preHandler: [apiKeyAuth] }, async () => whatsappService.getState())

  fastify.post('/start', { preHandler: [apiKeyAuth] }, async () => whatsappService.start())

  fastify.post('/automation', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.updateAutomation(request.body || {})
  })

  fastify.post('/training', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.addTraining(request.body?.text)
  })

  fastify.post('/handoff', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.handoff(request.body?.chatId)
  })

  fastify.post('/resume-auto', { preHandler: [apiKeyAuth] }, async () => {
    return whatsappService.resumeAuto()
  })

  fastify.get('/chats', { preHandler: [apiKeyAuth] }, async (request) => {
    const { limit = 30 } = request.query
    return whatsappService.listChats(limit)
  })

  fastify.get('/messages', { preHandler: [apiKeyAuth] }, async (request) => {
    const { chatId, limit = 50 } = request.query
    if (!chatId) return []
    return whatsappService.getMessages(chatId, Number(limit))
  })

  fastify.post('/send', { preHandler: [apiKeyAuth] }, async (request, reply) => {
    try {
      const result = await whatsappService.sendMessage(request.body || {})
      return reply.send(result)
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.message })
    }
  })

  // CRM — lista todos os contatos com dados CRM
  fastify.get('/contacts', { preHandler: [apiKeyAuth] }, async () => {
    return whatsappService.listCrmContacts()
  })

  // Catálogo completo — todos os contatos do celular + quem conversou
  fastify.get('/phonebook', { preHandler: [apiKeyAuth] }, async () => {
    return whatsappService.listPhonebook()
  })

  // CRM — busca dados de um contato específico
  fastify.get('/crm/:chatId', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.getCrm(request.params.chatId)
  })

  // CRM — salva/atualiza dados de um contato (stage, tags, score, notes)
  fastify.post('/crm/:chatId', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.saveCrm(request.params.chatId, request.body || {})
  })

  // SSE — eventos em tempo real (estado + mensagens recebidas)
  fastify.get('/events', async (request, reply) => { // sem auth — EventSource não suporta headers
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (event, data) => {
      try {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {}
    }

    // Estado inicial imediato
    send('state', whatsappService.getState())

    const onMessage = (data) => send('message', data)
    const onState = (data) => send('state', data)

    whatsappService.emitter.on('message', onMessage)
    whatsappService.emitter.on('state', onState)

    const keepalive = setInterval(() => {
      try { raw.write(': keepalive\n\n') } catch {}
    }, 25000)

    await new Promise((resolve) => {
      request.raw.on('close', resolve)
      request.raw.on('error', resolve)
    })

    clearInterval(keepalive)
    whatsappService.emitter.off('message', onMessage)
    whatsappService.emitter.off('state', onState)
  })

  // ─────────────────────────────────────────────────────────────────
  // NOVAS ROTAS — FASE 1: RESPONDER MENSAGENS INDIVIDUAIS
  // ─────────────────────────────────────────────────────────────────

  // GET /conversations — Listar conversas com paginação
  fastify.get('/conversations', { preHandler: [apiKeyAuth] }, async (request) => {
    const { skip = 0, take = 50 } = request.query
    try {
      const conversations = await prisma.conversation.findMany({
        skip: Number(skip),
        take: Number(take),
        include: {
          lead: { select: { id: true, phoneNumber: true, contactName: true, stage: true } },
          messages: { take: 1, orderBy: { timestamp: 'desc' } },
        },
        orderBy: { updatedAt: 'desc' },
      })

      return {
        success: true,
        data: conversations.map(conv => ({
          id: conv.id,
          leadId: conv.leadId,
          lead: conv.lead,
          title: conv.title || conv.lead.contactName || conv.lead.phoneNumber,
          lastMessage: conv.messages[0]?.content || '',
          lastMessageAt: conv.messages[0]?.timestamp || conv.updatedAt,
          messageCount: conv.messageCount,
          archived: conv.archived,
        })),
        total: await prisma.conversation.count(),
      }
    } catch (error) {
      monitoringService.recordRequest('/conversations', 500, 0)
      return { success: false, error: error.message }
    }
  })

  // GET /conversations/:id/messages — Carregar histórico de uma conversa
  fastify.get('/conversations/:id/messages', { preHandler: [apiKeyAuth] }, async (request) => {
    const { id } = request.params
    const { skip = 0, take = 50 } = request.query
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        skip: Number(skip),
        take: Number(take),
        orderBy: { timestamp: 'asc' },
      })

      return {
        success: true,
        data: messages,
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // POST /messages/reply/:conversationId — Responder uma conversa
  fastify.post('/messages/reply/:conversationId', { preHandler: [apiKeyAuth] }, async (request) => {
    const { conversationId } = request.params
    const { text } = request.body

    if (!text || text.trim().length === 0) {
      return { success: false, error: 'Mensagem vazia' }
    }

    try {
      // Validar entrada (guardrails)
      const guardResult = aiGuardrailsService.validateInput(text)
      if (!guardResult.valid) {
        return { success: false, error: guardResult.reason }
      }

      // Buscar conversa e lead
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { lead: true },
      })

      if (!conversation) {
        return { success: false, error: 'Conversa não encontrada' }
      }

      // Enviar mensagem via WhatsApp
      const sendResult = await whatsappService.sendMessage({
        chatId: conversation.lead.phoneNumber,
        text: text,
      })

      // Sanitizar saída
      const sanitized = aiGuardrailsService.validateOutput(text)
      const finalText = sanitized.safe ? text : sanitized.text

      // Registrar no banco de dados
      const message = await prisma.message.create({
        data: {
          conversationId: conversationId,
          content: finalText,
          contentType: 'text',
          messageId: sendResult?.key?.id || `msg_${Date.now()}`,
          timestamp: new Date(),
          fromPhone: 'bot',
          ackStatus: 1,
        },
      })

      // Registrar no evento (audit)
      await prisma.leadEvent.create({
        data: {
          leadId: conversation.leadId,
          eventType: 'message_sent',
          description: `Mensagem enviada via API`,
          metadata: { messageId: message.id },
        },
      })

      // Rastrear métrica
      monitoringService.recordMessage('sent')
      monitoringService.recordRequest('/messages/reply', 200, 50)

      return {
        success: true,
        data: message,
        note: sanitized.sanitized ? 'Mensagem foi sanitizada (PII removido)' : undefined,
      }
    } catch (error) {
      monitoringService.recordRequest('/messages/reply', 500, 0)
      return { success: false, error: error.message }
    }
  })

  // POST /messages/bulk — Envio em massa
  fastify.post('/messages/bulk', { preHandler: [apiKeyAuth] }, async (request) => {
    const { recipientIds, template } = request.body

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return { success: false, error: 'Forneça lista de recipientIds' }
    }

    if (!template) {
      return { success: false, error: 'Forneça template de mensagem' }
    }

    try {
      // Validar template
      const guardResult = aiGuardrailsService.validateInput(template)
      if (!guardResult.valid) {
        return { success: false, error: guardResult.reason }
      }

      // Criar job de envio em massa
      const jobId = await jobsService.bulkSendMessages(recipientIds, template)

      return {
        success: true,
        jobId: jobId,
        status: 'processing',
        message: `Envio em massa iniciado para ${recipientIds.length} leads`,
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // GET /bulk/:jobId — Status do envio em massa
  fastify.get('/bulk/:jobId', { preHandler: [apiKeyAuth] }, async (request) => {
    const { jobId } = request.params
    try {
      const status = await jobsService.getJobStatus(jobId)
      return { success: true, data: status }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // POST /ai/suggest/:conversationId — Sugestão de resposta via IA
  fastify.post('/ai/suggest/:conversationId', { preHandler: [apiKeyAuth] }, async (request) => {
    const { conversationId } = request.params
    const { userMessage } = request.body

    try {
      // Buscar conversa e lead
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { lead: true },
      })

      if (!conversation) {
        return { success: false, error: 'Conversa não encontrada' }
      }

      // Carregar contexto (últimas mensagens + dados do lead)
      const context = await aiContextService.getContextForChat(
        conversationId,
        conversation.lead,
        []
      )

      // Obter resposta sugerida via Gemini
      const suggestion = await aiContextService.generateResponse(
        userMessage || context.recentMessages[context.recentMessages.length - 1]?.content,
        context.systemPrompt
      )

      // Registrar sugestão (rate limiting)
      const rateLimitOk = cacheService.trackAISuggest(conversationId)
      if (!rateLimitOk) {
        return {
          success: false,
          error: 'Limite de sugestões IA atingido (máximo 30/hora)',
        }
      }

      // Rastrear métrica
      monitoringService.recordAIRequest(true, 100, userMessage?.length || 0, suggestion.length)

      return {
        success: true,
        suggestion: suggestion,
        contextUsed: {
          leadStage: conversation.lead.stage,
          leadScore: conversation.lead.score,
          recentMessagesCount: context.recentMessages.length,
        },
      }
    } catch (error) {
      monitoringService.recordAIRequest(false, 100, 0, 0)
      return { success: false, error: error.message }
    }
  })

  // GET /metrics — Métricas de operação
  fastify.get('/metrics', { preHandler: [apiKeyAuth] }, async () => {
    try {
      const metrics = monitoringService.getMetrics()
      const queueStats = await jobsService.getAllQueueStats()
      const cacheStats = cacheService.getStatus()

      return {
        success: true,
        metrics: {
          ...metrics,
          queues: queueStats,
          cache: cacheStats,
        },
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // ── AVATARES ────────────────────────────────────────
  fastify.get('/avatar', async (request) => {
    try {
      const { chatId } = request.query
      const url = await whatsappService.getProfilePicUrl(chatId)
      return { url }
    } catch (e) {
      return { url: null }
    }
  })

  // ── MEMBROS DE GRUPO ─────────────────────────────────
  fastify.get('/group-members/:gid', { preHandler: [apiKeyAuth] }, async (request, reply) => {
    try {
      const members = await whatsappService.getGroupMembers(decodeURIComponent(request.params.gid))
      return members
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // ── ENVIO DE MÍDIA ──────────────────────────────────
  fastify.post('/send-media', { preHandler: [apiKeyAuth] }, async (request, reply) => {
    try {
      const result = await whatsappService.sendMedia(request.body || {})
      return result
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
    }
  })

  // ── VARIAÇÕES COM IA ────────────────────────────────
  fastify.post('/ai/variations', { preHandler: [apiKeyAuth] }, async (request) => {
    try {
      const { message } = request.body || {}
      if (!message) return { variations: [] }
      const variations = await whatsappService.generateVariations(message)
      return { variations }
    } catch (e) {
      return { variations: [request.body?.message || ''], error: e.message }
    }
  })

  // ── LABELS / SELOS ──────────────────────────────────
  fastify.get('/labels', async () => whatsappService.getLabels())
  fastify.post('/labels', { preHandler: [apiKeyAuth] }, async (request) => {
    const { name, color } = request.body
    return whatsappService.createLabel({ name, color })
  })
  fastify.delete('/labels/:id', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.deleteLabel(request.params.id)
  })
  fastify.post('/labels/:id/contacts', { preHandler: [apiKeyAuth] }, async (request) => {
    const { contactId } = request.body
    return whatsappService.addContactToLabel(request.params.id, contactId)
  })
  fastify.delete('/labels/:id/contacts/:contactId', { preHandler: [apiKeyAuth] }, async (request) => {
    return whatsappService.removeContactFromLabel(request.params.id, request.params.contactId)
  })

  // ── QUICK REPLIES ────────────────────────────────────
  fastify.get('/quick-replies', { preHandler: [apiKeyAuth] }, async () => whatsappService.getQuickReplies())
  fastify.post('/quick-replies', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.addQuickReply(req.body || {}))
  fastify.delete('/quick-replies/:id', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.deleteQuickReply(req.params.id))

  // ── NOTAS INTERNAS ────────────────────────────────────
  fastify.get('/notes/:chatId', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.getNotes(decodeURIComponent(req.params.chatId)))
  fastify.post('/notes/:chatId', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.addNote(decodeURIComponent(req.params.chatId), req.body?.text))
  fastify.delete('/notes/:chatId/:noteId', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.deleteNote(decodeURIComponent(req.params.chatId), req.params.noteId))

  // ── STATUS DE CONVERSA ────────────────────────────────
  fastify.post('/status/:chatId', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.setConvStatus(decodeURIComponent(req.params.chatId), req.body?.status))

  // ── AGENDAMENTO ───────────────────────────────────────
  fastify.post('/schedule', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.scheduleMessage(req.body || {}))
  fastify.get('/schedule', { preHandler: [apiKeyAuth] }, async () => whatsappService.listScheduled())
  fastify.delete('/schedule/:id', { preHandler: [apiKeyAuth] }, async (req) => whatsappService.cancelScheduled(req.params.id))

  // ── TRANSCRIÇÃO DE ÁUDIO ──────────────────────────────
  fastify.post('/transcribe', { preHandler: [apiKeyAuth] }, async (req) => {
    try {
      const { audio, mimetype } = req.body || {}
      if (!audio) return { error: 'Nenhum áudio enviado' }
      if (!process.env.GEMINI_API_KEY) return { error: 'GEMINI_API_KEY não configurada' }
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent([
        { inlineData: { data: audio, mimeType: mimetype || 'audio/ogg' } },
        'Transcreva exatamente o que foi dito neste áudio em português. Responda somente com a transcrição, sem explicações.'
      ])
      return { text: result.response.text().trim() }
    } catch (e) {
      return { error: e.message }
    }
  })

  // ── KANBAN DATA ───────────────────────────────────────
  fastify.get('/kanban', { preHandler: [apiKeyAuth] }, async () => {
    const contacts = whatsappService.listCrmContacts()
    const byStage = { novo: [], qualificado: [], proposta: [], negociacao: [], fechado: [] }
    for (const c of contacts) {
      const stage = c.stage || 'novo'
      if (byStage[stage]) byStage[stage].push(c)
      else byStage['novo'].push(c)
    }
    return byStage
  })

  // ── DASHBOARD DATA ────────────────────────────────────
  fastify.get('/dashboard', { preHandler: [apiKeyAuth] }, async () => {
    try {
      const { PrismaClient } = require('@prisma/client')
      const now = new Date()
      const days7ago = new Date(now - 7 * 86400000)

      const [totalLeads, totalMsgs, recentMsgs] = await Promise.all([
        prisma.lead.count(),
        prisma.message.count(),
        prisma.message.findMany({
          where: { timestamp: { gte: days7ago } },
          select: { timestamp: true, fromPhone: true },
          orderBy: { timestamp: 'asc' }
        })
      ])

      // Agrupar por dia
      const byDay = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 86400000)
        byDay[d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = { received: 0, sent: 0 }
      }
      for (const m of recentMsgs) {
        const key = new Date(m.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        if (byDay[key]) {
          if (m.fromPhone === 'bot' || m.fromPhone === 'agent') byDay[key].sent++
          else byDay[key].received++
        }
      }

      return {
        totalLeads,
        totalMessages: totalMsgs,
        connectedChats: whatsappService.getState().connected,
        byDay,
        stages: { novo: 0, qualificado: 0, proposta: 0, negociacao: 0, fechado: 0 }
      }
    } catch (e) {
      return { error: e.message, byDay: {}, totalLeads: 0, totalMessages: 0 }
    }
  })

  // GET /health/extended — Saúde estendida
  fastify.get('/health/extended', async () => {
    return {
      whatsapp: {
        connected: whatsappService.getState().connected,
        ready: whatsappService.getState().ready,
        lastEvent: whatsappService.getState().lastEventAt,
      },
      database: {
        type: 'Prisma/SQLite',
        leads: await prisma.lead.count(),
        conversations: await prisma.conversation.count(),
        messages: await prisma.message.count(),
      },
      cache: cacheService.getStatus(),
      queues: await jobsService.getAllQueueStats(),
    }
  })
}
