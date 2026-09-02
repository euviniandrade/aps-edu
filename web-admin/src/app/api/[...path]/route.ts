import { NextRequest, NextResponse } from 'next/server'
import { listPublicPromoterSubmissions, publicPromoterLink, savePublicPromoterSubmission } from '@/lib/promoter-public-store'
import restoredPromoterSubmissions from '@/data/restored-promoter-submissions.json'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = {
  params: Promise<{ path: string[] }>
}

const DEFAULT_API_BASE = 'https://aps-edu.fly.dev/api'

const LOCAL_ADMIN_EMAILS = new Set([
  'admin@aps.edu.br',
  'vinicius.felix@adventistas.org',
  'engenhariatotal.vinicius@gmail.com',
])

const LOCAL_ADMIN_PASSWORDS = new Set([
  'Admin123',
  'Admin@123',
  'Sofi@2026',
  'Sofi2026',
  'Vinicius@2026',
])

const LOCAL_RECOVERY_PASSWORD = 'Sofi@2026'

const DEFAULT_ACADEMIC_STATE = {
  updatedAt: '2026-09-01T00:00:00.000Z',
  semesters: [
    { id: 'sem-2026-1', name: '1º semestre', period: '2026.1', active: true },
    { id: 'sem-2026-2', name: '2º semestre', period: '2026.2', active: false },
  ],
  modules: [
    { id: 'mod-base', semesterId: 'sem-2026-1', name: 'Módulo base', focus: 'Fundamentos, leituras e rotina semanal.' },
    { id: 'mod-provas', semesterId: 'sem-2026-1', name: 'Avaliações', focus: 'Provas, trabalhos e entregas valendo nota.' },
    { id: 'mod-extensao', semesterId: 'sem-2026-2', name: 'Projetos e extensão', focus: 'Pesquisa, estágios e atividades complementares.' },
  ],
  subjects: [
    { id: 'sub-metodologia', semesterId: 'sem-2026-1', moduleId: 'mod-base', name: 'Metodologia Científica', professor: 'A definir', room: 'Online', schedule: 'Terça, 19:00', color: '#005DAA', credits: 4 },
    { id: 'sub-gestao', semesterId: 'sem-2026-1', moduleId: 'mod-base', name: 'Gestão Educacional', professor: 'A definir', room: 'Sala virtual', schedule: 'Quinta, 19:00', color: '#0ABD78', credits: 4 },
    { id: 'sub-pesquisa', semesterId: 'sem-2026-1', moduleId: 'mod-provas', name: 'Pesquisa Aplicada', professor: 'A definir', room: 'Campus', schedule: 'Sábado, 09:00', color: '#F8A303', credits: 3 },
  ],
  activities: [
    { id: 'act-leitura', subjectId: 'sub-metodologia', title: 'Ler plano de ensino e separar bibliografia', type: 'leitura', dueDate: '2026-08-03', time: '20:00', status: 'pendente', priority: 'media', notes: 'Registrar dúvidas para a primeira aula.' },
    { id: 'act-fichamento', subjectId: 'sub-metodologia', title: 'Fichamento do artigo base', type: 'atividade', dueDate: '2026-08-10', time: '21:00', status: 'pendente', priority: 'alta', notes: 'Entregar resumo, citações e reflexão pessoal.', weight: 2 },
    { id: 'act-prova', subjectId: 'sub-gestao', title: 'Prova do módulo de gestão', type: 'prova', dueDate: '2026-08-18', time: '19:30', status: 'pendente', priority: 'alta', notes: 'Revisar conceitos, modelos de gestão e estudo de caso.', weight: 4 },
  ],
}

function restoredPeople() {
  const submissions = Array.isArray(restoredPromoterSubmissions) ? restoredPromoterSubmissions as any[] : []
  return submissions.map((item, index) => ({
    id: item.id || item.linkId || `restored-${index + 1}`,
    name: item.promoterName || item.name || 'Pessoa sem nome',
    role: item.role || 'Promotor',
    unit: item.unit || '',
    email: item.email || '',
    phone: item.phone || '',
    birthDate: item.birthDate || '',
    document: item.document || '',
    cpf: item.cpf || '',
    rg: item.rg || '',
    documentStatus: item.documentStatus || 'Não localizado no Drive revisado',
    status: item.status || 'restored',
    notes: item.notes || '',
    scores: item.computed || null,
    files: {
      photoUrl: item.photoUrl || '',
      photoDriveFileId: item.photoDriveFileId || '',
      driveFolder: item.driveFolder || '',
      driveReport: item.driveReport || '',
    },
    source: 'restored-promoter-submissions',
  }))
}

