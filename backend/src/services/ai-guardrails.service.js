/**
 * AI Guardrails Service - Safety & Validation
 * Validates input and output for AI responses
 */

const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

class AIGuardrailsService {
  constructor() {
    // Patterns that should be rejected
    this.bannedPatterns = [
      /\b(password|senha|cpf|cnpj|cartão)\b/i,
      /\b(http|https):\/\/[^\s]+/i, // URLs in responses
      /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i, // CPF
      /(\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2})/i, // CNPJ
    ]

    // Maximum lengths
    this.maxInputLength = 500
    this.maxOutputLength = 2000
    this.maxContextMessages = 20
  }

  /**
   * Validate input message
   */
  validateInput(text, context = {}) {
    const errors = []

    // Check length
    if (!text || text.trim().length === 0) {
      errors.push('Mensagem vazia')
    }

    if (text.length > this.maxInputLength) {
      errors.push(`Mensagem muito longa (máx ${this.maxInputLength} caracteres)`)
    }

    // Check for banned patterns
    for (const pattern of this.bannedPatterns) {
      if (pattern.test(text)) {
        logger.warn('Banned pattern detected in input', { pattern: pattern.source })
        errors.push('Mensagem contém informações sensíveis')
        break
      }
    }

    // Check for injection attempts
    if (this._hasInjectionPatterns(text)) {
      logger.warn('Possible injection attempt detected', { text: text.slice(0, 100) })
      errors.push('Formato de mensagem inválido')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate AI output before sending
   */
  validateOutput(text, context = {}) {
    const errors = []
    const warnings = []

    // Check length
    if (text.length > this.maxOutputLength) {
      errors.push(`Resposta muito longa (máx ${this.maxOutputLength} caracteres)`)
    }

    // Check for banned patterns
    for (const pattern of this.bannedPatterns) {
      if (pattern.test(text)) {
        logger.warn('Banned pattern detected in AI output', { pattern: pattern.source })
        errors.push('Resposta contém informações inadequadas')
        break
      }
    }

    // Check for inappropriate language (basic check)
    if (this._hasInappropriateLanguage(text)) {
      warnings.push('Resposta pode conter linguagem inadequada')
    }

    // Check if response is too generic
    if (this._isTooGeneric(text)) {
      warnings.push('Resposta pode ser muito genérica')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleanedText: this._sanitizeOutput(text),
    }
  }

  /**
   * Validate context messages
   */
  validateContext(messages) {
    if (!Array.isArray(messages)) {
      return { valid: false, error: 'Context must be an array' }
    }

    if (messages.length > this.maxContextMessages) {
      return {
        valid: false,
        error: `Too many messages in context (max ${this.maxContextMessages})`,
      }
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return {
          valid: false,
          error: 'Invalid message format',
        }
      }

      const validation = this.validateInput(msg.content)
      if (!validation.valid) {
        return {
          valid: false,
          error: `Invalid context message: ${validation.errors[0]}`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * Check for injection patterns
   */
  _hasInjectionPatterns(text) {
    const injectionPatterns = [
      /ignore previous instructions/i,
      /system prompt/i,
      /forget .+ and/i,
      /roleplay as/i,
      /[;|(][\s]*drop[\s]*table/i,
      /\${.*}/g,
      /{{.*}}/g,
    ]

    for (const pattern of injectionPatterns) {
      if (pattern.test(text)) {
        return true
      }
    }

    return false
  }

  /**
   * Check for inappropriate language
   */
  _hasInappropriateLanguage(text) {
    // Simple list of words to avoid (Portuguese)
    const bannedWords = [
      'xingamento',
      'insulto',
      'ódio',
      'violência',
      'discriminação',
    ]

    const lowerText = text.toLowerCase()
    for (const word of bannedWords) {
      if (lowerText.includes(word)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if response is too generic
   */
  _isTooGeneric(text) {
    const genericPhrases = [
      'não tenho informação',
      'não posso ajudar',
      'desculpe',
      'não sei',
      'não tenho acesso',
    ]

    const lowerText = text.toLowerCase()
    let genericCount = 0

    for (const phrase of genericPhrases) {
      if (lowerText.includes(phrase)) {
        genericCount++
      }
    }

    // If response has only generic phrases, it's too generic
    return genericCount >= 2 && text.length < 50
  }

  /**
   * Sanitize output
   * Removes or masks sensitive information
   */
  _sanitizeOutput(text) {
    let sanitized = text

    // Mask potential phone numbers
    sanitized = sanitized.replace(
      /(\d{2})\s?9?\d{4}-?\d{4}/g,
      '(XX) 9XXXX-XXXX'
    )

    // Mask potential emails
    sanitized = sanitized.replace(
      /[\w\.-]+@[\w\.-]+\.\w+/g,
      '[email protegido]'
    )

    // Remove suspicious URLs
    sanitized = sanitized.replace(
      /https?:\/\/[^\s]+/g,
      '[link removido]'
    )

    return sanitized
  }

  /**
   * Apply rate limiting to AI responses
   */
  async checkRateLimit(chatId, maxPerHour = 30) {
    try {
      const cacheService = require('./cache.service').getInstance()
      const count = await cacheService.trackAISuggest(chatId)

      if (count > maxPerHour) {
        logger.warn('AI rate limit exceeded', { chatId, count })
        return {
          allowed: false,
          message: 'Muitas requisições. Tente novamente mais tarde.',
        }
      }

      return { allowed: true }
    } catch (error) {
      logger.error('Rate limit check failed', error)
      return { allowed: false }
    }
  }

  /**
   * Get guardrails configuration
   */
  getConfig() {
    return {
      maxInputLength: this.maxInputLength,
      maxOutputLength: this.maxOutputLength,
      maxContextMessages: this.maxContextMessages,
      bannedPatterns: this.bannedPatterns.map(p => p.source),
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new AIGuardrailsService()
  }
  return instance
}

module.exports = {
  getInstance,
  AIGuardrailsService,
}
