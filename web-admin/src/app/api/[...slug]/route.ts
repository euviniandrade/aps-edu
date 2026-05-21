import { NextRequest, NextResponse } from 'next/server'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || ''

async function proxy(
  method: string,
  slug: string[],
  searchParams: Record<string, string>,
  body: Record<string, any>,
  token: string
) {
  if (!APPS_SCRIPT_URL) {
    return { error: 'APPS_SCRIPT_URL não configurada', code: 503 }
  }

  const path = slug.join('/')
  const payload = {
    _method: method,
    _path: path,
    _token: token,
    ...searchParams,
    ...body,
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Apps Script redirects to a different URL — follow it
      redirect: 'follow',
    })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { error: text } }
  } catch (err: any) {
    return { error: err.message || 'Erro ao conectar com o backend' }
  }
}

function getToken(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') || ''
}

function getSearchParams(req: NextRequest): Record<string, string> {
  const result: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((value, key) => { result[key] = value })
  return result
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params
  const data = await proxy('GET', slug, getSearchParams(req), {}, getToken(req))
  const status = data?.code || (data?.error ? 400 : 200)
  return NextResponse.json(data, { status: status === 401 ? 401 : 200 })
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params
  const body = await req.json().catch(() => ({}))
  const data = await proxy('POST', slug, getSearchParams(req), body, getToken(req))
  const status = data?.code === 401 ? 401 : 200
  return NextResponse.json(data, { status })
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params
  const body = await req.json().catch(() => ({}))
  const data = await proxy('PUT', slug, getSearchParams(req), body, getToken(req))
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params
  const body = await req.json().catch(() => ({}))
  const data = await proxy('PUT', slug, getSearchParams(req), body, getToken(req))
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params
  const data = await proxy('DELETE', slug, getSearchParams(req), {}, getToken(req))
  return NextResponse.json(data)
}
