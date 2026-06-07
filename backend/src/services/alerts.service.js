/**
 * Alerts Service - Telegram Notifications
 * Sends alerts when service failures occur
 */

const axios = require('axios')
const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const ALERT_THRESHOLD_ERROR_RATE = 0.1 // 10%
const ALERT_COOLDOWN_MS = 60000 // 1 minute

class AlertsService {
  constructor() {
    this.lastAlertTime = {}
    this.enabled = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)

    if (this.enabled) {
      logger.info('Telegram alerts enabled')
    } else {
      logger.warn('Telegram alerts disabled - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID')
    }
  }

  /**
   * Send alert via Telegram
   */
  async sendAlert(title, message, severity = 'INFO') {
    if (!this.enabled) {
      logger.debug('Alert not sent (Telegram disabled)', { title })
      return false
    }

    // Check cooldown
    const key = `${severity}:${title}`
    if (this.lastAlertTime[key] && Date.now() - this.lastAlertTime[key] < ALERT_COOLDOWN_MS) {
      logger.debug('Alert suppressed (cooldown)', { title })
      return false
    }

    try {
      const emoji = {
        CRITICAL: '🚨',
        ERROR: '❌',
        WARNING: '⚠️',
        INFO: 'ℹ️',
        SUCCESS: '✅',
      }[severity] || 'ℹ️'

      const text = `${emoji} *${title}*\n\n${message}\n\n_${new Date().toLocaleString('pt-BR')}_`

      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown',
        },
        {
          timeout: 5000,
        }
      )

      this.lastAlertTime[key] = Date.now()

      logger.info('Alert sent via Telegram', { title, severity })
      return true
    } catch (error) {
      logger.error('Failed to send Telegram alert', error, { title })
      return false
    }
  }

  /**
   * Alert on WhatsApp connection failure
   */
  async alertConnectionFailure(error) {
    await this.sendAlert(
      'WhatsApp Connection Failed',
      `Error: ${error.message}\n\nThe service will attempt to reconnect.`,
      'ERROR'
    )
  }

  /**
   * Alert on WhatsApp connection recovery
   */
  async alertConnectionRecovered() {
    await this.sendAlert(
      'WhatsApp Connection Recovered',
      'Service is back online and processing messages.',
      'SUCCESS'
    )
  }

  /**
   * Alert on AI API failure
   */
  async alertAIAPIFailure(error) {
    await this.sendAlert(
      'AI API Failure',
      `The AI service is unavailable.\n\nError: ${error.message}\n\nUsing fallback responses.`,
      'WARNING'
    )
  }

  /**
   * Alert on database connection failure
   */
  async alertDatabaseFailure(error) {
    await this.sendAlert(
      'Database Connection Failed',
      `Error: ${error.message}\n\nMessages will be queued until connection is restored.`,
      'ERROR'
    )
  }

  /**
   * Alert on Redis connection failure
   */
  async alertRedisFailure(error) {
    await this.sendAlert(
      'Redis Cache Failed',
      `The cache service is unavailable.\n\nError: ${error.message}`,
      'WARNING'
    )
  }

  /**
   * Alert on high error rate
   */
  async alertHighErrorRate(errorRate) {
    await this.sendAlert(
      'High Error Rate Detected',
      `Error rate: ${(errorRate * 100).toFixed(2)}%\n\nMonitoring elevated.`,
      'WARNING'
    )
  }

  /**
   * Alert on high CPU/Memory usage
   */
  async alertHighSystemUsage(cpuUsage, memoryUsage) {
    const message =
      `CPU: ${cpuUsage}%\n` + `Memory: ${memoryUsage}%\n\n` + `System is under heavy load.`

    await this.sendAlert(
      'High System Usage',
      message,
      cpuUsage > 90 || memoryUsage > 90 ? 'CRITICAL' : 'WARNING'
    )
  }

  /**
   * Alert on circuit breaker open
   */
  async alertCircuitBreakerOpen(service) {
    await this.sendAlert(
      `${service} Circuit Breaker Opened`,
      `${service} service is temporarily disabled due to repeated failures.\n\nFallback mode enabled.`,
      'ERROR'
    )
  }

  /**
   * Alert on queue overflow
   */
  async alertQueueOverflow(queueName, count) {
    await this.sendAlert(
      'Queue Overflow',
      `Queue: ${queueName}\n` + `Pending jobs: ${count}\n\nProcessing may be delayed.`,
      'WARNING'
    )
  }

  /**
   * Send health check report
   */
  async sendHealthReport(healthStatus) {
    if (healthStatus.status === 'healthy') {
      return // Don't spam with healthy status
    }

    const { metrics, issues } = healthStatus

    const message =
      `Status: ${healthStatus.status}\n\n` +
      `Issues:\n${issues.map(i => `• ${i}`).join('\n')}\n\n` +
      `Requests: ${metrics.requests.total} (${metrics.requests.errorRate} error rate)\n` +
      `Messages: ${metrics.messages.processed}\n` +
      `CPU: ${metrics.system.cpuUsage}\n` +
      `Memory: ${metrics.system.memoryUsage}`

    await this.sendAlert(
      'System Health Report',
      message,
      healthStatus.status === 'degraded' ? 'WARNING' : 'INFO'
    )
  }

  /**
   * Test alert connectivity
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'Telegram alerts not configured' }
    }

    try {
      await this.sendAlert('Test Alert', 'Telegram alerts are working correctly!', 'SUCCESS')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory() {
    return {
      lastAlertTime: this.lastAlertTime,
      enabled: this.enabled,
      cooldownMs: ALERT_COOLDOWN_MS,
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new AlertsService()
  }
  return instance
}

module.exports = {
  getInstance,
  AlertsService,
}
