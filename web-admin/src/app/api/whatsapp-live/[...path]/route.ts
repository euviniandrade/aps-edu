import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const BACKEND_URL = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://aps-edu-api.fly.dev/api').replace(/\/$/, '')

async function proxy(req: NextRequest, path: string[], method: string) {
  const target = `${BACKEND_URL}/whatsapp/${path.join('/')}${req.nextUrl.search || ''}`
  const body = method === 'GET' ? undefined : await req.text()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = req.headers.get('authorization')
  if (auth) headers.Authorization = auth

  try {
    const res = await fetch(target, {
      method,
      headers,
      body,
      cache: 'no-store',
    })
    const text = await res.text()
    const contentType = res.headers.get('content-type') || 'application/json'
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': contentType } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao conectar ao WhatsApp real' }, { status: 503 })
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(req, path, 'GET')
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(req, path, 'POST')
}
