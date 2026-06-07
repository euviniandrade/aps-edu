/**
 * AI Fallback Service - Graceful Degradation
 * Handles API failures with fallback responses
 */

const logger = require('../modules/whatsapp/whatsapp.stable.service').logger
const cacheService = require('./cache.service')

class AIFallbackService {
  constructor() {
    this.cache = cacheService.getInstance()
    this.failureThreshold = 3 // Failures before circuit breaks
    this.resetTimeout = 60000 // 1 minute
    this.circuitState = 'closed' // closed, open, half-open
    this.failureCount = 0
    this.lastFailureTime = null
  }

  /**
   * Check if API is available
   */
  isAvailable() {
    if (this.circuitState === 'closed') {
      return true
    }

    if (this.circuitState === 'open') {
      // Try to reset after timeout
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        logger.info('Circuit breaker transitioning to half-open')
        this.circuitState = 'half-open'
        return false
      }
      return false
    }

    // half-open: allow one request to test
    return true
  }

  /**
   * Record API success
   */
  recordSuccess() {
    this.failureCount = 0
    if (this.circuitState !== 'closed') {
      logger.info('Circuit breaker closed')
      this.circuitState = 'closed'
    }
  }

  /**
   * Record API failure
   */
  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.failureThreshold && this.circuitState !== 'open') {
      logger.error('Circuit breaker opened - AI API failures', {
        failureCount: this.failureCount,
      })
      this.circuitState = 'open'
    }
  }

  /**
   * Get fallback response
   * Returns templated response when API unavailable
   */
  async getFallbackResponse(chatId, userMessage, context = {}) {
    try {
      const lead = context.lead || {}
      const stage = lead.stage || 'inbox'

      // Different responses based on stage
      const fallbackResponses = {
        inbox: [
          'Obrigado por sua mensagem! Um atendente responderá em breve.',
          'Sua mensagem foi recebida. Logo entraremos em contato.',
          'Agradecemos o contato! Estamos processando sua mensagem.',
        ],
        hoje: [
          'Você está em nossa fila de atendimento. Responderemos em breve!',
          'Estamos revisando sua solicitação agora.',
          'Você é prioridade! Em instantes responderemos.',
        ],
        acompanhar: [
          'Continuamos acompanhando seu caso.',
          'Você está em nosso acompanhamento próximo.',
          'Vamos retomar sua solicitação em breve.',
        ],
        pessoal: [
          'Sua solicitação pessoal foi anotada.',
          'Registramos seu interesse. Entraremos em contato.',
          'Obrigado por nos contactar!',
        ],
        concluido: [
          'Seu caso foi concluído. Pode contar conosco para o futuro.',
          'Obrigado por seu contato anterior. Estamos aqui se precisar.',
          'Sempre à disposição para novas solicitações.',
        ],
      }

      const stageResponses = fallbackResponses[stage] || fallbackResponses.inbox
      const response =
        stageResponses[Math.floor(Math.random() * stageResponses.length)]

      logger.info('Fallback response sent', {
        chatId,
        circuitState: this.circuitState,
        stage,
      })

      return {
        success: true,
        message: response,
        isFallback: true,
        circuitState: this.circuitState,
      }
    } catch (error) {
      logger.error('Fallback response generation failed', error)

      return {
        success: false,
        message:
          'Desculpe, estamos com dificuldades técnicas. Tente novamente em alguns momentos.',
        isFallback: true,
      }
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      circuitState: this.circuitState,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      isAvailable: this.isAvailable(),
    }
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    logger.info('Resetting circuit breaker')
    this.circuitState = 'closed'
    this.failureCount = 0
    this.lastFailureTime = null
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(fn, maxRetries = 3) {
    let lastError = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn()
        if (attempt > 0) {
          this.recordSuccess()
        }
        return result
      } catch (error) {
        lastError = error
        this.recordFailure()

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000
          logger.warn('Retry attempt', {
            attempt: attempt + 1,
            maxRetries,
            delayMs,
            error: error.message,
          })

          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    logger.error('All retry attempts failed', { maxRetries, error: lastError?.message })
    throw lastError
  }

  /**
   * Cache response for future use
   */
  async cacheResponse(key, response, ttl = 3600) {
    try {
      await this.cache.set(key, response, ttl)
      return true
    } catch (error) {
      logger.warn('Failed to cache response', error)
      return false
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse(key) {
    try {
      return await this.cache.get(key)
    } catch (error) {
      logger.warn('Failed to retrieve cached response', error)
      return null
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new AIFallbackService()
  }
  return instance
}

module.exports = {
  getInstance,
  AIFallbackService,
}
