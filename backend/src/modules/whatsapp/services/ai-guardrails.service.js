/**
 * AI Guardrails Service
 * Validação de input/output para segurança
 */

class GuardrailsService {
  constructor() {
    this.stats = { validated: 0, blocked: 0 }
  }

  validateInput(text) {
    if (!text || typeof text !== 'string') {
      return { valid: false, reason: 'Invalid input' }
    }

    // Verificar injeção
    if (this._hasInjectionPatterns(text)) {
      this.stats.blocked++
      return { valid: false, reason: 'Injection pattern detected' }
    }

    // Verificar comprimento
    if (text.length > 5000) {
      this.stats.blocked++
      return { valid: false, reason: 'Input too long' }
    }

    this.stats.validated++
    return { valid: true }
  }

  validateOutput(text) {
    if (!text) return ''

    // Remover PII
    let sanitized = text
      .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF]')  // CPF
      .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, '[CNPJ]')  // CNPJ
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]')  // Email
      .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, '[PHONE]')  // Telefone

    // Remover URLs
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]')

    return sanitized
  }

  _hasInjectionPatterns(text) {
    const patterns = [
      /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b)/i,  // SQL
      /(<script|javascript:|onerror|onload)/i,  // XSS
      /(\$\{|\$\(|`)/,  // Template injection
    ]

    return patterns.some(pattern => pattern.test(text))
  }

  checkRateLimit(chatId, maxPerHour = 30) {
    // Rate limit seria rastreado via cache
    return true
  }
}

module.exports = new GuardrailsService()
