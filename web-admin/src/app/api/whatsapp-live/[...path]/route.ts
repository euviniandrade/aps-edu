import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://aps-edu-api.fly.dev/api'
).replace(/\/$/, '')

function buildTarget(path: string[], search: string) {
  return `${BACKEND_URL}/whatsapp/${path.join('/')}${search || ''}`
}

function authHeader(req: NextRequest): Record<string, string> {
  const auth = req.headers.get('authorization')
  return auth ? { Authorization: auth } : {}
}

async function proxy(req: NextRequest, path: string[], method: string) {
  const target = buildTarget(path, req.nextUrl.search)
  const body = method === 'GET' ? undefined : await req.text()

  try {
    const res = await fetch(target, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader(req) },
      body,
      cache: 'no-store',
    })
    const text = await res.text()
    const contentType = res.headers.get('content-type') || 'application/json'
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': contentType } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao conectar ao backend WhatsApp' }, { status: 503 })
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params

  // SSE passthrough — não armazena em buffer, repassa o stream diretamente
  if (path[0] === 'events') {
    const target = buildTarget(path, req.nextUrl.search)
    try {
      const res = await fetch(target, {
        headers: { 'Accept': 'text/event-stream', ...authHeader(req) },
        cache: 'no-store',
      })
      if (!res.body) {
        return NextResponse.json({ error: 'Backend não retornou stream' }, { status: 502 })
      }
      return new NextResponse(res.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Transfer-Encoding': 'chunked',
        },
      })
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Erro ao conectar ao SSE' }, { status: 503 })
    }
  }

  return proxy(req, path, 'GET')
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(req, path, 'POST')
}
