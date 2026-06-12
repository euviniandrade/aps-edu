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

  // Servir mídia (imagens, áudios, vídeos, documentos) das mensagens
  fastify.get('/media', { preHandler: [apiKeyAuth] }, async (request, reply) => {
    const { id } = request.query
    if (!id) return reply.code(400).send({ error: 'id obrigatório' })
    const result = await whatsappService.getMedia(id)
    if (!result) return reply.code(404).send({ error: 'Mídia não encontrada' })
    reply.header('Content-Type', result.mimetype)
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(result.buffer)
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
    // Se já há chats carregados, notifica o frontend imediatamente
    whatsappService.listChats(5).then(c => { if (c.length > 0) send('chats.update', { count: c.length }) }).catch(() => {})

    const onMessage = (data) => send('message', data)
    const onState = (data) => send('state', data)
    const onChatsUpdate = (data) => send('chats.update', data)
    const onMessageUpdate = (data) => send('message.update', data)

    whatsappService.emitter.on('message', onMessage)
    whatsappService.emitter.on('state', onState)
    whatsappService.emitter.on('chats.update', onChatsUpdate)
    whatsappService.emitter.on('message.update', onMessageUpdate)

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
    whatsappService.emitter.off('chats.update', onChatsUpdate)
    whatsappService.emitter.off('message.update', onMessageUpdate)
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

  // ── LIMPAR HISTÓRICO DE CHAT (força re-sync) ─────────
  fastify.delete('/messages/:chatId', { preHandler: [apiKeyAuth] }, async (request, reply) => {
    try {
      const chatId = decodeURIComponent(request.params.chatId)
      return whatsappService.clearChatHistory(chatId)
    } catch (e) {
      return reply.code(e.statusCode || 500).send({ error: e.message })
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
    const byStage = { aguardando: [], urgentes: [], ministerio: [], marketing: [], respondidos: [] }
    for (const c of contacts) {
      const stage = c.stage || 'aguardando'
      if (byStage[stage] !== undefined) byStage[stage].push(c)
      else byStage['aguardando'].push(c)
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

  // ── AI IMPROVEMENT AGENTS ──────────────────────────────────────────────────

  // POST /ai-improve/analyze — Analisa a plataforma e sugere melhorias via Gemini
  fastify.post('/ai-improve/analyze', { preHandler: apiKeyAuth }, async (request, reply) => {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

      // Backlog de funcionalidades pesquisadas de plataformas líderes
      const FEATURE_BACKLOG = [
        { id: 'quick-replies-shortcuts', category: 'Produtividade', title: 'Atalhos de teclado para respostas rápidas', description: 'Digitar /saudacao ou pressionar Ctrl+1 insere mensagem pré-definida automaticamente', impact: 'Alto — reduz tempo de resposta em 40%' },
        { id: 'unread-badge-counter', category: 'UX', title: 'Contador de não lidos na aba do navegador', description: 'Título da aba mostra "(3) APS EDU CRM" quando há mensagens não lidas', impact: 'Médio — melhora notificação passiva' },
        { id: 'contact-notes', category: 'CRM', title: 'Notas internas por contato', description: 'Campo de notas privadas visível só para a equipe, não enviado ao cliente', impact: 'Alto — melhora contexto de atendimento' },
        { id: 'message-templates', category: 'Produtividade', title: 'Templates de mensagem por categoria', description: 'Biblioteca de templates para: boas-vindas, follow-up, cobrança, encerramento', impact: 'Alto — padroniza comunicação' },
        { id: 'conversation-search', category: 'UX', title: 'Busca dentro da conversa aberta', description: 'Ctrl+F dentro do chat para pesquisar texto no histórico de mensagens', impact: 'Médio — facilita auditoria' },
        { id: 'sound-notifications', category: 'UX', title: 'Som de notificação configurável', description: 'Toque sonoro ao receber mensagem nova, com opção de silenciar por contato', impact: 'Médio — não perder mensagens' },
        { id: 'read-receipt-tracking', category: 'Analytics', title: 'Confirmação de leitura e status de entrega', description: 'Mostrar ✓✓ azul quando cliente leu, ✓✓ cinza quando entregue', impact: 'Alto — visibilidade de engajamento' },
        { id: 'bulk-label-assign', category: 'CRM', title: 'Aplicar etiqueta em múltiplos contatos', description: 'Selecionar vários contatos e aplicar/remover etiqueta de uma vez', impact: 'Médio — gestão de funil em massa' },
        { id: 'chat-assign-agent', category: 'CRM', title: 'Atribuir conversa a um agente', description: 'Transferir atendimento entre membros da equipe com notificação', impact: 'Alto — trabalho em equipe' },
        { id: 'kanban-drag-drop', category: 'UX', title: 'Drag & drop no Kanban', description: 'Arrastar cards entre colunas do Kanban para mudar estágio', impact: 'Alto — UX mais intuitiva' },
        { id: 'dark-light-theme', category: 'Design', title: 'Alternância de tema claro/escuro', description: 'Botão para alternar entre modo escuro (atual) e claro', impact: 'Baixo — preferência visual' },
        { id: 'export-conversations', category: 'Analytics', title: 'Exportar conversa como PDF ou CSV', description: 'Botão para baixar o histórico de chat em PDF formatado ou CSV', impact: 'Médio — compliance e auditoria' },
        { id: 'scheduled-messages', category: 'Produtividade', title: 'Agendamento de mensagens aprimorado', description: 'Visualizar e cancelar mensagens agendadas numa fila dedicada', impact: 'Médio — controle de automações' },
        { id: 'ai-summary-conversation', category: 'IA', title: 'Resumo IA da conversa', description: 'Botão "Resumir" que gera um resumo em 3 linhas do histórico de chat usando Gemini', impact: 'Alto — acelera onboarding de agente' },
        { id: 'emoji-reactions', category: 'UX', title: 'Reações rápidas com emoji', description: 'Passar o mouse na mensagem exibe opções de reação (👍❤️😂)', impact: 'Baixo — engajamento visual' },
      ]

      const prompt = `Você é um especialista em CRM e plataformas de atendimento ao cliente (Intercom, Zendesk, Chatwoot, WATI, Trengo, Kommo).

Analise este backlog de funcionalidades para um CRM WhatsApp educacional e selecione as 5 MAIS IMPACTANTES e VIÁVEIS para implementar agora:

BACKLOG:
${JSON.stringify(FEATURE_BACKLOG, null, 2)}

Retorne EXATAMENTE este JSON (sem markdown, sem explicações):
{
  "suggestions": [
    {
      "id": "string — id da funcionalidade do backlog",
      "category": "string",
      "title": "string — título conciso",
      "description": "string — descrição clara do que será implementado",
      "impact": "string — impacto esperado",
      "priority": "high|medium|low"
    }
  ]
}`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Gemini não retornou JSON válido')
      const parsed = JSON.parse(jsonMatch[0])
      return parsed

    } catch (e) {
      fastify.log.error('AI analyze error:', e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // POST /ai-improve/apply — Aplica melhorias aprovadas e faz commit no git
  fastify.post('/ai-improve/apply', { preHandler: apiKeyAuth }, async (request, reply) => {
    try {
      const { suggestions = [] } = request.body || {}
      if (!suggestions.length) return reply.code(400).send({ error: 'Nenhuma sugestão fornecida' })

      const { execSync } = require('child_process')
      const path = require('path')
      const fs = require('fs')

      const ROOT = path.resolve(__dirname, '../../../../')
      let applied = 0
      const appliedTitles = []

      for (const s of suggestions) {
        try {
          // Por ora: registra a melhoria aprovada num arquivo de roadmap
          const roadmapPath = path.join(ROOT, 'ROADMAP-IA.md')
          const entry = `\n## ✅ ${s.title}\n**Categoria:** ${s.category}  \n**Impacto:** ${s.impact || 'N/A'}  \n**Descrição:** ${s.description}\n**Aprovado em:** ${new Date().toLocaleDateString('pt-BR')}\n`

          if (!fs.existsSync(roadmapPath)) {
            fs.writeFileSync(roadmapPath, '# Roadmap de Melhorias — APS EDU CRM\n\nGerado automaticamente pelo Agente IA.\n')
          }
          fs.appendFileSync(roadmapPath, entry)
          applied++
          appliedTitles.push(s.title)
        } catch (err) {
          fastify.log.warn('Erro ao aplicar sugestão:', s.id, err.message)
        }
      }

      // Commit no git
      let commitHash = null
      try {
        execSync('git -C ' + ROOT + ' add ROADMAP-IA.md', { stdio: 'pipe' })
        const commitMsg = `chore: AI agent aprovações [${appliedTitles.map(t => t.substring(0, 30)).join(', ')}]`
        execSync(`git -C ${ROOT} commit -m "${commitMsg.replace(/"/g, "'")}"`, { stdio: 'pipe' })
        commitHash = execSync(`git -C ${ROOT} rev-parse --short HEAD`, { stdio: 'pipe' }).toString().trim()
        execSync(`git -C ${ROOT} push`, { stdio: 'pipe' })
      } catch (gitErr) {
        fastify.log.warn('Git commit/push error (non-fatal):', gitErr.message)
      }

      return {
        applied,
        commit: commitHash,
        message: `${applied} melhoria(s) registrada(s) no roadmap${commitHash ? ' e commitadas' : ''}.`,
        titles: appliedTitles
      }
    } catch (e) {
      fastify.log.error('AI apply error:', e)
      return reply.code(500).send({ error: e.message })
    }
  })
}
