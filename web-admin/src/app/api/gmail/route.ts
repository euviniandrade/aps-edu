import { NextRequest, NextResponse } from 'next/server'
import { attachRefreshedGoogleSession, getGoogleAccess } from '../integrations/_session'

export const runtime = 'nodejs'

function header(headers: any[] = [], name: string) {
  return headers.find(item => String(item.name).toLowerCase() === name.toLowerCase())?.value || ''
}

export async function GET(request: NextRequest) {
  try {
    const access = await getGoogleAccess(request)
    const limit = Math.min(25, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 8)))
    const q = request.nextUrl.searchParams.get('q') || 'newer_than:7d'
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    listUrl.searchParams.set('maxResults', String(limit))
    listUrl.searchParams.set('q', q)
    const listResponse = await fetch(listUrl, { headers: { authorization: `Bearer ${access.accessToken}` }, cache: 'no-store' })
    const list = await listResponse.json().catch(() => ({}))
    if (!listResponse.ok) throw new Error(list?.error?.message || 'Não foi possível consultar o Gmail.')
    const emails = await Promise.all((list.messages || []).map(async (message: any) => {
      const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { authorization: `Bearer ${access.accessToken}` },
        cache: 'no-store',
      })
      const detail = await detailResponse.json().catch(() => ({}))
      const headers = detail.payload?.headers || []
      return {
        id: detail.id || message.id,
        subject: header(headers, 'Subject') || 'Sem assunto',
        from: header(headers, 'From'),
        date: header(headers, 'Date'),
        snippet: detail.snippet || '',
        unread: Array.isArray(detail.labelIds) && detail.labelIds.includes('UNREAD'),
      }
    }))
    return attachRefreshedGoogleSession(NextResponse.json(emails), access)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao consultar o Gmail.' }, { status: 400 })
  }
}

