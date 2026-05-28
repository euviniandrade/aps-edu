const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { EventEmitter } = require('events')

const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), '.whatsapp_session')
const MEMORY_PATH = process.env.WHATSAPP_MEMORY_PATH || path.join(SESSION_PATH, 'sofi-whatsapp-memory.json')

const emitter = new EventEmitter()
emitter.setMaxListeners(100)

// Histórico de mensagens em memória (últimas 100 por chat)
const messageHistory = new Map()
// Chats vistos (populado por mensagens recebidas)
const chatsStore = new Map()

const defaultAutomation = {
  mode: process.env.WHATSAPP_AI_MODE || 'paused',
  tone: 'humano, acolhedor, objetivo e profissional',
  maxChars: 650,
  allowGroups: false,
  handoffKeywords: ['humano', 'atendente', 'reclamação', 'cancelar', 'jurídico', 'diretor'],
  training: [
    'Sempre se apresente como Sofi, assistente do Departamento de Educação da Associação Paulista Sul.',
    'Priorize acolhimento, clareza, próximo passo simples e nunca prometa algo sem confirmação humana.',
  ],
}

const state = {
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  connected: false,
  ready: false,
  qr: null,
  qrDataUrl: null,
  lastEventAt: null,
  error: null,
  autoReplies: 0,
  handoffs: 0,
  lastMessageAt: null,
}

let sock = null
let automation = loadMemory()
const manualChats = new Set()
const suggestions = []

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      return { ...defaultAutomation, ...JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8')) }
    }
  } catch (error) {
    state.error = error.message
  }
  return { ...defaultAutomation }
}

function saveMemory() {
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true })
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(automation, null, 2))
}

function getState() {
  return {
    ...state,
    mode: state.enabled ? 'live' : 'preview',
    provider: 'baileys',
    needsRuntime: !state.enabled,
    automation,
    manualChats: Array.from(manualChats),
    suggestions: suggestions.slice(-20),
  }
}

function emitState() {
  emitter.emit('state', getState())
}

function storeMessage(chatId, message) {
  if (!messageHistory.has(chatId)) messageHistory.set(chatId, [])
  const msgs = messageHistory.get(chatId)
  msgs.push(message)
  if (msgs.length > 100) msgs.shift()
}

function getMessages(chatId, limit = 50) {
  return (messageHistory.get(chatId) || []).slice(-limit)
}

// Extrai texto de qualquer tipo de mensagem Baileys
function extractText(msg) {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  )
}

async function start() {
  if (!state.enabled) {
    state.error = 'Ative WHATSAPP_ENABLED=true no .env para iniciar a sessão real.'
    return getState()
  }

  if (sock) return getState()

  state.error = null
  state.lastEventAt = new Date().toISOString()
  emitState()

  try {
    // Importação dinâmica compatível com CJS e ESM
    const baileys = await import('@whiskeysockets/baileys')
    const makeWASocket = baileys.default
    const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys
    const pino = require('pino')

    fs.mkdirSync(SESSION_PATH, { recursive: true })

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_PATH)

    // Obtém versão mais recente do WA Web (com fallback)
    let version = [2, 3000, 1017531287]
    try {
      const result = await fetchLatestBaileysVersion()
      version = result.version
    } catch (_) {}

    sock = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      generateHighQualityLinkPreview: false,
      browser: ['APS-EDU Sofi', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      state.lastEventAt = new Date().toISOString()

      if (qr) {
        try {
          state.qr = qr
          state.qrDataUrl = await QRCode.toDataURL(qr)
          state.ready = false
          state.connected = false
          state.error = null
          emitState()
        } catch (err) {
          state.error = `Erro ao gerar QR: ${err.message}`
          emitState()
        }
      }

      if (connection === 'open') {
        state.qr = null
        state.qrDataUrl = null
        state.ready = true
        state.connected = true
        state.error = null
        emitState()
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut

        state.ready = false
        state.connected = false
        state.qr = null
        state.qrDataUrl = null
        state.error = loggedOut
          ? 'Sessão encerrada — faça login novamente.'
          : (lastDisconnect?.error?.message || 'WhatsApp desconectado.')
        sock = null
        emitState()

        if (!loggedOut) {
          console.log('[WhatsApp] Reconectando em 8s...')
          setTimeout(() => start(), 8000)
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const message of messages) {
        if (message.key.fromMe) continue

        const chatId = message.key.remoteJid
        if (!chatId) continue

        const isGroup = chatId.endsWith('@g.us')
        if (isGroup && !automation.allowGroups) continue

        const text = extractText(message)
        if (!text) continue

        state.lastMessageAt = new Date().toISOString()
        const pushName = message.pushName || ''
        const at = new Date().toISOString()

        const incomingMsg = {
          id: message.key.id || `${Date.now()}`,
          chatId,
          name: pushName,
          text,
          from: 'lead',
          at,
        }

        // Atualiza store de chats
        chatsStore.set(chatId, {
          id: chatId,
          name: pushName || chatId.replace('@s.whatsapp.net', '').replace('@g.us', ''),
          isGroup,
          unreadCount: (chatsStore.get(chatId)?.unreadCount || 0) + 1,
          timestamp: Math.floor(Date.now() / 1000),
          lastMessage: text,
        })

        storeMessage(chatId, incomingMsg)
        emitter.emit('message', incomingMsg)

        await handleAutomation({ chatId, text, pushName, at }).catch(err => {
          console.error('[WhatsApp] Erro na automação:', err.message)
        })
      }
    })

  } catch (error) {
    state.error = `Erro ao iniciar Baileys: ${error.message}`
    sock = null
    emitState()
    console.error('[WhatsApp] Falha ao iniciar:', error)
  }

  return getState()
}

