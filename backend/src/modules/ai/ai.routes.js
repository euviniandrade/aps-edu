const controller = require('./ai.controller')

async function aiRoutes(fastify) {
  // Auth required for all AI routes
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Não autorizado' })
    }
  })

  fastify.post('/insights', {
    schema: {
      description: 'Gera insights da plataforma com Gemini AI',
      tags: ['AI'],
    }
  }, controller.generateInsights)

  fastify.post('/generate-text', {
    schema: {
      description: 'Gera texto para comunicados, tarefas e eventos',
      tags: ['AI'],
      body: {
        type: 'object',
        required: ['type', 'context'],
        properties: {
          type: { type: 'string', enum: ['announcement', 'task', 'event', 'feedback_response'] },
          context: { type: 'string', minLength: 3 },
        },
      },
    }
  }, controller.generateText)

  fastify.post('/chat', {
    schema: {
      description: 'Chat com assistente de IA da plataforma',
      tags: ['AI'],
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string' },
              },
            },
          },
          context: { type: 'object' },
        },
      },
    }
  }, controller.chat)

  fastify.post('/analyze-users', {
    schema: {
      description: 'Análise estratégica dos colaboradores com IA',
      tags: ['AI'],
    }
  }, controller.analyzeUsers)
}

module.exports = aiRoutes
