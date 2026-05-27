const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { EventEmitter } = require('events')

const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), '.wwebjs_auth')
const MEMORY_PATH = process.env.WHATSAPP_MEMORY_PATH || path.join(SESSION_PATH, 'sofi-whatsapp-memory.json')

const emitter = new EventEmitter()
emitter.setMaxListeners(100)

// Histórico de mensagens em memória (últimas 100 por chat)
const messageHistory = new Map()

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

let client = null
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
  return defaultAutomation
}

function saveMemory() {
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true })
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(automation, null, 2))
}

function loadWwebjs() {
  try {
    return require('whatsapp-web.js')
  } catch (error) {
    state.error = 'whatsapp-web.js não está instalado no backend.'
    return null
  }
}

function getState() {
  return {
    ...state,
    mode: state.enabled ? 'live' : 'preview',
    provider: 'whatsapp-web.js',
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

async function start() {
  if (!state.enabled) {
    state.error = 'Ative WHATSAPP_ENABLED=true no Fly para iniciar a sessão real.'
    return getState()
  }

  if (client) return getState()

  const wwebjs = loadWwebjs()
  if (!wwebjs) return getState()

  const { Client, LocalAuth } = wwebjs
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: process.env.WHATSAPP_CLIENT_ID || 'aps-edu',
      dataPath: SESSION_PATH,
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    takeoverOnConflict: true,
  })

  client.on('qr', async qr => {
    state.qr = qr
    state.qrDataUrl = await QRCode.toDataURL(qr)
    state.ready = false
    state.connected = false
    state.lastEventAt = new Date().toISOString()
    emitState()
  })

  client.on('ready', () => {
    state.qr = null
    state.qrDataUrl = null
    state.ready = true
    state.connected = true
    state.error = null
    state.lastEventAt = new Date().toISOString()
    emitState()
  })

  client.on('message', handleIncomingMessage)

  client.on('auth_failure', message => {
    state.ready = false
    state.connected = false
    state.error = message || 'Falha de autenticação no WhatsApp.'
    state.lastEventAt = new Date().toISOString()
    emitState()
  })

  client.on('disconnected', reason => {
    state.ready = false
    state.connected = false
    state.error = reason || 'WhatsApp desconectado.'
    state.lastEventAt = new Date().toISOString()
    client = null
    emitState()
  })

  await client.initialize()
  return getState()
}

async function handleIncomingMessage(message) {
  if (message.fromMe || !message.body) return
  if (message.from.endsWith('@g.us') && !automation.allowGroups) return

  state.lastMessageAt = new Date().toISOString()
  const text = String(message.body || '')
  const normalized = text.toLowerCase()
  const pushName = message._data?.notifyName || ''
  const at = new Date().toISOString()

  const incomingMsg = {
    id: message.id?._serialized || message.id || crypto.randomUUID?.() || Date.now().toString(),
    chatId: message.from,
    name: pushName,
    text,
    from: 'lead',
    at,
  }
  storeMessage(message.from, incomingMsg)
  emitter.emit('message', incomingMsg)

  const shouldHandoff = automation.handoffKeywords.some(keyword => normalized.includes(keyword.toLowerCase()))
  if (shouldHandoff) {
    manualChats.add(message.from)
    state.handoffs += 1
    emitState()
    return
  }

  if (manualChats.has(message.from) || automation.mode === 'paused') return

  const replyText = await generateSofiReply({ text, from: message.from, pushName })

  if (automation.mode === 'assist') {
    suggestions.push({ chatId: message.from, text: replyText, at })
    return
  }

  await client.sendMessage(message.from, replyText)
  state.autoReplies += 1

  const outMsg = { id: `out_${Date.now()}`, chatId: message.from, name: 'Sofi', text: replyText, from: 'sofi', at: new Date().toISOString() }
  storeMessage(message.from, outMsg)
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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: process.env.WHATSAPP_GEMINI_MODEL || 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    return result.response.text().slice(0, automation.maxChars)
  }

  return 'Olá! Sou a Sofi, do Departamento de Educação da Associação Paulista Sul. Recebi sua mensagem e vou te ajudar com o próximo passo. Pode me contar um pouco mais?'
}

async function sendMessage({ phone, text }) {
  if (!client || !state.ready) {
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

  const chatId = `${normalized}@c.us`
  const result = await client.sendMessage(chatId, String(text))
  return {
    id: result.id?._serialized || result.id || null,
    to: normalized,
    at: new Date().toISOString(),
  }
}

async function listChats(limit = 30) {
  if (!client || !state.ready) return []
  const chats = await client.getChats()
  return chats.slice(0, Number(limit)).map(chat => ({
    id: chat.id?._serialized,
    name: chat.name,
    isGroup: chat.isGroup,
    unreadCount: chat.unreadCount,
    timestamp: chat.timestamp,
  }))
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
