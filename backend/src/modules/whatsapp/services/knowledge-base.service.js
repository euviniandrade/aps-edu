/**
 * Knowledge Base Service
 * Gerencia base de conhecimento para busca semântica
 */

class KnowledgeBaseService {
  constructor() {
    this.articles = new Map()
    this.categories = new Set()
    this._initializeDefault()
  }

  _initializeDefault() {
    const defaults = [
      {
        id: 'kb:001',
        title: 'Como usar a plataforma',
        content: 'Guia completo de como usar o WhatsApp CRM integrado com IA',
        category: 'tutorial',
        keywords: ['plataforma', 'como', 'usar', 'guia'],
      },
      {
        id: 'kb:002',
        title: 'Preços e planos',
        content: 'Conheça nossos planos: Starter R$ 99, Professional R$ 299, Enterprise customizado',
        category: 'pricing',
        keywords: ['preço', 'plano', 'valor', 'custa'],
      },
      {
        id: 'kb:003',
        title: 'Suporte técnico',
        content: 'Entre em contato com nosso time: suporte@apsedu.com.br ou chat 24/7',
        category: 'support',
        keywords: ['suporte', 'ajuda', 'problema', 'erro'],
      },
      {
        id: 'kb:004',
        title: 'Integração com WhatsApp',
        content: 'Conecte seu WhatsApp em 3 passos simples: 1) Escaneie QR 2) Confirme 3) Pronto!',
        category: 'integration',
        keywords: ['whatsapp', 'conectar', 'qr', 'integração'],
      },
    ]

    defaults.forEach(article => {
      this.articles.set(article.id, article)
      this.categories.add(article.category)
    })
  }

  searchByKeyword(query) {
    const results = []
    const queryLower = query.toLowerCase()

    for (const [, article] of this.articles) {
      const match = article.keywords.some(kw => kw.includes(queryLower) || queryLower.includes(kw))
        || article.title.toLowerCase().includes(queryLower)
        || article.content.toLowerCase().includes(queryLower)

      if (match) {
        results.push(article)
      }
    }

    return results
  }

  searchByCategory(category) {
    const results = []
    for (const [, article] of this.articles) {
      if (article.category === category) {
        results.push(article)
      }
    }
    return results
  }

  addArticle(title, content, category, keywords = []) {
    const id = `kb:${Date.now()}`
    const article = { id, title, content, category, keywords }
    this.articles.set(id, article)
    this.categories.add(category)
    return id
  }

  getStats() {
    return {
      totalArticles: this.articles.size,
      categories: Array.from(this.categories),
      breakdown: Array.from(this.categories).reduce((acc, cat) => {
        acc[cat] = this.searchByCategory(cat).length
        return acc
      }, {}),
    }
  }
}

module.exports = new KnowledgeBaseService()
