/**
 * Cache Service - Redis Integration
 * Gerencia cache de contacts, conversations e messages
 * TTL: 5min contacts, 10min conversations, 5min messages
 */

const redis = require('redis')

class CacheService {
  constructor() {
    this.client = null
    this.memoryCache = null
    this.stats = { hits: 0, misses: 0, sets: 0 }
  }

  async initialize() {
    try {
      this.client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
      })
      await this.client.connect()
      console.log('✅ Cache Service inicializado (Redis)')
      return true
    } catch (error) {
      console.warn('⚠️ Redis indisponível - usando fallback em memória')
      this.memoryCache = new Map()
      console.log('✅ Cache Service inicializado (Memory)')
      return false
    }
  }

  async getContact(phoneNumber) {
    const key = `contact:${phoneNumber}`
    try {
      const data = this.client 
        ? await this.client.get(key)
        : this.memoryCache?.get(key)
      if (data) {
        this.stats.hits++
        return JSON.parse(data)
      }
      this.stats.misses++
      return null
    } catch (error) {
      return null
    }
  }

  async setContact(phoneNumber, data) {
    const key = `contact:${phoneNumber}`
    try {
      const ttl = 5 * 60
      if (this.client) {
        await this.client.setEx(key, ttl, JSON.stringify(data))
      } else {
        this.memoryCache?.set(key, JSON.stringify(data))
      }
      this.stats.sets++
      return true
    } catch (error) {
      return false
    }
  }

  async getConversation(chatId) {
    const key = `conversation:${chatId}`
    try {
      const data = this.client 
        ? await this.client.get(key)
        : this.memoryCache?.get(key)
      if (data) {
        this.stats.hits++
        return JSON.parse(data)
      }
      this.stats.misses++
      return null
    } catch (error) {
      return null
    }
  }

  async setConversation(chatId, data) {
    const key = `conversation:${chatId}`
    try {
      const ttl = 10 * 60
      if (this.client) {
        await this.client.setEx(key, ttl, JSON.stringify(data))
      } else {
        this.memoryCache?.set(key, JSON.stringify(data))
      }
      this.stats.sets++
      return true
    } catch (error) {
      return false
    }
  }

  getStatus() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0
    return {
      type: this.client ? 'redis' : 'memory',
      hitRate: `${hitRate}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      status: this.client ? '🟢 CONNECTED' : '🟡 FALLBACK',
    }
  }
}

module.exports = new CacheService()
