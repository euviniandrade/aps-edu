const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  getContentType
} = require('@whiskeysockets/baileys')
const path = require('path')
const fs = require('fs')
const prisma = require('../../shared/config/prisma')

const SESSION_PATH = path.join(process.cwd(), '.whatsapp_auth')

let sock = null
let qrCode = null
let status = 'disconnected' // disconnected | connecting | qr | connected
let sseClients = []

// Cache simples de mensagens em memória (substitui makeInMemoryStore removido)
const msgCache = new Map()

// ─── SSE helpers ────────────────────────────────────────────────────────────

function broadcast(event, data) {
  const msg = `data: ${JSON.stringify({ event, data })}\n\n`
  sseClients = sseClients.filter(res => {
    try { res.raw.write(msg); return true }
    catch { return false }
  })
}

function addSSEClient(res) {
  sseClients.push(res)
}

// ─── Utility ────────────────────────────────────────────────────────────────

function jidToPhone(jid) {
  const decoded = jidDecode(jid)
  return decoded?.user || jid.split('@')[0]
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, '')
}

// ─── Connection ─────────────────────────────────────────────────────────────

async function connect() {
  fs.mkdirSync(SESSION_PATH, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH)
  const { version } = await fetchLatestBaileysVersion()

  status = 'connecting'
  broadcast('status', { status })

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['APS-EDU CRM', 'Chrome', '120.0.0'],
    getMessage: async (key) => {
      return msgCache.get(key.id) || { conversation: '' }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const QRCode = require('qrcode')
      qrCode = await QRCode.toDataURL(qr)
      status = 'qr'
      broadcast('qr', { qr: qrCode })
      broadcast('status', { status })
      console.log('[WhatsApp] QR Code gerado — aguardando escaneamento')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      qrCode = null
      status = 'disconnected'
      broadcast('status', { status })
      console.log('[WhatsApp] Conexão fechada. Código:', code, '| Reconectar:', shouldReconnect)
      if (shouldReconnect) {
        setTimeout(connect, 3000)
      }
    }

    if (connection === 'open') {
      qrCode = null
      status = 'connected'
      broadcast('status', { status })
      console.log('[WhatsApp] ✅ Conectado com sucesso!')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      // Guardar no cache para getMessage
      if (msg.message) msgCache.set(msg.key.id, msg.message)
      if (msg.key.fromMe) continue
      await handleIncomingMessage(msg)
    }
  })

  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (update.update?.status != null) {
        await prisma.message.updateMany({
          where: { messageId: update.key.id },
          data: { ackStatus: update.update.status }
        }).catch(() => {})
      }
    }
  })
}

// ─── Incoming message handler ─────────────────────────────────────────────

async function handleIncomingMessage(msg) {
  try {
    const jid = msg.key.remoteJid
    if (!jid || jid === 'status@broadcast') return

    const phone = jidToPhone(jid)
    const isGroup = jid.endsWith('@g.us')
    const contentType = getContentType(msg.message) || 'text'
    const content = extractContent(msg.message, contentType)
    const timestamp = new Date((msg.messageTimestamp || Date.now() / 1000) * 1000)

    // Upsert lead
    const lead = await prisma.lead.upsert({
      where: { phoneNumber: phone },
      create: {
        phoneNumber: phone,
        contactName: msg.pushName || null,
        stage: 'inbox',
        lastMessageAt: timestamp,
        lastMessageText: content.slice(0, 200),
        isGroup
      },
      update: {
        lastMessageAt: timestamp,
        lastMessageText: content.slice(0, 200),
        ...(msg.pushName ? { contactName: msg.pushName } : {})
      }
    })

    // Upsert conversation
    let conversation = await prisma.conversation.findFirst({
      where: { leadId: lead.id, archived: false }
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, lastMessageAt: timestamp, messageCount: 0 }
      })
    }

    // Criar mensagem (pular duplicatas)
    const existing = await prisma.message.findUnique({ where: { messageId: msg.key.id } })
    if (!existing) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content,
          contentType,
          messageId: msg.key.id,
          timestamp,
          fromPhone: phone,
          ackStatus: 1
        }
      })
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: timestamp, messageCount: { increment: 1 } }
      })
    }

    broadcast('message', {
      leadId: lead.id,
      conversationId: conversation.id,
      phone,
      contactName: lead.contactName,
      content,
      contentType,
      timestamp,
      fromMe: false
    })

    // Bot auto-reply
    await checkBotRules(lead, conversation, content, phone)

  } catch (err) {
    console.error('[WhatsApp] handleIncomingMessage error:', err.message)
  }
}

