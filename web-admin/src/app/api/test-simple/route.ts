import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Test OK',
    timestamp: new Date().toISOString(),
    version: '1.0'
  })
}
