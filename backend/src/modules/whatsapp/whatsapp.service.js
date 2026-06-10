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
const LABELS_STORE_PATH = path.join(SESSION_PATH, 'labels-store.json')

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
// Selos / Labels — persistido em disco
let labelsStore = []
// Cache de avatares (evita chamadas repetidas à API do WhatsApp)
const avatarCache = new Map() // chatId -> { url, expires }
// Store de mensagens brutas do Baileys (para download de mídia sob demanda)
const rawMessageStore = new Map() // msgId -> rawBaileysMessage

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
    // Resync: atualizar lastMessage/lastFromMe em chats que têm "..." ou vazio
    for (const [chatId, msgs] of messageHistory.entries()) {
      if (!Array.isArray(msgs) || !msgs.length) continue
      const chat = chatsStore.get(chatId)
      if (!chat) continue
      const last = msgs[msgs.length - 1]
      if (!last) continue
      const mediaLabels = { image:'📷 Foto', video:'🎥 Vídeo', audio:'🎤 Áudio', ptt:'🎤 Áudio', document:'📄 Documento', sticker:'😀 Figurinha', location:'📍 Localização' }
      const preview = last.text || mediaLabels[last.type] || ''
      const isFromMe = last.from === 'me' || last.from === 'agent' || last.fromMe === true
      if (preview && (!chat.lastMessage || chat.lastMessage === '...')) {
        chatsStore.set(chatId, { ...chat, lastMessage: preview, lastFromMe: isFromMe, lastAck: isFromMe ? (last.ack || 1) : null })
      }
    }
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

  const labelsData = loadJsonFile(LABELS_STORE_PATH)
  if (Array.isArray(labelsData)) {
    labelsStore = labelsData
    console.log(`[WhatsApp] ${labelsStore.length} selos carregados do disco.`)
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

function saveLabels() {
  writeJsonFile(LABELS_STORE_PATH, labelsStore)
}

// Remove apenas os arquivos de autenticação do Baileys (mantém histórico de chats/msgs)
function clearAuthFiles() {
  const keep = new Set([
    'chats-store.json', 'messages-store.json', 'crm-store.json',
    'phonebook-store.json', 'labels-store.json', 'quick-replies.json',
    'scheduled-messages.json', 'sofi-whatsapp-memory.json'
  ])
  try {
    if (!fs.existsSync(SESSION_PATH)) return
    const files = fs.readdirSync(SESSION_PATH)
    let deleted = 0
    for (const f of files) {
      if (keep.has(f)) continue
      const fp = path.join(SESSION_PATH, f)
      try {
        const stat = fs.statSync(fp)
        if (stat.isFile()) { fs.unlinkSync(fp); deleted++ }
        else if (stat.isDirectory()) { fs.rmSync(fp, { recursive: true, force: true }); deleted++ }
      } catch (_) {}
    }
    console.log(`[WhatsApp] 🧹 ${deleted} arquivos de autenticação removidos (histórico preservado).`)
  } catch (e) {
    console.error('[WhatsApp] Erro ao limpar auth:', e.message)
  }
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
  if (msgs.length > 1000) msgs.shift()
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
  return crmStore.get(phone) || { phone, stage: 'aguardando', tags: ['whatsapp'], score: 50, notes: '' }
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
    // Stage automático: se tem mensagens não lidas (não minhas) → aguardando
    // Se última mensagem foi minha → respondidos; senão → aguardando
    const autoStage = (chat.unreadCount > 0 && !chat.lastFromMe) ? 'aguardando'
      : chat.lastFromMe ? 'respondidos'
      : 'aguardando'
    const crm = crmStore.get(phone) || { stage: autoStage, tags: ['whatsapp'], score: 50 }
    // Se CRM tem stage mas é o default antigo 'novo', usa autoStage
    if (crm.stage === 'novo') crm.stage = autoStage
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

// ── Buscar nomes dos grupos sem nome ─────────────────────────────────────────

async function loadGroupNames() {
  if (!sock) return
  const groups = Array.from(chatsStore.values()).filter(c =>
    c.isGroup && (!c.name || c.name === normalizePhone(c.id) || /^\d+$/.test(c.name))
  )
  if (groups.length === 0) return
  console.log(`[WhatsApp] 🔄 Buscando nomes de ${groups.length} grupos...`)
  let updated = 0
  for (const group of groups.slice(0, 200)) {
    try {
      const metadata = await sock.groupMetadata(group.id)
      if (metadata?.subject) {
        chatsStore.set(group.id, { ...group, name: metadata.subject })
        updated++
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 150)) // evitar rate limiting
  }
  if (updated > 0) {
    console.log(`[WhatsApp] ✅ ${updated} nomes de grupos atualizados`)
    saveChatsStore()
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
      downloadMediaMessage,
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
        const name = contact.name || contact.notify || contact.verifiedName
        const existing = phonebookStore.get(phone) || {}
        phonebookStore.set(phone, {
          ...existing,
          phone,
          name: name || existing.name || phone,
          chatId: contact.id,
        })
        // Atualizar chatsStore com o nome do contato
        if (name && chatsStore.has(contact.id)) {
          const existingChat = chatsStore.get(contact.id)
          if (!existingChat.name || existingChat.name === phone) {
            chatsStore.set(contact.id, { ...existingChat, name })
          }
        }
      }
      console.log(`[WhatsApp] ${phonebookStore.size} contatos do catálogo carregados.`)
      savePhonebookStore()
      saveChatsStore()
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
        // Notifica o frontend que os chats estão prontos
        emitter.emit('chats.update', { count: updated })
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

        // Buscar nomes dos grupos após 5s (deixa os chats.set/contacts.set carregarem primeiro)
        setTimeout(() => loadGroupNames().catch(() => {}), 5000)

        // Sincronizar histórico de todas as conversas
        console.log('[WhatsApp] 🔄 Sincronizando histórico de mensagens...')
        syncAllConversationHistory().catch(err => {
          console.error('[WhatsApp] Erro ao sincronizar histórico:', err.message)
        })
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const errorMsg = lastDisconnect?.error?.message || ''
        const loggedOut = statusCode === DisconnectReason.loggedOut
        const restartRequired = statusCode === DisconnectReason.restartRequired
        // Bad MAC = sessão Signal Protocol corrompida (acontece após múltiplos restarts sem logout limpo)
        const isBadMac = errorMsg.toLowerCase().includes('bad mac') || errorMsg.includes('Bad MAC')
          || errorMsg.includes('bad-mac') || statusCode === 401

        state.ready = false
        state.connected = false
        state.qr = null
        state.qrDataUrl = null
        sock = null

        if (isBadMac || loggedOut) {
          // Limpa APENAS os arquivos de autenticação (preserva histórico de chats/msgs)
          const reason = isBadMac ? 'Sessão corrompida (Bad MAC)' : 'Sessão encerrada'
          console.log(`[WhatsApp] ⚠️ ${reason} — limpando autenticação e gerando novo QR...`)
          state.error = 'Reconectando... escaneie o QR Code quando aparecer.'
          emitState()
          clearAuthFiles()
          // Reinicia em 3s → vai gerar novo QR automaticamente
          setTimeout(() => { state._reconnectAttempt = 0; start() }, 3000)
        } else if (restartRequired) {
          console.log('[WhatsApp] Restart necessário — reconectando em 2s...')
          state.error = 'Reconectando...'
          emitState()
          setTimeout(() => start(), 2000)
        } else {
          // Reconexão progressiva: 5s → 7.5s → 11s → ... → 30s
          const attempt = (state._reconnectAttempt || 0) + 1
          state._reconnectAttempt = attempt
          const delay = Math.min(5000 * Math.pow(1.5, attempt - 1), 30000)
          state.error = `Desconectado — reconectando em ${Math.round(delay/1000)}s... (tentativa ${attempt})`
          emitState()
          console.log(`[WhatsApp] Reconectando em ${Math.round(delay/1000)}s... (tentativa ${attempt})`)
          setTimeout(() => { state._reconnectAttempt = 0; start() }, delay)
        }
      }

      if (connection === 'open') {
        state._reconnectAttempt = 0
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // 'notify' = novas mensagens em tempo real
      // 'append' = mensagens carregadas do cache (histórico de enviadas/recebidas)
      const isRealTime = type === 'notify'

      for (const message of messages) {
        const chatId = message.key?.remoteJid
        if (!chatId || chatId === 'status@broadcast') continue
        // ── Detectar mensagem APAGADA (REVOKE type=0) ou EDITADA (type=14) ──
        const proto = message.message?.protocolMessage
        if (proto) {
          // DELETE for everyone
          if (proto.type === 0 && proto.key?.id) {
            const targetId = proto.key.id
            const targetChat = proto.key.remoteJid || chatId
            const msgs = messageHistory.get(targetChat)
            if (msgs) {
              const idx = msgs.findIndex(m => m.id === targetId)
              if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], deleted: true, originalText: msgs[idx].text, text: '' }
                saveMessagesStore()
                emitter.emit('message.update', { chatId: targetChat, msgId: targetId, deleted: true })
                console.log(`[WhatsApp] 🗑️ Mensagem apagada: ${targetId} em ${targetChat}`)
              }
            }
            continue
          }
          // EDIT (type=14)
          if (proto.type === 14 && proto.key?.id) {
            const targetId = proto.key.id
            const newText = proto.editedMessage?.conversation
              || proto.editedMessage?.extendedTextMessage?.text
              || proto.editedMessage?.imageMessage?.caption
              || ''
            if (newText) {
              const msgs = messageHistory.get(chatId)
              if (msgs) {
                const idx = msgs.findIndex(m => m.id === targetId)
                if (idx >= 0) {
                  const originalText = msgs[idx].originalText || msgs[idx].text
                  msgs[idx] = { ...msgs[idx], edited: true, originalText, text: newText }
                  saveMessagesStore()
                  emitter.emit('message.update', { chatId, msgId: targetId, edited: true, text: newText, originalText })
                  console.log(`[WhatsApp] ✏️ Mensagem editada: ${targetId} em ${chatId}`)
                }
              }
            }
            continue
          }
          // Qualquer outro protocolMessage — ignora silenciosamente
          if ([0, 14, 5, 6, 8, 9, 10, 11].includes(proto.type)) continue
        }

        // ── editedMessage fora de protocolMessage (variante de alguns clientes) ─
        const editedMsg = message.message?.editedMessage
        if (editedMsg) {
          const eKey = editedMsg.message?.key
          const eText = editedMsg.message?.message?.conversation
            || editedMsg.message?.message?.extendedTextMessage?.text
            || ''
          if (eKey?.id && eText) {
            const msgs = messageHistory.get(chatId)
            if (msgs) {
              const idx = msgs.findIndex(m => m.id === eKey.id)
              if (idx >= 0) {
                const originalText = msgs[idx].originalText || msgs[idx].text
                msgs[idx] = { ...msgs[idx], edited: true, originalText, text: eText }
                saveMessagesStore()
                emitter.emit('message.update', { chatId, msgId: eKey.id, edited: true, text: eText, originalText })
              }
            }
          }
          continue
        }

        const isGroup = chatId.endsWith('@g.us')
        const fromMe = message.key.fromMe === true
        const text = extractText(message)

        // Detectar tipo de mídia mesmo sem texto
        const msgContent = message.message || {}
        const mediaType = msgContent.imageMessage ? 'image'
          : msgContent.videoMessage ? 'video'
          : msgContent.audioMessage ? 'audio'
          : msgContent.pttMessage ? 'ptt'
          : msgContent.documentMessage ? 'document'
          : msgContent.stickerMessage ? 'sticker'
          : msgContent.locationMessage ? 'location'
          : 'text'

        // Só pula se não tem conteúdo nenhum
        if (!text && mediaType === 'text') continue

        // ⚠️ CORREÇÃO: grupos SEMPRE armazenam — só automação é bloqueada
        // (removido o continue que impedia grupos de aparecer)

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
          text: text || '',
          type: mediaType,
          mediaLabel: mediaType !== 'text' ? (
            mediaType === 'image' ? '📷 Foto'
            : mediaType === 'video' ? '🎥 Vídeo'
            : mediaType === 'audio' || mediaType === 'ptt' ? '🎤 Áudio'
            : mediaType === 'document' ? '📄 Documento'
            : mediaType === 'sticker' ? '😀 Figurinha'
            : mediaType === 'location' ? '📍 Localização'
            : '📎 Arquivo'
          ) : '',
          fromMe,
          from: fromMe ? 'me' : 'lead',
          at,
          ack: message.status || (fromMe ? 1 : 0),
        }

        // Preview da última mensagem (com emoji para mídia)
        const mediaLabel = mediaType === 'image' ? '📷 Foto'
          : mediaType === 'video' ? '🎥 Vídeo'
          : mediaType === 'audio' || mediaType === 'ptt' ? '🎤 Áudio'
          : mediaType === 'document' ? '📄 Documento'
          : mediaType === 'sticker' ? '😀 Figurinha'
          : mediaType === 'location' ? '📍 Localização'
          : ''
        const lastPreview = text || mediaLabel || ''
        // Em grupos, prefixa com nome do remetente
        const senderPrefix = isGroup && !fromMe && pushName ? `${pushName}: ` : ''

        // Atualiza store de chats
        const existing = chatsStore.get(chatId) || {}
        chatsStore.set(chatId, {
          ...existing,
          id: chatId,
          name: chatName || pushName || existing.name || normalizePhone(chatId),
          isGroup,
          unreadCount: (!fromMe && isRealTime) ? (existing.unreadCount || 0) + 1 : (existing.unreadCount || 0),
          timestamp: ts,
          lastMessage: senderPrefix + lastPreview,
          lastSender: isGroup && !fromMe ? (pushName || '') : '',
          lastFromMe: fromMe,
          lastAck: fromMe ? (message.status || 1) : null,
        })
        saveChatsStore()

        // Guardar mensagem bruta do Baileys para download de mídia sob demanda
        if (mediaType !== 'text' && message.key.id) {
          rawMessageStore.set(message.key.id, message)
          // Limitar tamanho do store (máx 2000 msgs brutas)
          if (rawMessageStore.size > 2000) {
            const firstKey = rawMessageStore.keys().next().value
            rawMessageStore.delete(firstKey)
          }
        }

        await storeMessage(chatId, msgObj)

        // ── Kanban automático ──────────────────────────────────────────────
        // Mensagem RECEBIDA → vai para "aguardando" (contato aguarda resposta)
        // Mensagem ENVIADA  → vai para "respondidos" (eu respondi)
        // Grupos não entram no kanban
        if (!isGroup) {
          const phone = normalizePhone(chatId)
          const crm = crmStore.get(phone) || {}
          if (!fromMe) {
            // Recebi mensagem: contato está aguardando resposta minha
            const stagesAlwaysReset = ['respondidos', 'aguardando']
            const newStage = stagesAlwaysReset.includes(crm.stage) || !crm.stage ? 'aguardando' : crm.stage
            crmStore.set(phone, { ...crm, phone, stage: 'aguardando', tags: crm.tags || ['whatsapp'], score: crm.score || 50 })
            saveCrmStore()
          } else {
            // Enviei mensagem: movi para respondidos SE estava em aguardando
            if (!crm.stage || crm.stage === 'aguardando') {
              crmStore.set(phone, { ...crm, phone, stage: 'respondidos', tags: crm.tags || ['whatsapp'], score: crm.score || 50 })
              saveCrmStore()
            }
          }
        }

        // Emitir evento em tempo real para TODOS (grupos incluídos)
        if (isRealTime) {
          state.lastMessageAt = new Date().toISOString()
          emitter.emit('message', msgObj)

          // Automação: só roda em privado (ou grupos se allowGroups=true)
          if (!fromMe && (!isGroup || automation.allowGroups)) {
            await handleAutomation({ chatId, text, pushName, at }).catch(err => {
              console.error('[WhatsApp] Erro na automação:', err.message)
            })
          }
        }
      }
    })

    // ── Mensagens editadas/apagadas pelo dispositivo primário (seu celular) ──
    // Quando VOCÊ edita ou apaga uma mensagem, Baileys recebe via messages.update
    sock.ev.on('messages.update', (updates) => {
      for (const { key, update } of updates) {
        const chatId = key?.remoteJid
        if (!chatId || chatId === 'status@broadcast') continue

        const msgs = messageHistory.get(chatId)
        if (!msgs) continue

        const proto = update.message?.protocolMessage

        // DELETE: message === null
        if (update.message === null) {
          const idx = msgs.findIndex(m => m.id === key.id)
          if (idx >= 0 && !msgs[idx].deleted) {
            msgs[idx] = { ...msgs[idx], deleted: true, originalText: msgs[idx].text, text: '' }
            saveMessagesStore()
            emitter.emit('message.update', { chatId, msgId: key.id, deleted: true })
            console.log(`[WhatsApp] 🗑️ Mensagem apagada: ${key.id}`)
          }
          continue
        }

        // DELETE via protocolMessage type=0
        if (proto?.type === 0 && proto?.key?.id) {
          const targetId = proto.key.id
          const idx = msgs.findIndex(m => m.id === targetId)
          if (idx >= 0 && !msgs[idx].deleted) {
            msgs[idx] = { ...msgs[idx], deleted: true, originalText: msgs[idx].text, text: '' }
            saveMessagesStore()
            emitter.emit('message.update', { chatId, msgId: targetId, deleted: true })
            console.log(`[WhatsApp] 🗑️ Mensagem apagada (proto): ${targetId}`)
          }
          continue
        }

        // EDIT via protocolMessage type=14
        if (proto?.type === 14 && proto?.key?.id) {
          const targetId = proto.key.id
          const newText = proto.editedMessage?.conversation
            || proto.editedMessage?.extendedTextMessage?.text
            || proto.editedMessage?.imageMessage?.caption || ''
          if (newText) {
            const idx = msgs.findIndex(m => m.id === targetId)
            if (idx >= 0) {
              const originalText = msgs[idx].originalText || msgs[idx].text
              msgs[idx] = { ...msgs[idx], edited: true, originalText, text: newText }
              saveMessagesStore()
              emitter.emit('message.update', { chatId, msgId: targetId, edited: true, text: newText, originalText })
              console.log(`[WhatsApp] ✏️ Mensagem editada (proto14): ${targetId}`)
            }
          }
          continue
        }

        // EDIT via update.message direto (proto existe mas sem type válido, ou sem proto)
        // Debug confirmou: edição chega com update.message contendo texto, proto.type=undefined
        if (update.message && (proto?.type === undefined || proto?.type === null)) {
          const newText = update.message.conversation
            || update.message.extendedTextMessage?.text
            || update.message.imageMessage?.caption
            || update.message.videoMessage?.caption || ''
          if (newText) {
            const idx = msgs.findIndex(m => m.id === key.id)
            if (idx >= 0 && !msgs[idx].deleted && msgs[idx].text !== newText) {
              const originalText = msgs[idx].originalText || msgs[idx].text
              msgs[idx] = { ...msgs[idx], edited: true, originalText, text: newText }
              saveMessagesStore()
              emitter.emit('message.update', { chatId, msgId: key.id, edited: true, text: newText, originalText })
              console.log(`[WhatsApp] ✏️ Mensagem editada: ${key.id}`)
            }
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
    lastFromMe: true,
    lastAck: 1,
  })
  saveChatsStore()

  // Kanban: enviei → mover para respondidos se estava em aguardando
  const phoneForCrm = normalizePhone(jid)
  const crmForSend = crmStore.get(phoneForCrm) || {}
  if (!crmForSend.stage || crmForSend.stage === 'aguardando') {
    crmStore.set(phoneForCrm, { ...crmForSend, phone: phoneForCrm, stage: 'respondidos', tags: crmForSend.tags || ['whatsapp'], score: crmForSend.score || 50 })
    saveCrmStore()
  }

  return { id: result?.key?.id || null, to: normalized, at: outMsg.at }
}

// ── Listagem ─────────────────────────────────────────────────────────────────

async function listChats(limit = 2000) {
  // Sempre usa chatsStore como base (tem dados mais ricos: nomes, timestamps, lastMessage)
  // Enriquece com phonebook para nomes melhores
  const memoryChats = Array.from(chatsStore.values())
    .filter(c => c.id && c.id !== 'status@broadcast')
    .map(c => ({
      ...c,
      name: phonebookStore.get(normalizePhone(c.id))?.name || c.name || normalizePhone(c.id),
    }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, Number(limit))

  if (memoryChats.length > 0) return memoryChats

  // Fallback: banco de dados com timeout de 3s (evita travar se DB inacessível)
  try {
    if (!prisma) return []
    const conversations = await Promise.race([
      prisma.conversation.findMany({
        include: { lead: true },
        orderBy: { lastMessageAt: 'desc' },
        take: Number(limit)
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 3000))
    ])
    if (conversations && conversations.length > 0) {
      return conversations.map(conv => ({
        id: conv.lead.phoneNumber + (conv.lead.isGroup ? '@g.us' : '@s.whatsapp.net'),
        name: conv.lead.contactName || conv.lead.phoneNumber,
        isGroup: conv.lead.isGroup,
        unreadCount: 0,
        timestamp: Math.floor(conv.lastMessageAt?.getTime() / 1000) || 0,
        lastMessage: conv.lead.lastMessageText || ''
      }))
    }
  } catch (err) {
    // Silencioso — DB pode não estar disponível neste servidor
  }

  return []
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
const AVATAR_TTL = 60 * 60 * 1000 // 1 hora de cache
const AVATAR_FAIL_TTL = 10 * 60 * 1000 // 10 min para erros

async function getProfilePicUrl(chatId) {
  if (!chatId) return null
  // Verificar cache
  const cached = avatarCache.get(chatId)
  if (cached && Date.now() < cached.expires) return cached.url

  if (!sock) return null
  try {
    const url = await sock.profilePictureUrl(chatId, 'image')
    avatarCache.set(chatId, { url, expires: Date.now() + AVATAR_TTL })
    return url
  } catch {
    avatarCache.set(chatId, { url: null, expires: Date.now() + AVATAR_FAIL_TTL })
    return null
  }
}

// ── DOWNLOAD DE MÍDIA ───────────────────────────────
async function getMedia(msgId) {
  const raw = rawMessageStore.get(msgId)
  if (!raw) return null
  if (!sock) return null
  try {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys')
    const buffer = await downloadMediaMessage(raw, 'buffer', {}, { logger: require('pino')({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage })
    const msgContent = raw.message || {}
    const mimetype =
      msgContent.imageMessage?.mimetype ||
      msgContent.videoMessage?.mimetype ||
      msgContent.audioMessage?.mimetype ||
      msgContent.pttMessage?.mimetype ||
      msgContent.documentMessage?.mimetype ||
      msgContent.stickerMessage?.mimetype ||
      'application/octet-stream'
    return { buffer, mimetype }
  } catch (e) {
    console.error('[WhatsApp] Erro ao baixar mídia:', e.message)
    return null
  }
}

// ── MEMBROS DE GRUPO ────────────────────────────────
async function getGroupMembers(gid) {
  if (!sock || !state.ready) throw Object.assign(new Error('WhatsApp não conectado'), { statusCode: 409 })
  const metadata = await sock.groupMetadata(gid)
  return (metadata.participants || []).map(p => {
    const phone = normalizePhone(p.id)
    // Normaliza JID para @s.whatsapp.net (evita @lid que não suporta avatar)
    const jid = p.id.includes('@lid') ? `${phone}@s.whatsapp.net` : p.id
    return {
      id: jid,
      phone,
      name: phonebookStore.get(phone)?.name ||
        chatsStore.get(jid)?.name ||
        chatsStore.get(p.id)?.name ||
        phone,
      isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
    }
  })
}

// ── ENVIO DE MÍDIA ──────────────────────────────────
async function sendMedia({ chatId, phone, media, mimetype, filename, caption }) {
  if (!sock || !state.ready) throw Object.assign(new Error('WhatsApp não conectado'), { statusCode: 409 })
  if (!media) throw Object.assign(new Error('Nenhum arquivo enviado'), { statusCode: 400 })

  let jid
  if (chatId && chatId.includes('@')) {
    jid = chatId
  } else {
    const normalized = String(phone || chatId || '').replace(/\D/g, '')
    if (!normalized) throw Object.assign(new Error('Informe chatId ou phone'), { statusCode: 400 })
    jid = `${normalized}@s.whatsapp.net`
  }

  const buffer = Buffer.from(media, 'base64')
  let content

  if ((mimetype || '').startsWith('image/')) {
    content = { image: buffer, caption: caption || '', mimetype }
  } else if ((mimetype || '').startsWith('video/')) {
    content = { video: buffer, caption: caption || '', mimetype }
  } else if ((mimetype || '').startsWith('audio/')) {
    content = { audio: buffer, mimetype, ptt: false }
  } else {
    content = { document: buffer, fileName: filename || 'arquivo', mimetype: mimetype || 'application/octet-stream', caption: caption || '' }
  }

  const result = await sock.sendMessage(jid, content)

  // Atualiza chatsStore
  const mediaPreview = caption || (content.image ? '📷 Foto' : content.video ? '🎥 Vídeo' : content.audio ? '🎤 Áudio' : '📄 Documento')
  const existing = chatsStore.get(jid) || {}
  chatsStore.set(jid, {
    ...existing, id: jid,
    timestamp: Math.floor(Date.now() / 1000),
    lastMessage: mediaPreview,
    lastFromMe: true,
    lastAck: 1,
  })
  saveChatsStore()

  return { id: result?.key?.id, to: jid }
}

// ── VARIAÇÕES DE MENSAGEM COM IA ────────────────────
async function generateVariations(message) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: process.env.WHATSAPP_GEMINI_MODEL || 'gemini-2.0-flash-lite' })
      const prompt = `Crie 4 variações da seguinte mensagem WhatsApp mantendo o mesmo significado mas com palavras diferentes (para evitar bloqueio de spam). Retorne APENAS um JSON array com as 4 strings, sem explicações extras.

Mensagem: "${message}"

Formato: ["variação1", "variação2", "variação3", "variação4"]`
      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const match = text.match(/\[[\s\S]*?\]/)
      if (match) {
        const variations = JSON.parse(match[0])
        if (Array.isArray(variations) && variations.length >= 2) return variations.slice(0, 4)
      }
    } catch (err) {
      console.error('[Sofi] Erro ao gerar variações:', err.message)
    }
  }
  // Fallback simples
  return [message, message + ' 😊', `Olá! ${message}`, message.replace(/!$/, '.')]
}

// ── QUICK REPLIES ────────────────────────────────────
const QUICK_REPLIES_PATH = path.join(SESSION_PATH, 'quick-replies.json')
let quickReplies = []
try { const d = loadJsonFile(QUICK_REPLIES_PATH); if (Array.isArray(d)) quickReplies = d } catch {}

function getQuickReplies() { return quickReplies }
function saveQuickRepliesFn() { writeJsonFile(QUICK_REPLIES_PATH, quickReplies) }
function addQuickReply({ shortcut, text }) {
  const id = `qr_${Date.now()}`
  quickReplies.push({ id, shortcut: String(shortcut || '').toLowerCase(), text: String(text || '') })
  saveQuickRepliesFn()
  return quickReplies
}
function deleteQuickReply(id) {
  quickReplies = quickReplies.filter(q => q.id !== id)
  saveQuickRepliesFn()
  return quickReplies
}

// ── NOTAS INTERNAS ────────────────────────────────────
function getNotes(chatId) {
  const phone = normalizePhone(chatId)
  return (crmStore.get(phone) || {}).notes_list || []
}
function addNote(chatId, text) {
  const phone = normalizePhone(chatId)
  const crm = crmStore.get(phone) || {}
  const notes = crm.notes_list || []
  notes.push({ id: `n_${Date.now()}`, text, at: new Date().toISOString() })
  crmStore.set(phone, { ...crm, notes_list: notes })
  saveCrmStore()
  return notes
}
function deleteNote(chatId, noteId) {
  const phone = normalizePhone(chatId)
  const crm = crmStore.get(phone) || {}
  const notes = (crm.notes_list || []).filter(n => n.id !== noteId)
  crmStore.set(phone, { ...crm, notes_list: notes })
  saveCrmStore()
  return notes
}

// ── STATUS DE CONVERSA ────────────────────────────────
function setConvStatus(chatId, status) {
  const phone = normalizePhone(chatId)
  const crm = crmStore.get(phone) || {}
  crmStore.set(phone, { ...crm, convStatus: status })
  saveCrmStore()
  return { chatId, status }
}

// ── AGENDAMENTO DE MENSAGENS ──────────────────────────
const SCHEDULED_PATH = path.join(SESSION_PATH, 'scheduled-messages.json')
let scheduledMessages = []
try { const d = loadJsonFile(SCHEDULED_PATH); if (Array.isArray(d)) scheduledMessages = d } catch {}

function saveScheduled() { writeJsonFile(SCHEDULED_PATH, scheduledMessages) }

function scheduleMessage({ chatId, text, sendAt }) {
  const id = `sch_${Date.now()}`
  scheduledMessages.push({ id, chatId, text, sendAt: new Date(sendAt).getTime(), sent: false })
  saveScheduled()
  return { id, chatId, sendAt }
}

function listScheduled() { return scheduledMessages.filter(m => !m.sent) }
function cancelScheduled(id) {
  scheduledMessages = scheduledMessages.filter(m => m.id !== id)
  saveScheduled()
  return { success: true }
}

// Verificar agendamentos a cada minuto
setInterval(async () => {
  const now = Date.now()
  const due = scheduledMessages.filter(m => !m.sent && m.sendAt <= now)
  for (const msg of due) {
    try {
      if (sock && state.ready) {
        await sock.sendMessage(msg.chatId, { text: msg.text })
        msg.sent = true
        console.log(`[WhatsApp] 📅 Mensagem agendada enviada para ${msg.chatId}`)
      }
    } catch (e) {
      console.error('[WhatsApp] Erro ao enviar mensagem agendada:', e.message)
    }
  }
  if (due.length > 0) saveScheduled()
}, 30000)

// ── LABELS / SELOS ──────────────────────────────────
function getLabels() {
  return labelsStore
}

function createLabel({ name, color }) {
  const label = { id: `lbl_${Date.now()}`, name: String(name || ''), color: String(color || '#667eea'), contacts: [] }
  labelsStore.push(label)
  saveLabels()
  return label
}

function deleteLabel(id) {
  labelsStore = labelsStore.filter(l => l.id !== id)
  saveLabels()
  return { success: true }
}

function addContactToLabel(labelId, contactId) {
  const label = labelsStore.find(l => l.id === labelId)
  if (!label) return { error: 'Selo não encontrado' }
  const phone = normalizePhone(contactId)
  if (!label.contacts.includes(phone)) label.contacts.push(phone)
  saveLabels()
  return label
}

function removeContactFromLabel(labelId, contactId) {
  const label = labelsStore.find(l => l.id === labelId)
  if (!label) return { error: 'Selo não encontrado' }
  const phone = normalizePhone(contactId)
  label.contacts = label.contacts.filter(c => c !== phone)
  saveLabels()
  return label
}

// ── WATCHDOG: reconecta automaticamente se offline (a cada 60s) ─────────────
setInterval(() => {
  if (!sock && !state.ready && !state.connected) {
    // Não reconectar se já está gerando QR (aguardando scan)
    if (state.qr) return
    console.log('[WhatsApp] Watchdog: offline sem QR ativo — tentando reconectar...')
    start().catch(() => {})
  }
}, 60 * 1000) // a cada 1 minuto

module.exports = {
  getState,
  start,
  sendMessage,
  sendMedia,
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
  getMedia,
  getGroupMembers,
  generateVariations,
  getLabels,
  createLabel,
  deleteLabel,
  addContactToLabel,
  removeContactFromLabel,
  getQuickReplies,
  addQuickReply,
  deleteQuickReply,
  getNotes,
  addNote,
  deleteNote,
  setConvStatus,
  scheduleMessage,
  listScheduled,
  cancelScheduled,
  emitter,
}
