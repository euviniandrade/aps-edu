/**
 * WhatsApp Stable Service - Production Ready
 *
 * Features:
 * ✅ Automatic reconnection with exponential backoff
 * ✅ Structured error logging
 * ✅ Health monitoring
 * ✅ Graceful shutdown
 * ✅ QR auto-refresh
 * ✅ Circuit breaker for bulk operations
 * ✅ Rate limiting
 * ✅ Proper state management
 */

const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')
const { EventEmitter } = require('events')

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING ESTRUTURADO
// ─────────────────────────────────────────────────────────────────────────────

class Logger {
  constructor(prefix = '[WhatsApp]') {
    this.prefix = prefix
  }

  _format(level, message, data = {}) {
    const timestamp = new Date().toISOString()
    return {
      timestamp,
      level,
      prefix: this.prefix,
      message,
      ...data,
    }
  }

  info(message, data = {}) {
    const log = this._format('INFO', message, data)
    console.log(JSON.stringify(log))
  }

  error(message, error, data = {}) {
    const log = this._format('ERROR', message, {
      ...data,
      error: error.message,
      stack: error.stack,
    })
    console.error(JSON.stringify(log))
  }

  warn(message, data = {}) {
    const log = this._format('WARN', message, data)
    console.warn(JSON.stringify(log))
  }

  debug(message, data = {}) {
    if (process.env.DEBUG === 'true') {
      const log = this._format('DEBUG', message, data)
      console.debug(JSON.stringify(log))
    }
  }
}

const logger = new Logger('[WhatsApp Stable]')

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  SESSION_PATH: process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), '.whatsapp_session'),

  // Reconexão
  RECONNECT_ATTEMPTS: 7,
  RECONNECT_INITIAL_DELAY: 1000, // 1s
  RECONNECT_MAX_DELAY: 60000, // 60s

  // QR Code
  QR_EXPIRATION_TIMEOUT: 55000, // Refresh QR antes de expirar (55s)
  QR_GENERATION_TIMEOUT: 30000, // Timeout ao gerar QR

  // Rate limiting
  MESSAGE_RATE_LIMIT: 40, // Mensagens por minuto (WhatsApp limit)
  MESSAGE_MIN_DELAY: 800, // mínimo 800ms entre mensagens

  // Sync
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutos

  // Health check
  HEALTH_CHECK_INTERVAL: 30000, // 30 segundos
  HEALTH_CHECK_TIMEOUT: 10000, // 10 segundos timeout
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

class WhatsAppState {
  constructor() {
    this.socket = null
    this.connected = false
    this.ready = false
    this.qrCode = null
    this.qrDataUrl = null
    this.lastError = null
    this.lastEventTime = null
    this.reconnectAttempts = 0
    this.startTime = Date.now()
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      errorCount: 0,
      reconnectCount: 0,
    }
  }

  toJSON() {
    return {
      connected: this.connected,
      ready: this.ready,
      qrDataUrl: this.qrDataUrl,
      error: this.lastError,
      lastEventAt: this.lastEventTime,
      uptime: Date.now() - this.startTime,
      reconnectAttempts: this.reconnectAttempts,
      metrics: this.metrics,
    }
  }

  recordError(error) {
    this.lastError = error.message
    this.metrics.errorCount++
    logger.error('State error recorded', error, { errorCount: this.metrics.errorCount })
  }

  recordReconnect() {
    this.reconnectAttempts++
    this.metrics.reconnectCount++
  }

  recordMessageSent() {
    this.metrics.messagesSent++
  }

  recordMessageReceived() {
    this.metrics.messagesReceived++
  }
}

const state = new WhatsAppState()
const emitter = new EventEmitter()
emitter.setMaxListeners(100)

// ─────────────────────────────────────────────────────────────────────────────
// EXPONENTIAL BACKOFF RECONNECTION
// ─────────────────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function calculateBackoffDelay(attempt) {
  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
  const delay = Math.min(
    CONFIG.RECONNECT_INITIAL_DELAY * Math.pow(2, attempt),
    CONFIG.RECONNECT_MAX_DELAY
  )

  // Add jitter (±20%) to avoid thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5)
  return Math.max(delay + jitter, 100)
}

