import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BACKEND_URL = 'https://aps-whatsapp.onrender.com'
const API_KEY = 'aps-edu-whatsapp'

export async function GET(req: NextRequest) {
  try {
    const url = `${BACKEND_URL}/status`

    const headers: Record<string, string> = {
      'x-api-key': API_KEY,
      'ngrok-skip-browser-warning': 'true',
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type')
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
