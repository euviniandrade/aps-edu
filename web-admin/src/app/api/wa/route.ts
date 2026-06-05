import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Render backend - hardcoded para garantir consistência
const BACKEND_URL = 'https://aps-whatsapp.onrender.com'
const API_KEY = 'aps-edu-whatsapp'

async function proxyRequest(req: NextRequest, path: string) {
  try {
    const url = `${BACKEND_URL}${path}${req.nextUrl.search}`

    console.log(`[WA Proxy] ${req.method} ${path}`, {
      url,
      method: req.method,
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      }
    })

    const headers: Record<string, string> = {
      'x-api-key': API_KEY,
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'curl/7.68.0',
      'Accept': '*/*',
    }

    // Only add Content-Type for requests with body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      headers['Content-Type'] = 'application/json'
    }

    const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    })

    console.log(`[WA Proxy] Response ${url}:`, {
      status: response.status,
      contentType: response.headers.get('content-type'),
    })

    const contentType = response.headers.get('content-type')

    // SSE (Server-Sent Events) - retornar stream diretamente
    if (contentType?.includes('text/event-stream')) {
      console.log(`[WA Proxy] Streaming SSE...`)

      const encoder = new TextEncoder()
      const customStream = new ReadableStream({
        async start(controller) {
          if (response.body) {
            const reader = response.body.getReader()
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                controller.enqueue(value)
              }
            } finally {
              reader.releaseLock()
            }
          }
          controller.close()
        },
      })

      return new NextResponse(customStream, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // JSON ou texto normal
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
