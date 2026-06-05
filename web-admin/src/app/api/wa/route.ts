import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Render backend - hardcoded para garantir consistência
const BACKEND_URL = 'https://aps-whatsapp.onrender.com'
const API_KEY = 'aps-edu-whatsapp'

async function proxyRequest(req: NextRequest, path: string) {
  try {
    const url = `${BACKEND_URL}${path}${req.nextUrl.search}`

    console.log(`[WA Proxy] ${req.method} ${path}`)

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
      cache: 'no-store',
    })

    console.log(`[WA Proxy] Response: ${response.status}`)

    const contentType = response.headers.get('content-type')
    let body: any

    if (contentType?.includes('application/json')) {
      body = await response.json().catch(() => ({}))
    } else {
      body = await response.text()
    }

    return NextResponse.json(body, { status: response.status })
  } catch (error: any) {
    console.error(`[WA Proxy Error] ${path}:`, error.message)
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/api/wa', '') || '/'
  return proxyRequest(req, path)
}

export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/api/wa', '') || '/'
  return proxyRequest(req, path)
}

export async function DELETE(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/api/wa', '') || '/'
  return proxyRequest(req, path)
}
