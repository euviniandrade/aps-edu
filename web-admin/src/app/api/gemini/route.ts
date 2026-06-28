import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const MAX_PROMPT_CHARS = 18_000

type ProviderKind = 'openai-compatible' | 'gemini' | 'anthropic'

interface ProviderConfig {
  id: string
  label: string
  kind: ProviderKind
  apiKey: string
  baseUrl?: string
  models: string[]
  visionModels?: string[]
  headers?: Record<string, string>
}

interface ProviderResult {
  text?: string
  error?: string
}

interface GenerationSuccess {
  content: string
  provider: string
  providerLabel: string
  model: string
  attemptedProviders: string[]
}

const keys = {
  groq: process.env.GROQ_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  mistral: process.env.MISTRAL_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  openrouter: process.env.OPENROUTER_API_KEY || '',
  xai: process.env.XAI_API_KEY || '',
  perplexity: process.env.PERPLEXITY_API_KEY || '',
}

function truncatePrompt(prompt: string) {
  return prompt.length <= MAX_PROMPT_CHARS
    ? prompt
    : `${prompt.substring(0, MAX_PROMPT_CHARS)}\n\n[... conteúdo truncado ...]`
}

function providerOrder(seed: string, providers: ProviderConfig[], preferredProvider?: string) {
  if (preferredProvider) {
    const selected = providers.find(provider => provider.id === preferredProvider)
    if (selected) return [selected, ...providers.filter(provider => provider.id !== preferredProvider)]
  }
  if (providers.length <= 1) return providers
  const index = Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % providers.length
  return [...providers.slice(index), ...providers.slice(0, index)]
}

function extractError(data: any, fallback: string) {
  if (!data) return fallback
  if (typeof data.error === 'string') return data.error
  if (data.error?.message) return data.error.message
  if (data.message) return data.message
  return fallback
}

function openAiContent(prompt: string, imageBase64?: string, imageMimeType?: string) {
  if (!imageBase64 || !imageMimeType) return prompt
  return [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
  ]
}

async function callOpenAiCompatible(
  provider: ProviderConfig,
  prompt: string,
  model: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<ProviderResult> {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Você é a IA da Educação, assistente executiva da Associação Paulista Sul. Responda em português do Brasil, com clareza, estrutura e próximos passos acionáveis.',
        },
        { role: 'user', content: openAiContent(prompt, imageBase64, imageMimeType) },
      ],
      max_tokens: 2200,
      temperature: 0.45,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error) return { error: extractError(data, `${provider.label} retornou HTTP ${res.status}`) }
  return { text: data?.choices?.[0]?.message?.content || '' }
}

