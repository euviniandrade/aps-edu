/**
 * Monitoring Service
 * Rastreia métricas do sistema em tempo real
 */

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      aiRequests: 0,
      aiSuccesses: 0,
      cacheHits: 0,
      cacheMisses: 0,
      messagesSent: 0,
      messagesReceived: 0,
    }
    this.events = []
    this.startTime = Date.now()
  }

  recordRequest(endpoint, statusCode, duration) {
    this.metrics.requests++
    if (statusCode >= 400) this.metrics.errors++

    this.events.push({
      type: 'REQUEST',
      endpoint,
      statusCode,
      duration,
      timestamp: new Date(),
    })

    this._trimEvents()
  }

  recordAIRequest(success, duration, inputLength = 0, outputLength = 0) {
    this.metrics.aiRequests++
    if (success) this.metrics.aiSuccesses++

    this.events.push({
      type: 'AI_REQUEST',
      success,
      duration,
      inputLength,
      outputLength,
      timestamp: new Date(),
    })

    this._trimEvents()
  }

  recordCacheAccess(type = 'hit') {
    if (type === 'hit') {
      this.metrics.cacheHits++
    } else {
      this.metrics.cacheMisses++
    }
  }

  recordMessage(direction = 'sent') {
    if (direction === 'sent') {
      this.metrics.messagesSent++
    } else {
      this.metrics.messagesReceived++
    }
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime
    const aiSuccessRate = this.metrics.aiRequests > 0
      ? ((this.metrics.aiSuccesses / this.metrics.aiRequests) * 100).toFixed(2)
      : 0
    const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
      ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2)
      : 0

    return {
      uptime: this._formatUptime(uptime),
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) : 0,
      ai: {
        total: this.metrics.aiRequests,
        successes: this.metrics.aiSuccesses,
        successRate: `${aiSuccessRate}%`,
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: `${cacheHitRate}%`,
      },
      messages: {
        sent: this.metrics.messagesSent,
        received: this.metrics.messagesReceived,
      },
    }
  }

  getEvents(limit = 100) {
    return this.events.slice(-limit)
  }

  _trimEvents() {
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000)
    }
  }

  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}

module.exports = new MonitoringService()
