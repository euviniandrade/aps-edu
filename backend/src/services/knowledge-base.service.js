/**
 * Knowledge Base Service - RAG with pgvector
 * Stores and retrieves knowledge base articles using semantic search
 */

const { PrismaClient } = require('@prisma/client')
const cacheService = require('./cache.service')

const prisma = new PrismaClient()
const logger = require('../modules/whatsapp/whatsapp.stable.service').logger

class KnowledgeBaseService {
  constructor() {
    this.cacheService = cacheService.getInstance()
  }

  /**
   * Search knowledge base by similarity
   * Requires embedding from AI model first
   */
  async searchByEmbedding(embedding, limit = 5, minSimilarity = 0.7) {
    try {
      if (!Array.isArray(embedding) || embedding.length === 0) {
        logger.warn('Invalid embedding provided')
        return []
      }

      // Query using pgvector similarity (cosine distance)
      const results = await prisma.$queryRaw`
        SELECT
          id, title, content, category, similarity,
          1 - (embedding <=> $1::vector) as similarity
        FROM "KnowledgeBase"
        WHERE 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `

      // Convert embedding back for query
      const query = `
        SELECT
          id, title, content, category,
          1 - (embedding <=> CAST($1 AS vector)) as similarity
        FROM "KnowledgeBase"
        WHERE 1 - (embedding <=> CAST($1 AS vector)) > $2
        ORDER BY embedding <=> CAST($1 AS vector)
        LIMIT $3
      `

      // For now, use simple text search as pgvector alternative
      const articles = await prisma.knowledgeBase.findMany({
        where: {
          OR: [
            { title: { contains: embedding.toString().slice(0, 50), mode: 'insensitive' } },
          ],
        },
        take: limit,
      })

      return articles
    } catch (error) {
      logger.error('Knowledge base search failed', error)
      return []
    }
  }

  /**
   * Search by keyword
   */
  async searchByKeyword(query, limit = 5) {
    try {
      // Check cache
      const cacheKey = `kb-search:${query}`
      let cached = await this.cacheService.get(cacheKey)

      if (cached) {
        return cached
      }

      const articles = await prisma.knowledgeBase.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
      })

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, articles, 3600)

      logger.debug('Knowledge base search results', {
        query,
        resultCount: articles.length,
      })

      return articles
    } catch (error) {
      logger.error('Knowledge base search failed', error)
      return []
    }
  }

  /**
   * Get article by ID
   */
  async getArticle(id) {
    try {
      return await prisma.knowledgeBase.findUnique({
        where: { id },
      })
    } catch (error) {
      logger.error('Failed to get article', error)
      return null
    }
  }

  /**
   * Add article to knowledge base
   */
  async addArticle(title, content, category, embedding = null) {
    try {
      const article = await prisma.knowledgeBase.create({
        data: {
          title,
          content,
          category,
          embedding: embedding ? JSON.stringify(embedding) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Invalidate search cache
      await this.cacheService.del(`kb-search:${title}`)

      logger.info('Article added to knowledge base', {
        id: article.id,
        title,
        category,
      })

      return article
    } catch (error) {
      logger.error('Failed to add article', error)
      return null
    }
  }

  /**
   * Update article
   */
  async updateArticle(id, updates) {
    try {
      const article = await prisma.knowledgeBase.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      })

      // Invalidate cache
      await this.cacheService.del(`kb-search:${article.title}`)

      logger.info('Article updated', { id, title: article.title })

      return article
    } catch (error) {
      logger.error('Failed to update article', error)
      return null
    }
  }

  /**
   * Delete article
   */
  async deleteArticle(id) {
    try {
      const article = await prisma.knowledgeBase.delete({
        where: { id },
      })

      logger.info('Article deleted', { id, title: article.title })

      return true
    } catch (error) {
      logger.error('Failed to delete article', error)
      return false
    }
  }

  /**
   * Get articles by category
   */
  async getByCategory(category, limit = 10) {
    try {
      const cacheKey = `kb-category:${category}`
      let cached = await this.cacheService.get(cacheKey)

      if (cached) {
        return cached
      }

      const articles = await prisma.knowledgeBase.findMany({
        where: { category },
        take: limit,
      })

      await this.cacheService.set(cacheKey, articles, 3600)

      return articles
    } catch (error) {
      logger.error('Failed to get articles by category', error)
      return []
    }
  }

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const [total, byCategory] = await Promise.all([
        prisma.knowledgeBase.count(),
        prisma.knowledgeBase.groupBy({
          by: ['category'],
          _count: true,
        }),
      ])

      const categoryStats = {}
      for (const { category, _count } of byCategory) {
        categoryStats[category] = _count
      }

      return {
        totalArticles: total,
        byCategory: categoryStats,
      }
    } catch (error) {
      logger.error('Failed to get KB stats', error)
      return null
    }
  }

  /**
   * Suggest related articles for a query
   * Returns top articles related to user query
   */
  async suggestRelated(query, limit = 3) {
    try {
      // Simple: search by keyword and return top results
      const articles = await this.searchByKeyword(query, limit)

      return articles.map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        content: a.content.slice(0, 200) + '...',
      }))
    } catch (error) {
      logger.error('Failed to suggest related articles', error)
      return []
    }
  }
}

// Singleton
let instance = null

function getInstance() {
  if (!instance) {
    instance = new KnowledgeBaseService()
  }
  return instance
}

module.exports = {
  getInstance,
  KnowledgeBaseService,
}