async function callGemini(
  provider: ProviderConfig,
  prompt: string,
  model: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`
  const parts = imageBase64 && imageMimeType
    ? [{ text: prompt }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }]
    : [{ text: prompt }]

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              'Você é a IA da Educação, assistente executiva da Associação Paulista Sul. Responda em português do Brasil, com clareza, estrutura e próximos passos acionáveis.',
          },
        ],
      },
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 2200,
      },
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error) return { error: extractError(data, `${provider.label} retornou HTTP ${res.status}`) }
  return { text: data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('\n') || '' }
}

async function callAnthropic(
  provider: ProviderConfig,
  prompt: string,
  model: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<ProviderResult> {
  const content = imageBase64 && imageMimeType
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageMimeType, data: imageBase64 } },
        { type: 'text', text: prompt },
      ]
    : prompt

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2200,
      temperature: 0.45,
      system:
        'Você é a IA da Educação, assistente executiva da Associação Paulista Sul. Responda em português do Brasil, com clareza, estrutura e próximos passos acionáveis.',
      messages: [{ role: 'user', content }],
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error || data?.type === 'error') {
    return { error: extractError(data, `${provider.label} retornou HTTP ${res.status}`) }
  }
  return { text: data?.content?.map((part: any) => part.text || '').join('\n') || '' }
}

async function callProvider(
  provider: ProviderConfig,
  prompt: string,
  model: string,
  imageBase64?: string,
  imageMimeType?: string
) {
  if (provider.kind === 'gemini') return callGemini(provider, prompt, model, imageBase64, imageMimeType)
  if (provider.kind === 'anthropic') return callAnthropic(provider, prompt, model, imageBase64, imageMimeType)
  return callOpenAiCompatible(provider, prompt, model, imageBase64, imageMimeType)
}

function getProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [
    {
      id: 'groq',
      label: 'Groq',
      kind: 'openai-compatible',
      apiKey: keys.groq,
      baseUrl: 'https://api.groq.com/openai/v1',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192'],
      visionModels: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-11b-vision-preview'],
    },
    {
      id: 'gemini',
      label: 'Google Gemini',
      kind: 'gemini',
      apiKey: keys.gemini,
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
    },
    {
      id: 'openai',
      label: 'OpenAI',
      kind: 'openai-compatible',
      apiKey: keys.openai,
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4.1-mini', 'gpt-4o-mini'],
      visionModels: ['gpt-4o-mini', 'gpt-4.1-mini'],
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      kind: 'anthropic',
      apiKey: keys.anthropic,
      models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'],
      visionModels: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    },
    {
      id: 'mistral',
      label: 'Mistral AI',
      kind: 'openai-compatible',
      apiKey: keys.mistral,
      baseUrl: 'https://api.mistral.ai/v1',
      models: ['mistral-small-latest', 'mistral-large-latest'],
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      kind: 'openai-compatible',
      apiKey: keys.deepseek,
      baseUrl: 'https://api.deepseek.com/v1',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      kind: 'openai-compatible',
      apiKey: keys.openrouter,
      baseUrl: 'https://openrouter.ai/api/v1',
      models: ['google/gemini-2.5-flash', 'anthropic/claude-3.5-haiku', 'openai/gpt-4o-mini'],
      visionModels: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini'],
      headers: {
        'HTTP-Referer': 'https://aps-edu.vercel.app',
        'X-Title': 'APS30 - IA da Educação',
      },
    },
    {
      id: 'xai',
      label: 'xAI Grok',
      kind: 'openai-compatible',
      apiKey: keys.xai,
      baseUrl: 'https://api.x.ai/v1',
      models: ['grok-3-mini', 'grok-2-latest'],
    },
    {
      id: 'perplexity',
      label: 'Perplexity',
      kind: 'openai-compatible',
      apiKey: keys.perplexity,
      baseUrl: 'https://api.perplexity.ai',
      models: ['sonar-pro', 'sonar'],
    },
  ]

  return providers.filter(provider => provider.apiKey)
}

async function generateResponse(
  prompt: string,
  imageBase64?: string,
  imageMimeType?: string,
  preferredProvider?: string
): Promise<GenerationSuccess> {
  const safePrompt = truncatePrompt(prompt)
  const providers = getProviders()
  const allErrors: string[] = []

  if (!providers.length) {
    throw new Error(
      'Nenhum provedor de IA está configurado. Adicione pelo menos uma chave no Vercel: GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, MISTRAL_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, XAI_API_KEY ou PERPLEXITY_API_KEY.'
    )
  }

  for (const provider of providerOrder(safePrompt, providers, preferredProvider)) {
    const models = imageBase64 && imageMimeType && provider.visionModels ? provider.visionModels : provider.models
    for (const model of models) {
      const result = await callProvider(provider, safePrompt, model, imageBase64, imageMimeType)
      if (result.text) {
        return {
          content: result.text,
          provider: provider.id,
          providerLabel: provider.label,
          model,
          attemptedProviders: providers.map(item => item.label),
        }
      }
      allErrors.push(`${provider.label}/${model}: ${result.error || 'resposta vazia'}`)
    }
  }

  throw new Error(`Todos os provedores configurados falharam: ${allErrors.join(' | ')}`)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, imageBase64, imageMimeType, preferredProvider, stream } = body

    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

    const result = await generateResponse(prompt, imageBase64, imageMimeType, preferredProvider)
    if (!stream) return NextResponse.json(result)

    const encoder = new TextEncoder()
    const chunks = result.content.match(/.{1,110}(\s|$)|.+$/g) || [result.content]
    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'meta',
              provider: result.provider,
              providerLabel: result.providerLabel,
              model: result.model,
            })}\n\n`
          )
        )

        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`))
          await new Promise(resolve => setTimeout(resolve, 18))
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', attemptedProviders: result.attemptedProviders })}\n\n`)
        )
        controller.close()
      },
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

