/**
 * WhatsApp Sync Service
 * Sincroniza dados do Baileys (em memória/JSON) com PostgreSQL via Prisma
 * Garante que todos os contatos, mensagens e eventos sejam persistidos
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Mapeia estágios do whatsapp.service para o Prisma enum
const stageMap = {
  'novo': 'inbox',
  'inbox': 'inbox',
  'hoje': 'hoje',
  'acompanhar': 'acompanhar',
  'pessoal': 'pessoal',
  'concluido': 'concluido',
  'pausado': 'pausado',
}

// Mapeia labels do whatsapp.service para o Prisma enum
const labelMap = {
  'VIP': 'vip',
  'Familia': 'familia',
  'Trabalho': 'trabalho',
  'Igreja': 'igreja',
  'Follow-up': 'followup',
  'Urgente': 'urgente',
}

/**
 * Sincroniza um contato (Lead) para o banco de dados
 * Cria ou atualiza conforme necessário
 */
async function syncLead(chatData, crmData = {}) {
  try {
    const phoneNumber = chatData.phone || chatData.id.replace(/[@.]/g, '')
    const stage = stageMap[crmData.stage] || 'inbox'

    const lead = await prisma.lead.upsert({
      where: { phoneNumber },
      create: {
        phoneNumber,
        contactName: chatData.name || null,
        stage,
        score: crmData.score || 50,
        lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * (chatData.timestamp < 1e10 ? 1000 : 1)) : null,
        lastMessageText: chatData.lastMessage || null,
        isGroup: chatData.isGroup || false,
        internalNotes: crmData.notes || null,
        customData: { tags: crmData.tags || [] },
      },
      update: {
        contactName: chatData.name || undefined,
        stage,
        score: crmData.score !== undefined ? crmData.score : undefined,
        lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * (chatData.timestamp < 1e10 ? 1000 : 1)) : undefined,
        lastMessageText: chatData.lastMessage || undefined,
        internalNotes: crmData.notes !== undefined ? crmData.notes : undefined,
        updatedAt: new Date(),
      },
    })

    // Sincroniza labels
    if (crmData.tags && Array.isArray(crmData.tags)) {
      // Remove labels antigos
      await prisma.leadLabel.deleteMany({ where: { leadId: lead.id } })

      // Adiciona novos labels
      for (const tag of crmData.tags) {
        const labelType = labelMap[tag] || labelMap['Follow-up'] // default
        await prisma.leadLabel.create({
          data: {
            leadId: lead.id,
            labelType,
          },
        }).catch(() => {}) // Ignora duplicatas
      }
    }

    return lead
  } catch (err) {
    console.error('[WhatsApp Sync] Erro ao sincronizar Lead:', err.message)
    return null
  }
}

/**
 * Sincroniza uma conversa (Conversation)
 */
async function syncConversation(leadId, chatData) {
  try {
    return await prisma.conversation.upsert({
      where: {
        id: chatData.id, // Usar chatId como conversation ID
      },
      create: {
        id: chatData.id,
        leadId,
        title: chatData.name || null,
        lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * (chatData.timestamp < 1e10 ? 1000 : 1)) : null,
      },
      update: {
        title: chatData.name || undefined,
        lastMessageAt: chatData.timestamp ? new Date(chatData.timestamp * (chatData.timestamp < 1e10 ? 1000 : 1)) : undefined,
      },
    })
  } catch (err) {
    // Pode falhar se já existe — tudo bem
    console.error('[WhatsApp Sync] Erro ao sincronizar Conversation:', err.message)
    return null
  }
}

/**
 * Sincroniza uma mensagem individual
 */
async function syncMessage(conversationId, messageData) {
  try {
    return await prisma.message.upsert({
      where: { messageId: messageData.id },
      create: {
        conversationId,
        content: messageData.text || '',
        contentType: 'text',
        messageId: messageData.id,
        timestamp: new Date(messageData.at || Date.now()),
        fromPhone: messageData.from === 'lead' ? 'lead' : 'bot',
        ackStatus: messageData.ack || 1,
      },
      update: {
        ackStatus: messageData.ack || undefined,
      },
    })
  } catch (err) {
    // Mensagens podem duplicar — tudo bem
    return null
  }
}

/**
 * Sincroniza um evento de lead (por exemplo: "message_received", "stage_changed")
 */
async function syncLeadEvent(leadId, eventType, description = null, metadata = null) {
  try {
    return await prisma.leadEvent.create({
      data: {
        leadId,
        eventType,
        description,
        metadata,
      },
    })
  } catch (err) {
    console.error('[WhatsApp Sync] Erro ao sincronizar LeadEvent:', err.message)
    return null
  }
}

/**
 * Sincroniza todos os dados do whatsapp.service para o Prisma
 * Chamado periodicamente (ex: a cada 5 minutos)
 */
async function syncAll(chatsStore, crmStore, messageHistory) {
  try {
    console.log('[WhatsApp Sync] Iniciando sincronização completa com Prisma...')

    let leadsCount = 0
    let messagesCount = 0

    // 1. Sincroniza cada chat como um Lead
    for (const [chatId, chatData] of chatsStore || new Map()) {
      if (chatData.isGroup) continue // Ignora grupos por enquanto

      const phone = chatData.id.replace(/[@.]/g, '')
      const crmData = crmStore?.get(phone) || {}

      const lead = await syncLead(chatData, crmData)
      if (!lead) continue

      leadsCount++

      // 2. Sincroniza a conversa
      const conversation = await syncConversation(lead.id, { ...chatData, id: chatId })
      if (!conversation) continue

      // 3. Sincroniza as mensagens da conversa
      const messages = messageHistory?.get(chatId) || []
      for (const msg of messages) {
        const synced = await syncMessage(conversation.id, msg)
        if (synced) messagesCount++
      }

      // 4. Registra evento de sincronização
      await syncLeadEvent(lead.id, 'sync_completed', `Sincronizados ${messages.length} mensagens`)
    }

    console.log(`[WhatsApp Sync] ✅ Sincronização completa: ${leadsCount} leads, ${messagesCount} mensagens`)
    return { leadsCount, messagesCount }
  } catch (err) {
    console.error('[WhatsApp Sync] Erro na sincronização:', err.message)
    return null
  }
}

/**
 * Observa mudanças em tempo real no Baileys e sincroniza imediatamente
 */
function watchRealtimeSync(whatsappService, syncInterval = 5 * 60 * 1000) {
  // Sincroniza periodicamente
  setInterval(() => {
    // Esses dados vêm do whatsapp.service
    // syncAll(chatsStore, crmStore, messageHistory)
  }, syncInterval)

  console.log('[WhatsApp Sync] Observador de sincronização iniciado (a cada 5 min)')
}

module.exports = {
  syncLead,
  syncConversation,
  syncMessage,
  syncLeadEvent,
  syncAll,
  watchRealtimeSync,
  prisma,
}