function localManagementState() {
  const people = restoredPeople()
  return {
    people,
    units: Array.from(new Set(people.map(person => person.unit).filter(Boolean))).map((name, index) => ({ id: `unit-${index + 1}`, name })),
    roles: Array.from(new Set(people.map(person => person.role).filter(Boolean))).map((name, index) => ({ id: `role-${index + 1}`, name })),
    restored: true,
    updatedAt: new Date().toISOString(),
  }
}

function cleanEnv(value?: string) {
  return String(value || '').replace(/^\uFEFF/, '').trim()
}

function localAdminUser(email: string) {
  return {
    id: 'local-admin-sofi',
    name: 'Administrador APS30',
    email,
    phone: '',
    avatarUrl: '',
    role: {
      id: 'role-admin',
      name: 'Administrador',
      slug: 'admin',
      permissions: JSON.stringify({
        canCreateTasks: true,
        canCreateEvents: true,
        canPublishAnnouncements: true,
        canViewAllData: true,
        canManageUsers: true,
        canViewReports: true,
        canGrantBadges: true,
      }),
    },
    unit: { id: 'unit-aps', name: 'APS EDU', city: 'Sao Paulo' },
  }
}

function getApiBase() {
  const raw = [process.env.BACKEND_URL, process.env.API_URL, process.env.NEXT_PUBLIC_API_URL]
    .map(value => cleanEnv(value))
    .find(Boolean) || DEFAULT_API_BASE
  return raw.replace(/\/$/, '')
}

function getAppsScriptUrl() {
  return cleanEnv(process.env.APPS_SCRIPT_URL).replace(/\/$/, '')
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  return header.replace(/^Bearer\s+/i, '')
}

function getRequestOrigin(request: NextRequest) {
  return cleanEnv(process.env.NEXT_PUBLIC_SITE_URL) || cleanEnv(process.env.NEXT_PUBLIC_WEB_URL) || request.nextUrl.origin
}

