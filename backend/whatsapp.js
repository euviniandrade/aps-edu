/**
 * whatsapp.js — Servidor WhatsApp Web para o CRM Sofi
 *
 * Arquitetura:
 *   1. whatsapp-web.js (Puppeteer) conecta ao WhatsApp
 *   2. Cada mensagem recebida/enviada é salva no banco SQLite (Prisma)
 *   3. API HTTP (porta 8081) serve dados DO BANCO — rápido, paginado
 *   4. Eventos em tempo real publicados no Pusher (Vinicius recebe instantâneo)
 *   5. Sincronização de fundo: ao conectar, carrega todos os chats no banco
 *
 * Resultado: funciona com 3000+ contatos sem travar
 */
'use strict'

const { Client, LocalAuth } = require('whatsapp-web.js')
const QRCode  = require('qrcode')
const http    = require('http')
const https   = require('https')
const crypto  = require('crypto')
const path    = require('path')
const fs      = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '.env') })
const { GoogleGenerativeAI } = require('@google/generative-ai')

// ── Prisma (SQLite local) ─────────────────────────────────────────────────────
const { PrismaClient } = require('./node_modules/.prisma/whatsapp-client/default.js')
const prisma = new PrismaClient()

// ── Pusher ────────────────────────────────────────────────────────────────────
const PUSHER = {
  appId: process.env.PUSHER_APP_ID || '2161236',
  key: process.env.PUSHER_KEY || 'e86cbcb6b0359bab789f',
  secret: process.env.PUSHER_SECRET || '616cabdc538dcd018e80',
  cluster: process.env.PUSHER_CLUSTER || 'sa1',
  channel: process.env.PUSHER_CHANNEL || 'whatsapp-sofi',
}

