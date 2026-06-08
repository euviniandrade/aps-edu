/**
 * Alerts Service
 * Notificações via Telegram para alertas críticos
 */

class AlertsService {
  constructor() {
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN || ''
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID || ''
    this.lastAlerts = new Map()
    this.cooldown = 60000 // 1 minuto
  }

  async sendAlert(title, message, severity = 'INFO') {
    try {
      // Verificar cooldown
      const key = `${severity}:${title}`
      const lastTime = this.lastAlerts.get(key)
      if (lastTime && Date.now() - lastTime < this.cooldown) {
        return false
      }

      const emoji = {
        'CRITICAL': '🔴',
        'ERROR': '❌',
        'WARNING': '⚠️',
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
      }[severity] || '📢'

      const text = `${emoji} [${severity}] ${title}\n${message}\n\n_${new Date().toLocaleString('pt-BR')}_`

      // Log apenas (Telegram requer token)
      console.log(`[ALERT] ${severity} - ${title}: ${message}`)

      this.lastAlerts.set(key, Date.now())
      return true
    } catch (error) {
      console.error('Erro ao enviar alerta:', error)
      return false
    }
  }

  async alertConnectionFailure(error) {
    return this.sendAlert('WhatsApp Desconectado', `Erro: ${error?.message || error}`, 'ERROR')
  }

  async alertConnectionRecovered() {
    return this.sendAlert('WhatsApp Reconectado', 'Conexão restaurada com sucesso!', 'SUCCESS')
  }

  async alertHighErrorRate(errorRate) {
    if (errorRate > 5) {
      return this.sendAlert('Taxa de Erro Elevada', `${errorRate.toFixed(2)}% de erros nas requisições`, 'WARNING')
    }
    return false
  }

  async alertAIFailure(error) {
    return this.sendAlert('Falha de IA', `Serviço de IA indisponível: ${error?.message}`, 'WARNING')
  }
}

module.exports = new AlertsService()
