const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { EventEmitter } = require('events')
const prisma = require('../../shared/config/prisma')

const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), '.whatsapp_session')
const MEMORY_PATH = process.env.WHATSAPP_MEMORY_PATH || path.join(SESSION_PATH, 'sofi-whatsapp-memory.json')
const CHATS_STORE_PATH = path.join(SESSION_PATH, 'chats-store.json')
const MESSAGES_STORE_PATH = path.join(SESSION_PATH, 'messages-store.json')
const CRM_STORE_PATH = path.join(SESSION_PATH, 'crm-store.json')
const PHONEBOOK_STORE_PATH = path.join(SESSION_PATH, 'phonebook-store.json')

const emitter = new EventEmitter()
emitter.setMaxListeners(100)

// Histórico de mensagens em memória + disco (últimas 200 por chat)
const messageHistory = new Map()
// Chats vistos — persistido em disco
const chatsStore = new Map()
// Dados CRM por contato (stage, tags, score, notes) — persistido em disco
const crmStore = new Map()
// Catálogo de contatos do celular (contacts.set / contacts.upsert) — persistido em disco
const phonebookStore = new Map()

// ── Persistência ────────────────────────────────────────────────────────────

function loadJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }
  } catch (_) {}
  return null
}

function writeJsonFile(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data))
  } catch (err) {
    console.error('[WhatsApp] Erro ao salvar arquivo:', filePath, err.message)
  }
}

// Carrega dados persistidos do disco ao iniciar
function bootstrapPersistence() {
  const chatsData = loadJsonFile(CHATS_STORE_PATH)
  if (chatsData && typeof chatsData === 'object') {
    for (const [k, v] of Object.entries(chatsData)) chatsStore.set(k, v)
    console.log(`[WhatsApp] ${chatsStore.size} chats carregados do disco.`)
  }

  const messagesData = loadJsonFile(MESSAGES_STORE_PATH)
  if (messagesData && typeof messagesData === 'object') {
    for (const [k, v] of Object.entries(messagesData)) {
      if (Array.isArray(v)) messageHistory.set(k, v)
    }
    console.log(`[WhatsApp] Histórico de ${messageHistory.size} chats carregado do disco.`)
  }

  const crmData = loadJsonFile(CRM_STORE_PATH)
  if (crmData && typeof crmData === 'object') {
    for (const [k, v] of Object.entries(crmData)) crmStore.set(k, v)
  }

  const phonebookData = loadJsonFile(PHONEBOOK_STORE_PATH)
  if (phonebookData && typeof phonebookData === 'object') {
    for (const [k, v] of Object.entries(phonebookData)) phonebookStore.set(k, v)
    console.log(`[WhatsApp] ${phonebookStore.size} contatos do catálogo carregados do disco.`)
  }
}

// Timers de debounce para salvar sem travar o loop de eventos
let _saveChatsTimer = null
function saveChatsStore() {
  clearTimeout(_saveChatsTimer)
  _saveChatsTimer = setTimeout(() => {
    writeJsonFile(CHATS_STORE_PATH, Object.fromEntries(chatsStore))
  }, 1500)
}

let _saveMessagesTimer = null
function saveMessagesStore() {
  clearTimeout(_saveMessagesTimer)
  _saveMessagesTimer = setTimeout(() => {
    writeJsonFile(MESSAGES_STORE_PATH, Object.fromEntries(messageHistory))
  }, 1500)
}

let _saveCrmTimer = null
function saveCrmStore() {
  clearTimeout(_saveCrmTimer)
  _saveCrmTimer = setTimeout(() => {
    writeJsonFile(CRM_STORE_PATH, Object.fromEntries(crmStore))
  }, 1500)
}

let _savePhonebookTimer = null
function savePhonebookStore() {
  clearTimeout(_savePhonebookTimer)
  _savePhonebookTimer = setTimeout(() => {
    writeJsonFile(PHONEBOOK_STORE_PATH, Object.fromEntries(phonebookStore))
  }, 1500)
}

// Carrega dados na inicialização do módulo
bootstrapPersistence()

