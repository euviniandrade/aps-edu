import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BACKEND_URL = 'https://aps-whatsapp.onrender.com'
const API_KEY = 'aps-edu-whatsapp'

export async function GET(req: NextRequest) {
  try {
    const path = '/status'
    const url = `${BACKEND_URL}${path}`

    const headers = {
      'x-api-key': API_KEY,
      'ngrok-skip-browser-warning': 'true',
    }

    const response = await fetch(url, {
      headers,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
}
