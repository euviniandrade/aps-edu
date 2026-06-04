import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

// ── Config ────────────────────────────────────────────────────────────────────
// BACKEND_URL pode ser definido no Vercel como variável de ambiente.
// Em produção: use um túnel (ngrok / cloudflare) apontando para localhost:8081
// Exemplo: BACKEND_URL=https://seu-tunel.ngrok-free.app
const BACKEND_CANDIDATES = (() => {
  const urls: string[] = []
  const add = (v: string | undefined) => {
    if (!v) return
    const u = v.trim().replace(/\/+$/, '')
    if (u && !urls.includes(u)) urls.push(u)
  }
  add(process.env.WHATSAPP_BACKEND_URL)
  add(process.env.BACKEND_URL)
  add(process.env.NEXT_PUBLIC_API_URL)
  add('http://localhost:8081')
  return urls
})()

const API_KEY = process.env.WHATSAPP_API_KEY || 'aps-edu-whatsapp'

function waHeaders(): Record<string, string> {
  return {
    'Content-Type':              'application/json',
    'x-api-key':                 API_KEY,
    'ngrok-skip-browser-warning':'true',
    'User-Agent':                'APS-EDU-WebAdmin/1.0',
  }
}

// ── Fetch com fallback entre candidatos ──────────────────────────────────────
async function waFetch(
  subpath: string,
  init: RequestInit & { method?: string },
): Promise<{ ok: boolean; data?: any; status?: number; text?: string }> {
  let lastErr = 'no backends configured'

  for (const base of BACKEND_CANDIDATES) {
    try {
      const res = await fetch(`${base}${subpath}`, {
        ...init,
        headers: { ...waHeaders(), ...(init.headers as Record<string, string> || {}) },
        cache: 'no-store',
      })

      if (res.ok) {
        const data = await res.json().catch(async () => {
          const t = await res.text().catch(() => '')
          throw new Error(t || 'invalid_json')
        })
        return { ok: true, data }
      }

      const text  = await res.text().catch(() => '')
      lastErr     = text || `http_${res.status}`

      // Não tenta próximo backend para erros 4xx (lógica, não rede)
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, text }
      }
    } catch (e: any) {
      lastErr = e?.message || 'fetch_failed'
    }
  }

  return { ok: false, status: 502, text: lastErr }
}

async function waGet(subpath: string) {
  const r = await waFetch(subpath, {})
  if (r.ok) return r.data
  return { ok: false, error: r.text, status: r.status }
}

async function waPost(subpath: string, body: any) {
  const r = await waFetch(subpath, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (r.ok) return r.data
  return { ok: false, error: r.text, status: r.status }
}

async function waDel(subpath: string, body?: any) {
  const r = await waFetch(subpath, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (r.ok) return r.data
  return { ok: false, error: r.text, status: r.status }
}

// ── SSE proxy ─────────────────────────────────────────────────────────────────
async function proxySSE(): Promise<ReadableStream<Uint8Array>> {
  const enc = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      let closed = false
      const close = () => {
        if (!closed) { closed = true; try { controller.close() } catch {} }
      }

      let upstream: Response | null = null
      for (const base of BACKEND_CANDIDATES) {
        try {
          const res = await fetch(`${base}/events`, {
            headers: {
              Accept:                       'text/event-stream',
              'x-api-key':                  API_KEY,
              'ngrok-skip-browser-warning': 'true',
              'Cache-Control':              'no-cache',
            },
            cache: 'no-store',
          })
          if (res.ok && res.body) { upstream = res; break }
        } catch {}
      }

      if (!upstream?.body) {
        controller.enqueue(enc.encode('event: error\ndata: {"msg":"backend indisponível"}\n\n'))
        close()
        return
      }

      const reader = upstream.body.getReader()
      const timeout = setTimeout(close, 55_000) // Vercel tem max 60s

      while (!closed) {
        const { done, value } = await reader.read()
        if (done || closed) break
        try { controller.enqueue(value) } catch { break }
      }

      clearTimeout(timeout)
      reader.cancel().catch(() => {})
      close()
    },
  })
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const p0 = path[0]

  try {
    // SSE em tempo real
    if (p0 === 'events') {
      const stream = await proxySSE()
      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          'Content-Type':      'text/event-stream',
          'Cache-Control':     'no-cache',
          'Connection':        'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    const routeMap: Record<string, string> = {
      'status':        '/status',
      'contacts':      '/contacts',
      'contacts-all':  '/contacts-all',
      'groups':        '/groups',
      'ai-state':      '/ai/state',
      'segments':      '/crm/segments',
      'bulk-status':   '/bulk-status',
    }

    if (p0 === 'messages') {
      const chatId = req.nextUrl.searchParams.get('chatId') || ''
      const limit  = req.nextUrl.searchParams.get('limit') || '50'
      return NextResponse.json(await waGet(`/messages?chatId=${encodeURIComponent(chatId)}&limit=${limit}`))
    }

    if (routeMap[p0]) return NextResponse.json(await waGet(routeMap[p0]))

    return NextResponse.json({ error: `Endpoint desconhecido: ${p0}` }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const p0 = path[0]

  try {
    const b = await req.json().catch(() => ({}))

    if (p0 === 'start')         return NextResponse.json(await waPost('/start', {}))
    if (p0 === 'disconnect')    return NextResponse.json(await waPost('/disconnect', {}))

    if (p0 === 'send')          return NextResponse.json(await waPost('/send', b))
    if (p0 === 'mark-read')     return NextResponse.json(await waPost('/mark-read', b))
    if (p0 === 'archive')       return NextResponse.json(await waPost('/archive', b))
    if (p0 === 'contacts-sync') return NextResponse.json(await waPost('/contacts/sync', {}))

    if (p0 === 'stage')         return NextResponse.json(await waPost('/crm/stage', b))
    if (p0 === 'crm-update')    return NextResponse.json(await waPost('/crm/update', b))
    if (p0 === 'ai-handoff')    return NextResponse.json(await waPost('/crm/handoff', b))

    if (p0 === 'ai-control')    return NextResponse.json(await waPost('/ai/control', b))
    if (p0 === 'ai-training')   return NextResponse.json(await waPost('/ai/training', b))
    if (p0 === 'ai-suggest')    return NextResponse.json(await waPost('/ai/suggest', b))

    if (p0 === 'bulk-send')     return NextResponse.json(await waPost('/bulk-send', b))
    if (p0 === 'bulk-stop')     return NextResponse.json(await waPost('/bulk-stop', {}))

    return NextResponse.json({ error: `Endpoint desconhecido: ${p0}` }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const p0 = path[0]

  try {
    if (p0 === 'ai-training') {
      const idx = path[1] || '0'
      return NextResponse.json(await waDel(`/ai/training/${idx}`))
    }
    return NextResponse.json({ error: `Endpoint desconhecido: ${p0}` }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}
