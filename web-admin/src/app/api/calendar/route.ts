import { NextRequest, NextResponse } from 'next/server'
import { attachRefreshedGoogleSession, getGoogleAccess } from '../integrations/_session'

export const runtime = 'nodejs'

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Não foi possível acessar o Google Agenda.'
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(request: NextRequest) {
  try {
    const access = await getGoogleAccess(request)
    const from = request.nextUrl.searchParams.get('from') || new Date().toISOString()
    const days = Number(request.nextUrl.searchParams.get('days') || 30)
    const to = request.nextUrl.searchParams.get('to')
      || new Date(Date.now() + Math.max(1, days) * 86_400_000).toISOString()
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    url.searchParams.set('timeMin', from)
    url.searchParams.set('timeMax', to)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')
    const googleResponse = await fetch(url, {
      headers: { authorization: `Bearer ${access.accessToken}` },
      cache: 'no-store',
    })
    const data = await googleResponse.json().catch(() => ({}))
    if (!googleResponse.ok) throw new Error(data?.error?.message || 'Google Agenda recusou a consulta.')
    const events = (data.items || []).map((item: any) => ({
      provider: 'google',
      id: item.id,
      title: item.summary || 'Compromisso sem título',
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      location: item.location || '',
      description: item.description || '',
      url: item.htmlLink || '',
      calendar: 'Google Agenda',
      calendarColor: '#4285F4',
    }))
    return attachRefreshedGoogleSession(NextResponse.json({ events }), access)
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getGoogleAccess(request)
    const payload = await request.json()
    if (!payload?.title || !payload?.start || !payload?.end) {
      return NextResponse.json({ error: 'Título, início e fim são obrigatórios.' }, { status: 400 })
    }
    const googleResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${access.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        summary: payload.title,
        description: payload.description || '',
        location: payload.location || '',
        start: { dateTime: payload.start, timeZone: payload.timeZone || 'America/Sao_Paulo' },
        end: { dateTime: payload.end, timeZone: payload.timeZone || 'America/Sao_Paulo' },
      }),
    })
    const data = await googleResponse.json().catch(() => ({}))
    if (!googleResponse.ok) throw new Error(data?.error?.message || 'Não foi possível criar o compromisso.')
    return attachRefreshedGoogleSession(NextResponse.json({ provider: 'google', event: data }, { status: 201 }), access)
  } catch (error) {
    return apiError(error)
  }
}