// ── Automação / estado ───────────────────────────────────────────────────────

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
// Rate limiting: armazena timestamp da última resposta da Sofi por chat
const lastReplyAt = new Map()

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

// ── Mensagens ────────────────────────────────────────────────────────────────

async function storeMessage(chatId, message) {
  if (!messageHistory.has(chatId)) messageHistory.set(chatId, [])
  const msgs = messageHistory.get(chatId)
  // Evita duplicatas por id
  if (message.id && msgs.some(m => m.id === message.id)) return
  msgs.push(message)
  if (msgs.length > 200) msgs.shift()
  saveMessagesStore()

  // Salvar no banco de dados também
  try {
    const isGroup = chatId.includes('@g.us')
    const phone = chatId.replace(/@.*/,'')
    const contactName = message.name || phone

    // Encontrar ou criar Lead (e ATUALIZAR nome se mudou)
    let lead = await prisma.lead.findUnique({ where: { phoneNumber: phone } })
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          phoneNumber: phone,
          contactName: contactName,
          isGroup: isGroup,
          lastMessageAt: new Date(message.at),
          lastMessageText: message.text || ''
        }
      })
    } else {
      // Atualizar nome e última mensagem
      lead = await prisma.lead.update({
        where: { phoneNumber: phone },
        data: {
          contactName: contactName,
          isGroup: isGroup,
          lastMessageAt: new Date(message.at),
          lastMessageText: message.text || ''
        }
      })
    }

    // Encontrar ou criar Conversation
    let conversation = await prisma.conversation.findFirst({
      where: { leadId: lead.id }
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          title: contactName,
          lastMessageAt: new Date(message.at)
        }
      })
    } else {
      // Atualizar última mensagem da conversa
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(message.at) }
      })
    }

    // Salvar Message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: message.text || '',
        contentType: message.type || 'text',
        messageId: message.id,
        timestamp: new Date(message.at),
        fromPhone: message.from || 'unknown',
        ackStatus: message.ack || 1
      }
    }).catch(() => {}) // Ignorar duplicatas no BD
  } catch (err) {
    console.error('[WhatsApp] Erro ao salvar mensagem no BD:', err.message)
  }
}

async function getMessages(chatId, limit = 50) {
  // Tenta memória primeiro (mais rápido)
  let msgs = messageHistory.get(chatId)
  if (msgs && msgs.length > 0) {
    return msgs.slice(-limit)
  }

  // Se não tiver em memória, recupera do banco de dados
  try {
    const phone = normalizePhone(chatId)
    const lead = await prisma.lead.findUnique({
      where: { phoneNumber: phone }
    })

    if (lead) {
      const conversation = await prisma.conversation.findFirst({
        where: { leadId: lead.id }
      })

      if (conversation) {
        const dbMessages = await prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { timestamp: 'desc' },
          take: limit
        })

        // Formatar para o padrão do app
        return dbMessages.reverse().map(m => ({
          id: m.messageId,
          text: m.content,
          type: m.contentType,
          at: m.timestamp.getTime(),
          from: m.fromPhone,
          ack: m.ackStatus
        }))
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Erro ao recuperar mensagens do BD:', err.message)
  }

  return []
}

// ── CRM ──────────────────────────────────────────────────────────────────────

function normalizePhone(chatId) {
  return String(chatId || '').replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '')
}

function getCrm(chatId) {
  const phone = normalizePhone(chatId)
  return crmStore.get(phone) || { phone, stage: 'novo', tags: ['whatsapp'], score: 50, notes: '' }
}

function saveCrm(chatId, data) {
  const phone = normalizePhone(chatId)
  const existing = crmStore.get(phone) || {}
  crmStore.set(phone, { ...existing, ...data, phone })
  saveCrmStore()
  return crmStore.get(phone)
}