async function handleAutomation({ chatId, text, pushName, at }) {
  const normalized = text.toLowerCase()

  const shouldHandoff = automation.handoffKeywords.some(k => normalized.includes(k.toLowerCase()))
  if (shouldHandoff) {
    manualChats.add(chatId)
    state.handoffs += 1
    emitState()
    return
  }

  if (manualChats.has(chatId) || automation.mode === 'paused') return

  const replyText = await generateSofiReply({ text, from: chatId, pushName })

  if (automation.mode === 'assist') {
    suggestions.push({ chatId, text: replyText, at })
    emitState()
    return
  }

  // mode === 'auto': envia resposta
  await sock.sendMessage(chatId, { text: replyText })
  state.autoReplies += 1

  const outMsg = {
    id: `out_${Date.now()}`,
    chatId,
    name: 'Sofi',
    text: replyText,
    from: 'sofi',
    at: new Date().toISOString(),
  }
  storeMessage(chatId, outMsg)
  emitter.emit('message', outMsg)
  emitState()
}

async function generateSofiReply({ text, from, pushName }) {
  const prompt = `Você é a Sofi, agente de WhatsApp da Associação Paulista Sul.
Responda como uma atendente humana, rápida, educada e objetiva.

Regras de treinamento:
${automation.training.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Tom: ${automation.tone}
Limite: ${automation.maxChars} caracteres
Contato: ${pushName || from}
Mensagem recebida: ${text}

Responda em português do Brasil e termine com uma pergunta simples quando fizer sentido.`

  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: process.env.WHATSAPP_GEMINI_MODEL || 'gemini-1.5-flash' })
      const result = await model.generateContent(prompt)
      return result.response.text().slice(0, automation.maxChars)
    } catch (err) {
      console.error('[Sofi] Erro Gemini:', err.message)
    }
  }

  return 'Olá! Sou a Sofi, do Departamento de Educação da Associação Paulista Sul. Recebi sua mensagem e estou aqui para ajudar. Pode me contar mais?'
}

async function sendMessage({ phone, text }) {
  if (!sock || !state.ready) {
    const error = new Error('WhatsApp ainda não está conectado.')
    error.statusCode = 409
    throw error
  }

  const normalized = String(phone || '').replace(/\D/g, '')
  if (!normalized || !text) {
    const error = new Error('Informe telefone e mensagem.')
    error.statusCode = 400
    throw error
  }

  // Baileys usa @s.whatsapp.net para chats individuais
  const jid = normalized.endsWith('@s.whatsapp.net') ? normalized : `${normalized}@s.whatsapp.net`
  const result = await sock.sendMessage(jid, { text: String(text) })
  return {
    id: result?.key?.id || null,
    to: normalized,
    at: new Date().toISOString(),
  }
}

async function listChats(limit = 30) {
  return Array.from(chatsStore.values())
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, Number(limit))
}

function updateAutomation(payload = {}) {
  automation = {
    ...automation,
    ...payload,
    mode: payload.mode || automation.mode,
    training: Array.isArray(payload.training) ? payload.training : automation.training,
    handoffKeywords: Array.isArray(payload.handoffKeywords) ? payload.handoffKeywords : automation.handoffKeywords,
  }
  saveMemory()
  return getState()
}

function addTraining(text) {
  const clean = String(text || '').trim()
  if (!clean) return getState()
  automation.training = [clean, ...automation.training].slice(0, 80)
  saveMemory()
  return getState()
}

function handoff(chatId) {
  if (chatId) manualChats.add(chatId)
  automation.mode = 'paused'
  saveMemory()
  state.handoffs += 1
  return getState()
}

function resumeAuto() {
  manualChats.clear()
  automation.mode = 'auto'
  saveMemory()
  return getState()
}

module.exports = {
  getState,
  start,
  sendMessage,
  listChats,
  getMessages,
  updateAutomation,
  addTraining,
  handoff,
  resumeAuto,
  emitter,
}
