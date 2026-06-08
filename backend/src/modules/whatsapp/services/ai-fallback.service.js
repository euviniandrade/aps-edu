/**
 * AI Fallback Service
 * Respostas humanas quando IA falha
 */

class AIFallbackService {
  constructor() {
    this.responses = {
      inbox: [
        'Obrigado por entrar em contato! Um especialista responderá em breve.',
        'Ótimo! Anotei sua mensagem. Logo retornamos!',
        'Bem-vindo! Como posso ajudar?',
      ],
      hoje: [
        'Estamos trabalhando nisso. Acompanharemos seu case!',
        'Tudo certo! Sua solicitação foi registrada.',
        'Continuaremos o atendimento. Obrigado pela paciência!',
      ],
      acompanhar: [
        'Você está em nosso radar. Logo tenho novidades!',
        'Seguindo com o acompanhamento. Fica ligado!',
        'Vamos manter contato. Você é importante para nós!',
      ],
      pessoal: [
        'Você é VIP para nós! Daremos máxima atenção.',
        'Seu caso é prioritário. Voltaremos com solução!',
        'Obrigado por sua confiança. Estamos aqui!',
      ],
      concluido: [
        'Sua conversa foi concluída. Obrigado pela confiança!',
        'Fico feliz em ter ajudado. Volte sempre!',
        'Qualquer dúvida, estamos aqui!',
      ],
      pausado: [
        'Sua conversa está pausada. Quer retomar?',
        'Estamos aqui se precisar de qualquer coisa!',
        'Bem-vindo de volta! Como posso ajudar?',
      ],
    }
  }

  getFallbackResponse(stage = 'inbox') {
    const stageResponses = this.responses[stage] || this.responses.inbox
    return stageResponses[Math.floor(Math.random() * stageResponses.length)]
  }

  cacheResponse(key, response, ttl = 3600) {
    // Seria armazenado em cache real
    return true
  }
}

module.exports = new AIFallbackService()
