/**
 * Cache Service - Redis Integration
 * Caches expensive queries: contacts, conversations, etc
 */

const redis = require('redis')

class CacheService {
  constructor() {
    this.client = null
    this.connected = false
    this.logger = require('../modules/whatsapp/whatsapp.stable.service').logger
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) return new Error('Max reconnection attempts')
            return Math.min(retries * 50, 500)
          }
        }
      })

      this.client.on('error', (err) => {
        this.logger.error('Redis error', err)
        this.connected = false
      })

      this.client.on('connect', () => {
        this.logger.info('Redis connected')
        this.connected = true
      })

      await this.client.connect()
      this.logger.info('Redis connection established')
    } catch (error) {
      this.logger.error('Redis connection failed', error)
      this.connected = false
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect()
      this.connected = false
      this.logger.info('Redis disconnected')
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CONTACTS CACHE
  // ──────────────────────────────────────────────────────────────────────────

  async getContacts(options = {}) {
    if (!this.connected) return null

    const cacheKey = `contacts:${JSON.stringify(options)}`
    try {
      const cached = await this.client.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      this.logger.warn('Cache get error', { cacheKey, error: error.message })
    }
    return null
  }

  async setContacts(contacts, options = {}, ttl = 300) {
    if (!this.connected) return false

    const cacheKey = `contacts:${JSON.stringify(options)}`
    try {
      await this.client.setEx(cacheKey, ttl, JSON.stringify(contacts))
      return true
    } catch (error) {
      this.logger.warn('Cache set error', { cacheKey, error: error.message })
      return false
    }
  }

  async invalidateContacts() {
    if (!this.connected) return

    try {
      // Apaga todas as variações de contacts:*
      const keys = await this.client.keys('contacts:*')
      if (keys.length > 0) {
        await this.client.del(keys)
      }
      this.logger.debug('Invalidated contacts cache')
    } catch (error) {
      this.logger.warn('Cache invalidation error', { error: error.message })
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CONVERSATION CACHE
  // ──────────────────────────────────────────────────────────────────────────

  async getConversation(leadId) {
    if (!this.connected) return null

    const cacheKey = `conversation:${leadId}`
    try {
      const cached = await this.client.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      this.logger.warn('Cache get error', { cacheKey, error: error.message })
      return null
    }
  }

  async setConversation(leadId, conversation, ttl = 600) {
    if (!this.connected) return false

    const cacheKey = `conversation:${leadId}`
    try {
      await this.client.setEx(cacheKey, ttl, JSON.stringify(conversation))
      return true
    } catch (error) {
      this.logger.warn('Cache set error', { cacheKey, error: error.message })
      return false
    }
  }

  async invalidateConversation(leadId) {
    if (!this.connected) return

    try {
      await this.client.del(`conversation:${leadId}`)
      this.logger.debug('Invalidated conversation cache', { leadId })
    } catch (error) {
      this.logger.warn('Cache invalidation error', { error: error.message })
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MESSAGES CACHE
  // ──────────────────────────────────────────────────────────────────────────

  async getMessages(conversationId, limit = 50) {
    if (!this.connected) return null

    const cacheKey = `messages:${conversationId}:${limit}`
    try {
      const cached = await this.client.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      this.logger.warn('Cache get error', { cacheKey, error: error.message })
      return null
    }
  }

  async setMessages(conversationId, messages, limit = 50, ttl = 300) {
    if (!this.connected) return false

    const cacheKey = `messages:${conversationId}:${limit}`
    try {
      await this.client.setEx(cacheKey, ttl, JSON.stringify(messages))
      return true
    } catch (error) {
      this.logger.warn('Cache set error', { cacheKey, error: error.message })
      return false
    }
  }

  async invalidateMessages(conversationId) {
    if (!this.connected) return

    try {
      const keys = await this.client.keys(`messages:${conversationId}:*`)
      if (keys.length > 0) {
        await this.client.del(keys)
      }
      this.logger.debug('Invalidated messages cache', { conversationId })
    } catch (error) {
      this.logger.warn('Cache invalidation error', { error: error.message })
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SESSION & RATE LIMIT TRACKING
  // ──────────────────────────────────────────────────────────────────────────

  async trackAISuggest(chatId) {
    if (!this.connected) return

    const key = `ai-suggest:${chatId}`
    try {
      const count = await this.client.incr(key)
      await this.client.expire(key, 3600) // 1 hour TTL
      return count
    } catch (error) {
      this.logger.warn('Rate limit tracking error', { error: error.message })
    }
  }

  async getAISuggestCount(chatId) {
    if (!this.connected) return 0

    const key = `ai-suggest:${chatId}`
    try {
      const count = await this.client.get(key)
      return parseInt(count) || 0
    } catch (error) {
      this.logger.warn('Rate limit check error', { error: error.message })
      return 0
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GENERIC HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  async set(key, value, ttl = 3600) {
    if (!this.connected) return false

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value))
      return true
    } catch (error) {
      this.logger.warn('Cache set error', { key, error: error.message })
      return false
    }
  }

  async get(key) {
    if (!this.connected) return null

    try {
      const cached = await this.client.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      this.logger.warn('Cache get error', { key, error: error.message })
      return null
    }
  }

  async del(key) {
    if (!this.connected) return

    try {
      await this.client.del(key)
    } catch (error) {
      this.logger.warn('Cache del error', { key, error: error.message })
    }
  }

  async clear() {
    if (!this.connected) return

    try {
      await this.client.flushDb()
      this.logger.info('Cache cleared')
    } catch (error) {
      this.logger.warn('Cache clear error', { error: error.message })
    }
  }

  getStatus() {
    return {
      connected: this.connected,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new CacheService()
  }
  return instance
}

module.exports = {
  getInstance,
  CacheService,
}