function pusherPublish(eventName, data) {
  try {
    const body    = JSON.stringify({ name: eventName, channel: PUSHER.channel, data: JSON.stringify(data) })
    const bodyMd5 = crypto.createHash('md5').update(body).digest('hex')
    const ts      = Math.floor(Date.now() / 1000)
    const p       = `/apps/${PUSHER.appId}/events`
    const params  = `auth_key=${PUSHER.key}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`
    const sig     = crypto.createHmac('sha256', PUSHER.secret).update(['POST', p, params].join('\n')).digest('hex')
    const req = https.request({
      hostname: `api-${PUSHER.cluster}.pusher.com`, port: 443,
      path: `${p}?${params}&auth_signature=${sig}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      if (res.statusCode !== 200) {
        let b = ''; res.on('data', d => b += d)
        res.on('end', () => console.error(`[Pusher] Erro ${res.statusCode}: ${b.substring(0,100)}`))
      }
    })
    req.on('error', e => console.error('[Pusher] Rede:', e.message))
    req.write(body); req.end()
  } catch (e) { console.error('[Pusher] Exception:', e.message) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PORT = 8081

function normPhone(jid) {
  return String(jid || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
}

function normJid(num) {
  const raw = String(num || '')
  if (raw.includes('@g.us') || raw.includes('@c.us') || raw.includes('@s.whatsapp.net')) return raw
  const phone = normPhone(raw)
  return `${phone}@s.whatsapp.net`
}

async function readBody(req) {
  return new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => r(b)) })
}

async function syncAllContactNames() {
  if (!isReady) return { synced: 0, skipped: 0, total: 0 }
  const chats = await client.getChats()
  const valid = chats.filter(c => !c.isGroup && c.id?._serialized && c.id._serialized !== 'status@broadcast')
  let synced = 0
  let skipped = 0
  for (const chat of valid) {
    const chatId = chat.id._serialized
    const phone = normPhone(chatId)
    let contactName = chat.name || ''
    let profilePicUrl = ''
    try {
      const contact = await chat.getContact()
      contactName = contact?.name || contact?.pushname || contact?.shortName || contactName || ''
    } catch {}
    try {
      profilePicUrl = (await client.getProfilePicUrl(chatId)) || ''
    } catch {}
    if (!phone) { skipped += 1; continue }
    await prisma.waChat.upsert({
      where: { id: chatId },
      update: {
        contactName: contactName || null,
        lastMessage: chat.lastMessage?.body || undefined,
        isGroup: false,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        id: chatId,
        phone,
        contactName: contactName || null,
        lastMessage: chat.lastMessage?.body || null,
        lastAt: chat.timestamp ? new Date(chat.timestamp * 1000) : null,
        isGroup: false,
        unreadCount: chat.unreadCount || 0,
        syncedAt: new Date(),
      },
    })
    // sem coluna dedicada no banco para foto: mantemos em evento para a UI.
    if (profilePicUrl) pusherPublish('contact_avatar', { chatId, phone, profilePicUrl })
    synced += 1
  }
  return { synced, skipped, total: valid.length }
}

// Sofi IA - atendimento automatico, supervisionado e treinavel.
const AI_MEMORY_PATH = path.join(__dirname, 'sofi-ai-memory.json')
const AI_MODES = new Set(['paused', 'assist', 'auto'])
const DEFAULT_AI_CONFIG = {
  mode: process.env.WHATSAPP_AI_MODE || 'assist',
  tone: 'humana, educada, objetiva e acolhedora',
  maxChars: 700,
  allowGroups: false,
  cooldownMs: 15000,
  training: [
    'A Sofi representa o Departamento de Educacao da Associacao Paulista Sul.',
    'Responda em portugues do Brasil, com clareza e naturalidade.',
    'Quando nao tiver certeza, assuma compromisso de verificar e encaminhar para um humano.',
  ],
}

function loadAiConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(AI_MEMORY_PATH, 'utf8'))
    return { ...DEFAULT_AI_CONFIG, ...saved, training: Array.isArray(saved.training) ? saved.training : DEFAULT_AI_CONFIG.training }
  } catch {
    return { ...DEFAULT_AI_CONFIG }
  }
}

let aiConfig = loadAiConfig()
const lastAiReplyAt = new Map()
const handoffChats = new Set()

function saveAiConfig() {
  try { fs.writeFileSync(AI_MEMORY_PATH, JSON.stringify(aiConfig, null, 2)) } catch (e) {
    console.error('[AI] Erro ao salvar memoria:', e.message)
  }
}

function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) return null
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model: process.env.WHATSAPP_AI_MODEL || 'gemini-1.5-flash' })
}

function shouldHandoff(text) {
  return /\b(humano|atendente|pessoa|vinicius|coordenador|ligar|telefone|reclamacao|reclamação|urgente)\b/i.test(text || '')
}

async function buildConversationContext(chatId) {
  const history = await prisma.waMessage.findMany({
    where: { chatId },
    orderBy: { ts: 'desc' },
    take: 12,
  })
  return history.reverse().map(m => `${m.fromMe ? 'APS/Sofi' : (m.pushName || 'Contato')}: ${m.text}`).join('\n')
}

async function generateSofiReply({ chatId, incomingText, pushName }) {
  const model = getGeminiModel()
  if (!model) return ''
  const context = await buildConversationContext(chatId)
  const prompt = [
    'Voce e a Sofi, agente de atendimento do APS-EDU no WhatsApp.',
    `Tom: ${aiConfig.tone}.`,
    `Limite: ate ${aiConfig.maxChars} caracteres.`,
    'Nao invente dados. Nao prometa prazos que nao conhece. Seja natural, rapida e util.',
    'Se a mensagem exigir decisao sensivel, diga que vai encaminhar para um responsavel.',
    '',
    'Treinamento ativo:',
    ...aiConfig.training.map(item => `- ${item}`),
    '',
    `Contato: ${pushName || 'sem nome'}`,
    'Historico recente:',
    context || '(sem historico)',
    '',
    `Mensagem recebida: ${incomingText}`,
    '',
    'Responda somente com a mensagem final para enviar no WhatsApp.',
  ].join('\n')

  const result = await model.generateContent(prompt)
  return (result.response.text() || '').trim().slice(0, Number(aiConfig.maxChars || 700))
}

async function maybeAutoReply(msg, text) {
  if (aiConfig.mode !== 'auto') return
  if (!isReady || !text || msg.fromMe || msg.isStatus) return
  if (msg.from?.endsWith('@g.us') && !aiConfig.allowGroups) return
  if (handoffChats.has(msg.from)) return
  if (shouldHandoff(text)) {
    handoffChats.add(msg.from)
    pusherPublish('ai_state', { mode: aiConfig.mode, handoffChatId: msg.from, reason: 'handoff_keyword' })
    return
  }
  const last = lastAiReplyAt.get(msg.from) || 0
  if (Date.now() - last < Number(aiConfig.cooldownMs || 15000)) return

  try {
    lastAiReplyAt.set(msg.from, Date.now())
    const reply = await generateSofiReply({ chatId: msg.from, incomingText: text, pushName: msg._data?.notifyName || '' })
    if (!reply) return
    const sent = await client.sendMessage(msg.from, reply)
    await saveMessage(msg.from, sent.id.id, true, reply, 'Sofi IA', Math.floor(Date.now() / 1000))
    pusherPublish('messages_upsert', {
      event: 'messages.upsert', instance: 'sofi',
      data: [{
        key: { remoteJid: msg.from, fromMe: true, id: sent.id.id },
        pushName: 'Sofi IA',
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: { conversation: reply },
      }],
    })
    pusherPublish('ai_replied', { chatId: msg.from, chars: reply.length })
  } catch (e) {
    console.error('[AI] Erro ao responder:', e.message)
  }
}

// ── Salva mensagem no banco ───────────────────────────────────────────────────
async function saveMessage(chatId, msgId, fromMe, text, pushName, timestamp) {
  if (!text || !chatId || !msgId) return
  const phone = normPhone(chatId)
  const ts    = new Date(Number(timestamp) * 1000)

  try {
    // Salva mensagem (upsert evita duplicata)
    await prisma.waMessage.upsert({
      where:  { id: msgId },
      update: {},
      create: { id: msgId, chatId, phone, fromMe, text, pushName: pushName || '', ts },
    })

    // Atualiza o chat (última mensagem, timestamp, badge de não lidos)
    await prisma.waChat.upsert({
      where:  { id: chatId },
      update: {
        lastMessage:  text,
        lastAt:       ts,
        updatedAt:    new Date(),
        ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
      },
      create: {
        id: chatId, phone,
        contactName:  pushName || null,
        lastMessage:  text,
        lastAt:       ts,
        unreadCount:  fromMe ? 0 : 1,
      },
    })
  } catch (e) {
    console.error('[DB] Erro ao salvar mensagem:', e.message)
  }
}

// ── Estado global ─────────────────────────────────────────────────────────────
let isReady   = false
let qrBase64  = null
let phoneInfo = null
let syncDone  = false

// ── Cliente WhatsApp Web ──────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'sofi',
    dataPath: path.join(__dirname, 'sessions'),
  }),
  puppeteer: {
    headless: true,
    protocolTimeout: 120000, // 2 minutos — necessário para 3000+ contatos
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--no-first-run', '--no-zygote',
    ],
  },
})

client.on('qr', async qr => {
  console.log('[WA] QR Code gerado')
  try {
    qrBase64 = await QRCode.toDataURL(qr)
    isReady  = false
    pusherPublish('qrcode_updated', { instance: 'sofi' })
  } catch (e) { console.error('[WA] QR error:', e.message) }
})

client.on('authenticated', () => {
  console.log('[WA] Autenticado')
  qrBase64 = null
})

client.on('ready', async () => {
  qrBase64  = null
  phoneInfo = { wuid: client.info.wid.user, name: client.info.pushname }
  console.log(`[WA] ✅ Conectado! ${phoneInfo.name} (${phoneInfo.wuid})`)

  // Aguarda 5s antes de liberar a API (WhatsApp precisa sincronizar)
  setTimeout(async () => {
    isReady = true
    pusherPublish('state', { connected: true, ready: true, state: 'open', provider: 'whatsapp-web.js', mode: 'live' })
    console.log('[WA] API pronta')

    // Sincroniza chats em background (não bloqueia)
    if (!syncDone) syncChatsBackground()
  }, 5000)
})

client.on('disconnected', reason => {
  isReady = false
  console.log('[WA] Desconectado:', reason)
  pusherPublish('state', { connected: false, ready: false, state: 'close' })
})

// ── Mensagem RECEBIDA ─────────────────────────────────────────────────────────
client.on('message', async msg => {
  if (msg.isStatus || msg.from === 'status@broadcast') return
  const text = msg.body || ''
  if (!text) return

  await saveMessage(msg.from, msg.id.id, false, text, msg._data?.notifyName || '', msg.timestamp)

  // Publica no Pusher (payload enxuto)
  pusherPublish('messages_upsert', {
    event: 'messages.upsert', instance: 'sofi',
    data: [{
      key: { remoteJid: msg.from, fromMe: false, id: msg.id.id },
      pushName: msg._data?.notifyName || '',
      messageTimestamp: msg.timestamp,
      message: { conversation: text },
    }],
  })

  maybeAutoReply(msg, text).catch(e => console.error('[AI] Auto reply:', e.message))

  console.log(`[WA] ← ${normPhone(msg.from)}: ${text.substring(0, 60)}`)
})

// ── Mensagem ENVIADA (do próprio número) ──────────────────────────────────────
client.on('message_create', async msg => {
  if (!msg.fromMe) return
  const text = msg.body || ''
  if (!text) return

  await saveMessage(msg.to, msg.id.id, true, text, '', msg.timestamp)

  pusherPublish('messages_upsert', {
    event: 'messages.upsert', instance: 'sofi',
    data: [{
      key: { remoteJid: msg.to, fromMe: true, id: msg.id.id },
      pushName: phoneInfo?.name || '',
      messageTimestamp: msg.timestamp,
      message: { conversation: text },
    }],
  })

  console.log(`[WA] → ${normPhone(msg.to)}: ${text.substring(0, 60)}`)
})

client.initialize()

// ── Sincronização em background ───────────────────────────────────────────────
// Carrega TODOS os chats do WhatsApp e salva no banco (roda uma vez ao conectar)
async function syncChatsBackground() {
  console.log('[DB] Iniciando sincronização de chats...')
  syncDone = true

  try {
    const allChats = await client.getChats()
    // Inclui TODOS: individuais + grupos (exclui só status@broadcast)
    const validChats = allChats.filter(c => c.id._serialized !== 'status@broadcast')
    console.log(`[DB] ${validChats.length} conversas para sincronizar (incluindo grupos)`)

    let count = 0
    for (const chat of validChats) {
      const chatId  = chat.id._serialized
      const isGroup = chat.isGroup || false
      // Para grupos: phone = o ID do grupo; para individuais: só dígitos
      const phone   = isGroup ? chatId : normPhone(chatId)
      const lastTs  = chat.timestamp ? new Date(chat.timestamp * 1000) : null
      const lastTxt = chat.lastMessage?.body || null
      const name    = chat.name || (isGroup ? chatId : null)

      try {
        await prisma.waChat.upsert({
          where:  { id: chatId },
          update: {
            contactName: name,
            lastMessage: lastTxt,
            lastAt:      lastTs,
            isGroup,
            syncedAt:    new Date(),
          },
          create: {
            id: chatId, phone,
            contactName: name,
            lastMessage: lastTxt,
            lastAt:      lastTs,
            isGroup,
            unreadCount: chat.unreadCount || 0,
            syncedAt:    new Date(),
          },
        })
        count++
      } catch {}

      if (count % 100 === 0) {
        console.log(`[DB] ${count}/${validChats.length} sincronizados...`)
        await new Promise(r => setTimeout(r, 100))
      }
    }

    console.log(`[DB] ✅ Sincronização concluída: ${count} conversas no banco`)
  } catch (e) {
    console.error('[DB] Erro na sincronização:', e.message)
    syncDone = false // permite tentar novamente
  }
}

// ── API HTTP (porta 8081) — serve dados DO BANCO ──────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, apikey, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = req.url || '/'
  const json = d => { res.writeHead(200); res.end(JSON.stringify(d)) }
  const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '')

  try {

    // ── Estado de conexão ───────────────────────────────────────────────────
    if (url.includes('/instance/connectionState') || url === '/status') {
      json({ instance: { state: isReady ? 'open' : qrBase64 ? 'qr' : 'close' } })
      return
    }

    // ── QR Code ─────────────────────────────────────────────────────────────
    if (url.includes('/instance/connect')) {
      if (isReady) { json({ connected: true, ready: true, qrDataUrl: null, error: null }); return }
      if (qrBase64) { json({ base64: qrBase64 }); return }
      json({ base64: null, error: 'Aguarde o QR Code...' })
      return
    }

    // ── Lista de chats (DO BANCO — sem limite, inclui grupos) ───────────────
    if (url.includes('/chat/findChats')) {
      const search   = params.get('q') || ''
      const onlyGrps = params.get('groups') === '1'

      const where = {
        archived: false,
        ...(onlyGrps ? { isGroup: true } : {}),
        ...(search ? { OR: [
          { contactName: { contains: search } },
          { phone:       { contains: search } },
          { lastMessage: { contains: search } },
        ]} : {}),
      }

      // Sem limite — serve TODOS os contatos e grupos do banco
      const chats = await prisma.waChat.findMany({
        where,
        orderBy: { lastAt: 'desc' },
      })

      json(chats.map(c => ({
        id:               c.id,
        name:             c.contactName || c.phone,
        pushname:         c.contactName || '',
        isGroup:          c.isGroup,
        unreadCount:      c.unreadCount,
        stage:            c.stage || 'Inbox',
        lastMsgTimestamp: c.lastAt ? Math.floor(c.lastAt.getTime() / 1000) : 0,
        lastMessage: c.lastMessage ? {
          messageTimestamp: c.lastAt ? Math.floor(c.lastAt.getTime() / 1000) : 0,
          message: { conversation: c.lastMessage },
        } : null,
      })))
      return
    }

    // ── Mensagens de um chat (DO BANCO) ────────────────────────────────────
    if (url.includes('/chat/findMessages')) {
      const body    = await readBody(req)
      let reqBody   = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}

      const chatId = reqBody?.where?.key?.remoteJid || reqBody?.where?.remoteJid || reqBody?.chatId || ''
      const limit  = reqBody.limit || 60

      if (!chatId) { json({ messages: { records: [] } }); return }

      // Busca do banco primeiro
      const dbMsgs = await prisma.waMessage.findMany({
        where:   { chatId },
        orderBy: { ts: 'asc' },
        take:    limit,
      })

      // Se não tiver no banco, busca do WhatsApp e salva
      if (dbMsgs.length === 0 && isReady) {
        try {
          const chat = await client.getChatById(chatId)
          const msgs = await chat.fetchMessages({ limit })
          for (const m of msgs) {
            if (m.body) await saveMessage(chatId, m.id.id, m.fromMe, m.body, m._data?.notifyName || '', m.timestamp)
          }
          // Retorna do banco agora
          const fresh = await prisma.waMessage.findMany({
            where: { chatId }, orderBy: { ts: 'asc' }, take: limit,
          })
          json({ messages: { records: fresh.map(m => ({
            key:              { remoteJid: chatId, fromMe: m.fromMe, id: m.id },
            pushName:         m.pushName || '',
            message:          { conversation: m.text },
            messageTimestamp: Math.floor(m.ts.getTime() / 1000),
          })) } })
          return
        } catch {}
      }

      json({ messages: { records: dbMsgs.map(m => ({
        key:              { remoteJid: chatId, fromMe: m.fromMe, id: m.id },
        pushName:         m.pushName || '',
        message:          { conversation: m.text },
        messageTimestamp: Math.floor(m.ts.getTime() / 1000),
      })) } })
      return
    }

    // ── Contatos (DO BANCO) ────────────────────────────────────────────────
    if (url.includes('/chat/findContacts')) {
      const contacts = await prisma.waChat.findMany({
        select: { id: true, contactName: true, phone: true, isGroup: true, stage: true, lastMessage: true, lastAt: true, unreadCount: true },
        take: 5000,
      })
      json(contacts.map(c => ({
        id: c.id,
        pushName: c.contactName || '',
        name: c.contactName || '',
        phone: c.phone,
        isGroup: c.isGroup,
        stage: c.stage || 'Inbox',
        lastMessage: c.lastMessage || '',
        lastMsgTimestamp: c.lastAt ? Math.floor(c.lastAt.getTime() / 1000) : 0,
        unreadCount: c.unreadCount || 0,
      })))
      return
    }

    if (url.includes('/contacts/sync') && req.method === 'POST') {
      const result = await syncAllContactNames()
      json({ ok: true, ...result })
      return
    }

    if (url.includes('/contacts/all')) {
      const contacts = await prisma.waChat.findMany({
        where: { archived: false, isGroup: false },
        orderBy: { contactName: 'asc' },
        take: 5000,
      })
      json(contacts.map(c => ({
        chatId: c.id,
        phone: c.phone,
        name: c.contactName || c.phone,
        stage: c.stage || 'Inbox',
      })))
      return
    }

    // ── Enviar mensagem ────────────────────────────────────────────────────
    if (url.includes('/message/sendText') && req.method === 'POST') {
      if (!isReady) { res.writeHead(503); res.end(JSON.stringify({ error: 'WhatsApp não conectado' })); return }
      const body = await readBody(req)
      const { number, textMessage } = JSON.parse(body || '{}')
      const jid  = normJid(number)
      const text = textMessage?.text || ''
      if (!jid || !text) { res.writeHead(400); res.end(JSON.stringify({ error: 'number e text obrigatórios' })); return }
      const sent = await client.sendMessage(jid, text)
      json({ key: { id: sent.id.id, remoteJid: jid, fromMe: true } })
      return
    }

    // ── Marcar como lido (atualiza badge no banco) ─────────────────────────
    if (url.includes('/chat/markMessageAsRead') && req.method === 'POST') {
      const body    = await readBody(req)
      let reqBody   = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId = reqBody?.read_messages?.[0]?.remoteJid || ''
      if (chatId) {
        await prisma.waChat.updateMany({ where: { id: chatId }, data: { unreadCount: 0 } })
        if (isReady) {
          try { const chat = await client.getChatById(chatId); await chat.sendSeen() } catch {}
        }
      }
      json({ ok: true })
      return
    }

    // ── Arquivar chat ──────────────────────────────────────────────────────
    if (url.includes('/chat/archiveChat') && req.method === 'POST') {
      const body    = await readBody(req)
      let reqBody   = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId  = reqBody?.lastMessage?.key?.remoteJid || ''
      const archive = reqBody?.archive !== false
      if (chatId) await prisma.waChat.updateMany({ where: { id: chatId }, data: { archived: archive } })
      json({ ok: true })
      return
    }

    // CRM: etapa do Kanban persistida no SQLite
    if (url.includes('/crm/stage') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const stage = String(reqBody.stage || 'Inbox')
      const chatId = reqBody.chatId || ''
      const phone = reqBody.phone || ''
      const where = chatId ? { id: chatId } : { phone: normPhone(phone) }
      await prisma.waChat.updateMany({ where, data: { stage, updatedAt: new Date() } })
      pusherPublish('crm_stage_updated', { chatId, phone, stage })
      json({ ok: true, stage })
      return
    }

    // Sofi IA: estado e configuracao
    if (url.includes('/ai/state')) {
      json({
        ok: true,
        mode: aiConfig.mode,
        tone: aiConfig.tone,
        maxChars: aiConfig.maxChars,
        allowGroups: aiConfig.allowGroups,
        training: aiConfig.training,
        handoffChats: [...handoffChats],
        hasGeminiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      })
      return
    }

    if (url.includes('/ai/control') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const nextMode = String(reqBody.mode || aiConfig.mode)
      if (AI_MODES.has(nextMode)) aiConfig.mode = nextMode
      if (typeof reqBody.tone === 'string') aiConfig.tone = reqBody.tone.slice(0, 300)
      if (Number(reqBody.maxChars) > 120) aiConfig.maxChars = Math.min(1200, Number(reqBody.maxChars))
      if (typeof reqBody.allowGroups === 'boolean') aiConfig.allowGroups = reqBody.allowGroups
      saveAiConfig()
      pusherPublish('ai_state', { mode: aiConfig.mode, tone: aiConfig.tone, allowGroups: aiConfig.allowGroups })
      json({ ok: true, ...aiConfig })
      return
    }

    if (url.includes('/ai/training') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const text = String(reqBody.text || '').trim()
      if (text) {
        aiConfig.training = [text, ...aiConfig.training.filter(t => t !== text)].slice(0, 40)
        saveAiConfig()
      }
      json({ ok: true, training: aiConfig.training })
      return
    }

    if (url.includes('/ai/handoff') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId = reqBody.chatId || ''
      const paused = reqBody.paused !== false
      if (chatId) paused ? handoffChats.add(chatId) : handoffChats.delete(chatId)
      json({ ok: true, chatId, paused })
      return
    }

    // Segmentos prontos para filtros, extracao e envio em massa
    if (url.includes('/crm/segments')) {
      const rows = await prisma.waChat.groupBy({ by: ['stage'], _count: { stage: true }, where: { archived: false } })
      const [all, named, groups, unread] = await Promise.all([
        prisma.waChat.count({ where: { archived: false, isGroup: false } }),
        prisma.waChat.count({ where: { archived: false, isGroup: false, contactName: { not: null } } }),
        prisma.waChat.count({ where: { archived: false, isGroup: true } }),
        prisma.waChat.count({ where: { archived: false, unreadCount: { gt: 0 } } }),
      ])
      json({ all, named, groups, unread, stages: rows.map(r => ({ stage: r.stage || 'Inbox', count: r._count.stage })) })
      return
    }

    // ── Estatísticas do banco (debug) ──────────────────────────────────────
    if (url === '/db/stats') {
      const [chats, messages] = await Promise.all([
        prisma.waChat.count(),
        prisma.waMessage.count(),
      ])
      json({ chats, messages, ready: isReady, phone: phoneInfo })
      return
    }

    // ── Grupos ────────────────────────────────────────────────────────────
    if (url.includes('/group/fetchAllGroups')) {
      if (!isReady) { json([]); return }
      const chats  = await client.getChats()
      const groups = chats.filter(c => c.isGroup)
      json(await Promise.all(groups.map(async g => ({
        id:      g.id._serialized,
        subject: g.name || '',
        participants: (g.participants || []).map(p => ({
          id:    p.id?._serialized || '',
          admin: p.isAdmin || false,
        })),
      }))))
      return
    }

    res.writeHead(404); res.end(JSON.stringify({ error: `Não encontrado: ${url}` }))
  } catch (err) {
    console.error('[WA API] Erro:', err.message)
    res.writeHead(500); res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log('═'.repeat(60))
  console.log('  Sofi CRM — WhatsApp Web + SQLite')
  console.log('═'.repeat(60))
  console.log(`  API:     http://localhost:${PORT}`)
  console.log(`  Banco:   ${path.join(__dirname, 'whatsapp.db')}`)
  console.log(`  Pusher:  "${PUSHER.channel}" @ ${PUSHER.cluster}`)
  console.log('  Inicializando WhatsApp Web...')
  console.log('═'.repeat(60))
})
