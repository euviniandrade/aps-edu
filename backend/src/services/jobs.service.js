/**
 * Jobs Service - BullMQ Integration
 * Handles async jobs: send messages, bulk operations, sync, etc
 */

const { Queue, Worker } = require('bullmq')
const redis = require('redis')

const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

class JobsService {
  constructor() {
    this.queues = {}
    this.workers = {}
    this.connection = null
  }

  async connect() {
    try {
      this.connection = redis.createClient({ url: REDIS_URL })
      await this.connection.connect()
      logger.info('Jobs service connected to Redis')
    } catch (error) {
      logger.error('Failed to connect jobs service', error)
      throw error
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // QUEUE MANAGEMENT
  // ──────────────────────────────────────────────────────────────────────────

  createQueue(name) {
    if (!this.queues[name]) {
      this.queues[name] = new Queue(name, {
        connection: REDIS_URL,
        settings: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Remove completed jobs after 1 hour
          },
          removeOnFail: {
            age: 24 * 3600, // Keep failed jobs for 24 hours
          },
        },
      })

      logger.info('Queue created', { queueName: name })
    }

    return this.queues[name]
  }

  async createWorker(queueName, processor) {
    const queue = this.createQueue(queueName)

    const worker = new Worker(queueName, processor, {
      connection: REDIS_URL,
      concurrency: process.env.JOB_CONCURRENCY || 5,
    })

    worker.on('completed', (job) => {
      logger.debug('Job completed', { jobId: job.id, queueName })
    })

    worker.on('failed', (job, error) => {
      logger.warn('Job failed', {
        jobId: job?.id,
        queueName,
        error: error.message,
        attemptsMade: job?.attemptsMade || 0,
      })
    })

    this.workers[queueName] = worker
    logger.info('Worker created', { queueName })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MESSAGE JOBS
  // ──────────────────────────────────────────────────────────────────────────

  async sendMessage(chatId, text, options = {}) {
    const queue = this.createQueue('send-message')

    const job = await queue.add(
      'send',
      { chatId, text, ...options },
      {
        jobId: `${chatId}:${Date.now()}`, // Unique ID per message
        priority: options.priority || 5,
        attempts: 3,
      }
    )

    logger.debug('Message job enqueued', {
      jobId: job.id,
      chatId,
    })

    return job
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BULK SEND JOBS
  // ──────────────────────────────────────────────────────────────────────────

  async bulkSendMessages(recipients, template, options = {}) {
    const queue = this.createQueue('bulk-send')

    const job = await queue.add(
      'bulk',
      {
        recipients,
        template,
        delayMs: options.delayMs || 1000,
        maxPerMinute: options.maxPerMinute || 40,
        ...options,
      },
      {
        jobId: `bulk:${Date.now()}`,
        priority: 3,
        timeout: 30 * 60 * 1000, // 30 minutes
      }
    )

    logger.info('Bulk send job enqueued', {
      jobId: job.id,
      recipientCount: recipients.length,
    })

    return job
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AI JOBS
  // ──────────────────────────────────────────────────────────────────────────

  async generateAIReply(chatId, text, context = {}) {
    const queue = this.createQueue('ai-reply')

    const job = await queue.add(
      'generate-reply',
      {
        chatId,
        text,
        history: context.history || [],
        tone: context.tone || 'humano, acolhedor',
      },
      {
        jobId: `ai:${chatId}:${Date.now()}`,
        priority: 7, // Higher priority than bulk
        attempts: 2, // Only 2 attempts for AI (expensive)
      }
    )

    logger.debug('AI reply job enqueued', { jobId: job.id, chatId })

    return job
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SYNC JOBS
  // ──────────────────────────────────────────────────────────────────────────

  async syncData(options = {}) {
    const queue = this.createQueue('sync')

    const job = await queue.add(
      'sync-baileys-to-db',
      {
        includeMessages: options.includeMessages !== false,
        includeContacts: options.includeContacts !== false,
        ...options,
      },
      {
        jobId: `sync:${Date.now()}`,
        priority: 1, // Low priority
        repeat: {
          every: 5 * 60 * 1000, // Every 5 minutes
        },
      }
    )

    logger.debug('Sync job enqueued', { jobId: job.id })

    return job
  }

  // ──────────────────────────────────────────────────────────────────────────
  // JOB MONITORING
  // ──────────────────────────────────────────────────────────────────────────

  async getJobStatus(queueName, jobId) {
    const queue = this.createQueue(queueName)
    const job = await queue.getJob(jobId)

    if (!job) {
      return null
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job._progress,
      data: job.data,
      attempts: job.attemptsMade,
      timestamp: job.timestamp,
    }
  }

  async getQueueStats(queueName) {
    const queue = this.createQueue(queueName)

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    }
  }

  async getAllQueueStats() {
    const stats = await Promise.all(
      Object.keys(this.queues).map(queueName => this.getQueueStats(queueName))
    )

    return {
      timestamp: new Date().toISOString(),
      queues: stats,
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ──────────────────────────────────────────────────────────────────────────

  async disconnect() {
    // Close all workers
    for (const [queueName, worker] of Object.entries(this.workers)) {
      await worker.close()
      logger.info('Worker closed', { queueName })
    }

    // Close all queues
    for (const [queueName, queue] of Object.entries(this.queues)) {
      await queue.close()
      logger.info('Queue closed', { queueName })
    }

    // Close Redis connection
    if (this.connection) {
      await this.connection.disconnect()
      logger.info('Jobs service disconnected')
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new JobsService()
  }
  return instance
}

module.exports = {
  getInstance,
  JobsService,
}
