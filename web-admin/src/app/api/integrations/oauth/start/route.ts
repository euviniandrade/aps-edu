import { NextRequest, NextResponse } from 'next/server'
import { getOAuthConfig, getRedirectUri, hasOAuthCredentials, setupRedirect } from '../../_lib'

export const runtime = 'nodejs'

function randomState() {
  return crypto.randomUUID()
}

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider') || ''
  const config = getOAuthConfig(provider)

  if (!config) {
    return setupRedirect(request, provider || 'unknown', 'unsupported_provider')
  }

  if (!hasOAuthCredentials(config)) {
    return setupRedirect(request, config.provider, 'missing_credentials')
  }

  const state = randomState()
  const redirectUri = getRedirectUri(request, config.provider)
  const url = new URL(config.authorizeUrl)

  url.searchParams.set('client_id', config.clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes.join(' '))
  url.searchParams.set('state', state)

  if (config.provider === 'google') {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
  }

  if (config.provider === 'microsoft') {
    url.searchParams.set('response_mode', 'query')
    url.searchParams.set('prompt', 'select_account')
  }

  const response = NextResponse.redirect(url)
  response.cookies.set(`aps_${config.provider}_oauth_state`, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 10 * 60,
    path: '/',
  })

  return response
}

