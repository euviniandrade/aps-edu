import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PAGE_PREFIXES = [
  '/login',
  '/promotores/form',
]

const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/promoter-forms/public',
]

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public') ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|css|js|map|txt|xml)$/i)
  )
}

function isPublicPage(pathname: string) {
  return PUBLIC_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const decodedPathname = decodeURIComponent(pathname)

  if (decodedPathname === '/inovação') {
    const url = request.nextUrl.clone()
    url.pathname = '/inovacao'
    return NextResponse.redirect(url)
  }

  if (decodedPathname === '/configurações') {
    const url = request.nextUrl.clone()
    url.pathname = '/configuracoes'
    return NextResponse.redirect(url)
  }

  if (decodedPathname === '/notificações') {
    const url = request.nextUrl.clone()
    url.pathname = '/notificacoes'
    return NextResponse.redirect(url)
  }

  if (isPublicAsset(pathname) || isPublicPage(pathname) || isPublicApi(pathname)) {
    return NextResponse.next()
  }

  const hasAccessToken = Boolean(request.cookies.get('accessToken')?.value)
  if (hasAccessToken) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!.*\\.).*)'],
}
