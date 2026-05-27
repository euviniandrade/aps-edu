const state = {
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  connected: false,
  ready: false,
  qr: null,
  lastEventAt: null,
  error: null,
}

let client = null

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
  }
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
      dataPath: process.env.WHATSAPP_SESSION_PATH || '.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    takeoverOnConflict: true,
  })

  client.on('qr', qr => {
    state.qr = qr
    state.ready = false
    state.connected = false
    state.lastEventAt = new Date().toISOString()
  })

  client.on('ready', () => {
    state.qr = null
    state.ready = true
    state.connected = true
    state.error = null
    state.lastEventAt = new Date().toISOString()
  })

  client.on('auth_failure', message => {
    state.ready = false
    state.connected = false
    state.error = message || 'Falha de autenticação no WhatsApp.'
    state.lastEventAt = new Date().toISOString()
  })

  client.on('disconnected', reason => {
    state.ready = false
    state.connected = false
    state.error = reason || 'WhatsApp desconectado.'
    state.lastEventAt = new Date().toISOString()
  })

  await client.initialize()
  return getState()
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

module.exports = {
  getState,
  start,
  sendMessage,
  listChats,
}
