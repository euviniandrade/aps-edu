import { NextResponse } from 'next/server'

const providers = [
  { id: 'openai', name: 'OpenAI GPT', env: 'OPENAI_API_KEY', role: 'Agente geral, documentos, planilhas, tarefas e raciocinio.' },
  { id: 'gemini', name: 'Google Gemini', env: 'GEMINI_API_KEY', role: 'Google Workspace, multimodalidade, Drive, Gmail, Agenda e Docs.' },
  { id: 'anthropic', name: 'Claude', env: 'ANTHROPIC_API_KEY', role: 'Analise longa, escrita profissional, codigo e tarefas complexas.' },
  { id: 'xai', name: 'Grok', env: 'XAI_API_KEY', role: 'Tendencias, leitura de sinais externos e contexto em tempo real.' },
  { id: 'perplexity', name: 'Perplexity', env: 'PERPLEXITY_API_KEY', role: 'Scanner com fontes, pesquisa profunda e benchmarking.' },
  { id: 'groq', name: 'Groq', env: 'GROQ_API_KEY', role: 'Inferencia rapida com modelos abertos.' },
  { id: 'mistral', name: 'Mistral', env: 'MISTRAL_API_KEY', role: 'Modelos eficientes para automacoes e texto operacional.' },
  { id: 'deepseek', name: 'DeepSeek', env: 'DEEPSEEK_API_KEY', role: 'Raciocinio e custo operacional menor.' },
  { id: 'openrouter', name: 'OpenRouter', env: 'OPENROUTER_API_KEY', role: 'Roteamento entre diversos modelos em uma unica chave.' },
]

export async function GET() {
  const items = providers.map(provider => ({
    id: provider.id,
    name: provider.name,
    role: provider.role,
    configured: Boolean(process.env[provider.env]),
  }))

  return NextResponse.json({
    configured: items.filter(item => item.configured).length,
    total: items.length,
    providers: items,
  })
}
