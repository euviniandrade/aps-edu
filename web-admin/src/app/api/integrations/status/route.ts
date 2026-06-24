import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBase, getOAuthConfig, hasOAuthCredentials } from '../_lib'

export const runtime = 'nodejs'

function cookieConnected(request: NextRequest, provider: string) {
  return request.cookies.get(`aps_${provider}_connected`)?.value === '1'
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value
  if (accessToken) {
    try {
      const response = await fetch(`${getBackendApiBase()}/integrations/status`, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
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
        connected: cookieConnected(request, 'google'),
        scopes: google.scopes,
        setup: google.envNames,
        connectUrl: '/api/integrations/oauth/start?provider=google',
      },
      {
        id: 'microsoft',
        name: 'Microsoft 365',
        services: ['Outlook', 'OneDrive', 'Calendario Microsoft', 'SharePoint', 'Planner'],
        envReady: hasOAuthCredentials(microsoft),
        connected: cookieConnected(request, 'microsoft'),
        scopes: microsoft.scopes,
        setup: microsoft.envNames,
        connectUrl: '/api/integrations/oauth/start?provider=microsoft',
      },
      {
        id: 'icloud',
        name: 'Apple iCloud',
        services: ['Calendario iCloud', 'Contatos iCloud', 'Lembretes via CalDAV/CardDAV'],
        envReady: false,
        connected: request.cookies.get('aps_icloud_configured')?.value === '1',
        scopes: [],
        setup: ['APPLE_ID', 'ICLOUD_APP_SPECIFIC_PASSWORD', 'CalDAV/CardDAV token vault'],
        connectUrl: null,
        note: 'iCloud usa senha especifica de app e protocolos CalDAV/CardDAV; iCloud Drive nao oferece OAuth publico equivalente a Google Drive/OneDrive.',
      },
    ],
    tokenVault: {
      ready: Boolean(process.env.INTEGRATION_TOKEN_VAULT_URL || process.env.DATABASE_URL),
      detail: 'Para autonomia permanente da Sofi, tokens de refresh devem ficar em banco/secret vault criptografado, nao em localStorage.',
    },
  })
}
