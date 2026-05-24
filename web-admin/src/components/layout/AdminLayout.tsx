'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'
import {
  HomeIcon, UsersIcon, CheckCircleIcon, CalendarDaysIcon,
  MegaphoneIcon, TrophyIcon, ChartBarIcon,
  ChatBubbleLeftEllipsisIcon, KeyIcon, BuildingLibraryIcon,
  ArrowRightOnRectangleIcon, Bars3Icon, BellIcon,
  ChevronRightIcon, MagnifyingGlassIcon, XMarkIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import AiAssistant from '@/components/ai/AiAssistant'
import {
  HomeIcon as HomeIconSolid, UsersIcon as UsersIconSolid,
  CheckCircleIcon as CheckIconSolid, CalendarDaysIcon as CalendarIconSolid,
  MegaphoneIcon as MegaphoneIconSolid, TrophyIcon as TrophyIconSolid,
  ChartBarIcon as ChartIconSolid,
  ChatBubbleLeftEllipsisIcon as ChatIconSolid,
  KeyIcon as KeyIconSolid, BuildingLibraryIcon as BuildingIconSolid,
  UserGroupIcon as UserGroupIconSolid,
} from '@heroicons/react/24/solid'

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',   icon: HomeIcon,                      iconSolid: HomeIconSolid,     color: '#F8A303', roles: [] },
  { href: '/meu-dia',       label: 'Meu Dia',      icon: CalendarDaysIcon,              iconSolid: CalendarIconSolid, color: '#4A9EFF', roles: [] },
  { href: '/tasks',         label: 'Tarefas',      icon: CheckCircleIcon,               iconSolid: CheckIconSolid,    color: '#0ABD78', roles: [] },
  { href: '/events',        label: 'Eventos',      icon: CalendarDaysIcon,              iconSolid: CalendarIconSolid, color: '#8B5CF6', roles: [] },
  { href: '/announcements', label: 'Mural',        icon: MegaphoneIcon,                 iconSolid: MegaphoneIconSolid,color: '#29ABE2', roles: [] },
  { href: '/gamification',  label: 'Gamificação',  icon: TrophyIcon,                    iconSolid: TrophyIconSolid,   color: '#F9C234', roles: [] },
  { href: '/reports',       label: 'Relatórios',   icon: ChartBarIcon,                  iconSolid: ChartIconSolid,    color: '#E07B39', roles: ['leader', 'admin'] },
  { href: '/feedback',      label: 'Feedback',     icon: ChatBubbleLeftEllipsisIcon,    iconSolid: ChatIconSolid,     color: '#FF4757', roles: [] },
  { href: '/promotores',    label: 'Promotores',   icon: UserGroupIcon,                 iconSolid: UserGroupIconSolid, color: '#29ABE2', roles: ['admin'] },
  { href: '/users',         label: 'Usuários',     icon: UsersIcon,                     iconSolid: UsersIconSolid,    color: '#4A9EFF', roles: ['admin'] },
  { href: '/roles',         label: 'Cargos',       icon: KeyIcon,                       iconSolid: KeyIconSolid,      color: '#A78BFA', roles: ['admin'] },
  { href: '/units',         label: 'Unidades',     icon: BuildingLibraryIcon,           iconSolid: BuildingIconSolid, color: '#34D399', roles: ['admin'] },
]

// Item exclusivo do admin — ícone reutilizado do KeyIcon com cor dourada especial
const myAreaItem = { href: '/minha-area', label: '⚡ Sofi IA', icon: KeyIcon, iconSolid: KeyIconSolid, color: '#FDC347' }

