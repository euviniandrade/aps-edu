import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// ── API Keys ─────────────────────────────────────────────────────
const GROQ_API_KEY      = process.env.GROQ_API_KEY      || ''
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY    || ''
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY    || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

// ── Token limit ──────────────────────────────────────────────────
// Limita prompt a ~18k chars para não estourar TPM do free tier
const MAX_PROMPT_CHARS = 18_000
function truncatePrompt(p: string) {
  return p.length <= MAX_PROMPT_CHARS
    ? p
    : p.substring(0, MAX_PROMPT_CHARS) + '\n\n[... conteúdo truncado ...]'
}

// ── Groq ──────────────────────────────────────────────────────────
const GROQ_FAST   = ['llama-3.1-8b-instant', 'llama3-8b-8192']
const GROQ_SMART  = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192']
const GROQ_VISION = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
]

function isComplex(prompt: string) {
  return prompt.length > 800
    || /\[DOC_CONTENT:|AUDIO_TRANSCRIBED:/i.test(prompt)
    || /analise|resumo|relatório|compara|explique|estratégia/i.test(prompt)
}

async function callGroq(prompt: string, model: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
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
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 2048,
      temperature: 0.4,
    }),
  })
  return res.json()
}

// ── Google Gemini ─────────────────────────────────────────────────
const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

async function callGemini(prompt: string, model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  const data = await res.json()
  if (data.error) return { error: data.error }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return { text }
}

// ── OpenAI ────────────────────────────────────────────────────────
async function callOpenAI(prompt: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.4,
    }),
  })
  const data = await res.json()
  if (data.error) return { error: data.error }
  const text = data.choices?.[0]?.message?.content || ''
  return { text }
}

// ── Anthropic Claude ──────────────────────────────────────────────
async function callClaude(prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (data.error || data.type === 'error') return { error: data.error || data }
  const text = data.content?.[0]?.text || ''
  return { text }
}

// ── Main handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, imageBase64, imageMimeType } = body

    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

    const safePrompt = truncatePrompt(prompt)
    const allErrors: string[] = []

    // ── 1. Groq Vision (se imagem) ───────────────────────────────
    if (imageBase64 && imageMimeType && GROQ_API_KEY) {
      for (const model of GROQ_VISION) {
        const data = await callGroqVision(safePrompt, imageBase64, imageMimeType, model)
        if (!data.error) {
          return NextResponse.json({ content: data.choices?.[0]?.message?.content || '', model, provider: 'groq' })
        }
        const msg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error))
        allErrors.push(`Groq/${model}: ${msg}`)
      }
      // fallback para texto se visão falhar
    }

    // ── 2. Groq Text ─────────────────────────────────────────────
    if (GROQ_API_KEY) {
      const models = isComplex(safePrompt) ? GROQ_SMART : GROQ_FAST
      for (const model of models) {
        const data = await callGroq(safePrompt, model)
        if (!data.error) {
          return NextResponse.json({ content: data.choices?.[0]?.message?.content || '', model, provider: 'groq' })
        }
        const msg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error))
        allErrors.push(`Groq/${model}: ${msg}`)
      }
    }

    // ── 3. Google Gemini ─────────────────────────────────────────
    if (GEMINI_API_KEY) {
      for (const model of GEMINI_MODELS) {
        const data = await callGemini(safePrompt, model)
        if (!data.error) {
          return NextResponse.json({ content: data.text || '', model, provider: 'gemini' })
        }
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        allErrors.push(`Gemini/${model}: ${msg}`)
      }
    }

    // ── 4. OpenAI GPT ────────────────────────────────────────────
    if (OPENAI_API_KEY) {
      const data = await callOpenAI(safePrompt)
      if (!data.error) {
        return NextResponse.json({ content: data.text || '', model: 'gpt-4o-mini', provider: 'openai' })
      }
      const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
      allErrors.push(`OpenAI/gpt-4o-mini: ${msg}`)
    }

    // ── 5. Anthropic Claude ──────────────────────────────────────
    if (ANTHROPIC_API_KEY) {
      const data = await callClaude(safePrompt)
      if (!data.error) {
        return NextResponse.json({ content: data.text || '', model: 'claude-haiku-4-5', provider: 'anthropic' })
      }
      const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
      allErrors.push(`Claude/claude-haiku-4-5: ${msg}`)
    }

    // Todos falharam
    return NextResponse.json(
      { error: `Todos os provedores falharam — ${allErrors.join(' | ')}` },
      { status: 500 }
    )

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
