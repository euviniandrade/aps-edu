/**
 * Health Check Routes
 * Expõe métricas e status da plataforma
 */

module.exports = async function (fastify) {
  const whatsappService = require('./whatsapp.stable.service')

  /**
   * GET /health
   * Retorna status geral da plataforma
   */
  fastify.get('/health', async (request, reply) => {
    try {
      const whatsappHealth = whatsappService.getHealthStatus()

      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: whatsappHealth.uptime,
        whatsapp: {
          connected: whatsappHealth.connected,
          ready: whatsappHealth.ready,
          uptime: whatsappHealth.uptime,
        },
        metrics: whatsappHealth.metrics,
        rateLimiter: whatsappHealth.rateLimiter,
        circuitBreakers: whatsappHealth.circuitBreakers,
      })
    } catch (error) {
      return reply.code(503).send({
        status: 'error',
        error: error.message,
      })
    }
  })

  /**
   * GET /health/detailed
   * Retorna diagnóstico detalhado (debug)
   */
  fastify.get('/health/detailed', async (request, reply) => {
    const whatsappState = whatsappService.getState()
    const health = whatsappService.getHealthStatus()

    return reply.send({
      timestamp: new Date().toISOString(),
      whatsapp: whatsappState,
      health,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        whatsappEnabled: process.env.WHATSAPP_ENABLED,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    })
  })

  /**
   * GET /health/whatsapp
   * Status específico do WhatsApp
   */
  fastify.get('/health/whatsapp', async (request, reply) => {
    const state = whatsappService.getState()

    return reply.send({
      connected: state.connected,
      ready: state.ready,
      error: state.error,
      lastEventAt: state.lastEventAt,
      metrics: state.metrics,
      uptime: state.uptime,
      reconnectAttempts: state.reconnectAttempts,
    })
  })

  /**
   * GET /health/metrics
   * Métricas detalhadas
   */
  fastify.get('/health/metrics', async (request, reply) => {
    const health = whatsappService.getHealthStatus()

    return reply.send({
      timestamp: new Date().toISOString(),
      messages: {
        sent: health.metrics.messagesSent,
        received: health.metrics.messagesReceived,
        errors: health.metrics.errorCount,
      },
      reconnections: {
        count: health.metrics.reconnectCount,
        attempts: health.rateLimiter.timeSinceLastMessage,
      },
      rateLimiter: health.rateLimiter,
      circuitBreakers: health.circuitBreakers,
    })
  })
}