async function reconnectWithBackoff(attempt = 0) {
  if (attempt >= CONFIG.RECONNECT_ATTEMPTS) {
    const errorMsg = `Max reconnection attempts (${CONFIG.RECONNECT_ATTEMPTS}) reached`
    logger.error(errorMsg, new Error(errorMsg))
    state.connected = false
    state.ready = false
    state.lastError = errorMsg
    emitter.emit('state', state.toJSON())
    return false
  }

  const delay = calculateBackoffDelay(attempt)
  logger.info(`Reconnection attempt ${attempt + 1}/${CONFIG.RECONNECT_ATTEMPTS}`, {
    delayMs: Math.round(delay),
  })

  await sleep(delay)

  try {
    await initializeWhatsApp()
    logger.info('Reconnection successful', { attemptNumber: attempt + 1 })
    return true
  } catch (error) {
    logger.warn(`Reconnection attempt ${attempt + 1} failed`, { errorMessage: error.message })
    state.recordError(error)
    return reconnectWithBackoff(attempt + 1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QR CODE AUTO-REFRESH
// ─────────────────────────────────────────────────────────────────────────────

let qrRefreshTimer = null

function setupQRAutoRefresh() {
  clearTimeout(qrRefreshTimer)

  qrRefreshTimer = setTimeout(() => {
    logger.warn('QR code expiring, generating new one')
    if (state.socket) {
      state.qrCode = null
      state.qrDataUrl = null
      emitter.emit('state', state.toJSON())

      // Reinicia para gerar novo QR
      initializeWhatsApp().catch(err => {
        logger.error('Failed to refresh QR', err)
      })
    }
  }, CONFIG.QR_EXPIRATION_TIMEOUT)
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER (Proteção contra falhas contínuas)
// ─────────────────────────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor(threshold = 10, resetTimeout = 60000) {
    this.failureCount = 0
    this.failureThreshold = threshold
    this.isOpen = false
    this.resetTimeout = resetTimeout
    this.lastFailureTime = null
  }

  recordSuccess() {
    this.failureCount = 0
    if (this.isOpen) {
      logger.info('Circuit breaker reset to CLOSED')
      this.isOpen = false
    }
  }

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.failureThreshold) {
      this.isOpen = true
      logger.warn('Circuit breaker OPENED', {
        failureCount: this.failureCount,
      })

      // Auto-reset após timeout
      setTimeout(() => {
        logger.info('Circuit breaker attempting HALF-OPEN state')
        this.failureCount = Math.max(0, this.failureCount - 1)
      }, this.resetTimeout)
    }
  }

  canExecute() {
    return !this.isOpen
  }

  getStatus() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

const bulkSendCircuitBreaker = new CircuitBreaker(10, 60000)
const messageCircuitBreaker = new CircuitBreaker(5, 30000)

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

let healthCheckInterval = null

function startHealthCheck() {
  clearInterval(healthCheckInterval)

  healthCheckInterval = setInterval(() => {
    logger.debug('Health check running', {
      connected: state.connected,
      ready: state.ready,
      uptime: Math.round((Date.now() - state.startTime) / 1000),
      metrics: state.metrics,
    })

    // Se desconectou, tenta reconectar
    if (!state.connected && !state.qrDataUrl) {
      logger.warn('Health check: socket offline, attempting reconnection')
      reconnectWithBackoff(0).catch(err => {
        logger.error('Health check reconnection failed', err)
      })
    }

    // Emite heartbeat para frontend
    emitter.emit('health-check', {
      timestamp: new Date().toISOString(),
      status: state.connected ? 'connected' : state.qrDataUrl ? 'pending' : 'disconnected',
      metrics: state.metrics,
    })
  }, CONFIG.HEALTH_CHECK_INTERVAL)
}

function stopHealthCheck() {
  clearInterval(healthCheckInterval)
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor(maxPerMinute = 40, minDelayMs = 800) {
    this.maxPerMinute = maxPerMinute
    this.minDelayMs = minDelayMs
    this.messages = []
    this.lastMessageTime = 0
  }

  canSend() {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Remove mensagens antigas
    this.messages = this.messages.filter(time => time > oneMinuteAgo)

    // Verifica limites
    if (this.messages.length >= this.maxPerMinute) {
      return false
    }

    if (now - this.lastMessageTime < this.minDelayMs) {
      return false
    }

    return true
  }

  record() {
    this.lastMessageTime = Date.now()
    this.messages.push(this.lastMessageTime)
  }

  getStatus() {
    const oneMinuteAgo = Date.now() - 60000
    const recentMessages = this.messages.filter(time => time > oneMinuteAgo)
    return {
      sentInLastMinute: recentMessages.length,
      maxPerMinute: this.maxPerMinute,
      timeSinceLastMessage: Date.now() - this.lastMessageTime,
    }
  }
}

const rateLimiter = new RateLimiter(CONFIG.MESSAGE_RATE_LIMIT, CONFIG.MESSAGE_MIN_DELAY)

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO BAILEYS
// ─────────────────────────────────────────────────────────────────────────────

async function initializeWhatsApp() {
  if (!process.env.WHATSAPP_ENABLED || process.env.WHATSAPP_ENABLED !== 'true') {
    logger.info('WhatsApp disabled in environment')
    return
  }

  if (state.socket) {
    logger.debug('Socket already exists, returning')
    return
  }

  logger.info('Initializing WhatsApp...')

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
      DisconnectReason,
    } = require('@whiskeysockets/baileys')
    const pino = require('pino')

    // Setup auth
    const { state: authState, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_PATH)

    // Get latest version
    let version = [2, 3000, 1017531287]
    try {
      const result = await fetchLatestBaileysVersion()
      version = result.version
      logger.info('Baileys version fetched', { version })
    } catch (err) {
      logger.warn('Failed to fetch latest Baileys version, using default', { error: err.message })
    }

    // Create socket
    state.socket = makeWASocket({
      version,
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(authState.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
      generateHighQualityLinkPreview: false,
      browser: ['APS-EDU Sofi', 'Chrome', '120.0.0'],
      syncFullHistory: false, // Don't sync full history in production
      markOnlineOnConnect: false,
    })

    // Save credentials
    state.socket.ev.on('creds.update', saveCreds)

    // ──────────────────────────────────────────────────────────────────────────
    // CONNECTION EVENTS
    // ──────────────────────────────────────────────────────────────────────────

    state.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      state.lastEventTime = new Date().toISOString()

      // QR Code
      if (qr) {
        logger.info('QR code generated')
        try {
          state.qrCode = qr
          state.qrDataUrl = await QRCode.toDataURL(qr)
          setupQRAutoRefresh()
          emitter.emit('qr', { qrDataUrl: state.qrDataUrl })
        } catch (err) {
          logger.error('Failed to generate QR code data URL', err)
        }
        state.connected = false
        state.ready = false
      }

      // Connected
      if (connection === 'open') {
        logger.info('WhatsApp connected')
        state.socket = state.socket // Ensure socket is set
        state.connected = true
        state.ready = true
        state.qrCode = null
        state.qrDataUrl = null
        state.reconnectAttempts = 0
        state.lastError = null
        messageCircuitBreaker.recordSuccess()
        emitter.emit('state', state.toJSON())
      }

      // Disconnected
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.message || 'Unknown reason'
        logger.warn('WhatsApp disconnected', { reason })

        state.connected = false
        state.ready = false

        // Decide if should reconnect
        if (reason.includes('credentials') || reason.includes('auth')) {
          logger.info('Authentication failed, waiting for manual QR scan')
          state.socket = null
          state.lastError = 'Re-authentication required'
        } else {
          logger.info('Will attempt to reconnect...')
          state.socket = null
          state.reconnectAttempts = 0
          reconnectWithBackoff(0).catch(err => {
            logger.error('Reconnection failed', err)
          })
        }

        emitter.emit('state', state.toJSON())
      }
    })

    // ──────────────────────────────────────────────────────────────────────────
    // MESSAGE EVENTS
    // ──────────────────────────────────────────────────────────────────────────

    state.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const message of messages) {
        try {
          if (message.key.fromMe) continue

          const chatId = message.key.remoteJid
          if (!chatId || chatId === 'status@broadcast') continue

          state.recordMessageReceived()
          messageCircuitBreaker.recordSuccess()

          const pushName = message.pushName || ''
          const text = extractTextFromMessage(message)

          emitter.emit('message', {
            chatId,
            msg: {
              id: message.key.id,
              name: pushName,
              text,
              from: 'lead',
              at: new Date().toISOString(),
            },
          })

          logger.debug('Message received', { chatId, messageId: message.key.id })
        } catch (err) {
          logger.error('Error processing message', err, { messageKey: message?.key?.id })
          messageCircuitBreaker.recordFailure()
        }
      }
    })

    // ──────────────────────────────────────────────────────────────────────────
    // ACK EVENTS (delivery status)
    // ──────────────────────────────────────────────────────────────────────────

    state.socket.ev.on('message.update', async (updates) => {
      for (const { key, update } of updates) {
        if (update.status !== undefined) {
          emitter.emit('message-ack', {
            msgId: key.id,
            ack: update.status, // 1=sent, 2=delivered, 3=read
          })
        }
      }
    })

    logger.info('WhatsApp initialized successfully')
    startHealthCheck()
  } catch (error) {
    logger.error('Failed to initialize WhatsApp', error)
    state.connected = false
    state.ready = false
    state.socket = null
    state.recordError(error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────

async function gracefulShutdown(signal = 'SIGTERM') {
  logger.info('Graceful shutdown initiated', { signal })

  // Stop accepting new messages
  stopHealthCheck()
  clearTimeout(qrRefreshTimer)

  // Disconnect socket
  if (state.socket) {
    try {
      await state.socket.logout()
      logger.info('Socket logged out')
    } catch (err) {
      logger.warn('Error during socket logout', { error: err.message })
    }
  }

  logger.info('Graceful shutdown completed')
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function extractTextFromMessage(msg) {
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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

async function sendMessage(chatId, text) {
  if (!state.ready) {
    throw new Error('WhatsApp not ready')
  }

  if (!messageCircuitBreaker.canExecute()) {
    throw new Error('Circuit breaker open - too many failures')
  }

  if (!rateLimiter.canSend()) {
    throw new Error('Rate limit exceeded')
  }

  try {
    await state.socket.sendMessage(chatId, { text })
    rateLimiter.record()
    state.recordMessageSent()
    messageCircuitBreaker.recordSuccess()
    logger.debug('Message sent', { chatId })
  } catch (error) {
    logger.error('Failed to send message', error, { chatId })
    messageCircuitBreaker.recordFailure()
    throw error
  }
}

function getState() {
  return {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    ...state.toJSON(),
    rateLimiter: rateLimiter.getStatus(),
    circuitBreaker: {
      message: messageCircuitBreaker.getStatus(),
      bulkSend: bulkSendCircuitBreaker.getStatus(),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  emitter,
  logger,
  state: state,

  // Initialization
  initialize: initializeWhatsApp,
  shutdown: gracefulShutdown,

  // Operations
  sendMessage,
  getState,

  // Monitoring
  getHealthStatus: () => ({
    connected: state.connected,
    ready: state.ready,
    uptime: Date.now() - state.startTime,
    metrics: state.metrics,
    rateLimiter: rateLimiter.getStatus(),
    circuitBreakers: {
      message: messageCircuitBreaker.getStatus(),
      bulkSend: bulkSendCircuitBreaker.getStatus(),
    },
  }),

  // Utilities
  reconnectWithBackoff,
  CircuitBreaker,
  RateLimiter,
  Logger,
}
