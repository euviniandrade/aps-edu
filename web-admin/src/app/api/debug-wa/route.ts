import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = 'https://aps-whatsapp.onrender.com/status'
    const headers = {
      'x-api-key': 'aps-edu-whatsapp',
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'curl/7.68.0',
      'Accept': '*/*',
    }

    console.log('[Debug WA] Fetching', url)
    console.log('[Debug WA] Headers:', headers)

    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    console.log('[Debug WA] Response status:', response.status)
    console.log('[Debug WA] Response headers:', Object.fromEntries(response.headers))

    const text = await response.text()
    console.log('[Debug WA] Response body:', text.substring(0, 200))

    return NextResponse.json({
      url,
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: text.substring(0, 500),
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
