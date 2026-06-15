const path = require('path')
const fs = require('fs')
const os = require('os')
const svc = require('./whatsapp.service')
const WA_KEY = process.env.WHATSAPP_API_KEY

// ===== STORES =====
const STORE_DIR = path.join(os.homedir(), '.whatsapp_data')
const MEDIA_DIR = path.join(STORE_DIR, 'media-cache')
fs.mkdirSync(STORE_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR, { recursive: true })

function readStore(name) { try { return JSON.parse(fs.readFileSync(path.join(STORE_DIR, name + '.json'), 'utf8')) } catch { return null } }
function writeStore(name, data) { fs.writeFileSync(path.join(STORE_DIR, name + '.json'), JSON.stringify(data, null, 2)) }
function mediaCachePath(id) { return path.join(MEDIA_DIR, id.replace(/[^a-z0-9]/gi, '_')) }

// ===== PRE-CACHE: baixar mídia ao receber mensagem =====
svc.emitter.on('wa-event', async (type, data) => {
  if (type !== 'message' || !data) return
  const id = data.key?.id || data.id
  const chatId = data.key?.remoteJid || data.chatId || data.from
  if (!id || !chatId) return
  const cp = mediaCachePath(id)
  if (fs.existsSync(cp + '.bin')) return // já em cache
  try {
    const media = await svc.getMedia(id, chatId)
    if (media) {
      fs.writeFileSync(cp + '.bin', media.buffer || media.data)
      fs.writeFileSync(cp + '.mime', media.mimetype || 'application/octet-stream')
    }
  } catch {}
})

// ===== AUTH =====
async function auth(req, reply) {
  if (!WA_KEY) return
  if (req.query.key !== WA_KEY && req.headers['x-wa-key'] !== WA_KEY) return reply.code(401).send({ error: 'Nao autorizado' })
}