function listCrmContacts() {
  // Junta chats conhecidos + catálogo com dados CRM
  const result = []
  const seen = new Set()

  // Primeiro: chats com histórico (têm timestamp de conversa)
  for (const [chatId, chat] of chatsStore) {
    if (chat.isGroup) continue
    const phone = normalizePhone(chatId)
    if (seen.has(phone)) continue
    seen.add(phone)
    const crm = crmStore.get(phone) || { stage: 'novo', tags: ['whatsapp'], score: 50 }
    const phonebook = phonebookStore.get(phone)
    const name = chat.name || phonebook?.name || phone
    result.push({ ...chat, id: chatId, name, phone, ...crm })
  }

  // Segundo: contatos do catálogo que ainda não têm chat
  for (const [phone, contact] of phonebookStore) {
    if (seen.has(phone)) continue
    seen.add(phone)
    const crm = crmStore.get(phone) || { stage: 'novo', tags: ['catálogo'], score: 50 }
    result.push({
      id: contact.chatId,
      chatId: contact.chatId,
      name: contact.name || phone,
      phone,
      isGroup: false,
      timestamp: 0,
      lastMessage: '',
      ...crm,
    })
  }

  // Ordena: quem conversou mais recente primeiro, depois catálogo por nome
  return result.sort((a, b) => {
    if ((b.timestamp || 0) !== (a.timestamp || 0)) return (b.timestamp || 0) - (a.timestamp || 0)
    return (a.name || '').localeCompare(b.name || '', 'pt-BR')
  })
}

// Lista todo o catálogo de contatos do celular
function listPhonebook() {
  const result = []
  const seen = new Set()
  // Inclui contatos do catálogo
  for (const [phone, contact] of phonebookStore) {
    if (seen.has(phone)) continue
    seen.add(phone)
    const crm = crmStore.get(phone) || { stage: 'novo', tags: ['catálogo'], score: 50 }
    const chat = chatsStore.get(contact.chatId) || {}
    result.push({
      phone,
      name: contact.name || phone,
      chatId: contact.chatId,
      lastMessage: chat.lastMessage || '',
      timestamp: chat.timestamp || 0,
      ...crm,
    })
  }
  // Também inclui quem só conversou (pode não estar no catálogo)
  for (const [chatId, chat] of chatsStore) {
    if (chat.isGroup) continue
    const phone = normalizePhone(chatId)
    if (seen.has(phone)) continue
    seen.add(phone)
    const crm = crmStore.get(phone) || { stage: 'novo', tags: ['whatsapp'], score: 50 }
    result.push({
      phone,
      name: chat.name || phone,
      chatId,
      lastMessage: chat.lastMessage || '',
      timestamp: chat.timestamp || 0,
      ...crm,
    })
  }
  return result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
}

// ── Extrai texto de qualquer tipo de mensagem Baileys ──────────────────────

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

// ── Sincronizar Histórico ───────────────────────────────────────────────────────

async function syncAllConversationHistory() {
  if (!sock) return

  try {
    console.log('[WhatsApp] 🔄 Carregando histórico de todas as conversas...')

    // Carregar TODAS as conversas do banco
    const conversations = await prisma.conversation.findMany({
      include: {
        lead: true,
        messages: {
          orderBy: { timestamp: 'asc' },
          take: 200
        }
      }
    })

    console.log(`[WhatsApp] Carregando ${conversations.length} conversas...`)
    let totalMsgs = 0

    for (const conv of conversations) {
      const chatId = conv.lead.phoneNumber + (conv.lead.isGroup ? '@g.us' : '@s.whatsapp.net')

      if (!messageHistory.has(chatId)) {
        messageHistory.set(chatId, [])
      }

      for (const msg of conv.messages) {
        const formattedMsg = {
          id: msg.messageId,
          chatId: chatId,
          text: msg.content,
          type: msg.contentType,
          at: msg.timestamp.getTime(),
          from: msg.fromPhone,
          ack: msg.ackStatus,
          name: conv.lead.contactName
        }

        // Adicionar em memória se não existir
        const msgs = messageHistory.get(chatId)
        if (!msgs.some(m => m.id === msg.messageId)) {
          msgs.push(formattedMsg)
          totalMsgs++
        }
      }
    }

    console.log(`[WhatsApp] ✅ Sincronização completa! ${totalMsgs} mensagens carregadas em memória`)
  } catch (err) {
    console.error('[WhatsApp] Erro na sincronização:', err.message)
  }
}

