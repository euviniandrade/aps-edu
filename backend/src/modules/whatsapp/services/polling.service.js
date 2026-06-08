/**
 * Polling Service
 * Fallback SSE - pesquisa por novas mensagens a cada 5 segundos
 * Limite: 1 hora de histórico
 * Deduplicação via messageId
 */

class PollingService {
  constructor() {
    this.lastMessageTime = {}
    this.deduplicationSet = new Set()
  }

  /**
   * Obter novas mensagens desde um timestamp
   */
  async getNewMessages(chatId, since, client) {
    try {
      if (!client || !client.isReady) {
        return []
      }

      const chat = await client.getChatById(chatId)
      if (!chat) return []

      const messages = await chat.fetchMessages({ limit: 100 })
      const sinceTime = since ? new Date(since).getTime() : Date.now() - (60 * 60 * 1000)

      const newMessages = messages
        .filter(msg => msg.timestamp * 1000 > sinceTime)
        .filter(msg => {
          // Deduplicação
          if (this.deduplicationSet.has(msg.id)) {
            return false
          }
          this.deduplicationSet.add(msg.id)
          return true
        })
        .map(msg => ({
          id: msg.id,
          from: msg.from,
          body: msg.body,
          timestamp: msg.timestamp * 1000,
          ack: msg.ack,
        }))

      this.lastMessageTime[chatId] = Date.now()
      return newMessages
    } catch (error) {
      console.error('Erro ao obter novas mensagens:', error)
      return []
    }
  }

  /**
   * Sincronizar todas as conversas recentes
   */
  async catchUpAllChats(since, client) {
    try {
      if (!client || !client.isReady) {
        return []
      }

      const chats = await client.getChats()
      const sinceTime = since ? new Date(since).getTime() : Date.now() - (60 * 60 * 1000)

      const conversations = []

      for (const chat of chats.slice(0, 50)) {
        const messages = await chat.fetchMessages({ limit: 10 })
        const filteredMessages = messages
          .filter(msg => msg.timestamp * 1000 > sinceTime)
          .map(msg => ({
            id: msg.id,
            body: msg.body,
            timestamp: msg.timestamp * 1000,
            fromMe: msg.fromMe,
          }))

        if (filteredMessages.length > 0) {
          conversations.push({
            chatId: chat.id,
            name: chat.name,
            messages: filteredMessages,
            lastMessageTime: Math.max(...filteredMessages.map(m => m.timestamp)),
          })
        }
      }

      return conversations
    } catch (error) {
      console.error('Erro ao sincronizar conversas:', error)
      return []
    }
  }

  /**
   * Limpar deduplicação antiga (cache)
   */
  cleanupDeduplication() {
    // Reset a cada 5 minutos para não acumular
    setInterval(() => {
      const size = this.deduplicationSet.size
      this.deduplicationSet.clear()
      if (size > 0) {
        console.log(`🧹 Limpeza de deduplicação: ${size} IDs removidos`)
      }
    }, 5 * 60 * 1000)
  }
}

module.exports = new PollingService()
