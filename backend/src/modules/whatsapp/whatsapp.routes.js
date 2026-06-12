const path = require('path')
const fs = require('fs')
const whatsappService = require('./whatsapp.service')
const WA_KEY = process.env.WHATSAPP_API_KEY
async function apiKeyAuth(req, reply) {
  if (!WA_KEY) return
  if (req.headers['x-wa-key'] !== WA_KEY) return reply.code(401).send({ error: 'Nao autorizado' })
}
module.exports = async function (fastify) {
  fastify.get('/crm', async (req, reply) => {
    const htmlPath = path.join(__dirname, '../../crm.html')
    return reply.type('text/html').send(fs.readFileSync(htmlPath, 'utf8'))
  })
  fastify.get('/status', { preHandler: apiKeyAuth }, async () => {
    const st = whatsappService.getState()
    return { connected: st.connected, ready: st.ready, qrDataUrl: st.qrDataUrl || null }
  })
  fastify.get('/events', { preHandler: apiKeyAuth }, async (req, reply) => {
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
    const handler = ({ event, data }) => reply.raw.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n")
    whatsappService.onEvent(handler)
    const ka = setInterval(() => reply.raw.write(': ping\n\n'), 25000)
    req.raw.on('close', () => { whatsappService.offEvent(handler); clearInterval(ka) })
    await new Promise(() => {})
  })
  fastify.get('/chats', { preHandler: apiKeyAuth }, async (req) => whatsappService.listChats(parseInt(req.query.limit) || 2000))
  fastify.get('/messages/:chatId', { preHandler: apiKeyAuth }, async (req) => whatsappService.getMessages(req.params.chatId, parseInt(req.query.limit) || 50))
  fastify.post('/send', { preHandler: apiKeyAuth }, async (req, reply) => {
    const { chatId, text } = req.body || {}
    if (!chatId || !text) return reply.code(400).send({ error: 'chatId e text obrigatorios' })
    await whatsappService.sendMessage(chatId, text)
    return { ok: true }
  })
  fastify.post('/send-media', { preHandler: apiKeyAuth }, async (req, reply) => {
    const { chatId, media, mimetype, filename, caption, ptt } = req.body || {}
    if (!chatId || !media) return reply.code(400).send({ error: 'chatId e media obrigatorios' })
    await whatsappService.sendMedia(chatId, media, mimetype, filename, caption, ptt)
    return { ok: true }
  })
  fastify.post('/schedule', { preHandler: apiKeyAuth }, async (req, reply) => {
    const { chatId, text, sendAt } = req.body || {}
    if (!chatId || !text || !sendAt) return reply.code(400).send({ error: 'Campos obrigatorios' })
    await whatsappService.scheduleMessage(chatId, text, new Date(sendAt))
    return { ok: true }
  })
  fastify.get('/avatar/:jid', { preHandler: apiKeyAuth }, async (req, reply) => {
    try { const url = await whatsappService.getAvatar(req.params.jid); if (!url) return reply.code(404).send({ error: 'Sem foto' }); return { url } }
    catch { return reply.code(404).send({ error: 'Sem foto' }) }
  })
  fastify.get('/labels', { preHandler: apiKeyAuth }, async () => whatsappService.getLabels ? whatsappService.getLabels() : [])
  fastify.get('/kanban', { preHandler: apiKeyAuth }, async () => whatsappService.getKanban ? whatsappService.getKanban() : { stages: [], cards: [] })
  fastify.post('/kanban/move', { preHandler: apiKeyAuth }, async (req, reply) => {
    const { chatId, stage } = req.body || {}
    if (!chatId || !stage) return reply.code(400).send({ error: 'chatId e stage obrigatorios' })
    if (whatsappService.moveKanban) whatsappService.moveKanban(chatId, stage)
    return { ok: true }
  })
  fastify.get('/quick-replies', { preHandler: apiKeyAuth }, async () => whatsappService.getQuickReplies ? whatsappService.getQuickReplies() : [])
  fastify.post('/quick-replies', { preHandler: apiKeyAuth }, async (req) => { if (whatsappService.saveQuickReply) whatsappService.saveQuickReply(req.body.shortcut, req.body.message); return { ok: true } })
  fastify.delete('/quick-replies/:id', { preHandler: apiKeyAuth }, async (req) => { if (whatsappService.deleteQuickReply) whatsappService.deleteQuickReply(req.params.id); return { ok: true } })
  fastify.post('/transcribe', { preHandler: apiKeyAuth }, async (req, reply) => {
    try { return { text: await whatsappService.transcribeAudio(req.body.audio, req.body.mimetype) } }
    catch (e) { return reply.code(500).send({ error: e.message }) }
  })
  fastify.post('/ai/variations', { preHandler: apiKeyAuth }, async (req, reply) => {
    try { return { variations: await whatsappService.generateVariations(req.body.message) } }
    catch (e) { return reply.code(500).send({ error: e.message }) }
  })
  fastify.post('/mark-read/:chatId', { preHandler: apiKeyAuth }, async (req) => { if (whatsappService.markRead) await whatsappService.markRead(req.params.chatId); return { ok: true } })
  fastify.post('/set-label', { preHandler: apiKeyAuth }, async (req) => { if (whatsappService.setLabel) whatsappService.setLabel(req.body.chatId, req.body.label); return { ok: true } })
  fastify.post('/ai-improve/analyze', { preHandler: apiKeyAuth }, async (req, reply) => {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: 'gemini-1.5-flash' })
      const backlog = [{id:'quick-replies-shortcuts',category:'Produtividade',title:'Atalhos para respostas rapidas',description:'Digitar /saudacao insere mensagem automaticamente',impact:'Alto'},{id:'contact-notes',category:'CRM',title:'Notas internas por contato',description:'Notas privadas visiveis so para equipe',impact:'Alto'},{id:'message-templates',category:'Produtividade',title:'Templates de mensagem',description:'Biblioteca de templates prontos',impact:'Alto'},{id:'kanban-drag-drop',category:'UX',title:'Drag and drop no Kanban',description:'Arrastar cards entre colunas',impact:'Alto'},{id:'ai-summary',category:'IA',title:'Resumo IA da conversa',description:'Botao Resumir usando Gemini',impact:'Alto'},{id:'unread-badge',category:'UX',title:'Contador de nao lidos na aba',description:'Titulo da aba mostra contagem',impact:'Medio'},{id:'sound-notif',category:'UX',title:'Som de notificacao',description:'Toque sonoro ao receber mensagem',impact:'Medio'},{id:'bulk-label',category:'CRM',title:'Etiqueta em multiplos contatos',description:'Aplicar etiqueta em varios de uma vez',impact:'Medio'},{id:'export-pdf',category:'Analytics',title:'Exportar conversa PDF',description:'Baixar historico como PDF',impact:'Medio'},{id:'read-receipts',category:'Analytics',title:'Status de leitura',description:'Check azul quando cliente leu',impact:'Alto'}]
      const result = await model.generateContent("Especialista CRM. Selecione as 5 mais impactantes: " + JSON.stringify(backlog) + "\nRetorne APENAS JSON: {\"suggestions\":[{\"id\":\"\",\"category\":\"\",\"title\":\"\",\"description\":\"\",\"impact\":\"\",\"priority\":\"high|medium|low\"}]}")
      const text = result.response.text().trim()
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Resposta invalida')
      return JSON.parse(m[0])
    } catch (e) { return reply.code(500).send({ error: e.message }) }
  })
  fastify.post('/ai-improve/apply', { preHandler: apiKeyAuth }, async (req, reply) => {
    try {
      const { suggestions = [] } = req.body || {}
      if (!suggestions.length) return reply.code(400).send({ error: 'Nenhuma sugestao' })
      const { execSync } = require('child_process')
      const ROOT = path.resolve(__dirname, ''../../../../'')
      const roadmapPath = path.join(ROOT, 'ROADMAP-IA.md')
      if (!fs.existsSync(roadmapPath)) fs.writeFileSync(roadmapPath, '# Roadmap de Melhorias APS EDU CRM\n\nGerado pelo Agente IA.\n')
      for (const s of suggestions) fs.appendFileSync(roadmapPath, "\n## " + s.title + "\n**Categoria:** " + s.category + "\n**Impacto:** " + (s.impact||'N/A') + "\n**Descricao:** " + s.description + "\n**Data:** " + new Date().toLocaleDateString('pt-BR') + "\n")
      let commitHash = null
      try {
        execSync("git -C " + ROOT + " add ROADMAP-IA.md", { stdio: 'pipe' })
        execSync("git -C " + ROOT + " commit -m \"chore: AI melhorias (" + suggestions.length + ")\"", { stdio: 'pipe' })
        commitHash = execSync("git -C " + ROOT + " rev-parse --short HEAD", { stdio: 'pipe' }).toString().trim()
        execSync("git -C " + ROOT + " push", { stdio: 'pipe' })
      } catch (e) { fastify.log.warn('git error:', e.message) }
      return { applied: suggestions.length, commit: commitHash, message: suggestions.length + ' melhoria(s) registrada(s).' }
    } catch (e) { return reply.code(500).send({ error: e.message }) }
  })
}
