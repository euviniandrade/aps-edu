'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'
import CommandPalette from '@/components/ui/CommandPalette'
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

// Nav organizado em seções
const navSections = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard',     label: 'Dashboard',    icon: HomeIcon,                   iconSolid: HomeIconSolid,      color: '#F8A303', roles: [] },
      { href: '/meu-dia',       label: 'Meu Dia',      icon: CalendarDaysIcon,           iconSolid: CalendarIconSolid,  color: '#4A9EFF', roles: [] },
      { href: '/notificacoes',  label: 'Notificações', icon: BellIcon,                   iconSolid: BellIcon,           color: '#FF4757', roles: [] },
    ],
  },
  {
    label: 'Trabalho',
    items: [
      { href: '/tasks',         label: 'Tarefas',      icon: CheckCircleIcon,            iconSolid: CheckIconSolid,     color: '#0ABD78', roles: [] },
      { href: '/events',        label: 'Eventos',      icon: CalendarDaysIcon,           iconSolid: CalendarIconSolid,  color: '#8B5CF6', roles: [] },
      { href: '/announcements', label: 'Mural',        icon: MegaphoneIcon,              iconSolid: MegaphoneIconSolid, color: '#29ABE2', roles: [] },
      { href: '/feedback',      label: 'Feedback',     icon: ChatBubbleLeftEllipsisIcon, iconSolid: ChatIconSolid,      color: '#FF4757', roles: [] },
      { href: '/gamification',  label: 'Gamificação',  icon: TrophyIcon,                 iconSolid: TrophyIconSolid,    color: '#F9C234', roles: [] },
    ],
  },
  {
    label: 'Inteligência IA',
    items: [
      { href: '/analytics',     label: 'Analytics IA', icon: ChartBarIcon,               iconSolid: ChartIconSolid,     color: '#F9C234', roles: [] },
      { href: '/automacoes',    label: 'Automações',   icon: ChartBarIcon,               iconSolid: ChartIconSolid,     color: '#4A9EFF', roles: [] },
      { href: '/reports',       label: 'Relatórios',   icon: ChartBarIcon,               iconSolid: ChartIconSolid,     color: '#E07B39', roles: ['leader', 'admin'] },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/users',         label: 'Usuários',     icon: UsersIcon,                  iconSolid: UsersIconSolid,     color: '#4A9EFF', roles: ['admin'] },
      { href: '/promotores',    label: 'Promotores',   icon: UserGroupIcon,              iconSolid: UserGroupIconSolid, color: '#29ABE2', roles: ['admin'] },
      { href: '/units',         label: 'Unidades',     icon: BuildingLibraryIcon,        iconSolid: BuildingIconSolid,  color: '#34D399', roles: ['admin'] },
      { href: '/roles',         label: 'Cargos',       icon: KeyIcon,                    iconSolid: KeyIconSolid,       color: '#A78BFA', roles: ['admin'] },
    ],
  },
]

// Flatten para manter compatibilidade com currentPage lookup
const navItems = navSections.flatMap(s => s.items)

// Item exclusivo do admin — ícone reutilizado do KeyIcon com cor dourada especial
const myAreaItem = { href: '/minha-area', label: '⚡ Sofi IA', icon: KeyIcon, iconSolid: KeyIconSolid, color: '#FDC347' }

