import { NextResponse } from 'next/server'

export async function GET() {
  const BACKEND_URL = 'https://aps-whatsapp.onrender.com'
  const API_KEY = 'aps-edu-whatsapp'

  try {
    const headers = {
      'x-api-key': API_KEY,
      'ngrok-skip-browser-warning': 'true',
    }

    const response = await fetch(`${BACKEND_URL}/status`, {
      headers,
      cache: 'no-store',
    })

    const text = await response.text()

    return NextResponse.json({
      rendered_url: `${BACKEND_URL}/status`,
      rendered_headers: headers,
      response_status: response.status,
      response_headers: Object.fromEntries(response.headers.entries()),
      response_body_preview: text.substring(0, 200),
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 })
  }
}
