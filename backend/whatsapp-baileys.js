/**
 * whatsapp-baileys.js — Backend WhatsApp para APS-EDU usando Baileys
 *
 * Sem Puppeteer, sem Chrome — roda em qualquer servidor com 80MB RAM
 * Mesma API REST do whatsapp.js — frontend não precisa de mudanças
 */
'use strict'

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  makeInMemoryStore,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys')

const pino      = require('pino')
const QRCode    = require('qrcode')
const express   = require('express')
const cors      = require('cors')
const crypto    = require('crypto')
const path      = require('path')
const fs        = require('fs')
const https     = require('https')

require('dotenv').config({ path: path.join(__dirname, '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '.env') })

const { GoogleGenerativeAI } = require('@google/generative-ai')

// ── Config ────────────────────────────────────────────────────────────────────
const PORT        = process.env.WHATSAPP_PORT || 8081
const DATA_DIR    = process.env.WHATSAPP_DATA_DIR || path.join(__dirname, '.whatsapp_data')
const AUTH_DIR    = path.join(DATA_DIR, 'auth')
const AVATAR_DIR  = path.join(DATA_DIR, 'avatars')
const PHONEBOOK_F = path.join(DATA_DIR, 'phonebook.json')
const CHATS_F     = path.join(DATA_DIR, 'chats.json')
const MSGS_F      = path.join(DATA_DIR, 'messages.json')
const CRM_F       = path.join(DATA_DIR, 'crm.json')
const AI_STATE_F  = path.join(DATA_DIR, 'ai-state.json')
const BULK_LOG_F  = path.join(DATA_DIR, 'bulk-log.json')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(AUTH_DIR, { recursive: true })
fs.mkdirSync(AVATAR_DIR, { recursive: true })

const GEMINI_KEY   = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.WHATSAPP_GEMINI_MODEL || 'gemini-2.0-flash-lite'
const API_KEY      = process.env.WHATSAPP_API_KEY || 'aps-edu-whatsapp'

// ── Estado ────────────────────────────────────────────────────────────────────
let sock       = null
let waReady    = false
let waQR       = null   // base64 data URL
let waState    = 'DISCONNECTED'
let sseClients = []

const phonebook = new Map()   // phone → { name, avatarUrl }
const chatsMap  = new Map()   // chatId → { chatId, phone, name, lastMsg, lastAt, unread, isGroup, avatarUrl }
const msgsMap   = new Map()   // chatId → Message[]
const crmMap    = new Map()   // phone → { stage, tags, notes, handoff }

// ── Persistência ──────────────────────────────────────────────────────────────
function readJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null }
}
function writeJson(f, d) {
  try { fs.writeFileSync(f, JSON.stringify(d)) } catch {}
}
const _timers = {}
function debounce(k, f, d, ms = 1500) {
  clearTimeout(_timers[k])
  _timers[k] = setTimeout(() => writeJson(f, d), ms)
}
function savePhonebook() { debounce('pb', PHONEBOOK_F, Object.fromEntries(phonebook)) }
function saveChats()     { debounce('ch', CHATS_F, Object.fromEntries(chatsMap)) }
function saveMsgs()      { debounce('ms', MSGS_F, Object.fromEntries(msgsMap)) }
function saveCrm()       { debounce('cr', CRM_F, Object.fromEntries(crmMap)) }

function bootstrap() {
  const pb = readJson(PHONEBOOK_F); if (pb) for (const [k,v] of Object.entries(pb)) phonebook.set(k, v)
  const ch = readJson(CHATS_F);     if (ch) for (const [k,v] of Object.entries(ch)) chatsMap.set(k, v)
  const ms = readJson(MSGS_F);      if (ms) for (const [k,v] of Object.entries(ms)) if (Array.isArray(v)) msgsMap.set(k, v)
  const cr = readJson(CRM_F);       if (cr) for (const [k,v] of Object.entries(cr)) crmMap.set(k, v)
}
bootstrap()

// ── AI State ──────────────────────────────────────────────────────────────────
const DEFAULT_AI = {
  mode: 'paused', tone: 'cordial e profissional', maxChars: 400,
  allowGroups: false, training: ['Sou a Sofi, assistente do Departamento de Educação da APS.'],
  playbooks: { vendas: '', suporte: '', pessoal: '' }, activePlaybook: null,
}
let aiState = { ...DEFAULT_AI, ...(readJson(AI_STATE_F) || {}) }
function saveAiState() { writeJson(AI_STATE_F, aiState) }

// ── Helpers ───────────────────────────────────────────────────────────────────
const normPhone = id => String(id || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
const phone2JID = p  => { const n = String(p||'').replace(/\D/g,''); return n.includes('@') ? n : `${n}@s.whatsapp.net` }

function pushSSE(event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  sseClients = sseClients.filter(res => { try { res.write(line); return true } catch { return false } })
}

function extractText(msg) {
  if (!msg) return ''
  const m = msg.message || msg
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.title ||
    (m.audioMessage || m.pttMessage ? '🎤 Áudio' : '') ||
    (m.imageMessage  ? '📷 Foto'       : '') ||
    (m.videoMessage  ? '🎥 Vídeo'      : '') ||
    (m.documentMessage ? '📄 Arquivo'  : '') ||
    (m.stickerMessage  ? '🎴 Sticker'  : '') ||
    (m.contactMessage  ? '👤 Contato'  : '') ||
    (m.locationMessage ? '📍 Localização' : '') ||
    (m.reactionMessage ? `${m.reactionMessage.text} (reação)` : '') ||
    ''
  )
}

function upsertChat(chatId, update) {
  chatsMap.set(chatId, { ...chatsMap.get(chatId) || {}, chatId, ...update })
  saveChats()
}

function pushMsg(chatId, msg) {
  const arr = msgsMap.get(chatId) || []
  arr.push(msg)
  msgsMap.set(chatId, arr)
  saveMsgs()
}

// ── Sofi IA ───────────────────────────────────────────────────────────────────
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null
const aiRate = new Map()
const aiSugg = new Map()

async function processAI(chatId, text) {
  if (!genAI || aiState.mode === 'paused') return
  if (chatId.endsWith('@g.us') && !aiState.allowGroups) return
  if (crmMap.get(normPhone(chatId))?.handoff) return
  const now = Date.now()
  if (now - (aiRate.get(chatId) || 0) < 30000) return

  const msgs   = (msgsMap.get(chatId) || []).slice(-8).map(m => `${m.from === 'agent' ? 'Sofi' : 'Cliente'}: ${m.text}`).join('\n')
  const prompt = `${(aiState.training||[]).join('\n')}\nTom: ${aiState.tone}. Máx ${aiState.maxChars} chars.\n${msgs}\nCliente: ${text}\nSofi:`

  try {
    const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    const reply  = result.response.text().trim().slice(0, aiState.maxChars)
    aiRate.set(chatId, Date.now())

    if (aiState.mode === 'auto' && sock && waReady) {
      await sock.sendMessage(chatId, { text: reply })
      const m = { id: crypto.randomUUID(), from: 'sofi', text: reply, at: new Date().toISOString(), ts: Date.now() }
      pushMsg(chatId, m)
      pushSSE('message', { chatId, msg: m })
    } else if (aiState.mode === 'assist') {
      aiSugg.set(chatId, reply)
      pushSSE('ai-suggestion', { chatId, suggestion: reply })
    }
  } catch (e) { console.error('[Sofi]', e.message) }
}

// ── Conexão Baileys ───────────────────────────────────────────────────────────
async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const logger = pino({ level: 'silent' })

  sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false,
    browser: ['APS-EDU', 'Chrome', '120.0'],
    getMessage: async key => {
      const msgs = msgsMap.get(key.remoteJid) || []
      const found = msgs.find(m => m.id === key.id)
      return found ? { conversation: found.text } : { conversation: '' }
    },
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      waQR    = await QRCode.toDataURL(qr)
      waState = 'QR_READY'
      console.log('[WA] QR gerado')
      pushSSE('qr', { qrDataUrl: waQR })
    }

    if (connection === 'open') {
      waReady = true
      waState = 'CONNECTED'
      waQR    = null
      console.log('[WA] Conectado!')
      pushSSE('state', { state: waState, connected: true, ready: true })
      setTimeout(() => syncAll(), 3000)
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      console.log('[WA] Desconectado. loggedOut:', loggedOut, 'code:', code)
      waReady = false
      waState = 'DISCONNECTED'
      pushSSE('state', { state: waState, connected: false, ready: false })

      if (!loggedOut) {
        console.log('[WA] Reconectando em 5s...')
        setTimeout(connectWA, 5000)
      }
    }
  })

  // Mensagens recebidas/enviadas
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      const chatId = msg.key.remoteJid
      if (!chatId || chatId === 'status@broadcast') continue

      const phone    = normPhone(chatId)
      const fromMe   = msg.key.fromMe
      const text     = extractText(msg)
      if (!text) continue

      const pushName = msg.pushName || phonebook.get(phone)?.name || phone
      const at       = new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      const msgObj   = { id: msg.key.id || crypto.randomUUID(), from: fromMe ? 'agent' : 'lead', text, at, ts: Number(msg.messageTimestamp) * 1000, name: pushName }

      pushMsg(chatId, msgObj)
      upsertChat(chatId, {
        phone, isGroup: chatId.endsWith('@g.us'),
        name: chatsMap.get(chatId)?.name || pushName,
        lastMsg: text, lastAt: at,
        unread: fromMe ? 0 : (chatsMap.get(chatId)?.unread || 0) + 1,
        avatarUrl: chatsMap.get(chatId)?.avatarUrl || '',
      })

      // Salva nome no phonebook
      if (pushName && pushName !== phone) {
        const pb = phonebook.get(phone) || {}
        if (!pb.name) { phonebook.set(phone, { ...pb, name: pushName }); savePhonebook() }
      }

      pushSSE('message', { chatId, msg: msgObj })
      pushSSE('chat-update', { chatId, lastMsg: text, lastAt: at, unread: msgObj.from === 'lead' ? (chatsMap.get(chatId)?.unread || 0) : 0 })

      if (!fromMe) processAI(chatId, text)
    }
  })

  // Status de leitura/entrega
  sock.ev.on('messages.update', updates => {
    for (const { key, update } of updates) {
      if (update.status !== undefined) {
        pushSSE('message-ack', { chatId: key.remoteJid, msgId: key.id, ack: update.status })
      }
    }
  })

  // Contatos
  sock.ev.on('contacts.upsert', contacts => {
    for (const c of contacts) {
      const phone = normPhone(c.id)
      if (!phone || phone.length < 7) continue
      const name = c.name || c.notify || ''
      if (name) {
        const pb = phonebook.get(phone) || {}
        phonebook.set(phone, { ...pb, name })
      }
    }
    savePhonebook()
  })

  // Chats
  sock.ev.on('chats.upsert', chats => {
    for (const chat of chats) {
      const chatId = chat.id
      if (!chatId || chatId === 'status@broadcast') continue
      const phone = normPhone(chatId)
      const pb    = phonebook.get(phone) || {}
      upsertChat(chatId, {
        phone,
        name:    chat.name || pb.name || phone,
        lastMsg: chat.lastMessage ? extractText(chat.lastMessage) : '',
        lastAt:  chat.conversationTimestamp ? new Date(Number(chat.conversationTimestamp)*1000).toISOString() : '',
        unread:  chat.unreadCount || 0,
        isGroup: chatId.endsWith('@g.us'),
        avatarUrl: pb.avatarUrl || '',
      })
    }
  })
}

