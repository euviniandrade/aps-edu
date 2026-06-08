/**
 * AI Context Service
 * Gerencia contexto de conversas para IA
 * Recupera últimas 10 mensagens + metadados do lead
 */

const { GoogleGenerativeAI } = require('@google/generative-ai')

class AIContextService {
  constructor() {
    this.conversations = new Map()
  }

  async getContextForChat(chatId, lead, recentMessages = []) {
    try {
      const context = {
        chatId,
        lead: {
          id: lead?.id,
          name: lead?.name,
          phone: lead?.phone_number,
          stage: lead?.stage,
          createdAt: lead?.created_at,
        },
        messageHistory: recentMessages.slice(-10),
        systemPrompt: this._buildSystemPrompt(lead, recentMessages),
      }

      return context
    } catch (error) {
      console.error('Erro ao obter contexto:', error)
      return null
    }
  }

  _buildSystemPrompt(lead, messages = []) {
    const stageContext = {
      inbox: 'Cliente novo, responda com apresentação profissional',
      hoje: 'Cliente em andamento, foco em resolução rápida',
      acompanhar: 'Cliente em follow-up, mantenha continuidade',
      pessoal: 'Cliente VIP, responda com atenção especial',
      concluido: 'Conversa finalizada, ofereça suporte adicional',
      pausado: 'Cliente em pausa, retome com cuidado',
    }

    const leadInfo = lead ? `Lead: ${lead.name} (${lead.phone_number}) - Estágio: ${lead.stage}` : 'Lead: Desconhecido'
    const contextMsg = stageContext[lead?.stage] || 'Responda de forma profissional e amigável'

    return `Você é um assistente de atendimento da plataforma APS EDU.
${leadInfo}
${contextMsg}

Contexto da conversa:
${messages.slice(-5).map(m => `${m.fromMe ? 'Bot' : 'Cliente'}: ${m.body}`).join('\n')}

Instruções:
- Respostas breves e diretas (máximo 2-3 linhas)
- Evite PII (telefone, email, CPF)
- Cite o nome do cliente quando apropriado
- Seja empático mas profissional`
  }

  async saveMessage(chatId, content, fromPhone) {
    try {
      if (!this.conversations.has(chatId)) {
        this.conversations.set(chatId, [])
      }

      const messages = this.conversations.get(chatId)
      messages.push({
        id: `msg:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
        content,
        fromPhone,
        timestamp: new Date(),
      })

      // Manter apenas últimas 100 mensagens
      if (messages.length > 100) {
        messages.shift()
      }

      return true
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error)
      return false
    }
  }

  getConversationHistory(chatId) {
    return this.conversations.get(chatId) || []
  }

  clearConversation(chatId) {
    this.conversations.delete(chatId)
  }

  async generateResponse(userMessage, systemPrompt) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

      const chat = model.startChat({
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.7,
        },
      })

      const result = await chat.sendMessage(userMessage)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('Erro ao gerar resposta com IA:', error)
      throw error
    }
  }
}

module.exports = new AIContextService()
