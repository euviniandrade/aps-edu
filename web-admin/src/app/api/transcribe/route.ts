import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const { fileBase64, mimeType, fileName } = await req.json()

    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: 'fileBase64 e mimeType são obrigatórios' }, { status: 400 })
    }

    // Plain text files — just decode base64 and return
    if (mimeType === 'text/plain' || fileName?.endsWith('.txt')) {
      try {
        const text = Buffer.from(fileBase64, 'base64').toString('utf-8')
        return NextResponse.json({ text })
      } catch {
        return NextResponse.json({ error: 'Erro ao decodificar arquivo de texto' }, { status: 400 })
      }
    }

    // Audio files — use Groq Whisper
    if (mimeType.startsWith('audio/')) {
      const audioBytes = Buffer.from(fileBase64, 'base64')
      const blob = new Blob([audioBytes], { type: mimeType })
      const formData = new FormData()
      formData.append('file', blob, fileName || 'audio.wav')
      formData.append('model', 'whisper-large-v3')
      formData.append('language', 'pt')
      formData.append('response_format', 'json')

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: formData,
      })

      const data = await res.json()
      if (data.error) {
        return NextResponse.json({ error: data.error?.message || JSON.stringify(data.error) }, { status: 500 })
      }
      return NextResponse.json({ text: data.text || '' })
    }

    // Documents (PDF, Word etc.) — return a note that text extraction is not supported client-side
    return NextResponse.json({ text: `[Arquivo: ${fileName || 'documento'}]` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
