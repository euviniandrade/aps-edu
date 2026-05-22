import { NextRequest, NextResponse } from 'next/server'

// Extende timeout para 30s — modelo LLM pode demorar alguns segundos
export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
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

    let lastError = ''
    for (const model of MODELS) {
      const data = await callGroq(prompt, model)
      if (data.error) {
        lastError = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error))
        continue // tenta próximo modelo
      }
      const text = data.choices?.[0]?.message?.content || ''
      return NextResponse.json({ content: text })
    }

    return NextResponse.json({ error: `Todos os modelos falharam: ${lastError}` }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
