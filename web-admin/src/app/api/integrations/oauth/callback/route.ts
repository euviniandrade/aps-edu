import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBase, getOAuthConfig, getOrigin, getRedirectUri, hasOAuthCredentials, setupRedirect } from '../../_lib'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider') || ''
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')
  const config = getOAuthConfig(provider)

  if (!config) return setupRedirect(request, provider || 'unknown', 'unsupported_provider')
  if (!hasOAuthCredentials(config)) return setupRedirect(request, config.provider, 'missing_credentials')
  if (error) return setupRedirect(request, config.provider, error)

  const expectedState = request.cookies.get(`aps_${config.provider}_oauth_state`)?.value
  if (!code || !state || !expectedState || state !== expectedState) {
    return setupRedirect(request, config.provider, 'invalid_state')
  }

  const body = new URLSearchParams()
  body.set('client_id', config.clientId!)
  body.set('client_secret', config.clientSecret!)
  body.set('code', code)
  body.set('redirect_uri', getRedirectUri(request, config.provider))
  body.set('grant_type', 'authorization_code')

  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  const tokenData = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok) {
    const detail = tokenData?.error || tokenData?.error_description || 'token_exchange_failed'
    return setupRedirect(request, config.provider, String(detail).slice(0, 80))
  }

  const url = new URL('/inovacao', getOrigin(request))
  url.searchParams.set('tab', 'sobre')
  url.searchParams.set('integration', config.provider)
  url.searchParams.set('connected', '1')

  const accessToken = request.cookies.get('accessToken')?.value
  if (accessToken) {
    try {
      await fetch(`${getBackendApiBase()}/integrations/oauth/store`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider,
          tokenData,
        }),
      })
    } catch {}
  }

  const response = NextResponse.redirect(url)
  response.cookies.delete(`aps_${config.provider}_oauth_state`)
  response.cookies.set(`aps_${config.provider}_connected`, '1', {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  response.cookies.set(`aps_${config.provider}_token_ready`, tokenData.refresh_token ? 'refresh_token_received' : 'access_token_only', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
