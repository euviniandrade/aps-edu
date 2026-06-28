const { GoogleGenerativeAI } = require('@google/generative-ai')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function getModel() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

// ─── INSIGHTS DO DASHBOARD ────────────────────────────────────────────────────
async function generateInsights(request, reply) {
  try {
    const model = getModel()

    const [totalUsers, activeUsers, tasksByStatus, upcomingEvents,
           recentAnnouncements, pendingFeedbacks, gamification] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.event.count({ where: { date: { gte: new Date() } } }),
      prisma.announcement.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }),
      prisma.feedback.count({ where: { status: 'pending' } }),
      prisma.userPoints.aggregate({ _avg: { points: true }, _max: { points: true } }).catch(() => null),
    ])

    const taskMap = Object.fromEntries(tasksByStatus.map(t => [t.status, t._count._all]))

    const prompt = `Você é um consultor de gestão educacional da APS Sul (rede adventista do Sul do Brasil).
Analise os dados abaixo e retorne exatamente 3 insights estratégicos em JSON.

DADOS:
- Colaboradores: ${activeUsers} ativos / ${totalUsers} total
- Tarefas: ${JSON.stringify(taskMap)}
- Eventos próximos: ${upcomingEvents}
- Comunicados (30 dias): ${recentAnnouncements}
- Feedbacks pendentes: ${pendingFeedbacks}
- Pontuação média gamificação: ${gamification?._avg?.points?.toFixed(0) || 'N/A'}

Responda APENAS com JSON válido, sem markdown:
{
  "insights": [
    {
      "title": "título curto (max 45 chars)",
      "description": "descrição acionável (max 120 chars)",
      "priority": "high|medium|low",
      "icon": "📊|⚠️|✅|🎯|💡|🚀|👥|📋"
    }
  ]
}`

    const result = await model.generateContent(prompt)
    const data = extractJSON(result.response.text())

    if (!data?.insights) return reply.status(500).send({ error: 'Resposta inválida da IA' })
    reply.send(data)
  } catch (err) {
    reply.status(500).send({ error: err.message })
  }
}

// ─── GERADOR DE TEXTO ─────────────────────────────────────────────────────────
async function generateText(request, reply) {
  try {
    const model = getModel()
    const { type, context } = request.body

    if (!context || context.trim().length < 3) {
      return reply.status(400).send({ error: 'Contexto muito curto' })
    }

    const prompts = {
      announcement: `Crie um comunicado institucional para a rede de colégios adventistas APS Sul.
Tema: "${context}"
Retorne APENAS JSON:
{ "title": "título impactante (max 60 chars)", "content": "texto do comunicado (max 280 chars, profissional e motivador)" }`,

      task: `Crie uma descrição clara para uma tarefa de gestão da rede educacional adventista.
Tema: "${context}"
Retorne APENAS JSON:
{ "description": "descrição objetiva da tarefa (max 200 chars)" }`,

      event: `Crie uma descrição envolvente para um evento da rede adventista APS Sul.
Tema: "${context}"
Retorne APENAS JSON:
{ "description": "descrição do evento que destaque propósito e benefícios (max 250 chars)" }`,

      feedback_response: `Redija uma resposta institucional e empática para este feedback recebido:
"${context}"
Retorne APENAS JSON:
{ "response": "resposta profissional e acolhedora (max 200 chars)" }`,
    }

    const prompt = prompts[type] || `Crie um texto profissional sobre: "${context}". Retorne APENAS JSON: { "text": "texto gerado" }`

    const result = await model.generateContent(prompt)
    const data = extractJSON(result.response.text())

    if (!data) return reply.status(500).send({ error: 'Resposta inválida da IA' })
    reply.send(data)
  } catch (err) {
    reply.status(500).send({ error: err.message })
  }
}

// ─── CHAT ASSISTENTE ──────────────────────────────────────────────────────────
async function chat(request, reply) {
  try {
    const model = getModel()
    const { messages, context } = request.body

    if (!messages?.length) {
      return reply.status(400).send({ error: 'Mensagens obrigatórias' })
    }

    // Busca dados contextuais da plataforma para enriquecer o chat
    const [users, tasks, events, units] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.task.count(),
      prisma.event.count({ where: { date: { gte: new Date() } } }),
      prisma.unit.count(),
    ])

    const systemContext = {
      plataforma: 'APS EDU Sul — Gestão de Rede Educacional Adventista',
      colaboradoresAtivos: users,
      totalTarefas: tasks,
      eventosProximos: events,
      unidades: units,
      ...context,
    }

    const systemInstruction = `Você é o assistente de IA da plataforma APS EDU Sul.
Ajuda administradores com gestão de colégios adventistas do Sul do Brasil.
Seja conciso, profissional e use emojis com moderação.
Responda sempre em português do Brasil.
Contexto atual: ${JSON.stringify(systemContext)}`

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const chatSession = model.startChat({ history, systemInstruction })
    const lastMsg = messages[messages.length - 1]
    const result = await chatSession.sendMessage(lastMsg.content)

    reply.send({ content: result.response.text() })
  } catch (err) {
    reply.status(500).send({ error: err.message })
  }
}

// ─── ANÁLISE DE USUÁRIOS ──────────────────────────────────────────────────────
async function analyzeUsers(request, reply) {
  try {
    const model = getModel()

    const users = await prisma.user.findMany({
      select: {
        role: { select: { name: true, slug: true } },
        unit: { select: { name: true, city: true } },
        isActive: true,
        createdAt: true,
      },
    })

    const byRole = users.reduce((acc, u) => {
      const role = u.role?.name || 'Sem cargo'
      acc[role] = (acc[role] || 0) + 1
      return acc
    }, {})

    const byUnit = users.reduce((acc, u) => {
      const unit = u.unit?.name || 'Sem unidade'
      acc[unit] = (acc[unit] || 0) + 1
      return acc
    }, {})

    const prompt = `Analise a distribuição de colaboradores da rede APS Sul:

Por cargo: ${JSON.stringify(byRole)}
Por unidade: ${JSON.stringify(byUnit)}
Total: ${users.length} (${users.filter(u => u.isActive).length} ativos)

Retorne APENAS JSON com análise estratégica:
{
  "summary": "resumo em 1 frase",
  "highlights": ["insight 1", "insight 2", "insight 3"],
  "recommendation": "recomendação principal"
}`

    const result = await model.generateContent(prompt)
    const data = extractJSON(result.response.text())

    reply.send(data || { error: 'Análise indisponível' })
  } catch (err) {
    reply.status(500).send({ error: err.message })
  }
}

module.exports = { generateInsights, generateText, chat, analyzeUsers }
