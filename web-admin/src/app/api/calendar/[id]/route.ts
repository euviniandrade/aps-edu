import { NextRequest, NextResponse } from 'next/server'
import { attachRefreshedGoogleSession, getGoogleAccess } from '../../integrations/_session'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const access = await getGoogleAccess(request)
    const { id } = await context.params
    const payload = await request.json()
    const googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${access.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(payload.title ? { summary: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.location !== undefined ? { location: payload.location } : {}),
        ...(payload.start ? { start: { dateTime: payload.start, timeZone: payload.timeZone || 'America/Sao_Paulo' } } : {}),
        ...(payload.end ? { end: { dateTime: payload.end, timeZone: payload.timeZone || 'America/Sao_Paulo' } } : {}),
      }),
    })
    const data = await googleResponse.json().catch(() => ({}))
    if (!googleResponse.ok) throw new Error(data?.error?.message || 'Não foi possível atualizar o compromisso.')
    return attachRefreshedGoogleSession(NextResponse.json({ provider: 'google', event: data }), access)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao atualizar compromisso.' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const access = await getGoogleAccess(request)
    const { id } = await context.params
    const googleResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${access.accessToken}` },
    })
    if (!googleResponse.ok && googleResponse.status !== 410) {
      const data = await googleResponse.json().catch(() => ({}))
      throw new Error(data?.error?.message || 'Não foi possível excluir o compromisso.')
    }
    return attachRefreshedGoogleSession(NextResponse.json({ ok: true }), access)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao excluir compromisso.' }, { status: 400 })
  }
}

