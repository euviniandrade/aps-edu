import { NextRequest, NextResponse } from 'next/server'

export type IntegrationProvider = 'google' | 'microsoft'

type OAuthConfig = {
  provider: IntegrationProvider
  label: string
  clientId?: string
  clientSecret?: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
  envNames: string[]
}

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
]

const MICROSOFT_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Files.ReadWrite.All',
]

function cleanEnv(value?: string) {
  return value?.replace(/^\uFEFF/, '').trim()
}

export function getOrigin(request: NextRequest) {
  const siteUrl = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL)
  const productionUrl = cleanEnv(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  return siteUrl
    || productionUrl && `https://${productionUrl}`
    || request.nextUrl.origin
}

export function getBackendApiBase() {
  return (cleanEnv(process.env.BACKEND_URL)
    || cleanEnv(process.env.API_URL)
    || cleanEnv(process.env.NEXT_PUBLIC_API_URL)
    || 'https://aps-edu.fly.dev/api').replace(/\/$/, '')
}

export function getOAuthConfig(provider: string): OAuthConfig | null {
  if (provider === 'google') {
    return {
      provider: 'google',
      label: 'Google Workspace',
      clientId: cleanEnv(process.env.GOOGLE_CLIENT_ID),
      clientSecret: cleanEnv(process.env.GOOGLE_CLIENT_SECRET),
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: GOOGLE_SCOPES,
      envNames: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    }
  }

  if (provider === 'microsoft') {
    const tenant = cleanEnv(process.env.MICROSOFT_TENANT_ID) || 'common'
    return {
      provider: 'microsoft',
      label: 'Microsoft 365',
      clientId: cleanEnv(process.env.MICROSOFT_CLIENT_ID),
      clientSecret: cleanEnv(process.env.MICROSOFT_CLIENT_SECRET),
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      scopes: MICROSOFT_SCOPES,
      envNames: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'],
    }
  }

  return null
}

export function getRedirectUri(request: NextRequest, provider: IntegrationProvider) {
  return `${getOrigin(request)}/api/integrations/oauth/callback?provider=${provider}`
}

export function hasOAuthCredentials(config: OAuthConfig) {
  return Boolean(config.clientId && config.clientSecret)
}

export function setupRedirect(request: NextRequest, provider: string, reason = 'missing_credentials') {
  const url = new URL('/inovacao', getOrigin(request))
  url.searchParams.set('tab', 'sobre')
  url.searchParams.set('integration', provider)
  url.searchParams.set('setup', reason)
  return NextResponse.redirect(url)
}