// ── Conexão Baileys ──────────────────────────────────────────────────────────

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
    const {
      default: makeWASocket,
      DisconnectReason,
      useMultiFileAuthState,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
    } = require('@whiskeysockets/baileys')
    const pino = require('pino')

    fs.mkdirSync(SESSION_PATH, { recursive: true })

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_PATH)

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
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      generateHighQualityLinkPreview: false,
      browser: ['APS-EDU Sofi', 'Chrome', '120.0.0'],
      syncFullHistory: process.env.WHATSAPP_SYNC_FULL !== 'false',  // true localmente (RAM ok), false na Oracle VM
      markOnlineOnConnect: false,
    })

    sock.ev.on('creds.update', saveCreds)

    // Catálogo de contatos do celular
    sock.ev.on('contacts.set', ({ contacts }) => {
      for (const contact of (contacts || [])) {
        if (!contact.id || contact.id === 'status@broadcast') continue
        const phone = normalizePhone(contact.id)
        if (phone.length < 8) continue
        const existing = phonebookStore.get(phone) || {}
        phonebookStore.set(phone, {
          ...existing,
          phone,
          name: contact.name || contact.notify || existing.name || phone,
          chatId: contact.id,
        })
      }
      console.log(`[WhatsApp] ${phonebookStore.size} contatos do catálogo carregados.`)
      savePhonebookStore()
    })

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const contact of (contacts || [])) {
        if (!contact.id || contact.id === 'status@broadcast') continue
        const phone = normalizePhone(contact.id)
        if (phone.length < 8) continue
        const existing = phonebookStore.get(phone) || {}
        phonebookStore.set(phone, {
          ...existing,
          phone,
          name: contact.name || contact.notify || existing.name || phone,
          chatId: contact.id,
        })
      }
      savePhonebookStore()
    })

    // Popula chatsStore com histórico ao conectar
    sock.ev.on('chats.set', ({ chats }) => {
      let updated = 0
      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue
        const existing = chatsStore.get(chat.id) || {}
        const phonebookName = phonebookStore.get(normalizePhone(chat.id))?.name
        const lastMsg = chat.lastMessage?.conversation || chat.lastMessage?.extendedTextMessage?.text ||
          chat.lastMessage?.imageMessage?.caption || chat.lastMessage?.videoMessage?.caption ||
          (chat.lastMessage?.imageMessage ? '📷 Imagem' : '') ||
          (chat.lastMessage?.videoMessage ? '🎥 Vídeo' : '') ||
          (chat.lastMessage?.audioMessage ? '🎤 Áudio' : '') ||
          (chat.lastMessage?.documentMessage ? '📄 Documento' : '') ||
          existing.lastMessage || ''
        chatsStore.set(chat.id, {
          ...existing,
          id: chat.id,
          name: chat.name || phonebookName || existing.name || normalizePhone(chat.id),
          isGroup: chat.id.endsWith('@g.us'),
          unreadCount: chat.unreadCount ?? existing.unreadCount ?? 0,
          timestamp: chat.conversationTimestamp || existing.timestamp || Math.floor(Date.now() / 1000),
          lastMessage: lastMsg,
        })
        updated++
      }
      if (updated > 0) {
        console.log(`[WhatsApp] ${updated} chats sincronizados do WhatsApp.`)
        saveChatsStore()
      }
    })

    // Histórico completo — salva chats E mensagens
    sock.ev.on('messaging-history.set', ({ chats: historyChats, messages: historyMessages, isLatest }) => {
      let updatedChats = 0
      let updatedMsgs = 0

      // 1) Salvar metadata dos chats
      for (const chat of (historyChats || [])) {
        if (!chat.id || chat.id === 'status@broadcast') continue
        const existing = chatsStore.get(chat.id) || {}
        chatsStore.set(chat.id, {
          ...existing,
          id: chat.id,
          name: chat.name || existing.name || normalizePhone(chat.id),
          isGroup: chat.id.endsWith('@g.us'),
          unreadCount: chat.unreadCount ?? existing.unreadCount ?? 0,
          timestamp: chat.conversationTimestamp || existing.timestamp || Math.floor(Date.now() / 1000),
          lastMessage: existing.lastMessage || '',
        })
        updatedChats++
      }

      // 2) Salvar mensagens históricas em memória
      for (const msg of (historyMessages || [])) {
        try {
          const chatId = msg.key?.remoteJid
          if (!chatId || chatId === 'status@broadcast') continue
          const text = extractText(msg)
          if (!text) continue

          const msgObj = {
            id: msg.key.id,
            chatId,
            text,
            type: 'text',
            from: msg.key.fromMe ? 'me' : 'lead',
            name: msg.pushName || '',
            at: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString(),
            ack: msg.status || 1,
          }

          if (!messageHistory.has(chatId)) messageHistory.set(chatId, [])
          const msgs = messageHistory.get(chatId)
          if (!msgs.some(m => m.id === msgObj.id)) {
            msgs.push(msgObj)
            if (msgs.length > 200) msgs.shift()
            updatedMsgs++
          }

          // Atualizar lastMessage no chatsStore
          const existing = chatsStore.get(chatId) || {}
          const ts = msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000)
          if (!existing.lastMessage || ts > (existing.timestamp || 0)) {
            chatsStore.set(chatId, {
              ...existing,
              id: chatId,
              lastMessage: text,
              timestamp: ts,
            })
          }
        } catch (e) { /* ignora mensagens inválidas */ }
      }

      if (updatedChats > 0 || updatedMsgs > 0) {
        console.log(`[WhatsApp] 📨 Histórico: ${updatedChats} chats, ${updatedMsgs} mensagens (isLatest=${isLatest})`)
        saveChatsStore()
        saveMessagesStore()
        emitter.emit('chats.update', { count: updatedChats })
      }
    })

    sock.ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        if (!chat.id || chat.id === 'status@broadcast') continue
        const existing = chatsStore.get(chat.id) || {}
        chatsStore.set(chat.id, {
          ...existing,
          id: chat.id,
          name: chat.name || existing.name || normalizePhone(chat.id),
          isGroup: chat.id.endsWith('@g.us'),
          unreadCount: chat.unreadCount ?? existing.unreadCount ?? 0,
          timestamp: chat.conversationTimestamp || existing.timestamp || Math.floor(Date.now() / 1000),
          lastMessage: chat.lastMessage?.conversation || chat.lastMessage?.extendedTextMessage?.text || existing.lastMessage || '',
        })
      }
      saveChatsStore()
    })

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
          const qrPngPath = path.join(process.cwd(), 'uploads', 'qr.png')
          await QRCode.toFile(qrPngPath, qr, { width: 300, margin: 2 })
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
        console.log('[WhatsApp] ✅ Conectado com sucesso!')

        // Sincronizar histórico de todas as conversas
        console.log('[WhatsApp] 🔄 Sincronizando histórico de mensagens...')
        syncAllConversationHistory().catch(err => {
          console.error('[WhatsApp] Erro ao sincronizar histórico:', err.message)
        })
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
      // 'notify' = novas mensagens em tempo real
      // 'append' = mensagens carregadas do cache (histórico de enviadas/recebidas)
      const isRealTime = type === 'notify'

      for (const message of messages) {
        const chatId = message.key?.remoteJid
        if (!chatId || chatId === 'status@broadcast') continue

        const isGroup = chatId.endsWith('@g.us')
        const fromMe = message.key.fromMe === true
        const text = extractText(message)
        if (!text) continue

        // Para mensagens em tempo real de grupo: verificar regra de automação
        if (isRealTime && isGroup && !automation.allowGroups && !fromMe) continue

        const pushName = message.pushName || ''
        const ts = message.messageTimestamp ? Number(message.messageTimestamp) : Math.floor(Date.now() / 1000)
        const at = new Date(ts * 1000).toISOString()

        // Nome do chat — para grupos, buscar metadata
        let chatName = ''
        if (isGroup) {
          const existingChat = chatsStore.get(chatId)
          chatName = existingChat?.name || ''
          if (!chatName && isRealTime) {
            try {
              const metadata = await sock.groupMetadata(chatId)
              chatName = metadata?.subject || ''
            } catch (e) {}
          }
        } else {
          const existingChat = chatsStore.get(chatId)
          chatName = phonebookStore.get(normalizePhone(chatId))?.name || pushName || existingChat?.name || ''
        }

        const msgObj = {
          id: message.key.id || `${Date.now()}`,
          chatId,
          name: fromMe ? 'Eu' : (chatName || pushName),
          text,
          from: fromMe ? 'me' : 'lead',
          at,
          ack: message.status || (fromMe ? 1 : 0),
        }

        // Atualiza store de chats
        const existing = chatsStore.get(chatId) || {}
        chatsStore.set(chatId, {
          ...existing,
          id: chatId,
          name: chatName || pushName || existing.name || normalizePhone(chatId),
          isGroup,
          unreadCount: (!fromMe && isRealTime) ? (existing.unreadCount || 0) + 1 : (existing.unreadCount || 0),
          timestamp: ts,
          lastMessage: text,
        })
        saveChatsStore()

        await storeMessage(chatId, msgObj)

        // Só emitir evento e rodar automação para mensagens novas recebidas
        if (isRealTime) {
          state.lastMessageAt = new Date().toISOString()
          emitter.emit('message', msgObj)

          if (!fromMe) {
            await handleAutomation({ chatId, text, pushName, at }).catch(err => {
              console.error('[WhatsApp] Erro na automação:', err.message)
            })
          }
        }
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

// ── Automação / Sofi ─────────────────────────────────────────────────────────

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

  // Rate limiting: no máximo 1 resposta da Sofi por chat a cada 30 segundos
  const now = Date.now()
  const lastReply = lastReplyAt.get(chatId) || 0
  if (now - lastReply < 30000) {
    console.log(`[Sofi] Rate limit — aguardando cooldown para ${chatId} (${Math.round((now - lastReply) / 1000)}s atrás)`)
    return
  }

  // Historico das últimas 10 mensagens para contexto
  const history = getMessages(chatId, 10)

  const replyText = await generateSofiReply({ text, from: chatId, pushName, history })

  // Registra o momento da resposta antes de enviar
  lastReplyAt.set(chatId, now)

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

async function generateSofiReply({ text, from, pushName, history = [] }) {
  // Monta contexto do histórico para o Gemini
  const historyText = history.length > 1
    ? '\n\nHistórico recente da conversa (para contexto — NÃO repita o que já foi dito):\n' +
      history.slice(-10).map(m => {
        const sender = m.from === 'lead' ? (pushName || 'Lead') : 'Sofi'
        return `${sender}: ${m.text}`
      }).join('\n')
    : ''

  const isFirstMessage = history.filter(m => m.from === 'sofi').length === 0

  const prompt = `Você é a Sofi, assistente humana de WhatsApp do Departamento de Educação da Associação Paulista Sul.
Responda como uma atendente real: natural, calorosa, rápida e objetiva.

REGRAS IMPORTANTES:
- ${isFirstMessage ? 'Esta é a PRIMEIRA mensagem deste contato — se apresente brevemente.' : 'NUNCA repita a saudação inicial, você já conversou com esta pessoa.'}
- NUNCA envie respostas genéricas ou idênticas a mensagens anteriores.
- Seja dinâmica: cada resposta deve ser única e adaptada ao contexto.
- Só faça UMA pergunta por mensagem, e apenas se fizer sentido natural.
- Se a pergunta do usuário foi respondida, não peça mais informações.

Regras de treinamento:
${automation.training.map((item, index) => `${index + 1}. ${item}`).join('\n')}

Tom: ${automation.tone}
Limite: ${automation.maxChars} caracteres
Contato: ${pushName || from}
${historyText}

Mensagem atual do lead: "${text}"

Responda em português do Brasil. Seja concisa e humana.`

  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: process.env.WHATSAPP_GEMINI_MODEL || 'gemini-2.0-flash-lite' })
      const result = await model.generateContent(prompt)
      const reply = result.response.text().trim()
      if (reply) return reply.slice(0, automation.maxChars)
    } catch (err) {
      console.error('[Sofi] Erro Gemini:', err.message)
    }
  }

  // Fallbacks variados — sem pergunta que incentive loop infinito
  const fallbacks = [
    'Olá! Recebi sua mensagem e já anoto aqui. Nossa equipe vai verificar e te retorna em breve! 😊',
    'Oi, tudo bem! Mensagem recebida. Vou verificar e te respondo logo!',
    'Olá! Obrigada pelo contato. Em breve nossa equipe retorna para você. 🙏',
  ]
  return fallbacks[Math.floor(Date.now() / 1000) % fallbacks.length]
}