// Sincroniza contatos e chats completos
async function syncAll() {
  if (!sock || !waReady) return
  try {
    console.log('[WA] Sincronizando contatos...')
    const contacts = await sock.fetchStatus?.('@s.whatsapp.net').catch(() => null)
    pushSSE('contacts-loaded', { count: chatsMap.size })
    console.log(`[WA] ${chatsMap.size} chats, ${phonebook.size} contatos`)
  } catch (e) { console.error('[WA] syncAll:', e.message) }
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/wa-avatar', express.static(AVATAR_DIR))

// Auth
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  const key = req.headers['x-api-key'] || req.headers['apikey'] || req.query.apikey
  const host = req.headers.host || ''
  if ((key && key === API_KEY) || host.includes('localhost') || host.includes('127.0.0.1')) return next()
  return res.status(401).json({ error: 'Unauthorized' })
})

app.get('/health', (_, res) => res.json({ ok: true }))

app.get('/status', (_, res) => res.json({
  connected: waReady, ready: waReady, state: waState, qrDataUrl: waQR || null, error: null,
}))

app.post('/start', async (req, res) => {
  if (waReady) return res.json({ connected: true, ready: true, qrDataUrl: null })
  if (waState === 'QR_READY') return res.json({ connected: false, ready: false, qrDataUrl: waQR })
  if (waState === 'CONNECTING') return res.json({ connected: false, ready: false, qrDataUrl: null, starting: true })
  waState = 'CONNECTING'
  connectWA().catch(e => { console.error('[WA] connect error:', e.message); waState = 'DISCONNECTED' })
  await new Promise(r => setTimeout(r, 3000))
  res.json({ connected: waReady, ready: waReady, qrDataUrl: waQR || null, starting: true })
})

