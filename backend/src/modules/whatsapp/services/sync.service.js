/**
 * Sync Service
 * Orquestra sincronização de dados do WhatsApp com banco de dados
 * Sincroniza: Leads → Conversas → Mensagens → Eventos
 * Deduplicação via messageId
 */

class SyncService {
  constructor() {
    this.metrics = {
      leadsSynced: 0,
      conversationsSynced: 0,
      messagesSynced: 0,
      eventsSynced: 0,
      errors: 0,
      duplicatesSkipped: 0,
    }
  }

  /**
   * Mapear estágios do WhatsApp para enum Prisma
   */
  mapStage(stage) {
    const mapping = {
      'inbox': 'inbox',
      'today': 'hoje',
      'follow-up': 'acompanhar',
      'personal': 'pessoal',
      'done': 'concluido',
      'archived': 'pausado',
    }
    return mapping[stage?.toLowerCase()] || 'inbox'
  }

  /**
   * Sincronizar leads (contatos)
   */
  async syncLeads(chatsStore, crmStore, prisma) {
    try {
      let synced = 0

      for (const [chatId, chat] of Object.entries(chatsStore || {})) {
        const phoneNumber = chatId.replace('@s.whatsapp.net', '')

        // Upsert lead
        await prisma.lead.upsert({
          where: { phone_number: phoneNumber },
          create: {
            phone_number: phoneNumber,
            name: chat.name || 'Unknown',
            stage: this.mapStage(chat.stage),
            created_at: new Date(),
            updated_at: new Date(),
          },
          update: {
            name: chat.name || 'Unknown',
            stage: this.mapStage(chat.stage),
            updated_at: new Date(),
          },
        })

        synced++
      }

      this.metrics.leadsSynced += synced
      console.log(`✅ ${synced} leads sincronizados`)
      return synced
    } catch (error) {
      console.error('Erro ao sincronizar leads:', error)
      this.metrics.errors++
      return 0
    }
  }

  /**
   * Sincronizar conversas
   */
  async syncConversations(chatsStore, prisma) {
    try {
      let synced = 0

      for (const [chatId, chat] of Object.entries(chatsStore || {})) {
        const phoneNumber = chatId.replace('@s.whatsapp.net', '')

        // Obter lead
        const lead = await prisma.lead.findUnique({
          where: { phone_number: phoneNumber },
        })

        if (!lead) continue

        // Upsert conversation
        await prisma.conversation.upsert({
          where: {
            lead_id_chat_id: {
              lead_id: lead.id,
              chat_id: chatId,
            },
          },
          create: {
            lead_id: lead.id,
            chat_id: chatId,
            chat_name: chat.name,
            last_message: chat.lastMessage || '',
            updated_at: new Date(),
          },
          update: {
            chat_name: chat.name,
            last_message: chat.lastMessage || '',
            updated_at: new Date(),
          },
        })

        synced++
      }

      this.metrics.conversationsSynced += synced
      console.log(`✅ ${synced} conversas sincronizadas`)
      return synced
    } catch (error) {
      console.error('Erro ao sincronizar conversas:', error)
      this.metrics.errors++
      return 0
    }
  }

  /**
   * Sincronizar mensagens com deduplicação
   */
  async syncMessages(messageHistory, prisma) {
    try {
      let synced = 0
      let duplicates = 0

      for (const msg of messageHistory || []) {
        // Verificar se já existe
        const existing = await prisma.message.findUnique({
          where: { message_id: msg.id },
        })

        if (existing) {
          duplicates++
          continue
        }

        // Obter conversation
        const conversation = await prisma.conversation.findUnique({
          where: { chat_id: msg.chatId },
        })

        if (!conversation) continue

        // Criar mensagem
        await prisma.message.create({
          data: {
            conversation_id: conversation.id,
            message_id: msg.id,
            content: msg.body || '',
            from_phone: msg.from,
            ack_status: msg.ack || 0,
            timestamp: new Date(msg.timestamp),
          },
        })

        synced++
      }

      this.metrics.messagesSynced += synced
      this.metrics.duplicatesSkipped += duplicates

      console.log(`✅ ${synced} mensagens sincronizadas (${duplicates} duplicadas)`)
      return { synced, duplicates }
    } catch (error) {
      console.error('Erro ao sincronizar mensagens:', error)
      this.metrics.errors++
      return { synced: 0, duplicates: 0 }
    }
  }

  /**
   * Sincronizar eventos (audit trail)
   */
  async syncEvents(crmStore, prisma) {
    try {
      let synced = 0

      for (const event of crmStore || []) {
        const lead = await prisma.lead.findUnique({
          where: { phone_number: event.phoneNumber },
        })

        if (!lead) continue

        await prisma.leadEvent.create({
          data: {
            lead_id: lead.id,
            event_type: event.type,
            event_data: JSON.stringify(event.data),
            created_at: new Date(),
          },
        })

        synced++
      }

      this.metrics.eventsSynced += synced
      console.log(`✅ ${synced} eventos sincronizados`)
      return synced
    } catch (error) {
      console.error('Erro ao sincronizar eventos:', error)
      this.metrics.errors++
      return 0
    }
  }

  /**
   * Sincronizar tudo (orquestração)
   */
  async syncAll(chatsStore, messageHistory, crmStore, prisma) {
    console.log('🔄 Iniciando sincronização completa...')
    const startTime = Date.now()

    try {
      // Sincronizar em sequência
      await this.syncLeads(chatsStore, crmStore, prisma)
      await this.syncConversations(chatsStore, prisma)
      await this.syncMessages(messageHistory, prisma)
      await this.syncEvents(crmStore, prisma)

      const duration = Date.now() - startTime
      console.log(`✅ Sincronização completa em ${duration}ms`)
      console.log(`📊 Métricas: ${JSON.stringify(this.metrics)}`)

      return this.metrics
    } catch (error) {
      console.error('Erro crítico na sincronização:', error)
      this.metrics.errors++
      return this.metrics
    }
  }

  /**
   * Obter métricas
   */
  getMetrics() {
    return this.metrics
  }

  /**
   * Resetar métricas
   */
  resetMetrics() {
    this.metrics = {
      leadsSynced: 0,
      conversationsSynced: 0,
      messagesSynced: 0,
      eventsSynced: 0,
      errors: 0,
      duplicatesSkipped: 0,
    }
  }
}

module.exports = new SyncService()
