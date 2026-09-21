import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBase, getOAuthConfig, hasOAuthCredentials } from '../_lib'

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

  return NextResponse.json({
    providers: [
      {
        id: 'google',
        name: 'Google Workspace',
        services: ['Gmail', 'Google Drive', 'Google Agenda', 'Google Docs', 'Google Sheets'],
        envReady: hasOAuthCredentials(google),
        connected: false,
        verified: false,
        scopes: google.scopes,
        setup: google.envNames,
        connectUrl: '/api/integrations/oauth/start?provider=google',
        note: 'Entre na plataforma para validar a conexão no backend criptografado.',
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
      ready: Boolean(process.env.INTEGRATION_TOKEN_VAULT_URL || process.env.DATABASE_URL),
      detail: 'Para autonomia permanente da IA da Educação, tokens de refresh devem ficar em banco/secret vault criptografado, nao em localStorage.',
    },
  })
}

