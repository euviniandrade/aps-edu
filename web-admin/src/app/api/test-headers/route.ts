import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries())

  return NextResponse.json({
    method: req.method,
    pathname: req.nextUrl.pathname,
    headers: {
      ...headers,
      authorization: headers.authorization ? '***' : 'missing',
    }
  })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
