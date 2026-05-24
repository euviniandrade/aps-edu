import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// Modelos do Pollinations.ai (gratuito, sem API key, sem rate limit)
const POLLINATIONS_MODELS = [
  'flux',           // FLUX.1 — melhor qualidade
  'flux-realism',   // realismo fotográfico
  'turbo',          // mais rápido
]

const STYLE_HINTS: Record<string, string> = {
  photorealistic: 'photorealistic, ultra detailed, 8k, professional photography',
  illustration:   'digital illustration, vibrant colors, professional design, clean',
  logo:           'professional logo design, vector art, minimalist, clean background',
  cartoon:        'cartoon style, colorful, fun, friendly, animated',
  presentation:   'clean infographic style, corporate, professional, blue tones',
}

async function tryPollinations(prompt: string, model: string): Promise<{ imageBase64?: string; mimeType?: string; error?: string }> {
  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=768&model=${model}&nologo=true&enhance=true`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(50_000), // 50s timeout
    headers: { 'Accept': 'image/*' },
  })

  if (!res.ok) return { error: `HTTP ${res.status}` }

  const contentType = res.headers.get('content-type') || 'image/jpeg'
  if (!contentType.startsWith('image/')) return { error: `Resposta inválida: ${contentType}` }

  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { imageBase64: base64, mimeType: 'image/jpeg' }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, style } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

    const styleHint = STYLE_HINTS[style] || STYLE_HINTS.photorealistic
    const fullPrompt = `${prompt}, ${styleHint}`

    const errors: string[] = []

    // Tenta cada modelo do Pollinations em sequência
    for (const model of POLLINATIONS_MODELS) {
      try {
        const result = await tryPollinations(fullPrompt, model)
        if (result.imageBase64) {
          return NextResponse.json({
            imageBase64: result.imageBase64,
            mimeType: result.mimeType,
            model: `pollinations/${model}`,
          })
        }
        errors.push(`pollinations/${model}: ${result.error}`)
      } catch (e: any) {
        errors.push(`pollinations/${model}: ${e.message}`)
      }
    }

    // Fallback: Hugging Face (se HF_TOKEN configurado)
    const HF_TOKEN = process.env.HF_TOKEN || ''
    if (HF_TOKEN) {
      try {
        const hfRes = await fetch(
          'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${HF_TOKEN}`,
            },
            body: JSON.stringify({ inputs: fullPrompt }),
            signal: AbortSignal.timeout(45_000),
          }
        )
        if (hfRes.ok) {
          const contentType = hfRes.headers.get('content-type') || ''
          if (contentType.startsWith('image/')) {
            const buffer = await hfRes.arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            return NextResponse.json({ imageBase64: base64, mimeType: 'image/png', model: 'huggingface/FLUX.1-schnell' })
          }
        }
        errors.push(`HuggingFace: HTTP ${hfRes.status}`)
      } catch (e: any) {
        errors.push(`HuggingFace: ${e.message}`)
      }
    }

    return NextResponse.json(
      { error: `Geração falhou — ${errors.join(' | ')}` },
      { status: 500 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
