import { NextRequest, NextResponse } from 'next/server'

// Extende timeout para 30s — modelo LLM pode demorar alguns segundos
export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// Modelos em ordem de preferência — remove os descontinuados
const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
]

// Modelos de visão em ordem de preferência
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
]

async function callGroq(prompt: string, model: string) {
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

    // Text-only path
    const errors: string[] = []
    for (const model of MODELS) {
      const data = await callGroq(prompt, model)
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