app.post('/disconnect', async (req, res) => {
  if (sock) { try { await sock.logout() } catch {} }
  waReady = false; waState = 'DISCONNECTED'; waQR = null; sock = null
  res.json({ ok: true })
})

app.get('/contacts', (req, res) => {
  const result = []
  for (const [chatId, chat] of chatsMap) {
    const phone = chat.phone || normPhone(chatId)
    const pb    = phonebook.get(phone) || {}
    const crm   = crmMap.get(phone) || {}
    result.push({
      chatId, phone,
      name:        chat.name || pb.name || phone,
      lastMessage: chat.lastMsg || '',
      lastAt:      chat.lastAt || '',
      timestamp:   chat.lastAt ? new Date(chat.lastAt).getTime() : 0,
      unread:      chat.unread || 0,
      isGroup:     chat.isGroup || false,
      avatarUrl:   chat.avatarUrl || pb.avatarUrl || '',
      stage:       crm.stage || 'Inbox',
    })
  }
  result.sort((a,b) => (b.timestamp||0) - (a.timestamp||0))
  res.json(result)
})

app.get('/contacts-all', (req, res) => {
  const result = []
  for (const [phone, pb] of phonebook) {
    const crm = crmMap.get(phone) || {}
    result.push({ phone, name: pb.name || phone, avatarUrl: pb.avatarUrl || '', stage: crm.stage || 'Inbox' })
  }
  res.json(result)
})

app.get('/messages', (req, res) => {
  const { chatId } = req.query
  if (!chatId) return res.status(400).json({ error: 'chatId obrigatório' })
  res.json(msgsMap.get(chatId) || [])
})

app.get('/messages/fetch', async (req, res) => {
  const { chatId, limit = 50 } = req.query
  if (!chatId) return res.status(400).json({ error: 'chatId obrigatório' })
  if (!waReady) return res.status(503).json({ error: 'Não conectado' })
  try {
    const msgs = await sock.loadMessages(chatId, Number(limit))
    const result = msgs.messages.map(m => ({
      id:   m.key.id || crypto.randomUUID(),
      from: m.key.fromMe ? 'agent' : 'lead',
      text: extractText(m),
      at:   new Date(Number(m.messageTimestamp)*1000).toISOString(),
      ts:   Number(m.messageTimestamp)*1000,
      name: m.pushName || '',
      ack:  m.status || 0,
    })).filter(m => m.text).reverse()
    if (result.length) { msgsMap.set(String(chatId), result); saveMsgs() }
    res.json(result)
  } catch (e) {
    // Fallback: retorna cache local
    res.json(msgsMap.get(String(chatId)) || [])
  }
})

app.post('/send', async (req, res) => {
  const { chatId, phone, text } = req.body
  if (!text) return res.status(400).json({ error: 'text obrigatório' })
  if (!waReady) return res.status(503).json({ error: 'Não conectado' })
  try {
    const jid = chatId || phone2JID(phone)
    await sock.sendMessage(jid, { text })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/mark-read', async (req, res) => {
  const { chatId, messages } = req.body
  if (!waReady) return res.json({ ok: false })
  try {
    await sock.readMessages((messages||[]).map(m => ({ remoteJid: chatId, id: m.id, fromMe: m.fromMe||false })))
    upsertChat(chatId, { unread: 0 })
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

app.get('/groups', async (req, res) => {
  if (!waReady) return res.status(503).json({ error: 'Não conectado' })
  try {
    const groups = await sock.groupFetchAllParticipating()
    const result = Object.values(groups).map(g => ({
      id:           g.id,
      name:         g.subject || g.id,
      description:  g.desc || '',
      participants: g.participants.length,
      avatarUrl:    '',
      members:      g.participants.map(p => ({
        id:    p.id,
        phone: normPhone(p.id),
        admin: p.admin === 'admin' || p.admin === 'superadmin',
        name:  phonebook.get(normPhone(p.id))?.name || '',
      })).filter(m => m.phone.length >= 7),
    }))
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Envio em Massa ────────────────────────────────────────────────────────────
let bulkRunning = false, bulkAbort = false
let bulkProgress = { total: 0, sent: 0, failed: 0, current: '', log: [] }

app.post('/bulk-send', async (req, res) => {
  const { recipients, template, delayMs = 4000, randomExtraMs = 3000, groupIds, segmentStage, dryRun = false } = req.body
  if (bulkRunning) return res.status(409).json({ error: 'Já existe envio em andamento' })
  if (!waReady)    return res.status(503).json({ error: 'Não conectado' })
  if (!template)   return res.status(400).json({ error: 'template obrigatório' })

  let list = (Array.isArray(recipients) ? recipients : []).map(r => ({ ...r, phone: String(r.phone||'').replace(/\D/g,'') })).filter(r => r.phone.length >= 8)

  if (Array.isArray(groupIds) && groupIds.length) {
    try {
      const groups = await sock.groupFetchAllParticipating()
      for (const gid of groupIds) {
        const g = groups[gid]
        if (!g) continue
        for (const p of g.participants) {
          const phone = normPhone(p.id)
          if (phone.length >= 8 && !list.find(r => r.phone === phone)) {
            list.push({ phone, nome: phonebook.get(phone)?.name || phone })
          }
        }
      }
    } catch {}
  }

  if (segmentStage) list = list.filter(r => (crmMap.get(r.phone)||{}).stage === segmentStage)
  if (!list.length) return res.status(400).json({ error: 'Nenhum destinatário' })

  bulkRunning = true; bulkAbort = false
  bulkProgress = { total: list.length, sent: 0, failed: 0, current: '', log: [], startedAt: new Date().toISOString() }
  res.json({ ok: true, total: list.length })

  ;(async () => {
    for (const r of list) {
      if (bulkAbort) break
      const { phone, ...vars } = r
      const text = template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || k)
      bulkProgress.current = phone
      pushSSE('bulk-progress', { ...bulkProgress })

      if (!dryRun) {
        try {
          await sock.sendMessage(phone2JID(phone), { text })
          bulkProgress.sent++
          bulkProgress.log.push({ phone, name: vars.nome || phone, status: 'sent', at: new Date().toISOString() })
        } catch (e) {
          bulkProgress.failed++
          bulkProgress.log.push({ phone, name: vars.nome || phone, status: 'error', error: e.message, at: new Date().toISOString() })
        }
      } else {
        bulkProgress.sent++
        bulkProgress.log.push({ phone, status: 'dry-run', at: new Date().toISOString() })
      }

      pushSSE('bulk-progress', { ...bulkProgress })
      await new Promise(r => setTimeout(r, Number(delayMs) + Math.floor(Math.random() * Number(randomExtraMs))))
    }
    bulkRunning = false; bulkProgress.done = true; bulkProgress.endAt = new Date().toISOString()
    writeJson(BULK_LOG_F, bulkProgress)
    pushSSE('bulk-done', { ...bulkProgress })
  })()
})

app.get('/bulk-status', (_, res) => res.json({ running: bulkRunning, ...bulkProgress }))
app.post('/bulk-stop', (_, res) => { bulkAbort = true; res.json({ ok: true }) })

// ── CRM ───────────────────────────────────────────────────────────────────────
app.post('/crm/stage', (req, res) => {
  const { chatId, phone, stage } = req.body
  const p = phone || normPhone(chatId)
  crmMap.set(p, { ...crmMap.get(p)||{}, stage }); saveCrm()
  res.json({ ok: true })
})
app.post('/crm/update', (req, res) => {
  const { phone, ...fields } = req.body
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' })
  crmMap.set(phone, { ...crmMap.get(phone)||{}, ...fields }); saveCrm()
  res.json({ ok: true })
})
app.post('/crm/handoff', (req, res) => {
  const { chatId, phone, paused } = req.body
  const p = phone || normPhone(chatId)
  crmMap.set(p, { ...crmMap.get(p)||{}, handoff: paused !== false }); saveCrm()
  res.json({ ok: true })
})
app.get('/crm/segments', (_, res) => {
  const counts = {}
  for (const [, c] of crmMap) { const s = c.stage||'Inbox'; counts[s] = (counts[s]||0)+1 }
  res.json(counts)
})

// ── AI ────────────────────────────────────────────────────────────────────────
app.get('/ai/state', (_, res) => res.json({ ...aiState, hasGeminiKey: !!GEMINI_KEY }))
app.post('/ai/control', (req, res) => {
  Object.assign(aiState, req.body); saveAiState()
  res.json({ ok: true, ...aiState })
})
app.post('/ai/training', (req, res) => {
  const { text } = req.body; if (!text) return res.status(400).json({ error: 'text obrigatório' })
  aiState.training = aiState.training || []; aiState.training.push(text); saveAiState()
  res.json({ ok: true })
})
app.delete('/ai/training/:idx', (req, res) => {
  const i = parseInt(req.params.idx); if (!isNaN(i)) aiState.training.splice(i, 1); saveAiState()
  res.json({ ok: true })
})
app.post('/ai/suggest', async (req, res) => {
  const { chatId, text } = req.body
  const cached = aiSugg.get(chatId)
  if (cached) { aiSugg.delete(chatId); return res.json({ suggestion: cached }) }
  if (!genAI) return res.json({ suggestion: null })
  try {
    const msgs   = (msgsMap.get(chatId)||[]).slice(-6).map(m => `${m.from==='agent'?'Sofi':'Cliente'}: ${m.text}`).join('\n')
    const prompt = `${(aiState.training||[]).join('\n')}\nTom: ${aiState.tone}\n${msgs}\nCliente: ${text||''}\nSofi:`
    const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    res.json({ suggestion: result.response.text().trim().slice(0, aiState.maxChars) })
  } catch (e) { res.json({ suggestion: null, error: e.message }) }
})

// ── Sync manual ───────────────────────────────────────────────────────────────
app.post('/contacts/sync', async (req, res) => {
  if (!waReady) return res.status(503).json({ error: 'Não conectado', ready: false })
  try {
    await syncAll()
    res.json({ ok: true, contacts: phonebook.size, chats: chatsMap.size })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── SSE ───────────────────────────────────────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  res.write(`event: state\ndata: ${JSON.stringify({ connected: waReady, ready: waReady, state: waState, qrDataUrl: waQR||null })}\n\n`)
  sseClients.push(res)

  const hb = setInterval(() => { try { res.write(': heartbeat\n\n') } catch { clearInterval(hb) } }, 20000)
  req.on('close', () => { clearInterval(hb); sseClients = sseClients.filter(c => c !== res) })
})

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(sig) {
  console.log(`\n[WA] ${sig} — salvando e encerrando...`)
  try { writeJson(CHATS_F, Object.fromEntries(chatsMap)) } catch {}
  try { writeJson(MSGS_F, Object.fromEntries(msgsMap)) } catch {}
  try { writeJson(CRM_F, Object.fromEntries(crmMap)) } catch {}
  try { writeJson(PHONEBOOK_F, Object.fromEntries(phonebook)) } catch {}
  // NÃO faz logout — preserva a sessão!
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n[WhatsApp Baileys] Porta ${PORT}`)
  console.log(`[WhatsApp Baileys] API Key: ${API_KEY}\n`)
})

connectWA().catch(e => { console.error('[WA] Erro inicial:', e.message) })
