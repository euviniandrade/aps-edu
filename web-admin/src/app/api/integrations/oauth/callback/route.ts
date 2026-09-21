import { NextRequest, NextResponse } from 'next/server'
import { getBackendApiBase, getOAuthConfig, getOrigin, getRedirectUri, hasOAuthCredentials, setupRedirect } from '../../_lib'
import { writeGoogleSession } from '../../_session'

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

  const url = new URL('/integracoes', getOrigin(request))
  url.searchParams.set('integration', config.provider)

  const accessToken = request.cookies.get('accessToken')?.value
  let stored = false
  if (accessToken) {
    try {
      const storeResponse = await fetch(`${getBackendApiBase()}/integrations/oauth/store`, {
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
      stored = storeResponse.ok
    } catch {}
  }

  let googleAccount = ''
  if (config.provider === 'google' && tokenData.access_token) {
    try {
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { authorization: `Bearer ${tokenData.access_token}` },
        cache: 'no-store',
      })
      if (profileResponse.ok) {
        const profile = await profileResponse.json()
        googleAccount = String(profile.email || '')
      }
    } catch {}
  }

  const storedLocally = config.provider === 'google' && Boolean(tokenData.access_token)

  if (!stored && !storedLocally) {
    url.searchParams.set('setup', accessToken ? 'token_store_failed' : 'login_required')
  } else {
    url.searchParams.set('connected', '1')
  }

  const response = NextResponse.redirect(url)
  response.cookies.delete(`aps_${config.provider}_oauth_state`)
  if (stored || storedLocally) {
    response.cookies.set(`aps_${config.provider}_token_ready`, tokenData.refresh_token ? 'refresh_token_received' : 'access_token_only', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    if (storedLocally) {
      writeGoogleSession(response, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
        scope: tokenData.scope,
        account: googleAccount,
      })
    }
  } else {
    response.cookies.delete(`aps_${config.provider}_token_ready`)
  }

  return response
}