function extractContent(message, contentType) {
  if (!message) return ''
  if (contentType === 'conversation') return message.conversation || ''
  if (contentType === 'extendedTextMessage') return message.extendedTextMessage?.text || ''
  if (contentType === 'imageMessage') return message.imageMessage?.caption || '[Imagem]'
  if (contentType === 'videoMessage') return message.videoMessage?.caption || '[Vídeo]'
  if (contentType === 'audioMessage') return '[Áudio]'
  if (contentType === 'documentMessage') return `[Arquivo: ${message.documentMessage?.fileName || 'documento'}]`
  if (contentType === 'stickerMessage') return '[Sticker]'
  if (contentType === 'locationMessage') return '[Localização]'
  return '[Mensagem]'
}

// ─── Bot rules ───────────────────────────────────────────────────────────────

async function checkBotRules(lead, conversation, content, phone) {
  const rules = await prisma.botRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' }
  })

  const text = content.toLowerCase()
  for (const rule of rules) {
    if (text.includes(rule.trigger.toLowerCase())) {
      await sendMessage(phone, rule.response)
      break
    }
  }
}

// ─── Send message ─────────────────────────────────────────────────────────

async function sendMessage(phone, text) {
  if (!sock || status !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const jid = phone.includes('@') ? phone : `${normalizePhone(phone)}@s.whatsapp.net`
  const sent = await sock.sendMessage(jid, { text })

  // Salvar mensagem enviada no banco
  const lead = await prisma.lead.findUnique({ where: { phoneNumber: normalizePhone(phone) } })
  if (lead) {
    let conversation = await prisma.conversation.findFirst({
      where: { leadId: lead.id, archived: false }
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { leadId: lead.id, lastMessageAt: new Date(), messageCount: 0 }
      })
    }

    const msgId = sent?.key?.id || `out-${Date.now()}`
    await prisma.message.upsert({
      where: { messageId: msgId },
      create: {
        conversationId: conversation.id,
        content: text,
        contentType: 'text',
        messageId: msgId,
        timestamp: new Date(),
        fromPhone: 'me',
        ackStatus: 1
      },
      update: {}
    })
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), messageCount: { increment: 1 } }
    })
  }

  broadcast('message', {
    leadId: lead?.id,
    phone: normalizePhone(phone),
    content: text,
    contentType: 'text',
    timestamp: new Date(),
    fromMe: true
  })

  return sent
}

// ─── Bulk send ────────────────────────────────────────────────────────────

async function sendBulk(userId, phones, content, title) {
  if (!sock || status !== 'connected') {
    throw new Error('WhatsApp não está conectado')
  }

  const bulk = await prisma.bulkMessage.create({
    data: {
      userId,
      title: title || null,
      content,
      recipientCount: phones.length,
      status: 'processing'
    }
  })

  let sent = 0, failed = 0

  for (const phone of phones) {
    try {
      await sendMessage(phone, content)
      sent++
      // Delay humano 1-3s para não parecer spam
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
    } catch {
      failed++
    }
  }

  await prisma.bulkMessage.update({
    where: { id: bulk.id },
    data: { sentCount: sent, failedCount: failed, status: 'completed' }
  })

  return { bulkId: bulk.id, sent, failed }
}

// ─── Exports ─────────────────────────────────────────────────────────────

module.exports = {
  connect,
  getStatus: () => ({ status, qr: qrCode }),
  sendMessage,
  sendBulk,
  addSSEClient,
  broadcast,
  disconnect: async () => {
    if (sock) {
      await sock.logout().catch(() => {})
      sock = null
      status = 'disconnected'
      broadcast('status', { status })
    }
  }
}
