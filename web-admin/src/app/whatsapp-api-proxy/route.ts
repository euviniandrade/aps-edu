import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BACKEND_URL = 'https://aps-whatsapp.onrender.com'
const API_KEY = 'aps-edu-whatsapp'

async function proxyRequest(req: NextRequest, path: string) {
  try {
    const url = `${BACKEND_URL}${path}${req.nextUrl.search}`

    const headers: Record<string, string> = {
      'x-api-key': API_KEY,
      'ngrok-skip-browser-warning': 'true',
    }

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

    const contentType = response.headers.get('content-type')

    // SSE (Server-Sent Events) - retornar stream diretamente
    if (contentType?.includes('text/event-stream')) {
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
    let responseBody: any

    if (contentType?.includes('application/json')) {
      responseBody = await response.json().catch(() => ({}))
    } else {
      responseBody = await response.text()
    }

    return NextResponse.json(responseBody, { status: response.status })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/whatsapp/api', '') || '/'
  return proxyRequest(req, path)
}

export async function POST(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/whatsapp/api', '') || '/'
  return proxyRequest(req, path)
}

export async function DELETE(req: NextRequest) {
  const path = req.nextUrl.pathname.replace('/whatsapp/api', '') || '/'
  return proxyRequest(req, path)
}
