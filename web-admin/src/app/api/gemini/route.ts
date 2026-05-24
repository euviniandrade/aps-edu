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

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

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