// ── Envio de mensagens ───────────────────────────────────────────────────────

async function sendMessage({ phone, chatId, text }) {
  if (!sock || !state.ready) {
    const error = new Error('WhatsApp ainda não está conectado.')
    error.statusCode = 409
    throw error
  }

  if (!text) {
    const error = new Error('Informe a mensagem.')
    error.statusCode = 400
    throw error
  }

  // Se chatId com @ foi fornecido, usa diretamente (suporta @lid, @s.whatsapp.net, @g.us)
  let jid
  if (chatId && chatId.includes('@')) {
    jid = chatId
  } else {
    const normalized = String(phone || chatId || '').replace(/\D/g, '')
    if (!normalized) {
      const error = new Error('Informe telefone ou chatId.')
      error.statusCode = 400
      throw error
    }
    jid = `${normalized}@s.whatsapp.net`
  }
  const result = await sock.sendMessage(jid, { text: String(text) })

  // Registra mensagem enviada
  const outMsg = {
    id: result?.key?.id || `out_${Date.now()}`,
    chatId: jid,
    name: 'Agente',
    text: String(text),
    from: 'agent',
    at: new Date().toISOString(),
  }
  storeMessage(jid, outMsg)

  // Atualiza chat store
  const existing = chatsStore.get(jid) || {}
  chatsStore.set(jid, {
    ...existing,
    id: jid,
    name: existing.name || normalized,
    isGroup: false,
    timestamp: Math.floor(Date.now() / 1000),
    lastMessage: String(text),
  })
  saveChatsStore()

  return { id: result?.key?.id || null, to: normalized, at: outMsg.at }
}

