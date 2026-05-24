import { NextRequest, NextResponse } from 'next/server'

// Extende timeout para 30s — modelo LLM pode demorar alguns segundos
export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// Modelos por capacidade (gemma2-9b-it foi descontinuado em mai/2025)
const MODELS_FAST  = ['llama-3.1-8b-instant', 'llama3-8b-8192']
const MODELS_SMART = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192']

// Limite de caracteres antes de enviar ao LLM (~3000 tokens de folga no free tier)
const MAX_PROMPT_CHARS = 18_000

// Trunca prompt para não ultrapassar o TPM do free tier
function truncatePrompt(prompt: string): string {
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt
  const head = prompt.substring(0, MAX_PROMPT_CHARS)
  return head + '\n\n[... conteúdo truncado para caber no limite do modelo ...]'
}

// Seleciona lista de modelos com base no tipo de prompt
function selectModels(prompt: string): string[] {
  const isComplex =
    prompt.length > 800 ||
    /\[DOC_CONTENT:|AUDIO_TRANSCRIBED:/i.test(prompt) ||
    /analise|resumo|relatório|compara|explique|estratégia/i.test(prompt)
  return isComplex ? MODELS_SMART : MODELS_FAST
}

// Modelos de visão em ordem de preferência
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
]

async function callGroq(prompt: string, model: string, maxTokens = 2048) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.4,
    }),
  })
  return res.json()
}

async function callGroqVision(prompt: string, imageBase64: string, imageMimeType: string, model: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.4,
    }),
  })
  return res.json()
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const { prompt, imageBase64, imageMimeType } = body

    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

    // Vision path
    if (imageBase64 && imageMimeType) {
      const errors: string[] = []
      for (const model of VISION_MODELS) {
        const data = await callGroqVision(prompt, imageBase64, imageMimeType, model)
        if (data.error) {
          const msg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error))
          errors.push(`${model}: ${msg}`)
          continue
        }
        const text = data.choices?.[0]?.message?.content || ''
        return NextResponse.json({ content: text, model })
      }
      // Fallback to text-only if all vision models fail
      const errSummary = errors.join(' | ')
      console.warn('Vision models failed, falling back to text:', errSummary)
    }

    // Text-only path — pick model list based on prompt complexity
    const safePRompt = truncatePrompt(prompt)
    const MODELS = selectModels(safePRompt)
    const errors: string[] = []
    for (const model of MODELS) {
      const data = await callGroq(safePRompt, model)
      if (data.error) {
        const msg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error))
        errors.push(`${model}: ${msg}`)
        continue
      }
      const text = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ content: text, model })
    }

    return NextResponse.json({ error: `Modelos falharam — ${errors.join(' | ')}` }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
