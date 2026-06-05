import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BACKEND = 'https://aps-whatsapp.onrender.com'
const API_KEY = 'aps-edu-whatsapp'

export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.replace('/api/whatsapp-live-simple', '')
    const url = new URL(`${BACKEND}${path}${req.nextUrl.search}`)

    const res = await fetch(url.toString(), {
      headers: {
        'x-api-key': API_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => null)
    return NextResponse.json(data || {}, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.replace('/api/whatsapp-live-simple', '')
    const body = await req.json().catch(() => ({}))
    const url = new URL(`${BACKEND}${path}`)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await res.json().catch(() => null)
    return NextResponse.json(data || {}, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
