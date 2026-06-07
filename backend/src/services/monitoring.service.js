/**
 * Monitoring Service - Real-time Metrics & Dashboard
 * Collects and aggregates system metrics
 */

const os = require('os')
const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

class MonitoringService {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      aiRequests: 0,
      aiErrors: 0,
      messagesProcessed: 0,
      whatsappConnections: 0,
      cacheHits: 0,
      cacheMisses: 0,
    }

    this.eventLog = [] // Last 100 events
    this.maxEventLog = 100

    // System info refresh interval
    this.systemInfoRefresh = 10000 // 10 seconds
    this.lastSystemInfo = this._getSystemInfo()
    this.setupSystemInfoRefresh()
  }

  // ──────────────────────────────────────────────────────────────────────────
  // METRICS COLLECTION
  // ──────────────────────────────────────────────────────────────────────────

  recordRequest(endpoint, statusCode, duration) {
    this.metrics.requests++

    if (statusCode >= 400) {
      this.metrics.errors++
    }

    this._logEvent('REQUEST', {
      endpoint,
      statusCode,
      duration,
    })
  }

  recordAIRequest(success, duration, inputLength, outputLength) {
    this.metrics.aiRequests++

    if (!success) {
      this.metrics.aiErrors++
    }

    this._logEvent('AI_REQUEST', {
      success,
      duration,
      inputLength,
      outputLength,
    })
  }

  recordMessageProcessed(chatId, success = true) {
    this.metrics.messagesProcessed++

    if (!success) {
      this.metrics.errors++
    }

    this._logEvent('MESSAGE_PROCESSED', {
      chatId,
      success,
    })
  }

  recordWhatsappConnection(connected) {
    if (connected) {
      this.metrics.whatsappConnections++
    }

    this._logEvent('WHATSAPP_CONNECTION', {
      connected,
      count: this.metrics.whatsappConnections,
    })
  }

  recordCacheAccess(type = 'hit') {
    if (type === 'hit') {
      this.metrics.cacheHits++
    } else {
      this.metrics.cacheMisses++
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DASHBOARD METRICS
  // ──────────────────────────────────────────────────────────────────────────

  getDashboard() {
    const uptime = Date.now() - this.metrics.startTime
    const avgRequestTime = this.metrics.requests > 0 ? 'N/A' : 0 // Would need to track

    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses
    const cacheHitRate =
      cacheTotal > 0 ? ((this.metrics.cacheHits / cacheTotal) * 100).toFixed(2) : 0

    const aiSuccessRate =
      this.metrics.aiRequests > 0
        ? (((this.metrics.aiRequests - this.metrics.aiErrors) /
            this.metrics.aiRequests) *
            100).toFixed(2)
        : 0

    const errorRate =
      this.metrics.requests > 0
        ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)
        : 0

    return {
      system: {
        uptime: this._formatUptime(uptime),
        uptimeMs: uptime,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      },

      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: parseFloat(errorRate) + '%',
      },

      ai: {
        totalRequests: this.metrics.aiRequests,
        errors: this.metrics.aiErrors,
        successRate: parseFloat(aiSuccessRate) + '%',
      },

      messages: {
        processed: this.metrics.messagesProcessed,
        whatsappConnections: this.metrics.whatsappConnections,
      },

      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        total: cacheTotal,
        hitRate: parseFloat(cacheHitRate) + '%',
      },

      system: {
        cpuUsage: this.lastSystemInfo.cpuUsage + '%',
        memoryUsage: this.lastSystemInfo.memoryUsage + '%',
        uptime: os.uptime(),
        freeMemory: this.lastSystemInfo.freeMemory,
        totalMemory: this.lastSystemInfo.totalMemory,
      },
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EVENT LOG
  // ──────────────────────────────────────────────────────────────────────────

  _logEvent(type, data) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      data,
    }

    this.eventLog.push(event)

    // Keep only last N events
    if (this.eventLog.length > this.maxEventLog) {
      this.eventLog.shift()
    }
  }

  getEventLog(type = null, limit = 50) {
    let events = this.eventLog

    if (type) {
      events = events.filter(e => e.type === type)
    }

    return events.slice(-limit).reverse()
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SYSTEM INFO
  // ──────────────────────────────────────────────────────────────────────────

  _getSystemInfo() {
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2)

    // CPU usage (average of last 1 minute)
    const cpus = os.cpus()
    const avgCpuLoad = os.loadavg()[0]
    const cpuUsage = (
      (avgCpuLoad / cpus.length) *
      100
    ).toFixed(2)

    return {
      cpuUsage,
      memoryUsage,
      freeMemory: this._formatBytes(freeMemory),
      totalMemory: this._formatBytes(totalMemory),
      usedMemory: this._formatBytes(usedMemory),
    }
  }

  setupSystemInfoRefresh() {
    setInterval(() => {
      this.lastSystemInfo = this._getSystemInfo()
    }, this.systemInfoRefresh)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ──────────────────────────────────────────────────────────────────────────

  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ──────────────────────────────────────────────────────────────────────────

  getHealthStatus() {
    const dashboard = this.getDashboard()
    const cpuUsage = parseFloat(dashboard.system.cpuUsage)
    const memUsage = parseFloat(dashboard.system.memoryUsage)
    const errorRate = parseFloat(dashboard.requests.errorRate)
    const aiSuccessRate = parseFloat(dashboard.ai.successRate)

    let status = 'healthy'
    const issues = []

    if (cpuUsage > 80) {
      status = 'degraded'
      issues.push('CPU usage high')
    }

    if (memUsage > 85) {
      status = 'degraded'
      issues.push('Memory usage high')
    }

    if (errorRate > 5) {
      status = 'degraded'
      issues.push('Error rate elevated')
    }

    if (aiSuccessRate < 80) {
      issues.push('AI success rate low')
    }

    if (status !== 'healthy') {
      logger.warn('System degraded', { status, issues })
    }

    return {
      status,
      issues,
      metrics: dashboard,
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────────────────────────────────

  getMetricsJSON() {
    return {
      dashboard: this.getDashboard(),
      health: this.getHealthStatus(),
      eventLog: this.getEventLog(),
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new MonitoringService()
  }
  return instance
}

module.exports = {
  getInstance,
  MonitoringService,
}
