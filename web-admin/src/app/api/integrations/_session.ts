import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export type GoogleIntegrationSession = {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope?: string
  account?: string
}

const COOKIE_NAME = 'aps_google_integration'

function encryptionKey() {
  const secret = process.env.INTEGRATION_COOKIE_SECRET
    || process.env.GOOGLE_CLIENT_SECRET
    || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Segredo de integração não configurado')
  return createHash('sha256').update(secret).digest()
}

export function sealGoogleSession(value: GoogleIntegrationSession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function readGoogleSession(request: NextRequest): GoogleIntegrationSession | null {
  const raw = request.cookies.get(COOKIE_NAME)?.value
  if (!raw) return null
  try {
    const payload = Buffer.from(raw, 'base64url')
    const iv = payload.subarray(0, 12)
    const tag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'))
  } catch {
    return null
  }
}

export function writeGoogleSession(response: NextResponse, session: GoogleIntegrationSession) {
  response.cookies.set(COOKIE_NAME, sealGoogleSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export function clearGoogleSession(response: NextResponse) {
  response.cookies.delete(COOKIE_NAME)
}

export async function getGoogleAccess(request: NextRequest) {
  const session = readGoogleSession(request)
  if (!session) throw new Error('Google Workspace ainda não está conectado.')
  if (session.expiresAt > Date.now() + 60_000) {
    return { accessToken: session.accessToken, session, refreshed: false }
  }
  if (!session.refreshToken) throw new Error('A autorização do Google expirou. Conecte novamente.')

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error('Credenciais do Google não configuradas.')

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const tokenData = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error('Não foi possível renovar a autorização do Google.')
  }

  const nextSession: GoogleIntegrationSession = {
    ...session,
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
    scope: tokenData.scope || session.scope,
  }
  return { accessToken: nextSession.accessToken, session: nextSession, refreshed: true }
}

export function attachRefreshedGoogleSession(
  response: NextResponse,
  access: Awaited<ReturnType<typeof getGoogleAccess>>,
) {
  if (access.refreshed) writeGoogleSession(response, access.session)
  return response
}