function getRoleLevel(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('admin') || r.includes('administrador')) return 'admin'
  if (r.includes('leader') || r.includes('lider') || r.includes('director') || r.includes('diretor') ||
      r.includes('coordinator') || r.includes('coordenador')) return 'leader'
  return 'member'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleLogout = () => {
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
    Cookies.remove('user')
    localStorage.removeItem('token')
    router.push('/login')
  }

  const currentPage = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  let user: any = null
  try {
    const userCookie = typeof window !== 'undefined' ? Cookies.get('user') : null
    if (userCookie) user = JSON.parse(decodeURIComponent(userCookie))
  } catch (_) {
    try {
      const userCookie = typeof window !== 'undefined' ? Cookies.get('user') : null
      if (userCookie) user = JSON.parse(userCookie)
    } catch (_2) { user = null }
  }
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A'
  const userName = user?.name ?? 'Administrador'
  const userRoleName = user?.role?.name ?? user?.role ?? 'Admin'
  const userRole = userRoleName
  const roleLevel = getRoleLevel(typeof userRoleName === 'string' ? userRoleName : 'member')

  const visibleNavItems = navItems.filter(item => {
    if (!item.roles || item.roles.length === 0) return true
    if (item.roles.includes('admin') && roleLevel !== 'admin') return false
    if (item.roles.includes('leader') && roleLevel !== 'admin' && roleLevel !== 'leader') return false
    return true
  })

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* ── BACKGROUND ORBS ──────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="glow-orb animate-orb"
          style={{
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(27,58,107,0.25) 0%, transparent 70%)',
            top: -200, left: -200,
          }}
        />
        <div
          className="glow-orb animate-orb"
          style={{
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(248,163,3,0.08) 0%, transparent 70%)',
            bottom: -150, right: -100,
            animationDelay: '-4s',
          }}
        />
      </div>

      {/* ── MOBILE OVERLAY ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════════════════ */}
      <aside
        style={{
          width: 256,
          background: 'var(--bg-sidebar)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '4px 0 40px rgba(0,0,0,0.4)',
        }}
        className={`fixed inset-y-0 left-0 z-30 flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* ── LOGO AREA ───────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="relative flex-shrink-0">
            <img
              src="/aps30-logo.png"
              alt="APS30"
              className="w-10 h-10 object-contain"
              style={{ filter: 'drop-shadow(0 0 8px rgba(248,163,3,0.4))' }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">
              Educação Adventista
            </p>
            <p
              className="text-[10px] font-semibold tracking-[0.16em] truncate mt-0.5 uppercase"
              style={{ color: 'var(--gold)', opacity: 0.8 }}
            >
              APS Sul
            </p>
          </div>
        </div>

        {/* ── MINHA ÁREA — destaque exclusivo ─────────── */}
        <div className="px-3 pt-3 pb-2">
          <Link
            href="/minha-area"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(248,163,3,0.18) 0%, rgba(253,195,71,0.08) 100%)',
              border: '1px solid rgba(248,163,3,0.35)',
              boxShadow: '0 4px 20px rgba(248,163,3,0.12)',
            }}
          >
            {/* Shimmer */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(248,163,3,0.08) 50%, transparent 70%)', backgroundSize: '200% 100%' }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg relative z-10"
              style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', boxShadow: '0 0 14px rgba(248,163,3,0.4)' }}>
              ⚡
            </div>
            <div className="min-w-0 relative z-10">
              <p className="text-sm font-extrabold leading-none" style={{ color: '#FDC347' }}>Minha Área</p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(248,163,3,0.55)' }}>
                Tarefas · Senhas · Conquistas
              </p>
            </div>
            <div className="ml-auto relative z-10 flex-shrink-0">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#F8A303' }} />
            </div>
          </Link>
        </div>

        {/* ── NAVIGATION ──────────────────────────────── */}
        <nav className="flex-1 py-2 px-3 overflow-y-auto">
          <p className="section-label px-3 mb-3">Menu</p>

          <ul className="space-y-0.5">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = isActive ? item.iconSolid : item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                               transition-all duration-200 group relative"
                    style={{
                      background: isActive ? `${item.color}18` : 'transparent',
                      color: isActive ? item.color : 'rgba(255,255,255,0.55)',
                      boxShadow: isActive ? `inset 3px 0 0 ${item.color}` : 'none',
                    }}
                  >
                    <Icon
                      className="flex-shrink-0 transition-all duration-200"
                      style={{
                        width: 18, height: 18,
                        color: isActive ? item.color : 'rgba(255,255,255,0.4)',
                      }}
                    />
                    <span
                      className="text-sm font-medium flex-1 transition-colors"
                      style={{ color: isActive ? item.color : 'rgba(255,255,255,0.7)' }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <ChevronRightIcon
                        style={{ width: 13, height: 13, color: item.color, opacity: 0.7 }}
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ── USER + LOGOUT ────────────────────────────── */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* User card */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center
                         text-xs font-bold flex-shrink-0 text-black"
              style={{
                background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                boxShadow: '0 0 10px rgba(248,163,3,0.4)',
              }}
            >
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{userName}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{userRole}</p>
            </div>
          </div>

          {/* Settings */}
          <Link
            href="/configuracoes"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all hover:bg-white/5 group"
          >
            <span style={{ width: 17, height: 17, color: 'rgba(255,255,255,0.35)', fontSize: 16, lineHeight: '17px' }}>⚙️</span>
            <span className="text-sm font-medium group-hover:text-white/70 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Configurações
            </span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                       transition-all hover:bg-white/5 group"
          >
            <ArrowRightOnRectangleIcon
              style={{ width: 17, height: 17, color: 'rgba(255,255,255,0.35)' }}
              className="group-hover:text-white/70 transition-colors"
            />
            <span
              className="text-sm font-medium group-hover:text-white/70 transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Sair
            </span>
          </button>
        </div>

        {/* ── APS30 COLOR BAND ─────────────────────────── */}
        <div className="flex h-0.5">
          <div className="flex-1" style={{ background: '#F9C234' }} />
          <div className="flex-1" style={{ background: '#29ABE2' }} />
          <div className="flex-1" style={{ background: '#E07B39' }} />
          <div className="flex-1" style={{ background: '#1B5FAD' }} />
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          MAIN AREA
          ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">

        {/* ── TOP BAR ─────────────────────────────────── */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
          style={{
            background: 'var(--bg-topbar)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <Bars3Icon className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs hidden sm:block"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                Educação Adventista
              </span>
              {currentPage && (
                <>
                  <ChevronRightIcon
                    className="w-3 h-3 hidden sm:block"
                    style={{ color: 'rgba(255,255,255,0.15)' }}
                  />
                  <span
                    className="text-sm font-bold"
                    style={{ color: currentPage.color }}
                  >
                    {currentPage.label}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {searchOpen
                ? <XMarkIcon className="w-5 h-5" />
                : <MagnifyingGlassIcon className="w-5 h-5" />
              }
            </button>

            {/* Search input */}
            {searchOpen && (
              <input
                autoFocus
                type="text"
                placeholder="Buscar..."
                className="animate-scale-in text-sm px-3 py-1.5 rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  width: 200,
                }}
              />
            )}

            {/* Bell */}
            <button
              className="relative p-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <BellIcon className="w-5 h-5" />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse-dot"
                style={{ background: 'var(--gold)' }}
              />
            </button>

            {/* Avatar */}
            <div
              className="flex items-center gap-2.5 pl-3"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center
                           text-xs font-bold text-black flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                  boxShadow: '0 0 12px rgba(248,163,3,0.35)',
                }}
              >
                {userInitial}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-none" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {userName}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {userRole}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── DOT GRID TEXTURE ────────────────────────── */}
        <div className="absolute inset-0 dot-grid pointer-events-none" style={{ zIndex: -1 }} />

        {/* ── PAGE CONTENT ────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>

      {/* ── AI ASSISTANT FLOAT ──────────────────────── */}
      <AiAssistant />
    </div>
  )
}
