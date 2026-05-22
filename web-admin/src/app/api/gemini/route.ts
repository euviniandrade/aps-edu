import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 503 })
  }

  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'prompt obrigatório' }, { status: 400 })

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    })

    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 })

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return NextResponse.json({ content: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
