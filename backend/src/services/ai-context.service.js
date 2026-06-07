/**
 * AI Context Service - Conversation History & Context Persistence
 * Stores and retrieves conversation history for AI context window
 */

const { PrismaClient } = require('@prisma/client')
const cacheService = require('./cache.service')

const prisma = new PrismaClient()
const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

class AIContextService {
  constructor() {
    this.contextWindow = 10 // Last 10 messages for context
    this.cacheService = cacheService.getInstance()
  }

  /**
   * Get conversation context for AI
   * Returns last N messages + metadata for context window
   */
  async getContextForChat(chatId, limit = null) {
    const windowSize = limit || this.contextWindow

    try {
      // Try cache first
      const cacheKey = `ai-context:${chatId}`
      let context = await this.cacheService.get(cacheKey)

      if (context) {
        logger.debug('AI context from cache', { chatId })
        return context
      }

      // Get lead info
      const lead = await prisma.lead.findFirst({
        where: {
          phoneNumber: chatId.replace(/[@.]/g, ''),
        },
        include: {
          labels: true,
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      })

      if (!lead) {
        return null
      }

      // Get conversation
      const conversation = await prisma.conversation.findFirst({
        where: { leadId: lead.id },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: windowSize,
          },
        },
      })

      if (!conversation) {
        return null
      }

      // Reverse messages to chronological order
      const messages = conversation.messages
        .reverse()
        .map(msg => ({
          role: msg.fromPhone === 'lead' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp.getTime(),
        }))

      // Build context object
      const context = {
        chatId,
        leadId: lead.id,
        contactName: lead.contactName,
        stage: lead.stage,
        score: lead.score,
        labels: lead.labels.map(l => l.labelType),
        lastMessageAt: lead.lastMessageAt?.getTime(),
        messageHistory: messages,
        recentEvents: lead.events.map(e => ({
          type: e.eventType,
          description: e.description,
          createdAt: e.createdAt.getTime(),
        })),
        systemPrompt: this._buildSystemPrompt(lead, messages),
      }

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, context, 300)

      logger.debug('AI context retrieved', {
        chatId,
        messageCount: messages.length,
      })

      return context
    } catch (error) {
      logger.error('Failed to get AI context', error, { chatId })
      return null
    }
  }

  /**
   * Save message to conversation history
   */
  async saveMessage(chatId, content, fromPhone = 'bot') {
    try {
      const lead = await prisma.lead.findFirst({
        where: { phoneNumber: chatId.replace(/[@.]/g, '') },
      })

      if (!lead) {
        return null
      }

      const conversation = await prisma.conversation.findFirst({
        where: { leadId: lead.id },
      })

      if (!conversation) {
        return null
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content,
          contentType: 'text',
          messageId: `msg:${Date.now()}:${Math.random()}`,
          timestamp: new Date(),
          fromPhone,
          ackStatus: fromPhone === 'bot' ? 1 : 2,
        },
      })

      // Invalidate context cache
      await this.cacheService.del(`ai-context:${chatId}`)

      logger.debug('Message saved to history', {
        chatId,
        messageId: message.id,
      })

      return message
    } catch (error) {
      logger.error('Failed to save message', error, { chatId })
      return null
    }
  }

  /**
   * Build system prompt with lead context
   */
  _buildSystemPrompt(lead, messages) {
    let prompt = 'Você é um assistente de atendimento ao cliente educado e profissional.\n\n'

    if (lead.contactName) {
      prompt += `Cliente: ${lead.contactName}\n`
    }

    if (lead.stage) {
      const stageMap = {
        inbox: 'novo contato',
        hoje: 'para ser atendido hoje',
        acompanhar: 'em acompanhamento',
        pessoal: 'interesse pessoal',
        concluido: 'finalizado',
        pausado: 'pausado',
      }
      prompt += `Estágio: ${stageMap[lead.stage] || lead.stage}\n`
    }

    if (lead.labels && lead.labels.length > 0) {
      prompt += `Contexto: ${lead.labels.join(', ')}\n`
    }

    prompt += `\nUltimas mensagens:\n`
    for (const msg of messages.slice(-3)) {
      const role = msg.role === 'user' ? 'Cliente' : 'Você'
      prompt += `${role}: ${msg.content}\n`
    }

    prompt += '\nResponda de forma clara, breve e acolhedora. Seja específico ao contexto da conversa.'

    return prompt
  }

  /**
   * Get context metrics (for analytics)
   */
  async getContextMetrics() {
    try {
      const totalConversations = await prisma.conversation.count()
      const totalMessages = await prisma.message.count()
      const avgMessagesPerConversation = Math.round(totalMessages / Math.max(totalConversations, 1))

      return {
        totalConversations,
        totalMessages,
        avgMessagesPerConversation,
        contextWindowSize: this.contextWindow,
      }
    } catch (error) {
      logger.error('Failed to get context metrics', error)
      return null
    }
  }

  /**
   * Cleanup old conversations (archive after 30 days of inactivity)
   */
  async cleanupOldConversations(daysInactive = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000)

      const result = await prisma.conversation.updateMany({
        where: {
          updatedAt: { lt: cutoffDate },
          archived: false,
        },
        data: {
          archived: true,
        },
      })

      logger.info('Old conversations archived', {
        count: result.count,
        daysInactive,
      })

      return result
    } catch (error) {
      logger.error('Failed to cleanup conversations', error)
      return null
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new AIContextService()
  }
  return instance
}

module.exports = {
  getInstance,
  AIContextService,
}