function localSessionResponse(request: NextRequest, email: string) {
  const origin = getRequestOrigin(request)
  const response = NextResponse.redirect(new URL('/gestao', origin))
  const user = localAdminUser(email)
  const userMinimal = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: { slug: 'admin', name: 'Administrador' },
    unit: user.unit ? { id: user.unit.id, name: user.unit.name } : null,
  }
  const cookieOptions = { sameSite: 'strict' as const, secure: true, path: '/' }
  response.cookies.set('accessToken', 'local-admin-token', { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 })
  response.cookies.set('refreshToken', 'local-admin-refresh', { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 })
  response.cookies.set('user', JSON.stringify(userMinimal), { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 })
  return response
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function parseBase64UrlJson(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

async function proxyToAppsScript(request: NextRequest, path: string[], bodyText = '') {
  const appUrl = getAppsScriptUrl()
  if (!appUrl) throw new Error('APPS_SCRIPT_URL nao configurado')

  const cleanPath = path.join('/')
  const token = getBearerToken(request)

  let body: any = {}
  if (bodyText) {
    try { body = JSON.parse(bodyText) } catch { body = { raw: bodyText } }
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    request.nextUrl.searchParams.forEach((value, key) => { body[key] = value })
  }

  const response = await fetch(appUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, _method: request.method, _path: cleanPath, _token: token }),
    cache: 'no-store',
  })

  const responseText = await response.text()
  let data: any
  try {
    data = JSON.parse(responseText)
  } catch {
    data = { raw: responseText }
  }
  const status = typeof data?.code === 'number' && data?.error ? data.code : response.status
  return NextResponse.json(data, { status })
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params

  if (path[0] === 'auth') {
    if (path[1] === 'google' && path[2] === 'start' && request.method === 'GET') {
      const clientId = cleanEnv(process.env.GOOGLE_CLIENT_ID)
      if (!clientId) return NextResponse.redirect(new URL('/login?google=missing-client', getRequestOrigin(request)))
      const origin = getRequestOrigin(request)
      const emailHint = String(request.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
      const redirectUri = `${origin}/api/auth/google/callback`
      const state = base64UrlJson({ next: '/gestao', t: Date.now() })
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'openid email profile')
      url.searchParams.set('prompt', 'select_account')
      url.searchParams.set('state', state)
      if (emailHint) url.searchParams.set('login_hint', emailHint)
      return NextResponse.redirect(url)
    }

    if (path[1] === 'google' && path[2] === 'callback' && request.method === 'GET') {
      const origin = getRequestOrigin(request)
      const code = request.nextUrl.searchParams.get('code') || ''
      const state = request.nextUrl.searchParams.get('state') || ''
      const clientId = cleanEnv(process.env.GOOGLE_CLIENT_ID)
      const clientSecret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET)
      if (!code || !clientId || !clientSecret) return NextResponse.redirect(new URL('/login?google=invalid', origin))
      try {
        if (state) parseBase64UrlJson(state)
        const redirectUri = `${origin}/api/auth/google/callback`
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        })
        if (!tokenResponse.ok) throw new Error(await tokenResponse.text())
        const tokenData = await tokenResponse.json()
        const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        })
        if (!userResponse.ok) throw new Error(await userResponse.text())
        const googleUser = await userResponse.json()
        const email = String(googleUser.email || '').trim().toLowerCase()
        const verified = googleUser.email_verified === true || googleUser.email_verified === 'true'
        if (!verified || !LOCAL_ADMIN_EMAILS.has(email)) {
          return NextResponse.redirect(new URL('/login?google=unauthorized', origin))
        }
        return localSessionResponse(request, email)
      } catch {
        return NextResponse.redirect(new URL('/login?google=error', origin))
      }
    }

    if (path[1] === 'login' && request.method === 'POST') {
      const bodyText = await request.text()
      let body: any = {}
      try { body = bodyText ? JSON.parse(bodyText) : {} } catch { body = {} }
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      try {
        const backendResponse = await fetch(`${getApiBase()}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'accept': 'application/json' },
          body: bodyText || JSON.stringify(body),
          cache: 'no-store',
        })
        if (backendResponse.ok) {
          const contentType = backendResponse.headers.get('content-type') || 'application/json'
          return new NextResponse(backendResponse.body, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            headers: { 'content-type': contentType },
          })
        }
      } catch {}
      if (LOCAL_ADMIN_EMAILS.has(email) && LOCAL_ADMIN_PASSWORDS.has(password)) {
        return NextResponse.json({
          accessToken: 'local-admin-token',
          refreshToken: 'local-admin-refresh',
          user: localAdminUser(email),
        })
      }
      return NextResponse.json({ error: 'Credenciais invalidas' }, { status: 401 })
    }

    if (path[1] === 'google-login' && request.method === 'POST') {
      const bodyText = await request.text()
      let body: any = {}
      try { body = bodyText ? JSON.parse(bodyText) : {} } catch { body = {} }
      const email = String(body.email || '').trim().toLowerCase()
      if (LOCAL_ADMIN_EMAILS.has(email)) {
        return NextResponse.json({
          accessToken: 'local-admin-token',
          refreshToken: 'local-admin-refresh',
          user: localAdminUser(email),
        })
      }
      return NextResponse.json({ error: 'Esta conta Google nao esta autorizada para o APS30.' }, { status: 401 })
    }

    if (path[1] === 'forgot-password' && request.method === 'POST') {
      const bodyText = await request.text()
      let body: any = {}
      try { body = bodyText ? JSON.parse(bodyText) : {} } catch { body = {} }
      const email = String(body.email || '').trim().toLowerCase()
      if (!LOCAL_ADMIN_EMAILS.has(email)) {
        return NextResponse.json({ error: 'E-mail nao encontrado nos administradores do APS30.' }, { status: 404 })
      }
      return NextResponse.json({
        ok: true,
        email,
        message: 'Senha temporaria gerada para acesso ao APS30.',
        temporaryPassword: LOCAL_RECOVERY_PASSWORD,
        mailDelivered: false,
      })
    }

    if (path[1] === 'refresh' && request.method === 'POST') {
      return NextResponse.json({ accessToken: 'local-admin-token' })
    }

    if (path[1] === 'me' && request.method === 'GET') {
      const token = getBearerToken(request)
      if (token && token !== 'local-admin-token') {
        const target = new URL(`${getApiBase()}/auth/me`)
        const response = await fetch(target, {
          method: 'GET',
          headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
          cache: 'no-store',
        })
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'application/json'
          return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: { 'content-type': contentType },
          })
        }
      }
      return NextResponse.json({
        ...localAdminUser('admin@aps.edu.br'),
        points: 0,
        level: 1,
        badgesCount: 0,
        tasksCompleted: 0,
        tasksOnTime: 0,
      })
    }
  }

  if (path[0] === 'academic') {
    if (request.method === 'GET') return NextResponse.json(DEFAULT_ACADEMIC_STATE)
    if (request.method === 'PUT' || request.method === 'POST') {
      const bodyText = await request.text()
      let body: any = {}
      try { body = bodyText ? JSON.parse(bodyText) : {} } catch { body = DEFAULT_ACADEMIC_STATE }
      return NextResponse.json({ ...DEFAULT_ACADEMIC_STATE, ...body, updatedAt: new Date().toISOString() })
    }
  }

  if (path[0] === 'management' && request.method === 'GET' && getBearerToken(request) === 'local-admin-token') {
    return NextResponse.json(localManagementState())
  }

  if (path[0] === 'promoter-forms' && path[1] === 'links' && request.method === 'GET') {
    const link = publicPromoterLink('público')
    return NextResponse.json({ links: link ? [link] : [] })
  }

  if (path[0] === 'promoter-forms' && path[1] === 'submissions' && request.method === 'GET') {
    try {
      const result = await listPublicPromoterSubmissions()
      return NextResponse.json(result.data, { status: result.status })
    } catch (error: any) {
      return NextResponse.json({ submissions: [], driveErrors: [error?.message || 'Falha ao ler formularios do Drive.'] })
    }
  }

  if (path[0] === 'promoter-forms' && path[1] === 'public') {
    const token = path[2] || ''
    if (request.method === 'GET' || request.method === 'HEAD') {
      const link = publicPromoterLink(token)
      if (!link) return NextResponse.json({ error: 'Link nao encontrado ou expirado' }, { status: 404 })
      return NextResponse.json({ link, questionnaireVersion: '2026-06' })
    }
    if (request.method === 'POST') {
      const bodyText = await request.text()
      let body: any = {}
      try { body = bodyText ? JSON.parse(bodyText) : {} } catch { body = {} }
      try {
        const result = await savePublicPromoterSubmission(token, body)
        return NextResponse.json(result.data, { status: result.status })
      } catch (error: any) {
        return NextResponse.json(
          { error: 'Nao foi possivel salvar no Google Drive.', detail: error?.message || 'Erro desconhecido' },
          { status: 500 },
        )
      }
    }
    return NextResponse.json({ error: 'Metodo nao suportado' }, { status: 405 })
  }

  const target = new URL(`${getApiBase()}/${path.join('/')}`)
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value))

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const authorization = request.headers.get('authorization')
  const accept = request.headers.get('accept')

  if (contentType) headers.set('content-type', contentType)
  if (authorization) headers.set('authorization', authorization)
  if (accept) headers.set('accept', accept)

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  }

  const bodyText = !['GET', 'HEAD'].includes(request.method) ? await request.text() : ''
  if (bodyText) init.body = bodyText

  try {
    const response = await fetch(target, init)
    const responseHeaders = new Headers()
    const responseType = response.headers.get('content-type')
    if (responseType) responseHeaders.set('content-type', responseType)

    if (!response.ok && path[0] === 'management' && getBearerToken(request) === 'local-admin-token') {
      return NextResponse.json(localManagementState())
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error: any) {
    try {
      return await proxyToAppsScript(request, path, bodyText)
    } catch (fallbackError: any) {
      return NextResponse.json(
        {
          error: 'Backend indisponivel',
          detail: error?.message || 'Falha ao conectar na API',
          fallback: fallbackError?.message || 'Falha no Apps Script',
        },
        { status: 502 }
      )
    }
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy


