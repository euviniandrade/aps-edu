/**
 * whatsapp.js — Servidor WhatsApp Web para APS-EDU (Sofi CRM)
 *
 * Stack: whatsapp-web.js (Puppeteer) + Express + SSE + Google Gemini
 * Porta: 8081
 *
 * Funcionalidades:
 *  - QR Code de autenticação (sessão persistida em disco)
 *  - Contatos com nome e foto de perfil
 *  - Chat em tempo real via SSE
 *  - Envio em massa: segmentado, personalizado, por grupos
 *  - Sofi IA (Gemini) nos modos paused / assist / auto
 */
'use strict'

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const QRCode   = require('qrcode')
const express  = require('express')
const cors     = require('cors')
const crypto   = require('crypto')
const path     = require('path')
const fs       = require('fs')
const https    = require('https')

require('dotenv').config({ path: path.join(__dirname, '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '.env') })

const { GoogleGenerativeAI } = require('@google/generative-ai')

// ── Config ────────────────────────────────────────────────────────────────────
const PORT         = process.env.WHATSAPP_PORT  || 8081
const DATA_DIR     = path.join(__dirname, '.whatsapp_data')
const PHONEBOOK_F  = path.join(DATA_DIR, 'phonebook.json')
const CHATS_F      = path.join(DATA_DIR, 'chats.json')
const MSGS_F       = path.join(DATA_DIR, 'messages.json')
const CRM_F        = path.join(DATA_DIR, 'crm.json')
const AI_STATE_F   = path.join(DATA_DIR, 'ai-state.json')
const AVATAR_DIR   = path.join(DATA_DIR, 'avatars')
const BULK_LOG_F   = path.join(DATA_DIR, 'bulk-log.json')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(AVATAR_DIR, { recursive: true })

const GEMINI_KEY   = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.WHATSAPP_GEMINI_MODEL || 'gemini-2.0-flash-lite'

// ── Estado em memória ─────────────────────────────────────────────────────────
let waClient     = null
let waReady      = false
let waQR         = null          // base64 PNG do QR
let waState      = 'DISCONNECTED'
let sseClients   = []            // EventEmitter-like array de res SSE

// Phonebook: phone (sem +, só dígitos) → { name, avatarUrl }
const phonebook  = new Map()
// Chats recentes: chatId → { chatId, phone, name, lastMsg, lastAt, unread, isGroup, avatarUrl }
const chatsMap   = new Map()
// Histórico de mensagens: chatId → Message[]  (últimas 300)
const msgsMap    = new Map()
// CRM: phone → { stage, tags, notes, score }
const crmMap     = new Map()

// ── Persistência ──────────────────────────────────────────────────────────────
function readJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null }
}
function writeJson(f, data) {
  try { fs.writeFileSync(f, JSON.stringify(data)) } catch {}
}
let _saveTimers = {}
function debounceSave(key, f, data, ms = 1500) {
  clearTimeout(_saveTimers[key])
  _saveTimers[key] = setTimeout(() => writeJson(f, data), ms)
}

function bootstrap() {
  const pb = readJson(PHONEBOOK_F)
  if (pb) for (const [k, v] of Object.entries(pb)) phonebook.set(k, v)

  const ch = readJson(CHATS_F)
  if (ch) for (const [k, v] of Object.entries(ch)) chatsMap.set(k, v)

  const ms = readJson(MSGS_F)
  if (ms) for (const [k, v] of Object.entries(ms)) if (Array.isArray(v)) msgsMap.set(k, v)

  const cr = readJson(CRM_F)
  if (cr) for (const [k, v] of Object.entries(cr)) crmMap.set(k, v)
}
bootstrap()

function savePhonebook() { debounceSave('pb', PHONEBOOK_F, Object.fromEntries(phonebook)) }
function saveChats()     { debounceSave('ch', CHATS_F,     Object.fromEntries(chatsMap)) }
function saveMsgs()      { debounceSave('ms', MSGS_F,      Object.fromEntries(msgsMap)) }
function saveCrm()       { debounceSave('cr', CRM_F,       Object.fromEntries(crmMap)) }

// ── AI State ──────────────────────────────────────────────────────────────────
const DEFAULT_AI = {
  mode:       'paused',
  tone:       'cordial e profissional',
  maxChars:   400,
  allowGroups: false,
  training:   ['Sou a Sofi, assistente virtual do Departamento de Educação da APS (Associação Paulista Sul).'],
  playbooks:  {
    vendas:   'Foque em entender a necessidade do contato. Seja consultivo, destaque benefícios e proponha próximos passos.',
    suporte:  'Seja empático, confirme o problema, ofereça solução e acompanhe a resolução.',
    pessoal:  'Seja amigável e personalizado, mencione o nome da pessoa.',
  },
  activePlaybook: null,
}
let aiState = { ...DEFAULT_AI, ...(readJson(AI_STATE_F) || {}) }
function saveAiState() { writeJson(AI_STATE_F, aiState) }

// ── Helpers ───────────────────────────────────────────────────────────────────
function normPhone(id) {
  return String(id || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
}

function chatId2Phone(chatId) {
  return normPhone(chatId)
}

function phone2JID(phone) {
  const p = String(phone || '').replace(/\D/g, '')
  return p.includes('@') ? p : `${p}@c.us`
}

function pushSSE(event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  sseClients = sseClients.filter(res => {
    try { res.write(line); return true }
    catch { return false }
  })
}

function getContactInfo(chatId, msg) {
  const phone = chatId2Phone(chatId)
  const pb    = phonebook.get(phone) || {}
  const name  = pb.name || msg?.notifyName || msg?._data?.notifyName || phone
  const avatarUrl = pb.avatarUrl || ''
  return { phone, name, avatarUrl }
}

function upsertChat(chatId, update) {
  const existing = chatsMap.get(chatId) || {}
  chatsMap.set(chatId, { ...existing, chatId, ...update })
  saveChats()
}

function pushMsg(chatId, msg) {
  const arr = msgsMap.get(chatId) || []
  arr.push(msg)
  msgsMap.set(chatId, arr)
  saveMsgs()
}

// Baixa e salva avatar localmente (cache em disco)
async function fetchAvatar(chatId) {
  if (!waClient || !waReady) return null
  const phone = chatId2Phone(chatId)
  const cached = phonebook.get(phone)
  if (cached?.avatarUrl && cached.avatarUrl.startsWith('/wa-avatar/')) return cached.avatarUrl

  try {
    const url = await waClient.getProfilePicUrl(chatId).catch(() => null)
    if (!url) return null
    const base64 = await new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : require('http')
      mod.get(url, res => {
        const chunks = []
        res.on('data', d => chunks.push(d))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
        res.on('error', reject)
      }).on('error', reject)
    })
    const avatarPath = path.join(AVATAR_DIR, `${phone}.jpg`)
    fs.writeFileSync(avatarPath, Buffer.from(base64, 'base64'))
    const avatarUrl = `/wa-avatar/${phone}.jpg`
    const pb = phonebook.get(phone) || {}
    phonebook.set(phone, { ...pb, avatarUrl })
    savePhonebook()
    return avatarUrl
  } catch {
    return null
  }
}

// ── Sofi IA ───────────────────────────────────────────────────────────────────
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null
const aiRateLimit = new Map() // phone → lastRepliedAt (ms)

async function sofiBuildPrompt(chatId, incomingText) {
  const pb   = phonebook.get(chatId2Phone(chatId)) || {}
  const name = pb.name || chatId2Phone(chatId)
  const msgs = msgsMap.get(chatId) || []
  const last10 = msgs.slice(-10).map(m =>
    `${m.from === 'agent' ? 'Sofi' : name}: ${m.text}`
  ).join('\n')

  const trainingBlock = (aiState.training || []).join('\n')
  const playbook = aiState.activePlaybook ? (aiState.playbooks?.[aiState.activePlaybook] || '') : ''

  return `${trainingBlock}
${playbook ? `\nPlaybook ativo: ${playbook}` : ''}

Tom: ${aiState.tone}. Máximo ${aiState.maxChars} caracteres. Responda SOMENTE a mensagem do usuário.

Histórico recente:
${last10}

${name}: ${incomingText}
Sofi:`
}

const assistSuggestions = new Map() // chatId → suggested text

async function processAI(chatId, incomingText) {
  if (!genAI || aiState.mode === 'paused') return null

  const phone = chatId2Phone(chatId)
  const now   = Date.now()
  const last  = aiRateLimit.get(phone) || 0
  if (now - last < 30_000) return null // máx 1 resposta / 30s

  const isGroup = chatId.endsWith('@g.us')
  if (isGroup && !aiState.allowGroups) return null

  const handoff = crmMap.get(phone)?.handoff
  if (handoff) return null

  try {
    const prompt  = await sofiBuildPrompt(chatId, incomingText)
    const model   = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result  = await model.generateContent(prompt)
    const reply   = result.response.text().trim().slice(0, aiState.maxChars)

    aiRateLimit.set(phone, now)

    if (aiState.mode === 'auto') {
      const chat = await waClient.getChatById(chatId).catch(() => null)
      if (chat) {
        await chat.sendMessage(reply)
        const replyMsg = {
          id:   crypto.randomUUID(),
          from: 'sofi',
          text: reply,
          at:   new Date().toISOString(),
          name: 'Sofi',
        }
        pushMsg(chatId, replyMsg)
        pushSSE('message', { chatId, msg: replyMsg })
      }
    } else if (aiState.mode === 'assist') {
      assistSuggestions.set(chatId, reply)
      pushSSE('ai-suggestion', { chatId, suggestion: reply })
    }

    return reply
  } catch (e) {
    console.error('[Sofi IA] Erro:', e.message)
    return null
  }
}

// Busca fotos de perfil em background — processa em lotes para não sobrecarregar
async function loadAvatarsInBackground() {
  if (!waClient || !waReady) return
  const chatIds = [...chatsMap.keys()].slice(0, 500) // fotos dos 500 mais recentes
  console.log(`[WA] Buscando fotos de ${chatIds.length} contatos...`)
  let fetched = 0
  for (const chatId of chatIds) {
    if (!waReady) break
    const phone = chatId2Phone(chatId)
    const pb = phonebook.get(phone) || {}
    if (pb.avatarUrl) continue // já tem foto
    try {
      const url = await waClient.getProfilePicUrl(chatId).catch(() => null)
      if (url) {
        phonebook.set(phone, { ...pb, avatarUrl: url })
        upsertChat(chatId, { avatarUrl: url })
        pushSSE('avatar', { chatId, avatarUrl: url })
        fetched++
      }
    } catch {}
    // Pausa pequena para não sobrecarregar
    await new Promise(r => setTimeout(r, 100))
  }
  savePhonebook()
  saveChats()
  console.log(`[WA] ${fetched} fotos carregadas.`)
}

// ── WhatsApp Client ───────────────────────────────────────────────────────────
function createClient() {
  waQR    = null
  waReady = false
  waState = 'CONNECTING'

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: DATA_DIR }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
      ],
    },
  })

  client.on('qr', async qr => {
    console.log('[WA] QR gerado')
    waQR    = await QRCode.toDataURL(qr)
    waState = 'QR_READY'
    pushSSE('qr', { qrDataUrl: waQR })
  })

  client.on('authenticated', () => {
    console.log('[WA] Autenticado')
    waState = 'AUTHENTICATED'
    waQR    = null
    pushSSE('state', { state: waState, connected: false, ready: false })
  })

  client.on('ready', async () => {
    console.log('[WA] Pronto!')
    waReady = true
    waState = 'CONNECTED'
    waQR    = null
    pushSSE('state', { state: waState, connected: true, ready: true })
    // Carrega chats e contatos em sequência
    await syncContacts()
    await loadRecentChats()
    pushSSE('contacts-loaded', { count: chatsMap.size })
    // Busca fotos em background (sem travar)
    loadAvatarsInBackground()
  })

  client.on('disconnected', reason => {
    console.log('[WA] Desconectado:', reason)
    waReady = false
    waState = 'DISCONNECTED'
    pushSSE('state', { state: waState, connected: false, ready: false })
  })

  client.on('auth_failure', () => {
    console.log('[WA] Falha de autenticação')
    waReady = false
    waState = 'AUTH_FAILURE'
    pushSSE('state', { state: waState, connected: false, ready: false })
  })

  client.on('message', async msg => {
    if (msg.from === 'status@broadcast') return
    const chatId = msg.from
    const phone  = chatId2Phone(chatId)
    const { name, avatarUrl } = getContactInfo(chatId, msg)
    const text = msg.body || ''

    const msgObj = {
      id:   msg.id.id || crypto.randomUUID(),
      from: 'lead',
      text,
      at:   new Date(msg.timestamp * 1000).toISOString(),
      name: msg.notifyName || name,
    }
    pushMsg(chatId, msgObj)

    const chat = chatsMap.get(chatId) || {}
    upsertChat(chatId, {
      phone,
      name:        chat.name || msg.notifyName || name,
      lastMsg:     text,
      lastAt:      msgObj.at,
      unread:      (chat.unread || 0) + 1,
      isGroup:     chatId.endsWith('@g.us'),
      avatarUrl:   chat.avatarUrl || avatarUrl,
    })

    pushSSE('message', { chatId, msg: msgObj })
    pushSSE('chat-update', { chatId, lastMsg: text, lastAt: msgObj.at, unread: (chat.unread || 0) + 1 })

    // Atualiza foto do perfil em background
    fetchAvatar(chatId).then(url => {
      if (url && url !== chat.avatarUrl) {
        upsertChat(chatId, { avatarUrl: url })
        pushSSE('avatar', { chatId, avatarUrl: url })
      }
    })

    // Sofi IA
    processAI(chatId, text)
  })

  client.on('message_create', msg => {
    if (!msg.fromMe) return
    const chatId = msg.to
    const text   = msg.body || ''
    const msgObj = {
      id:   msg.id.id || crypto.randomUUID(),
      from: 'agent',
      text,
      at:   new Date(msg.timestamp * 1000).toISOString(),
      name: 'Você',
      ack:  1, // sent
    }
    pushMsg(chatId, msgObj)
    upsertChat(chatId, { lastMsg: text, lastAt: msgObj.at })
    pushSSE('message', { chatId, msg: msgObj })
  })

  // Status de entrega/leitura: 1=sent 2=delivered 3=read
  client.on('message_ack', (msg, ack) => {
    const chatId = msg.fromMe ? msg.to : msg.from
    pushSSE('message-ack', { chatId, msgId: msg.id.id, ack })
  })

  // Indicador de digitando
  client.on('contact_changed', () => {})

  client.on('group_update', () => {})

  let retryCount = 0
  const tryInit = () => {
    client.initialize().catch(async e => {
      console.error('[WA] Erro ao inicializar:', e.message)
      waState = 'ERROR'
      pushSSE('state', { state: waState, connected: false, ready: false, error: e.message })
      if (retryCount < 3) {
        retryCount++
        const delay = retryCount * 5000
        console.log(`[WA] Tentando novamente em ${delay/1000}s... (tentativa ${retryCount}/3)`)
        setTimeout(tryInit, delay)
      }
    })
  }
  tryInit()

  return client
}

// Sincroniza contatos do celular após conectar
async function syncContacts() {
  if (!waClient || !waReady) return
  try {
    const contacts = await waClient.getContacts()
    let updated = 0
    for (const c of contacts) {
      const phone = normPhone(c.id._serialized || c.number || '')
      if (!phone || phone.length < 7) continue
      const pb = phonebook.get(phone) || {}
      const name = c.name || c.pushname || pb.name || ''
      if (name && name !== pb.name) {
        phonebook.set(phone, { ...pb, name })
        updated++
      }
    }
    savePhonebook()
    console.log(`[WA] ${updated} contatos sincronizados do celular.`)
  } catch (e) {
    console.error('[WA] Erro ao sincronizar contatos:', e.message)
  }
}

// Carrega TODOS os chats e contatos da agenda — sem limite
async function loadRecentChats() {
  if (!waClient || !waReady) return
  try {
    console.log('[WA] Carregando todos os chats e contatos...')

    // 1) Carrega todos os chats (conversas abertas)
    const chats = await waClient.getChats()
    console.log(`[WA] ${chats.length} chats encontrados`)

    for (const chat of chats) {
      const chatId = chat.id._serialized
      if (!chatId || chatId === 'status@broadcast') continue

      const phone = chatId2Phone(chatId)
      const pb    = phonebook.get(phone) || {}
      const name  = chat.name || pb.name || phone

      const lm      = chat.lastMessage
      const lastMsg = lm?.body || lm?.caption || ''
      const lastTs  = lm?.timestamp || chat.timestamp || 0
      const lastAt  = lastTs ? new Date(Number(lastTs) * 1000).toISOString() : ''

      upsertChat(chatId, {
        phone,
        name,
        lastMsg,
        lastAt,
        unread:   chat.unreadCount || 0,
        isGroup:  chat.isGroup || false,
        avatarUrl: pb.avatarUrl || '',
      })

      // Salva nome no phonebook
      if (name && name !== phone) {
        const existing = phonebook.get(phone) || {}
        if (!existing.name) {
          phonebook.set(phone, { ...existing, name })
        }
      }
    }

    // 2) Carrega TODOS os contatos da agenda do celular
    // (inclui contatos que nunca tiveram conversa)
    const contacts = await waClient.getContacts()
    console.log(`[WA] ${contacts.length} contatos na agenda`)

    let newContacts = 0
    for (const c of contacts) {
      const phone = normPhone(c.id._serialized || c.number || '')
      if (!phone || phone.length < 7) continue
      if (phone === 'status' || phone === 'broadcast') continue

      const name = c.name || c.pushname || c.shortName || ''
      const chatId = `${phone}@c.us`

      // Atualiza phonebook com nome
      const pb = phonebook.get(phone) || {}
      if (name && name !== pb.name) {
        phonebook.set(phone, { ...pb, name })
      }

      // Adiciona no chatsMap se ainda não existe (contato sem conversa)
      if (!chatsMap.has(chatId) && name) {
        upsertChat(chatId, {
          phone,
          name,
          lastMsg:  '',
          lastAt:   '',
          unread:   0,
          isGroup:  false,
          avatarUrl: pb.avatarUrl || '',
        })
        newContacts++
      }
    }

    saveChats()
    savePhonebook()
    console.log(`[WA] Total: ${chatsMap.size} chats + ${newContacts} contatos novos da agenda`)
    pushSSE('contacts-loaded', { count: chatsMap.size })
  } catch (e) {
    console.error('[WA] Erro ao carregar chats:', e.message)
  }
}

// ── Express App ───────────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// Serve avatars
app.use('/wa-avatar', express.static(AVATAR_DIR))

// ── Middleware de autenticação simples ────────────────────────────────────────
const API_KEY = process.env.WHATSAPP_API_KEY || 'aps-edu-whatsapp'
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  const key = req.headers['x-api-key'] || req.headers['apikey'] || req.query.apikey
  if (key && key === API_KEY) return next()
  // Permite localhost sem chave para desenvolvimento
  const host = req.headers.host || ''
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return next()
  return res.status(401).json({ error: 'Unauthorized' })
})

// ── Routes ────────────────────────────────────────────────────────────────────

// Health
app.get('/health', (_, res) => res.json({ ok: true }))

// Status da conexão
app.get('/status', (req, res) => {
  res.json({
    connected:  waReady,
    ready:      waReady,
    state:      waState,
    qrDataUrl:  waQR || null,
    error:      null,
  })
})

// Iniciar / reconectar
app.post('/start', async (req, res) => {
  if (waReady) return res.json({ connected: true, ready: true, qrDataUrl: null, error: null })
  if (waState === 'CONNECTING' || waState === 'QR_READY') {
    return res.json({ connected: false, ready: false, qrDataUrl: waQR || null, error: null })
  }
  // Destrói cliente antigo se existir
  if (waClient) {
    try { await waClient.destroy() } catch {}
    waClient = null
  }
  waClient = createClient()
  res.json({ connected: false, ready: false, qrDataUrl: null, error: null, starting: true })
})

// Desconectar
app.post('/disconnect', async (req, res) => {
  if (waClient) {
    try { await waClient.logout() } catch {}
    try { await waClient.destroy() } catch {}
    waClient = null
  }
  waReady = false
  waState = 'DISCONNECTED'
  waQR    = null
  res.json({ ok: true })
})

// Contatos (chats + phonebook)
app.get('/contacts', (req, res) => {
  const contacts = []
  for (const [chatId, chat] of chatsMap) {
    const phone = chat.phone || chatId2Phone(chatId)
    const pb    = phonebook.get(phone) || {}
    const crm   = crmMap.get(phone) || {}
    contacts.push({
      chatId,
      phone,
      name:        chat.name || pb.name || phone,
      lastMessage: chat.lastMsg || '',
      lastAt:      chat.lastAt || '',
      timestamp:   chat.lastAt ? new Date(chat.lastAt).getTime() : 0,
      unread:      chat.unread || 0,
      isGroup:     chat.isGroup || false,
      avatarUrl:   chat.avatarUrl || pb.avatarUrl || '',
      stage:       crm.stage || 'Inbox',
      tags:        crm.tags || [],
    })
  }
  contacts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  res.json(contacts)
})

// Todos os contatos do phonebook (para envio em massa)
app.get('/contacts-all', (req, res) => {
  const result = []
  for (const [phone, pb] of phonebook) {
    const crm = crmMap.get(phone) || {}
    result.push({ phone, name: pb.name || phone, avatarUrl: pb.avatarUrl || '', stage: crm.stage || 'Inbox' })
  }
  res.json(result)
})

// Mensagens de um chat
app.get('/messages', (req, res) => {
  const { chatId, limit = 50 } = req.query
  if (!chatId) return res.status(400).json({ error: 'chatId obrigatório' })
  const msgs = msgsMap.get(chatId) || []
  res.json(msgs)
})

// Busca mensagens históricas do WhatsApp para um chat
app.get('/messages/fetch', async (req, res) => {
  const { chatId, limit = 200 } = req.query
  if (!chatId) return res.status(400).json({ error: 'chatId obrigatório' })
  if (!waReady) return res.status(503).json({ error: 'WhatsApp não conectado' })
  try {
    const chat = await waClient.getChatById(chatId).catch(() => null)
    if (!chat) return res.json([])
    const raw = await chat.fetchMessages({ limit: Number(limit) })

    function extractText(m) {
      if (m.body) return m.body
      if (m.caption) return m.caption
      if (m.type === 'audio' || m.type === 'ptt') return '🎤 Áudio'
      if (m.type === 'image') return '📷 Foto'
      if (m.type === 'video') return '🎥 Vídeo'
      if (m.type === 'document') return '📄 Arquivo'
      if (m.type === 'sticker') return '🎴 Sticker'
      if (m.type === 'location') return '📍 Localização'
      if (m.type === 'vcard' || m.type === 'multi_vcard') return '👤 Contato'
      return ''
    }

    // Baixa mídia para imagens (inline base64)
    const msgs = await Promise.all(raw.map(async m => {
      let text = extractText(m)
      let mediaData = null

      // Para imagens: baixa e converte para base64
      if (m.type === 'image' || m.type === 'sticker') {
        try {
          const media = await m.downloadMedia()
          if (media) mediaData = `data:${media.mimetype};base64,${media.data}`
        } catch {}
      }

      return {
        id:        m.id.id || crypto.randomUUID(),
        from:      m.fromMe ? 'agent' : 'lead',
        text:      mediaData || text,
        mediaType: m.type || 'text',
        at:        new Date(m.timestamp * 1000).toISOString(),
        ts:        m.timestamp * 1000,
        name:      m.notifyName || (m.fromMe ? 'Você' : ''),
        ack:       m.ack || 0,
      }
    }))
    const filtered = msgs.filter(m => m.text)

    // Salva no cache local
    if (filtered.length) {
      msgsMap.set(String(chatId), filtered)
      saveMsgs()
    }
    res.json(filtered)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Enviar mensagem individual
app.post('/send', async (req, res) => {
  const { chatId, phone, text } = req.body
  if (!text) return res.status(400).json({ error: 'text obrigatório' })
  if (!waReady) return res.status(503).json({ error: 'WhatsApp não conectado' })

  try {
    const jid  = chatId || phone2JID(phone)
    const chat = await waClient.getChatById(jid)
    await chat.sendMessage(text)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Marcar mensagens como lidas
app.post('/mark-read', async (req, res) => {
  const { chatId } = req.body
  if (!waReady) return res.json({ ok: false })
  try {
    const chat = await waClient.getChatById(chatId)
    await chat.sendSeen()
    upsertChat(chatId, { unread: 0 })
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

// Grupos
app.get('/groups', async (req, res) => {
  if (!waReady) return res.status(503).json({ error: 'WhatsApp não conectado' })
  try {
    const chats = await waClient.getChats()
    const groups = []
    for (const chat of chats.filter(c => c.isGroup)) {
      const participants = await chat.participants || []
      const avatarUrl = await waClient.getProfilePicUrl(chat.id._serialized).catch(() => '')
    groups.push({
        id:           chat.id._serialized,
        name:         chat.name || chat.id._serialized,
        description:  chat.description || '',
        participants: participants.length,
        avatarUrl:    avatarUrl || '',
        members:      participants.map(p => ({
          id:    p.id._serialized,
          phone: normPhone(p.id._serialized),
          admin: p.isAdmin || false,
          name:  phonebook.get(normPhone(p.id._serialized))?.name || '',
        })).filter(m => m.phone && m.phone.length >= 7),
      })
    }
    res.json(groups)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Envio em Massa ────────────────────────────────────────────────────────────
let bulkRunning   = false
let bulkAbort     = false
let bulkProgress  = { total: 0, sent: 0, failed: 0, current: '', log: [] }

app.post('/bulk-send', async (req, res) => {
  const {
    recipients,   // [{ phone, nome, empresa, ...vars }]
    template,     // "Olá {nome}, ..."
    delayMs = 4000,
    randomExtraMs = 3000,
    groupIds,     // opcional: array de chatIds de grupos
    segmentStage, // opcional: enviar para stage específico
    dryRun = false,
  } = req.body

  if (bulkRunning) return res.status(409).json({ error: 'Já existe um envio em andamento' })
  if (!waReady)    return res.status(503).json({ error: 'WhatsApp não conectado' })
  if (!template)   return res.status(400).json({ error: 'template obrigatório' })

  // Monta lista final de destinatários
  let finalList = []

  if (Array.isArray(recipients) && recipients.length) {
    finalList = recipients.map(r => ({ ...r, phone: String(r.phone || '').replace(/\D/g, '') }))
      .filter(r => r.phone.length >= 8)
  }

  // Adicionar membros de grupos
  if (Array.isArray(groupIds) && groupIds.length) {
    try {
      for (const gid of groupIds) {
        const chat = await waClient.getChatById(gid).catch(() => null)
        if (!chat || !chat.isGroup) continue
        for (const p of (chat.participants || [])) {
          const phone = normPhone(p.id._serialized)
          if (phone && phone.length >= 8 && !finalList.find(r => r.phone === phone)) {
            const pb = phonebook.get(phone) || {}
            finalList.push({ phone, nome: pb.name || phone })
          }
        }
      }
    } catch {}
  }

  // Filtrar por segmento/stage
  if (segmentStage) {
    finalList = finalList.filter(r => {
      const crm = crmMap.get(r.phone) || {}
      return crm.stage === segmentStage
    })
  }

  if (!finalList.length) return res.status(400).json({ error: 'Nenhum destinatário encontrado' })

  bulkRunning  = true
  bulkAbort    = false
  bulkProgress = { total: finalList.length, sent: 0, failed: 0, current: '', log: [], startedAt: new Date().toISOString() }

  res.json({ ok: true, total: finalList.length, message: 'Envio em massa iniciado' })

  // Envio assíncrono
  ;(async () => {
    for (const recipient of finalList) {
      if (bulkAbort) break

      const { phone, ...vars } = recipient
      const personalized = template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || k)

      bulkProgress.current = phone
      pushSSE('bulk-progress', { ...bulkProgress })

      if (!dryRun) {
        try {
          const chat = await waClient.getChatById(phone2JID(phone)).catch(() => null)
          if (chat) {
            await chat.sendMessage(personalized)
            bulkProgress.sent++
            bulkProgress.log.push({ phone, name: vars.nome || phone, status: 'sent', at: new Date().toISOString() })
          } else {
            // Tenta via número diretamente
            await waClient.sendMessage(phone2JID(phone), personalized)
            bulkProgress.sent++
            bulkProgress.log.push({ phone, name: vars.nome || phone, status: 'sent', at: new Date().toISOString() })
          }
        } catch (e) {
          bulkProgress.failed++
          bulkProgress.log.push({ phone, name: vars.nome || phone, status: 'error', error: e.message, at: new Date().toISOString() })
        }
      } else {
        bulkProgress.sent++
        bulkProgress.log.push({ phone, name: vars.nome || phone, status: 'dry-run', at: new Date().toISOString() })
      }

      pushSSE('bulk-progress', { ...bulkProgress })

      // Delay com variação aleatória para evitar bloqueio
      const delay = Number(delayMs) + Math.floor(Math.random() * Number(randomExtraMs))
      await new Promise(r => setTimeout(r, delay))
    }

    bulkRunning         = false
    bulkProgress.done   = true
    bulkProgress.endAt  = new Date().toISOString()
    writeJson(BULK_LOG_F, bulkProgress)
    pushSSE('bulk-done', { ...bulkProgress })
    console.log(`[Bulk] Finalizado: ${bulkProgress.sent} enviados, ${bulkProgress.failed} falhas`)
  })()
})

// Status do envio em massa
app.get('/bulk-status', (req, res) => {
  res.json({ running: bulkRunning, ...bulkProgress })
})

// Pausar envio em massa
app.post('/bulk-stop', (req, res) => {
  bulkAbort = true
  res.json({ ok: true, message: 'Envio pausado na próxima iteração' })
})

// ── CRM / Stages ──────────────────────────────────────────────────────────────
app.post('/crm/stage', (req, res) => {
  const { chatId, phone, stage } = req.body
  const p = phone || chatId2Phone(chatId)
  const existing = crmMap.get(p) || {}
  crmMap.set(p, { ...existing, stage })
  saveCrm()
  res.json({ ok: true })
})

app.post('/crm/update', (req, res) => {
  const { phone, ...fields } = req.body
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' })
  const existing = crmMap.get(phone) || {}
  crmMap.set(phone, { ...existing, ...fields })
  saveCrm()
  res.json({ ok: true })
})

app.post('/crm/handoff', (req, res) => {
  const { chatId, phone, paused } = req.body
  const p = phone || chatId2Phone(chatId)
  const existing = crmMap.get(p) || {}
  crmMap.set(p, { ...existing, handoff: paused !== false })
  saveCrm()
  assistSuggestions.delete(chatId || phone2JID(p))
  res.json({ ok: true })
})

// Segmentos (contagem por stage)
app.get('/crm/segments', (req, res) => {
  const counts = {}
  for (const [, crm] of crmMap) {
    const s = crm.stage || 'Inbox'
    counts[s] = (counts[s] || 0) + 1
  }
  res.json(counts)
})

// ── AI State ──────────────────────────────────────────────────────────────────
app.get('/ai/state', (req, res) => {
  res.json({ ...aiState, hasGeminiKey: !!GEMINI_KEY })
})

app.post('/ai/control', (req, res) => {
  const { mode, tone, maxChars, allowGroups, activePlaybook } = req.body
  if (mode      !== undefined) aiState.mode          = mode
  if (tone      !== undefined) aiState.tone          = tone
  if (maxChars  !== undefined) aiState.maxChars       = Number(maxChars)
  if (allowGroups !== undefined) aiState.allowGroups  = !!allowGroups
  if (activePlaybook !== undefined) aiState.activePlaybook = activePlaybook
  saveAiState()
  res.json({ ok: true, ...aiState })
})

app.post('/ai/training', (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text obrigatório' })
  aiState.training = aiState.training || []
  aiState.training.push(text)
  saveAiState()
  res.json({ ok: true })
})

app.delete('/ai/training/:idx', (req, res) => {
  const idx = parseInt(req.params.idx, 10)
  if (!isNaN(idx)) aiState.training.splice(idx, 1)
  saveAiState()
  res.json({ ok: true })
})

app.post('/ai/suggest', async (req, res) => {
  const { chatId, text } = req.body
  const cached = assistSuggestions.get(chatId)
  if (cached) {
    assistSuggestions.delete(chatId)
    return res.json({ suggestion: cached })
  }
  if (!genAI) return res.json({ suggestion: null })
  const prompt = await sofiBuildPrompt(chatId, text || '')
  try {
    const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    const reply  = result.response.text().trim().slice(0, aiState.maxChars)
    res.json({ suggestion: reply })
  } catch (e) {
    res.json({ suggestion: null, error: e.message })
  }
})

// ── Sync manual de contatos ────────────────────────────────────────────────────
app.post('/contacts/sync', async (req, res) => {
  if (!waReady) return res.status(503).json({ error: 'WhatsApp não conectado', ready: false })
  try {
    await syncContacts()
    await loadRecentChats()
    res.json({ ok: true, contacts: phonebook.size, chats: chatsMap.size })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── SSE: stream de eventos em tempo real ──────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Envia estado atual imediatamente
  const state = { connected: waReady, ready: waReady, state: waState, qrDataUrl: waQR || null }
  res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`)

  sseClients.push(res)

  // Heartbeat a cada 20s para manter conexão viva
  const hb = setInterval(() => {
    try { res.write(': heartbeat\n\n') } catch { clearInterval(hb) }
  }, 20_000)

  req.on('close', () => {
    clearInterval(hb)
    sseClients = sseClients.filter(c => c !== res)
  })
})

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n[WhatsApp Server] Rodando na porta ${PORT}`)
  console.log(`[WhatsApp Server] API Key: ${API_KEY}`)
  console.log(`[WhatsApp Server] Acesse: http://localhost:${PORT}/status\n`)
})

// Inicia o cliente WhatsApp automaticamente
waClient = createClient()
