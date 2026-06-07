/**
 * Message Polling Service - SSE Fallback
 * Polls database for new messages if SSE connection fails
 * Prevents message loss due to connection issues
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const logger = require('./whatsapp.stable.service').logger

class PollingService {
  constructor() {
    this.activePolls = new Map() // chatId -> timestamp
    this.pollInterval = 5000 // 5 seconds
    this.maxAge = 3600000 // 1 hour - don't poll messages older than 1 hour
  }

  /**
   * Start polling for new messages in a conversation
   */
  startPolling(chatId, onNewMessage) {
    if (this.activePolls.has(chatId)) {
      logger.debug('Polling already active', { chatId })
      return
    }

    const lastFetchTime = Date.now()
    this.activePolls.set(chatId, lastFetchTime)

    const pollInterval = setInterval(async () => {
      try {
        const messages = await this.getNewMessages(chatId, lastFetchTime)

        if (messages.length > 0) {
          logger.debug('Polling found new messages', {
            chatId,
            count: messages.length,
          })

          for (const message of messages) {
            onNewMessage(message)
          }

          // Update last fetch time
          const lastMessage = messages[messages.length - 1]
          lastFetchTime = new Date(lastMessage.timestamp).getTime()
        }
      } catch (error) {
        logger.warn('Polling error', {
          chatId,
          error: error.message,
        })
      }
    }, this.pollInterval)

    // Store interval ID for cleanup
    this.activePolls.set(chatId, {
      startTime: lastFetchTime,
      intervalId: pollInterval,
    })

    logger.info('Message polling started', { chatId })
  }

  /**
   * Stop polling for a conversation
   */
  stopPolling(chatId) {
    const poll = this.activePolls.get(chatId)
    if (poll && poll.intervalId) {
      clearInterval(poll.intervalId)
      this.activePolls.delete(chatId)
      logger.info('Message polling stopped', { chatId })
    }
  }

  /**
   * Get new messages since last fetch
   */
  async getNewMessages(chatId, since) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { phoneNumber: chatId.replace(/[@.]/g, '') },
      })

      if (!lead) {
        return []
      }

      // Get latest message timestamp
      const lastSync = since || Date.now() - this.maxAge

      const newMessages = await prisma.message.findMany({
        where: {
          conversation: {
            leadId: lead.id,
          },
          timestamp: {
            gt: new Date(lastSync),
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
        take: 100, // Limit to 100 messages per poll
      })

      return newMessages
    } catch (error) {
      logger.error('Failed to fetch new messages', error, { chatId })
      return []
    }
  }

  /**
   * Poll all open conversations
   * Useful for catching up after connection loss
   */
  async catchUpAllChats(since) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          updatedAt: {
            gt: new Date(since),
          },
        },
        include: {
          lead: true,
          messages: {
            orderBy: {
              timestamp: 'desc',
            },
            take: 10,
          },
        },
      })

      logger.info('Catching up all chats', {
        conversationCount: conversations.length,
      })

      return conversations
    } catch (error) {
      logger.error('Failed to catch up chats', error)
      return []
    }
  }

  /**
   * Get status of all active polls
   */
  getStatus() {
    const status = {
      activePolls: this.activePolls.size,
      polls: Array.from(this.activePolls.entries()).map(([chatId, data]) => ({
        chatId,
        startTime: data.startTime,
        isActive: !!data.intervalId,
      })),
    }

    return status
  }

  /**
   * Stop all polling
   */
  stopAll() {
    for (const [chatId] of this.activePolls) {
      this.stopPolling(chatId)
    }
    logger.info('All polling stopped')
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new PollingService()
  }
  return instance
}

module.exports = {
  getInstance,
  PollingService,
}
