import { NextRequest, NextResponse } from 'next/server'
import { attachRefreshedGoogleSession, getGoogleAccess } from '../integrations/_session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const access = await getGoogleAccess(request)
    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 8)))
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('pageSize', String(limit))
    url.searchParams.set('orderBy', 'modifiedTime desc')
    url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)')
    url.searchParams.set('q', 'trashed = false')
    const googleResponse = await fetch(url, { headers: { authorization: `Bearer ${access.accessToken}` }, cache: 'no-store' })
    const data = await googleResponse.json().catch(() => ({}))
    if (!googleResponse.ok) throw new Error(data?.error?.message || 'Não foi possível consultar o Google Drive.')
    const files = (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      modifiedAt: file.modifiedTime,
      url: file.webViewLink,
      mimeType: file.mimeType,
      icon: file.mimeType === 'application/vnd.google-apps.folder' ? 'Pasta' : 'Arquivo',
    }))
    return attachRefreshedGoogleSession(NextResponse.json(files), access)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao consultar o Drive.' }, { status: 400 })
  }
}

