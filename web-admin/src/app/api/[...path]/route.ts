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

function getAppsScriptUrl() {
  return (process.env.APPS_SCRIPT_URL || '').replace(/\/$/, '')
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  return header.replace(/^Bearer\s+/i, '')
}

async function proxyToAppsScript(request: NextRequest, path: string[], bodyText = '') {
  const appUrl = getAppsScriptUrl()
  if (!appUrl) throw new Error('APPS_SCRIPT_URL nao configurado')

  const cleanPath = path.join('/')
  const token = getBearerToken(request)

  let response: Response
  if (request.method === 'GET' || request.method === 'HEAD') {
    const target = new URL(`${appUrl}/${cleanPath}`)
    request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value))
    if (token) target.searchParams.set('_token', token)
    response = await fetch(target, { method: 'GET', cache: 'no-store' })
  } else {
    let body: any = {}
    if (bodyText) {
      try { body = JSON.parse(bodyText) } catch { body = { raw: bodyText } }
    }
    response = await fetch(appUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, _method: request.method, _path: cleanPath, _token: token }),
      cache: 'no-store',
    })
  }

  const data = await response.json().catch(async () => ({ raw: await response.text() }))
  const status = typeof data?.code === 'number' && data?.error ? data.code : response.status
  return NextResponse.json(data, { status })
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

  const bodyText = !['GET', 'HEAD'].includes(request.method) ? await request.text() : ''
  if (bodyText) init.body = bodyText

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
    try {
      return await proxyToAppsScript(request, path, bodyText)
    } catch (fallbackError: any) {
      return NextResponse.json(
        {
          error: 'Backend indisponivel',
          detail: error?.message || 'Falha ao conectar na API',
          fallback: fallbackError?.message || 'Falha no Apps Script',
        },
        { status: 502 }
      )
    }
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
