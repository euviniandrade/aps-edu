import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_TRANSCRIBE_MODEL = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const { fileBase64, mimeType, fileName } = await req.json()

    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: 'fileBase64 e mimeType são obrigatórios' }, { status: 400 })
    }

    const buffer = Buffer.from(fileBase64, 'base64')
    const nameLower = (fileName || '').toLowerCase()

    // ── Plain text ──────────────────────────────────────────────
    if (mimeType === 'text/plain' || nameLower.endsWith('.txt') || nameLower.endsWith('.csv')) {
      return NextResponse.json({ text: buffer.toString('utf-8') })
    }

    // ── DOCX (Word) ──────────────────────────────────────────────
    if (
      nameLower.endsWith('.docx') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        const text = result.value?.trim()
        if (!text) return NextResponse.json({ text: '[Documento Word vazio ou sem texto extraível]' })
        return NextResponse.json({ text })
      } catch (e: any) {
        return NextResponse.json({ error: 'Erro ao ler DOCX: ' + e.message }, { status: 500 })
      }
    }

    // ── DOC (Word antigo) ─────────────────────────────────────────
    if (nameLower.endsWith('.doc') || mimeType === 'application/msword') {
      // .doc não é suportado pelo mammoth — extrai texto bruto legível
      try {
        const raw = buffer.toString('latin1')
        // Extrai sequências de caracteres ASCII legíveis (heurística para .doc)
        const readable = raw.match(/[\x20-\x7E\xC0-\xFF]{4,}/g)?.join(' ') || ''
        const cleaned = readable.replace(/\s+/g, ' ').trim().substring(0, 8000)
        return NextResponse.json({ text: cleaned || '[Arquivo .doc — conteúdo não extraível. Use .docx]' })
      } catch {
        return NextResponse.json({ text: '[Arquivo .doc antigo — converta para .docx para melhor leitura]' })
      }
    }

    // ── PDF ───────────────────────────────────────────────────────
    if (nameLower.endsWith('.pdf') || mimeType === 'application/pdf') {
      try {
        // Extração heurística de texto do PDF (sem biblioteca externa)
        const raw = buffer.toString('latin1')
        // Busca por streams de texto PDF (BT...ET)
        const btEtMatches = raw.match(/BT[\s\S]*?ET/g) || []
        const lines: string[] = []
        for (const block of btEtMatches) {
          const tjMatches = block.match(/\(([^)]+)\)\s*Tj/g) || []
          for (const tj of tjMatches) {
            const m = tj.match(/\(([^)]+)\)/)
            if (m?.[1]) lines.push(m[1])
          }
        }
        const text = lines.join(' ').trim()
        if (text.length > 20) {
          return NextResponse.json({ text: text.substring(0, 8000) })
        }
        // Fallback: tenta extrair strings legíveis
        const readable = raw.match(/[\x20-\x7E]{5,}/g)
          ?.filter(s => /[a-zA-ZÀ-ÿ]{3,}/.test(s))
          ?.join(' ')
          ?.replace(/\s+/g, ' ')
          ?.trim()
          ?.substring(0, 8000) || ''
        return NextResponse.json({ text: readable || '[PDF sem texto extraível — pode ser escaneado]' })
      } catch {
        return NextResponse.json({ text: '[Erro ao ler PDF]' })
      }
    }

    // ── Audio ─────────────────────────────────────────────────────
    if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      if (!GROQ_API_KEY) {
        return NextResponse.json({ error: 'GROQ_API_KEY não configurada para transcrição de áudio' }, { status: 503 })
      }
      if (buffer.byteLength > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: 'Áudio acima de 25MB. Envie um arquivo menor ou comprimido.' }, { status: 413 })
      }
      const blob = new Blob([buffer], { type: mimeType })
      const formData = new FormData()
      formData.append('file', blob, fileName || 'audio.wav')
      formData.append('model', GROQ_TRANSCRIBE_MODEL)
      formData.append('language', 'pt')
      formData.append('response_format', 'json')
      formData.append('prompt', 'Português do Brasil. Contexto: gestão educacional, Associação Paulista Sul, Educação Adventista, reuniões, tarefas, unidades, colaboradores e decisões executivas.')

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

    // ── Outros ────────────────────────────────────────────────────
    return NextResponse.json({ text: `[Arquivo: ${fileName || 'documento'} — tipo ${mimeType} não suportado para leitura]` })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
