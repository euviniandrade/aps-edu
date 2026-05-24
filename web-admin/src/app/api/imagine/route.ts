import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const HF_TOKEN = process.env.HF_TOKEN || ''

// Modelos em ordem de preferência (gratuitos no Hugging Face)
const MODELS = [
  'black-forest-labs/FLUX.1-schnell',
  'stabilityai/stable-diffusion-xl-base-1.0',
  'runwayml/stable-diffusion-v1-5',
]

export async function POST(req: NextRequest) {
  try {
    const { prompt, style } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

    // Enriquece o prompt com o estilo solicitado
    const styleMap: Record<string, string> = {
      photorealistic: 'photorealistic, high quality, 8k, detailed',
      illustration:   'digital illustration, vibrant colors, professional design',
      logo:           'professional logo design, clean, minimalist, vector art',
      cartoon:        'cartoon style, colorful, fun, friendly',
    }
    const styleHint = styleMap[style] || styleMap.photorealistic
    const fullPrompt = `${prompt}, ${styleHint}`

    const errors: string[] = []

    for (const model of MODELS) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (HF_TOKEN) headers['Authorization'] = `Bearer ${HF_TOKEN}`

        const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ inputs: fullPrompt }),
        })

        if (!res.ok) {
          const errText = await res.text()
          errors.push(`${model}: ${errText.substring(0, 120)}`)
          continue
        }

        const contentType = res.headers.get('content-type') || ''
        if (!contentType.startsWith('image/')) {
          const body = await res.text()
          errors.push(`${model}: resposta não é imagem — ${body.substring(0, 120)}`)
          continue
        }

        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = contentType.split(';')[0]

        return NextResponse.json({ imageBase64: base64, mimeType, model })
      } catch (e: any) {
        errors.push(`${model}: ${e.message}`)
      }
    }

    return NextResponse.json({ error: `Geração falhou — ${errors.join(' | ')}` }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
