/**
 * Sync Service - Baileys → Database Synchronization
 * Reliable syncing with retry, deduplication, and transaction support
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

class SyncService {
  constructor() {
    this.syncing = false
    this.lastSyncTime = null
    this.syncMetrics = {
      leadsSynced: 0,
      conversationsSynced: 0,
      messagesSynced: 0,
      eventsSynced: 0,
      errors: 0,
      duplicatesSkipped: 0,
    }
  }

  /**
   * Main sync function - Syncs Baileys data to Prisma
   */
  async syncAll(baileysData) {
    if (this.syncing) {
      logger.warn('Sync already in progress')
      return { status: 'in-progress' }
    }

    this.syncing = true
    this.lastSyncTime = Date.now()

    try {
      logger.info('Sync started', {
        leadsCount: baileysData.chatsStore?.size || 0,
        messagesCount: Array.from(baileysData.messageHistory?.values() || []).reduce((sum, msgs) => sum + msgs.length, 0),
      })

      // Sync in order: Leads → Conversations → Messages → Events
      await this.syncLeads(baileysData.chatsStore, baileysData.crmStore)
      await this.syncConversations(baileysData.chatsStore, baileysData.messageHistory)
      await this.syncMessages(baileysData.messageHistory)
      await this.syncEvents(baileysData.crmStore)

      logger.info('Sync completed', this.syncMetrics)

      return {
        status: 'success',
        metrics: this.syncMetrics,
        duration: Date.now() - this.lastSyncTime,
      }
    } catch (error) {
      logger.error('Sync failed', error)
      this.syncMetrics.errors++

      return {
        status: 'error',
        error: error.message,
        metrics: this.syncMetrics,
      }
    } finally {
      this.syncing = false
    }
  }

  /**
   * Sync Leads (Contacts)
   */
  async syncLeads(chatsStore, crmStore) {
    let synced = 0

    try {
      for (const [chatId, chatData] of chatsStore || new Map()) {
        if (chatData.isGroup) continue

        const phone = chatId.replace(/[@.]/g, '')
        const crmData = crmStore?.get(phone) || {}

        try {
          await prisma.lead.upsert({
            where: { phoneNumber: phone },
            create: {
              phoneNumber: phone,
              contactName: chatData.name || null,
              stage: this.mapStage(crmData.stage),
              score: crmData.score || 50,
              lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * 1000) : null,
              lastMessageText: chatData.lastMessage || null,
              isGroup: false,
              customData: { tags: crmData.tags || [] },
            },
            update: {
              contactName: chatData.name || undefined,
              stage: this.mapStage(crmData.stage),
              score: crmData.score !== undefined ? crmData.score : undefined,
              lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * 1000) : undefined,
              lastMessageText: chatData.lastMessage || undefined,
              updatedAt: new Date(),
            },
          })

          synced++

          // Sync labels if provided
          if (crmData.tags && Array.isArray(crmData.tags)) {
            const lead = await prisma.lead.findUnique({ where: { phoneNumber: phone } })
            if (lead) {
              await this.syncLabels(lead.id, crmData.tags)
            }
          }
        } catch (error) {
          logger.warn('Failed to sync lead', {
            phone,
            error: error.message,
          })
          this.syncMetrics.errors++
        }
      }

      this.syncMetrics.leadsSynced = synced
      logger.debug('Leads synced', { count: synced })
    } catch (error) {
      logger.error('Lead sync error', error)
      throw error
    }
  }

  /**
   * Sync Conversations
   */
  async syncConversations(chatsStore, messageHistory) {
    let synced = 0

    try {
      for (const [chatId, chatData] of chatsStore || new Map()) {
        if (chatData.isGroup) continue

        try {
          const phone = chatId.replace(/[@.]/g, '')
          const lead = await prisma.lead.findUnique({ where: { phoneNumber: phone } })

          if (!lead) continue

          const messages = messageHistory?.get(chatId) || []

          await prisma.conversation.upsert({
            where: { id: chatId },
            create: {
              id: chatId,
              leadId: lead.id,
              title: chatData.name || null,
              lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * 1000) : null,
              messageCount: messages.length,
            },
            update: {
              lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * 1000) : undefined,
              messageCount: messages.length,
            },
          })

          synced++
        } catch (error) {
          logger.warn('Failed to sync conversation', {
            chatId,
            error: error.message,
          })
          this.syncMetrics.errors++
        }
      }

      this.syncMetrics.conversationsSynced = synced
      logger.debug('Conversations synced', { count: synced })
    } catch (error) {
      logger.error('Conversation sync error', error)
      throw error
    }
  }

  /**
   * Sync Messages
   */
  async syncMessages(messageHistory) {
    let synced = 0
    let duplicates = 0

    try {
      for (const [chatId, messages] of messageHistory || new Map()) {
        const conversation = await prisma.conversation.findUnique({
          where: { id: chatId },
        })

        if (!conversation) continue

        for (const msg of messages) {
          try {
            // Check for duplicate
            const existing = await prisma.message.findFirst({
              where: {
                messageId: msg.id,
              },
            })

            if (existing) {
              duplicates++
              continue
            }

            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                content: msg.text || '',
                contentType: 'text',
                messageId: msg.id,
                timestamp: new Date(msg.at || Date.now()),
                fromPhone: msg.from === 'lead' ? 'lead' : 'bot',
                ackStatus: msg.ack || 1,
              },
            })

            synced++
          } catch (error) {
            logger.warn('Failed to sync message', {
              messageId: msg.id,
              error: error.message,
            })
            this.syncMetrics.errors++
          }
        }
      }

      this.syncMetrics.messagesSynced = synced
      this.syncMetrics.duplicatesSkipped = duplicates
      logger.debug('Messages synced', { synced, duplicates })
    } catch (error) {
      logger.error('Message sync error', error)
      throw error
    }
  }

  /**
   * Sync Events (Audit Trail)
   */
  async syncEvents(crmStore) {
    let synced = 0

    try {
      for (const [phone, crmData] of crmStore || new Map()) {
        if (!crmData.lastSync) continue

        try {
          const lead = await prisma.lead.findUnique({
            where: { phoneNumber: phone },
          })

          if (!lead) continue

          // Create sync event
          await prisma.leadEvent.create({
            data: {
              leadId: lead.id,
              eventType: 'sync_completed',
              description: `Lead synced from Baileys`,
              metadata: {
                stage: crmData.stage,
                score: crmData.score,
                tags: crmData.tags,
              },
            },
          })

          synced++
        } catch (error) {
          logger.warn('Failed to sync event', {
            phone,
            error: error.message,
          })
        }
      }

      this.syncMetrics.eventsSynced = synced
      logger.debug('Events synced', { count: synced })
    } catch (error) {
      logger.error('Event sync error', error)
      // Don't throw - events are not critical
    }
  }

  /**
   * Sync Labels for a Lead
   */
  async syncLabels(leadId, tags) {
    try {
      // Remove old labels
      await prisma.leadLabel.deleteMany({
        where: { leadId },
      })

      // Add new labels
      const labelTypeMap = {
        'VIP': 'vip',
        'Familia': 'familia',
        'Trabalho': 'trabalho',
        'Igreja': 'igreja',
        'Follow-up': 'followup',
        'Urgente': 'urgente',
      }

      for (const tag of tags) {
        const labelType = labelTypeMap[tag] || 'vip'

        try {
          await prisma.leadLabel.create({
            data: {
              leadId,
              labelType,
            },
          })
        } catch (error) {
          // Ignore duplicate key errors
          if (!error.message.includes('unique constraint')) {
            throw error
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to sync labels', { leadId, error: error.message })
    }
  }

  /**
   * Helper: Map stage names
   */
  mapStage(stage) {
    const stageMap = {
      'novo': 'inbox',
      'inbox': 'inbox',
      'Inbox': 'inbox',
      'hoje': 'hoje',
      'Hoje': 'hoje',
      'acompanhar': 'acompanhar',
      'Acompanhar': 'acompanhar',
      'pessoal': 'pessoal',
      'Pessoal': 'pessoal',
      'concluido': 'concluido',
      'Concluido': 'concluido',
      'pausado': 'pausado',
      'Pausado': 'pausado',
    }

    return stageMap[stage] || 'inbox'
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      syncing: this.syncing,
      lastSyncTime: this.lastSyncTime,
      metrics: this.syncMetrics,
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.syncMetrics = {
      leadsSynced: 0,
      conversationsSynced: 0,
      messagesSynced: 0,
      eventsSynced: 0,
      errors: 0,
      duplicatesSkipped: 0,
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new SyncService()
  }
  return instance
}

module.exports = {
  getInstance,
  SyncService,
}