module.exports = async function (fastify) {

  // CRM HTML
  fastify.get('/crm', async (req, reply) => {
    return reply.type('text/html').send(fs.readFileSync(path.join(__dirname, '../../crm.html'), 'utf8'))
  })

  // Status
  fastify.get('/status', { preHandler: auth }, async () => {
    const st = svc.getState()
    return { connected: st.connected, ready: st.ready, qrDataUrl: st.qrDataUrl || null }
  })

  // SSE Events
  fastify.get('/events', { preHandler: auth }, async (req, reply) => {
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
    const handler = (type, data) => reply.raw.write('event: wa-event\ndata: ' + JSON.stringify({ type, ...data }) + '\n\n')
    svc.emitter.on('wa-event', handler)
    const ka = setInterval(() => reply.raw.write(': ping\n\n'), 25000)
    req.raw.on('close', () => { svc.emitter.off('wa-event', handler); clearInterval(ka) })
    await new Promise(() => {})
  })

  // Chats / Mensagens
  fastify.get('/chats', { preHandler: auth }, async (req) => svc.listChats(parseInt(req.query.limit) || 2000))
  fastify.get('/messages', { preHandler: auth }, async (req) => svc.getMessages(req.query.chatId, parseInt(req.query.limit) || 50))
  fastify.get('/messages/:chatId', { preHandler: auth }, async (req) => svc.getMessages(req.params.chatId, parseInt(req.query.limit) || 50))

  // Enviar texto
  fastify.post('/send', { preHandler: auth }, async (req, reply) => {
    const { chatId, text } = req.body || {}
    if (!chatId || !text) return reply.code(400).send({ error: 'chatId e text obrigatorios' })
    await svc.sendMessage(chatId, text)
    return { ok: true }
  })

  // Enviar mídia (arquivo / PTT)
  fastify.post('/send-media', { preHandler: auth }, async (req, reply) => {
    const { chatId, media, mimetype, filename, caption, ptt } = req.body || {}
    if (!chatId || !media) return reply.code(400).send({ error: 'chatId e media obrigatorios' })
    await svc.sendMedia(chatId, media, mimetype, filename, caption, ptt)
    return { ok: true }
  })

  // Avatar
  fastify.get('/avatar', { preHandler: auth }, async (req, reply) => {
    const jid = req.query.chatId || req.query.jid
    try {
      const url = await svc.getProfilePicUrl(jid)
      if (!url) return reply.code(404).send({ error: 'Sem foto' })
      return { url }
    } catch { return reply.code(404).send({ error: 'Sem foto' }) }
  })

  // ===== MÍDIA — com cache em disco =====
  fastify.get('/media', { preHandler: auth }, async (req, reply) => {
    const { id, chatId } = req.query
    if (!id) return reply.code(400).send({ error: 'id obrigatorio' })

    const cp = mediaCachePath(id)

    // 1. Tentar cache em disco
    if (fs.existsSync(cp + '.bin')) {
      const mime = fs.existsSync(cp + '.mime') ? fs.readFileSync(cp + '.mime', 'utf8') : 'application/octet-stream'
      reply.type(mime)
      return reply.send(fs.readFileSync(cp + '.bin'))
    }

    // 2. Tentar baixar do WhatsApp
    try {
      const data = await svc.getMedia(id, chatId)
      if (!data) return reply.code(404).send({ error: 'Midia nao encontrada' })
      const buf = data.buffer || data.data
      const mime = data.mimetype || 'application/octet-stream'
      // Salvar em cache
      fs.writeFileSync(cp + '.bin', buf)
      fs.writeFileSync(cp + '.mime', mime)
      reply.type(mime)
      return reply.send(buf)
    } catch (e) {
      // 3. Tentar via getMessages como fallback
      try {
        if (chatId) {
          const msgs = await svc.getMessages(chatId, 200)
          const arr = Array.isArray(msgs) ? msgs : (msgs.messages || [])
          const msg = arr.find(m => (m.id || m.key?.id) === id)
          if (msg) {
            const data2 = await svc.getMedia(id, chatId, msg)
            if (data2) {
              const buf = data2.buffer || data2.data
              const mime = data2.mimetype || 'application/octet-stream'
              fs.writeFileSync(cp + '.bin', buf)
              fs.writeFileSync(cp + '.mime', mime)
              reply.type(mime)
              return reply.send(buf)
            }
          }
        }
      } catch {}
      return reply.code(404).send({ error: 'Midia expirada - disponivel apenas em mensagens recentes' })
    }
  })

  // Labels / Kanban legado
  fastify.get('/labels', { preHandler: auth }, async () => svc.getLabels ? svc.getLabels() : [])
  fastify.get('/kanban', { preHandler: auth }, async () => svc.getCrm ? svc.getCrm() : { stages: [], cards: [] })
  fastify.post('/kanban/move', { preHandler: auth }, async (req, reply) => {
    const { chatId, stage } = req.body || {}
    if (!chatId || !stage) return reply.code(400).send({ error: 'chatId e stage obrigatorios' })
    if (svc.saveCrm) svc.saveCrm(chatId, { stage })
    return { ok: true }
  })

  // Respostas rápidas
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

  // ===== AGENDAMENTO =====
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

  // ===== TEMPLATES =====
  fastify.get('/templates', { preHandler: auth }, async () => {
    return readStore('templates') || [
      { id: '1', shortcut: '/oi', text: 'Ola {{nome}}! Tudo bem? Aqui e da APS-EDU.' },
      { id: '2', shortcut: '/preco', text: 'Ola {{nome}}! Nossos planos comecom a partir de R$ 99/mes.' },
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
    writeStore('templates', (readStore('templates') || []).filter(t => t.id !== req.params.id))
    return { ok: true }
  })

  // ===== PIPELINE =====
  fastify.get('/pipeline', { preHandler: auth }, async () => {
    return readStore('pipeline') || { stages: ['Novo Lead','Em Contato','Proposta Enviada','Negociando','Fechado','Perdido'], contacts: {} }
  })
  fastify.post('/pipeline/contact', { preHandler: auth }, async (req, reply) => {
    const { chatId, name, stage, tags } = req.body || {}
    if (!chatId) return reply.code(400).send({ error: 'chatId obrigatorio' })
    const pipeline = readStore('pipeline') || { stages: ['Novo Lead','Em Contato','Proposta Enviada','Negociando','Fechado','Perdido'], contacts: {} }
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

  // ===== BOT =====
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

  // ===== ANALYTICS =====
  fastify.get('/analytics', { preHandler: auth }, async () => {
    const events = readStore('analytics') || []
    const campaigns = readStore('campaigns') || []
    const now = Date.now(), day = 86400000
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

  // ===== AI =====
  fastify.post('/ai/variations', { preHandler: auth }, async (req, reply) => {
    try { return { variations: await svc.generateVariations(req.body.message) } }
    catch (e) { return reply.code(500).send({ error: e.message }) }
  })

  // ===== SYNC CRM (HubSpot / Pipedrive) =====
  fastify.post('/sync/hubspot', { preHandler: auth }, async (req, reply) => {
    const { token } = req.body || {}
    if (!token) return reply.code(400).send({ error: 'token obrigatorio' })
    try {
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,phone,email', {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (!r.ok) return reply.code(400).send({ error: 'Token HubSpot invalido' })
      const d = await r.json()
      const contacts = (d.results || []).map(c => ({
        name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') || 'Sem nome',
        phone: c.properties.phone || '', email: c.properties.email || '', source: 'hubspot'
      }))
      const pipeline = readStore('pipeline') || { stages: ['Novo Lead','Em Contato','Proposta Enviada','Negociando','Fechado','Perdido'], contacts: {} }
      let imported = 0
      contacts.forEach(c => {
        if (!c.phone) return
        const chatId = c.phone.replace(/\D/g, '') + '@s.whatsapp.net'
        if (!pipeline.contacts[chatId]) { pipeline.contacts[chatId] = { chatId, name: c.name, stage: 'Novo Lead', tags: ['hubspot'] }; imported++ }
      })
      writeStore('pipeline', pipeline)
      return { ok: true, total: contacts.length, imported }
    } catch (e) { return reply.code(500).send({ error: e.message }) }
  })

  fastify.post('/sync/pipedrive', { preHandler: auth }, async (req, reply) => {
    const { token } = req.body || {}
    if (!token) return reply.code(400).send({ error: 'token obrigatorio' })
    try {
      const r = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${token}&limit=100`)
      if (!r.ok) return reply.code(400).send({ error: 'Token Pipedrive invalido' })
      const d = await r.json()
      const contacts = (d.data || []).map(c => ({
        name: c.name || 'Sem nome',
        phone: (c.phone || []).find(p => p.value)?.value || '', source: 'pipedrive'
      }))
      const pipeline = readStore('pipeline') || { stages: ['Novo Lead','Em Contato','Proposta Enviada','Negociando','Fechado','Perdido'], contacts: {} }
      let imported = 0
      contacts.forEach(c => {
        if (!c.phone) return
        const chatId = c.phone.replace(/\D/g, '') + '@s.whatsapp.net'
        if (!pipeline.contacts[chatId]) { pipeline.contacts[chatId] = { chatId, name: c.name, stage: 'Novo Lead', tags: ['pipedrive'] }; imported++ }
      })
      writeStore('pipeline', pipeline)
      return { ok: true, total: contacts.length, imported }
    } catch (e) { return reply.code(500).send({ error: e.message }) }
  })

  fastify.get('/sync/config', { preHandler: auth }, async () => readStore('sync-config') || {})
  fastify.post('/sync/config', { preHandler: auth }, async (req) => {
    writeStore('sync-config', req.body)
    return { ok: true }
  })
}
