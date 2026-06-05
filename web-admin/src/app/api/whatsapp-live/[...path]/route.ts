import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Usar APENAS Render backend em produção
const BACKEND_URL = process.env.WHATSAPP_BACKEND_URL || 'https://aps-whatsapp.onrender.com'
const API_KEY = process.env.WHATSAPP_API_KEY || 'aps-edu-whatsapp'

async function fetchBackend(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'ngrok-skip-browser-warning': 'true',
      ...options.headers,
    },
    cache: 'no-store',
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const p0 = path[0]

  if (p0 === 'debug') {
    return NextResponse.json({ backend: BACKEND_URL, status: 'OK' })
  }

  if (p0 === 'wa-avatar') {
    try {
      const res = await fetchBackend(`${BACKEND_URL}/wa-avatar/${path[1]}`)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        return new NextResponse(buf, {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
        })
      }
    } catch {}
    return new NextResponse(null, { status: 404 })
  }

  try {
    const res = await fetchBackend(`${BACKEND_URL}/${path.join('/')}${req.nextUrl.search}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetchBackend(`${BACKEND_URL}/${path.join('/')}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetchBackend(`${BACKEND_URL}/${path.join('/')}`, {
      method: 'DELETE',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