function getRoleLevel(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('admin') || r.includes('administrador')) return 'admin'
  if (r.includes('leader') || r.includes('lider') || r.includes('director') || r.includes('diretor') ||
      r.includes('coordinator') || r.includes('coordenador')) return 'leader'
  return 'member'
}

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <svg className="w-3.5 h-3.5" style={{ color: 'rgba(248,163,3,0.6)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6l4 2"/>
      </svg>
      <span className="text-xs font-mono font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>{time}</span>
    </div>
  )
}

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const shortcuts = [
    { key: '⌘K / Ctrl+K', desc: 'Abrir buscador / Sofi IA' },
    { key: '?',            desc: 'Ver atalhos de teclado' },
    { key: 'Esc',          desc: 'Fechar modal / painel' },
    { key: 'G + D',        desc: 'Ir para Dashboard' },
    { key: 'G + T',        desc: 'Ir para Tarefas' },
    { key: 'G + E',        desc: 'Ir para Eventos' },
    { key: 'G + N',        desc: 'Ir para Notificações' },
    { key: 'G + A',        desc: 'Ir para Analytics IA' },
    { key: 'G + M',        desc: 'Ir para Minha Área (Sofi)' },
  ]
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'rgba(12,14,30,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Atalhos de teclado</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">✕</button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between py-1.5">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.desc}</span>
              <kbd className="text-xs px-2 py-1 rounded-lg font-mono" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#FDC347' }}>{s.key}</kbd>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-center mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Pressione ? a qualquer momento para ver esta lista</p>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const [searchOpen, setSearchOpen]         = useState(false)
  const [paletteOpen, setPaletteOpen]       = useState(false)
  const [shortcutsOpen, setShortcutsOpen]   = useState(false)

  // Global keyboard shortcuts
  const gPressedRef = useRef(false)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // ⌘K / Ctrl+K → Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setPaletteOpen(v => !v)
      return
    }
    // ? → shortcuts modal (only when not typing)
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === '?') { setShortcutsOpen(v => !v); return }
    // G + key navigation
    if (e.key === 'g' || e.key === 'G') { gPressedRef.current = true; setTimeout(() => { gPressedRef.current = false }, 1000); return }
    if (gPressedRef.current) {
      const map: Record<string, string> = { d: '/dashboard', t: '/tasks', e: '/events', n: '/notificacoes', a: '/analytics', m: '/minha-area' }
      const dest = map[e.key.toLowerCase()]
      if (dest) { e.preventDefault(); router.push(dest); gPressedRef.current = false }
    }
  }, [router])
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
              alt="APS"
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
              Associação Paulista Sul
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

        {/* ── NAVIGATION (por seções) ──────────────────── */}
        <nav className="flex-1 py-2 px-3 overflow-y-auto scrollbar-thin space-y-1">
          {navSections.map((section) => {
            // Filtrar itens visíveis da seção
            const sectionItems = section.items.filter(item => {
              if (!item.roles || item.roles.length === 0) return true
              if (item.roles.includes('admin')  && roleLevel !== 'admin') return false
              if (item.roles.includes('leader') && roleLevel !== 'admin' && roleLevel !== 'leader') return false
              return true
            })
            if (sectionItems.length === 0) return null

            return (
              <div key={section.label}>
                {/* Section label */}
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {sectionItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = isActive ? item.iconSolid : item.icon
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative"
                          style={{
                            background: isActive ? `${item.color}18` : 'transparent',
                            boxShadow: isActive ? `inset 3px 0 0 ${item.color}` : 'none',
                          }}
                        >
                          <Icon className="flex-shrink-0"
                            style={{ width: 16, height: 16, color: isActive ? item.color : 'rgba(255,255,255,0.35)' }} />
                          <span className="text-sm font-medium flex-1 truncate"
                            style={{ color: isActive ? item.color : 'rgba(255,255,255,0.65)' }}>
                            {item.label}
                          </span>
                          {/* Badge especial para Notificações */}
                          {item.href === '/notificacoes' && !isActive && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: '#FF4757' }} />
                          )}
                          {/* Badge especial para Automações */}
                          {item.href === '/automacoes' && !isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(74,158,255,0.15)', color: '#4A9EFF' }}>
                              IA
                            </span>
                          )}
                          {/* Badge especial para Analytics */}
                          {item.href === '/analytics' && !isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(249,194,52,0.15)', color: '#F9C234' }}>
                              ✨
                            </span>
                          )}
                          {isActive && (
                            <ChevronRightIcon style={{ width: 12, height: 12, color: item.color, opacity: 0.7 }} />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
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

        {/* ── APS COLOR BAND ──────────────────────────── */}
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
            {/* ⌘K Command Palette trigger */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              <MagnifyingGlassIcon className="w-3.5 h-3.5" />
              <span className="text-xs">Buscar...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                ⌘K
              </kbd>
            </button>
            {/* Mobile search */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden p-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>

            {/* Live clock */}
            <LiveClock />

            {/* Keyboard shortcuts hint */}
            <button onClick={() => setShortcutsOpen(true)} className="hidden lg:flex items-center gap-1 p-2 rounded-xl transition-all hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.25)' }} title="Atalhos (?)">
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>?</kbd>
            </button>

            {/* Bell → Notificações */}
            <Link href="/notificacoes"
              className="relative p-2 rounded-xl transition-all hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              title="Notificações"
            >
              <BellIcon className="w-5 h-5" />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse-dot"
                style={{ background: '#FF4757' }}
              />
            </Link>

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
        <main className="flex-1 overflow-y-auto p-5 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── AI ASSISTANT FLOAT ──────────────────────── */}
      <AiAssistant />

      {/* ── COMMAND PALETTE ⌘K ──────────────────────── */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* ── KEYBOARD SHORTCUTS MODAL ─────────────────── */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* ── MOBILE BOTTOM NAV ────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{ background: 'rgba(7,9,22,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { href: '/dashboard',    icon: '🏠', label: 'Início' },
          { href: '/tasks',        icon: '✅', label: 'Tarefas' },
          { href: '/minha-area',   icon: '⚡', label: 'Sofi' },
          { href: '/notificacoes', icon: '🔔', label: 'Notif.' },
          { href: '/analytics',    icon: '📊', label: 'Analytics' },
        ].map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
              style={{ color: active ? '#FDC347' : 'rgba(255,255,255,0.35)', background: active ? 'rgba(248,163,3,0.1)' : 'transparent' }}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[9px] font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
