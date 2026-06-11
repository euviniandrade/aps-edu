import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = {
  params: Promise<{ path: string[] }>
}

const DEFAULT_API_BASE = 'https://aps-edu-api.fly.dev/api'

function getApiBase() {
  const raw = process.env.BACKEND_URL || process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE
  return raw.replace(/\/$/, '')
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  const target = new URL(`${getApiBase()}/${path.join('/')}`)
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value))

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const authorization = request.headers.get('authorization')
  const accept = request.headers.get('accept')

  if (contentType) headers.set('content-type', contentType)
  if (authorization) headers.set('authorization', authorization)
  if (accept) headers.set('accept', accept)

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer()
  }

  try {
    const response = await fetch(target, init)
    const responseHeaders = new Headers()
    const responseType = response.headers.get('content-type')
    if (responseType) responseHeaders.set('content-type', responseType)

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Backend indisponivel', detail: error?.message || 'Falha ao conectar na API' },
      { status: 502 }
    )
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
