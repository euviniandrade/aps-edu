import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query) return NextResponse.json({ error: 'query obrigatória' }, { status: 400 })

    // DuckDuckGo Instant Answer API — sem necessidade de API key
    const encoded = encodeURIComponent(query)
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Erro ao buscar resultados' }, { status: 500 })
    }

    const data = await res.json()

    // Extrai resultados relevantes
    const results: { title: string; snippet: string; url: string }[] = []

    // Abstract (resposta direta)
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText,
        url: data.AbstractURL || '',
      })
    }

    // Related topics
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 5).forEach((t: any) => {
        if (t.Text && t.FirstURL) {
          results.push({
            title: t.Text.split(' - ')[0] || t.Text.substring(0, 60),
            snippet: t.Text,
            url: t.FirstURL,
          })
        }
      })
    }

    // Answer direto (ex: cálculos, conversões)
    const answer = data.Answer || data.Definition || ''

    return NextResponse.json({
      query,
      answer,
      results: results.slice(0, 6),
      source: 'DuckDuckGo',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
