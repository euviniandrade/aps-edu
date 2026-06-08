/**
 * Jobs Service - BullMQ Integration
 * Gerencia filas assíncronas para:
 * - send-message: prioridade 5, 3 tentativas
 * - bulk-send: prioridade 3
 * - ai-reply: prioridade 7, 2 tentativas
 * - sync: prioridade 1, repetição a cada 5min
 */

const { Queue, Worker } = require('bullmq')

class JobsService {
  constructor() {
    this.queues = new Map()
    this.workers = new Map()
  }

  async initialize() {
    try {
      // Configuração Redis (ou memory queue)
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      }

      console.log('📦 Inicializando filas BullMQ...')
      
      // send-message queue
      this.queues.set('send-message', new Queue('send-message', { connection: redisConfig }))
      
      // bulk-send queue
      this.queues.set('bulk-send', new Queue('bulk-send', { connection: redisConfig }))
      
      // ai-reply queue
      this.queues.set('ai-reply', new Queue('ai-reply', { connection: redisConfig }))
      
      // sync queue
      this.queues.set('sync', new Queue('sync', { connection: redisConfig }))

      console.log('✅ Jobs Service inicializado')
      return true
    } catch (error) {
      console.warn('⚠️ BullMQ não disponível (Redis necessário)')
      return false
    }
  }

  /**
   * Adicionar job de envio de mensagem
   */
  async sendMessage(chatId, text) {
    try {
      const queue = this.queues.get('send-message')
      if (!queue) return null

      const jobId = `${chatId}:${Date.now()}`
      const job = await queue.add(
        'send',
        { chatId, text },
        {
          jobId,
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        }
      )

      console.log(`📤 Job criado: ${jobId}`)
      return jobId
    } catch (error) {
      console.error('Erro ao criar job de envio:', error)
      return null
    }
  }

  /**
   * Adicionar job de envio em massa
   */
  async bulkSendMessages(recipients, template) {
    try {
      const queue = this.queues.get('bulk-send')
      if (!queue) return null

      const jobId = `bulk:${Date.now()}`
      const job = await queue.add(
        'bulk',
        { recipients, template },
        {
          jobId,
          priority: 3,
          attempts: 2,
          timeout: 30 * 60 * 1000, // 30 minutos
          removeOnComplete: { age: 3600 },
        }
      )

      console.log(`📤 Job em massa criado: ${jobId}`)
      return jobId
    } catch (error) {
      console.error('Erro ao criar job em massa:', error)
      return null
    }
  }

  /**
   * Adicionar job de resposta com IA
   */
  async generateAIReply(chatId, text, context) {
    try {
      const queue = this.queues.get('ai-reply')
      if (!queue) return null

      const jobId = `ai:${chatId}:${Date.now()}`
      const job = await queue.add(
        'ai',
        { chatId, text, context },
        {
          jobId,
          priority: 7,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: { age: 3600 },
        }
      )

      console.log(`🤖 Job de IA criado: ${jobId}`)
      return jobId
    } catch (error) {
      console.error('Erro ao criar job de IA:', error)
      return null
    }
  }

  /**
   * Adicionar job de sync
   */
  async syncData(options = {}) {
    try {
      const queue = this.queues.get('sync')
      if (!queue) return null

      const jobId = `sync:${Date.now()}`
      const job = await queue.add(
        'sync',
        options,
        {
          jobId,
          priority: 1,
          repeat: {
            every: 5 * 60 * 1000, // 5 minutos
          },
          removeOnComplete: { age: 3600 },
        }
      )

      console.log(`🔄 Job de sync criado: ${jobId}`)
      return jobId
    } catch (error) {
      console.error('Erro ao criar job de sync:', error)
      return null
    }
  }

  /**
   * Obter status de um job
   */
  async getJobStatus(queueName, jobId) {
    try {
      const queue = this.queues.get(queueName)
      if (!queue) return null

      const job = await queue.getJob(jobId)
      if (!job) return null

      return {
        id: job.id,
        state: await job.getState(),
        progress: job.progress(),
        data: job.data,
        returnValue: job.returnValue,
      }
    } catch (error) {
      console.error('Erro ao obter status do job:', error)
      return null
    }
  }

  /**
   * Obter estatísticas de uma fila
   */
  async getQueueStats(queueName) {
    try {
      const queue = this.queues.get(queueName)
      if (!queue) return null

      const counts = await queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed')

      return {
        queue: queueName,
        waiting: counts.wait,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
        total: counts.wait + counts.active + counts.completed + counts.failed + counts.delayed,
      }
    } catch (error) {
      console.error('Erro ao obter stats da fila:', error)
      return null
    }
  }

  /**
   * Obter estatísticas de todas as filas
   */
  async getAllQueueStats() {
    try {
      const stats = {}
      for (const [name, queue] of this.queues.entries()) {
        stats[name] = await this.getQueueStats(name)
      }
      return stats
    } catch (error) {
      console.error('Erro ao obter stats das filas:', error)
      return {}
    }
  }
}

module.exports = new JobsService()
