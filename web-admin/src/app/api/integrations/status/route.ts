import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBase, getOAuthConfig, hasOAuthCredentials } from '../_lib'
import { readGoogleSession } from '../_session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value
  if (accessToken) {
    try {
      const response = await fetch(`${getBackendApiBase()}/integrations/status`, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      })
      if (response.ok) {
        return NextResponse.json(await response.json())
      }
    } catch {}
  }

  const google = getOAuthConfig('google')!
  const microsoft = getOAuthConfig('microsoft')!
  const googleSession = readGoogleSession(request)

  return NextResponse.json({
    providers: [
      {
        id: 'google',
        name: 'Google Workspace',
        services: ['Gmail', 'Google Drive', 'Google Agenda', 'Google Docs', 'Google Sheets'],
        envReady: hasOAuthCredentials(google),
        connected: Boolean(googleSession),
        verified: Boolean(googleSession),
        operational: Boolean(googleSession),
        account: googleSession?.account || null,
        scopes: google.scopes,
        setup: google.envNames,
        connectUrl: '/api/integrations/oauth/start?provider=google',
        note: googleSession
          ? 'Conexão protegida neste navegador e pronta para Agenda, Gmail e Drive.'
          : 'Conecte sua conta para ativar Agenda, Gmail e Drive.',
      },
      {
        id: 'microsoft',
        name: 'Microsoft 365',
        services: ['Outlook', 'OneDrive', 'Calendario Microsoft', 'SharePoint', 'Planner'],
        envReady: hasOAuthCredentials(microsoft),
        connected: false,
        verified: false,
        scopes: microsoft.scopes,
        setup: microsoft.envNames,
        connectUrl: '/api/integrations/oauth/start?provider=microsoft',
        note: 'Entre na plataforma para validar a conexão no backend criptografado.',
      },
      {
        id: 'icloud',
        name: 'Apple iCloud',
        services: ['Calendario iCloud', 'Contatos iCloud', 'Lembretes via CalDAV/CardDAV'],
        envReady: true,
        connected: false,
        verified: false,
        scopes: [],
        setup: ['APPLE_ID', 'ICLOUD_APP_SPECIFIC_PASSWORD', 'CalDAV/CardDAV token vault'],
        connectUrl: null,
        note: 'iCloud usa senha especifica de app e protocolos CalDAV/CardDAV; iCloud Drive nao oferece OAuth público equivalente a Google Drive/OneDrive.',
      },
    ],
    tokenVault: {
      ready: Boolean(googleSession || process.env.INTEGRATION_TOKEN_VAULT_URL || process.env.DATABASE_URL),
      detail: googleSession
        ? 'A autorização do Google está criptografada em cookie HttpOnly e é renovada automaticamente.'
        : 'Conecte o Google Workspace para criar uma sessão criptografada; nenhum token é salvo no localStorage.',
    },
  })
}