// ── Listagem ─────────────────────────────────────────────────────────────────

async function listChats(limit = 500) {
  try {
    // Buscar do banco com nomes corretos
    const conversations = await prisma.conversation.findMany({
      include: {
        lead: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMessageAt: 'desc' },
      take: Number(limit)
    })

    // Se tiver dados do banco, retorna; senão usa memória
    if (conversations && conversations.length > 0) {
      return conversations.map(conv => ({
        id: conv.lead.phoneNumber + (conv.lead.isGroup ? '@g.us' : '@s.whatsapp.net'),
        name: conv.lead.contactName || conv.lead.phoneNumber,
        isGroup: conv.lead.isGroup,
        unreadCount: 0,
        timestamp: Math.floor(conv.lastMessageAt?.getTime() / 1000) || 0,
        lastMessage: conv.lead.lastMessageText || '...'
      }))
    }
  } catch (err) {
    console.error('[WhatsApp] Erro ao listar chats do banco:', err.message)
  }

  // Fallback para memória (chatsStore) — enriquece com phonebook
  return Array.from(chatsStore.values())
    .filter(c => c.id !== 'status@broadcast')
    .map(c => ({
      ...c,
      name: phonebookStore.get(normalizePhone(c.id))?.name || c.name || normalizePhone(c.id),
    }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, Number(limit))
}

// ── Configurações ────────────────────────────────────────────────────────────

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

// ── AVATARES / FOTOS DE PERFIL ──────────────────────
async function getProfilePicUrl(chatId) {
  if (!sock) return null
  try {
    const contact = await sock.profilePictureUrl(chatId)
    return contact
  } catch (e) {
    console.error('[WhatsApp] Erro ao obter foto:', chatId, e.message)
    return null
  }
}

module.exports = {
  getState,
  start,
  sendMessage,
  listChats,
  getMessages,
  getCrm,
  saveCrm,
  listCrmContacts,
  listPhonebook,
  updateAutomation,
  addTraining,
  handoff,
  resumeAuto,
  getProfilePicUrl,
  emitter,
}
