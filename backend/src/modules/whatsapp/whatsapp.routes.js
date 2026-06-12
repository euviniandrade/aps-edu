const path = require('path')
const fs = require('fs')
const svc = require('./whatsapp.service')
const WA_KEY = process.env.WHATSAPP_API_KEY

// JSON store helpers
const STORE_DIR = path.join(__dirname, '../../../../.whatsapp_data')
fs.mkdirSync(STORE_DIR, { recursive: true })
function readStore(name) { try { return JSON.parse(fs.readFileSync(path.join(STORE_DIR, name + '.json'), 'utf8')) } catch { return null } }
function writeStore(name, data) { fs.writeFileSync(path.join(STORE_DIR, name + '.json'), JSON.stringify(data, null, 2)) }

async function auth(req, reply) {
  if (!WA_KEY) return
  if (req.query.key !== WA_KEY && req.headers['x-wa-key'] !== WA_KEY) return reply.code(401).send({ error: 'Nao autorizado' })
}

module.exports = async function (fastify) {
  fastify.get('/crm', async (req, reply) => {
    return reply.type('text/html').send(fs.readFileSync(path.join(__dirname, '../../crm.html'), 'utf8'))
  })

  fastify.get('/status', { preHandler: auth }, async () => {
    const st = svc.getState()
    return { connected: st.connected, ready: st.ready, qrDataUrl: st.qrDataUrl || null }
  })

  fastify.get('/events', { preHandler: auth }, async (req, reply) => {
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
    const handler = (event, data) => reply.raw.write('event: wa-event\ndata: ' + JSON.stringify({ type: event, ...data }) + '\n\n')
    svc.emitter.on('wa-event', handler)
    const ka = setInterval(() => reply.raw.write(': ping\n\n'), 25000)
    req.raw.on('close', () => { svc.emitter.off('wa-event', handler); clearInterval(ka) })
    await new Promise(() => {})
  })

  fastify.get('/chats', { preHandler: auth }, async (req) => svc.listChats(parseInt(req.query.limit) || 2000))
  fastify.get('/messages', { preHandler: auth }, async (req) => svc.getMessages(req.query.chatId, parseInt(req.query.limit) || 50))
  fastify.get('/messages/:chatId', { preHandler: auth }, async (req) => svc.getMessages(req.params.chatId, parseInt(req.query.limit) || 50))

  fastify.post('/send', { preHandler: auth }, async (req, reply) => {
    const { chatId, text } = req.body || {}
    if (!chatId || !text) return reply.code(400).send({ error: 'chatId e text obrigatorios' })
    await svc.sendMessage(chatId, text)
    return { ok: true }
  })

  fastify.post('/send-media', { preHandler: auth }, async (req, reply) => {
    const { chatId, media, mimetype, filename, caption, ptt } = req.body || {}
    if (!chatId || !media) return reply.code(400).send({ error: 'chatId e media obrigatorios' })
    await svc.sendMedia(chatId, media, mimetype, filename, caption, ptt)
    return { ok: true }
  })

  fastify.get('/avatar', { preHandler: auth }, async (req, reply) => {
    const jid = req.query.chatId || req.query.jid
    try {
      const url = await svc.getProfilePicUrl(jid)
      if (!url) return reply.code(404).send({ error: 'Sem foto' })
      return { url }
    } catch { return reply.code(404).send({ error: 'Sem foto' }) }
  })

  fastify.get('/media', { preHandler: auth }, async (req, reply) => {
    try {
      const data = await svc.getMedia(req.query.id, req.query.chatId)
      if (!data) return reply.code(404).send({ error: 'Midia nao encontrada' })
      reply.type(data.mimetype || 'application/octet-stream')
      return reply.send(data.buffer || data.data)
    } catch (e) { return reply.code(404).send({ error: e.message }) }
  })

  fastify.get('/labels', { preHandler: auth }, async () => svc.getLabels ? svc.getLabels() : [])

  fastify.get('/kanban', { preHandler: auth }, async () => svc.getCrm ? svc.getCrm() : { stages: [], cards: [] })
  fastify.post('/kanban/move', { preHandler: auth }, async (req, reply) => {
    const { chatId, stage } = req.body || {}
    if (!chatId || !stage) return reply.code(400).send({ error: 'chatId e stage obrigatorios' })
    if (svc.saveCrm) svc.saveCrm(chatId, { stage })
    return { ok: true }
  })

  fastify.get('/quick-replies', { preHandler: auth }, async () => svc.getQuickReplies ? svc.getQuickReplies() : [])
  fastify.post('/quick-replies', { preHandler: auth }, async (req) => {
    if (svc.addQuickReply) svc.addQuickReply(req.body.shortcut, req.body.message)
    return { ok: true }
  })
  fastify.delete('/quick-replies/:id', { preHandler: auth }, async (req) => {
    if (svc.deleteQuickReply) svc.deleteQuickReply(req.params.id)
    return { ok: true }
  })

  fastify.post('/mark-read/:chatId', { preHandler: auth }, async (req) => {
    if (svc.setConvStatus) svc.setConvStatus(req.params.chatId, 'read')
    return { ok: true }
  })
  fastify.post('/set-label', { preHandler: auth }, async (req) => {
    if (svc.addContactToLabel) svc.addContactToLabel(req.body.chatId, req.body.label)
    return { ok: true }
  })

  // AGENDAMENTO
  fastify.post('/schedule', { preHandler: auth }, async (req, reply) => {
    const { chatId, text, sendAt, contactName } = req.body || {}
    if (!chatId || !text || !sendAt) return reply.code(400).send({ error: 'Campos obrigatorios' })
    if (svc.scheduleMessage) await svc.scheduleMessage(chatId, text, new Date(sendAt))
    const scheduled = readStore('scheduled') || []
    const id = Date.now().toString()
    scheduled.push({ id, chatId, contactName: contactName || '', text, sendAt, status: 'pending', createdAt: Date.now() })
    writeStore('scheduled', scheduled)
    return { ok: true, id }
  })
  fastify.get('/scheduled', { preHandler: auth }, async () => readStore('scheduled') || [])
  fastify.delete('/scheduled/:id', { preHandler: auth }, async (req) => {
    const scheduled = (readStore('scheduled') || []).filter(m => m.id !== req.params.id)
    writeStore('scheduled', scheduled)
    if (svc.cancelScheduled) svc.cancelScheduled(req.params.id)
    return { ok: true }
  })

  // TEMPLATES
  fastify.get('/templates', { preHandler: auth }, async () => {
    return readStore('templates') || [
      { id: '1', shortcut: '/oi', text: 'Ola {{nome}}! Tudo bem? Aqui e da APS-EDU. Como posso ajudar?' },
      { id: '2', shortcut: '/preco', text: 'Ola {{nome}}! Nossos planos comecam a partir de R$ 99/mes.' },
      { id: '3', shortcut: '/obrigado', text: 'Obrigado {{nome}}! Foi um prazer atender voce!' }
    ]
  })
  fastify.post('/templates', { preHandler: auth }, async (req, reply) => {
    const { shortcut, text } = req.body || {}
    if (!shortcut || !text) return reply.code(400).send({ error: 'shortcut e text obrigatorios' })
    const tpls = readStore('templates') || []
    const id = Date.now().toString()
    tpls.push({ id, shortcut: shortcut.startsWith('/') ? shortcut : '/' + shortcut, text })
    writeStore('templates', tpls)
    return { ok: true, id }
  })
  fastify.delete('/templates/:id', { preHandler: auth }, async (req) => {
    const tpls = (readStore('templates') || []).filter(t => t.id !== req.params.id)
    writeStore('templates', tpls)
    return { ok: true }
  })

  // PIPELINE
  fastify.get('/pipeline', { preHandler: auth }, async () => {
    return readStore('pipeline') || { stages: ['Novo Lead', 'Em Contato', 'Proposta Enviada', 'Negociando', 'Fechado', 'Perdido'], contacts: {} }
  })
  fastify.post('/pipeline/contact', { preHandler: auth }, async (req, reply) => {
    const { chatId, name, stage, tags } = req.body || {}
    if (!chatId) return reply.code(400).send({ error: 'chatId obrigatorio' })
    const pipeline = readStore('pipeline') || { stages: ['Novo Lead', 'Em Contato', 'Proposta Enviada', 'Negociando', 'Fechado', 'Perdido'], contacts: {} }
    pipeline.contacts[chatId] = { chatId, name: name || chatId.split('@')[0], stage: stage || 'Novo Lead', tags: tags || [], updatedAt: Date.now() }
    writeStore('pipeline', pipeline)
    return { ok: true }
  })
  fastify.patch('/pipeline/contact/:chatId', { preHandler: auth }, async (req) => {
    const pipeline = readStore('pipeline') || { stages: [], contacts: {} }
    if (pipeline.contacts[req.params.chatId]) {
      Object.assign(pipeline.contacts[req.params.chatId], req.body, { updatedAt: Date.now() })
      writeStore('pipeline', pipeline)
    }
    return { ok: true }
  })
  fastify.delete('/pipeline/contact/:chatId', { preHandler: auth }, async (req) => {
    const pipeline = readStore('pipeline') || { stages: [], contacts: {} }
    delete pipeline.contacts[req.params.chatId]
    writeStore('pipeline', pipeline)
    return { ok: true }
  })

  // BOT
  fastify.get('/bot/rules', { preHandler: auth }, async () => {
    return readStore('bot-rules') || { enabled: false, aiEnabled: false, rules: [] }
  })
  fastify.post('/bot/rules', { preHandler: auth }, async (req) => {
    const config = readStore('bot-rules') || { enabled: false, aiEnabled: false, rules: [] }
    if (req.body.enabled !== undefined) config.enabled = req.body.enabled
    if (req.body.aiEnabled !== undefined) config.aiEnabled = req.body.aiEnabled
    if (req.body.rule) { const rule = req.body.rule; rule.id = Date.now().toString(); config.rules.push(rule) }
    writeStore('bot-rules', config)
    return { ok: true }
  })
  fastify.delete('/bot/rules/:id', { preHandler: auth }, async (req) => {
    const config = readStore('bot-rules') || { enabled: false, rules: [] }
    config.rules = config.rules.filter(r => r.id !== req.params.id)
    writeStore('bot-rules', config)
    return { ok: true }
  })

  // ANALYTICS
  fastify.get('/analytics', { preHandler: auth }, async () => {
    const events = readStore('analytics') || []
    const campaigns = readStore('campaigns') || []
    const now = Date.now(); const day = 86400000
    return {
      total_sent: events.filter(e => e.type === 'sent' || e.type === 'bulk_sent').length,
      total_received: events.filter(e => e.type === 'received').length,
      total_bulk: events.filter(e => e.type === 'bulk_sent').length,
      total_auto: events.filter(e => e.type === 'auto_replied').length,
      today_sent: events.filter(e => (e.type === 'sent' || e.type === 'bulk_sent') && e.time > now - day).length,
      today_received: events.filter(e => e.type === 'received' && e.time > now - day).length,
      campaigns: campaigns.slice(0, 20)
    }
  })
  fastify.post('/analytics/event', { preHandler: auth }, async (req) => {
    const events = readStore('analytics') || []
    events.push({ ...req.body, time: Date.now() })
    writeStore('analytics', events.slice(-5000))
    return { ok: true }
  })
  fastify.post('/analytics/campaign', { preHandler: auth }, async (req) => {
    const campaigns = readStore('campaigns') || []
    campaigns.unshift({ ...req.body, date: Date.now() })
    writeStore('campaigns', campaigns.slice(0, 100))
    return { ok: true }
  })

  // AI
  fastify.post('/ai/variations', { preHandler: auth }, async (req, reply) => {
    try { return { variations: await svc.generateVariations(req.body.message) } }
    catch (e) { return reply.code(500).send({ error: e.message }) }
  })
}