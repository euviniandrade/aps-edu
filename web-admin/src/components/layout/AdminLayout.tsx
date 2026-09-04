'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'
import CommandPalette from '@/components/ui/CommandPalette'
import {
  HomeIcon, UsersIcon, CalendarDaysIcon,
  MegaphoneIcon, TrophyIcon, ChartBarIcon,
  ChatBubbleLeftEllipsisIcon, KeyIcon, BuildingLibraryIcon,
  ArrowRightOnRectangleIcon, Bars3Icon, BellIcon,
  ChevronRightIcon, MagnifyingGlassIcon, XMarkIcon,
  UserGroupIcon, RocketLaunchIcon, ArchiveBoxIcon, Cog6ToothIcon, AcademicCapIcon,
} from '@heroicons/react/24/outline'
import AiAssistant from '@/components/ai/AiAssistant'
import {
  HomeIcon as HomeIconSolid, UsersIcon as UsersIconSolid,
  CalendarDaysIcon as CalendarIconSolid,
  MegaphoneIcon as MegaphoneIconSolid, TrophyIcon as TrophyIconSolid,
  ChartBarIcon as ChartIconSolid,
  ChatBubbleLeftEllipsisIcon as ChatIconSolid,
  KeyIcon as KeyIconSolid, BuildingLibraryIcon as BuildingIconSolid,
  UserGroupIcon as UserGroupIconSolid, RocketLaunchIcon as RocketLaunchIconSolid,
  ArchiveBoxIcon as ArchiveBoxIconSolid, AcademicCapIcon as AcademicCapIconSolid,
} from '@heroicons/react/24/solid'

// Nav principal enxuto; fluxos detalhados vivem dentro do Centro e da busca.
const navSections = [
  {
    label: 'Operação',
    items: [
      { href: '/gestao',        label: 'Central Operacional', icon: HomeIcon,             iconSolid: HomeIconSolid,      color: '#F8A303', roles: [] },
      { href: '/escolar-financeiro', label: 'Gestão Escolar e Financeiro', icon: BuildingLibraryIcon, iconSolid: BuildingIconSolid, color: '#29ABE2', roles: [] },
      { href: '/pessoas',       label: 'Pessoas',      icon: UsersIcon,                  iconSolid: UsersIconSolid,     color: '#8B5CF6', roles: [] },
      { href: '/academico',     label: 'Acadêmico',    icon: AcademicCapIcon,            iconSolid: AcademicCapIconSolid, color: '#0ABD78', roles: [] },
      { href: '/estoque',       label: 'Estoque e Patrimônio', icon: ArchiveBoxIcon,     iconSolid: ArchiveBoxIconSolid, color: '#E07B39', roles: [] },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/inovacao',      label: 'IA da Educação',   icon: RocketLaunchIcon,           iconSolid: RocketLaunchIconSolid, color: '#0ABD78', roles: [] },
      { href: '/reports',       label: 'Relatórios',   icon: ChartBarIcon,               iconSolid: ChartIconSolid,     color: '#F9C234', roles: ['leader', 'admin'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/configuracoes', label: 'Configurações', icon: Cog6ToothIcon,             iconSolid: Cog6ToothIcon,      color: '#A78BFA', roles: [] },
    ],
  },
]

const hiddenNavItems = [
  { href: '/dashboard',     label: 'Dashboard',    icon: HomeIcon,                   iconSolid: HomeIconSolid,      color: '#F8A303', roles: [] },
  { href: '/events',        label: 'Eventos',      icon: CalendarDaysIcon,           iconSolid: CalendarIconSolid,  color: '#8B5CF6', roles: [] },
  { href: '/announcements', label: 'Mural',        icon: MegaphoneIcon,              iconSolid: MegaphoneIconSolid, color: '#29ABE2', roles: [] },
  { href: '/feedback',      label: 'Feedback',     icon: ChatBubbleLeftEllipsisIcon, iconSolid: ChatIconSolid,      color: '#FF4757', roles: [] },
  { href: '/gamification',  label: 'Gamificação',  icon: TrophyIcon,                 iconSolid: TrophyIconSolid,    color: '#F9C234', roles: [] },
  { href: '/promotores',    label: 'Promotores',   icon: UserGroupIcon,              iconSolid: UserGroupIconSolid, color: '#29ABE2', roles: ['admin'] },
  { href: '/roles',         label: 'Cargos',       icon: KeyIcon,                    iconSolid: KeyIconSolid,       color: '#A78BFA', roles: ['admin'] },
  { href: '/notificacoes',  label: 'Notificações', icon: BellIcon,                   iconSolid: BellIcon,           color: '#FF4757', roles: [] },
  { href: '/minha-area',    label: 'Minha Central', icon: KeyIcon,                   iconSolid: KeyIconSolid,       color: '#FDC347', roles: [] },
]

// Flatten para manter compatibilidade com currentPage lookup
const navItems = [...navSections.flatMap(s => s.items), ...hiddenNavItems]

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
      style={{ background: 'rgba(0,63,117,0.05)', border: '1px solid rgba(0,63,117,0.10)' }}>
      <svg className="w-3.5 h-3.5" style={{ color: 'rgba(246,178,33,0.9)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6l4 2"/>
      </svg>
      <span className="text-xs font-mono font-bold" style={{ color: 'rgba(0,63,117,0.70)' }}>{time}</span>
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
    { key: 'Cmd+K / Ctrl+K', desc: 'Abrir buscador / IA da Educação' },
    { key: '?',            desc: 'Ver atalhos de teclado' },
    { key: 'Esc',          desc: 'Fechar modal / painel' },
    { key: 'G + D',        desc: 'Ir para Dashboard' },
    { key: 'G + G',        desc: 'Ir para Central Operacional' },
    { key: 'G + T',        desc: 'Ir para Central de Tarefas' },
    { key: 'G + E',        desc: 'Ir para Eventos' },
    { key: 'G + N',        desc: 'Ir para Notificações' },
    { key: 'G + A',        desc: 'Ir para Analytics IA' },
    { key: 'G + M',        desc: 'Ir para Minha Central' },
  ]
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'rgba(12,14,30,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Atalhos de teclado</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">x</button>
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
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen]         = useState(false)
  const [paletteOpen, setPaletteOpen]       = useState(false)
  const [shortcutsOpen, setShortcutsOpen]   = useState(false)

  // Global keyboard shortcuts
  const gPressedRef = useRef(false)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // RK / Ctrl+K   Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setPaletteOpen(v => !v)
      return
    }
    // ?   shortcuts modal (only when not typing)
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === '?') { setShortcutsOpen(v => !v); return }
    // G + key navigation
    if (e.key === 'g' || e.key === 'G') { gPressedRef.current = true; setTimeout(() => { gPressedRef.current = false }, 1000); return }
    if (gPressedRef.current) {
      const map: Record<string, string> = { d: '/dashboard', g: '/gestao', t: '/tasks', e: '/events', n: '/notificacoes', a: '/analytics', m: '/gestao' }
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = {
      path: pathname,
      label: currentPage?.label || 'Tela atual',
      recordedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem('aps_edu_last_context_v1', JSON.stringify(payload))
    } catch {}
  }, [pathname, currentPage?.label])

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
  const [currentGestãoView, setCurrentGestãoView] = useState('agenda')
  useEffect(() => {
    if (typeof window === 'undefined') return
    setCurrentGestãoView(new URLSearchParams(window.location.search).get('view') || 'agenda')
  }, [pathname])
  // Mantemos o menu contextual enxuto para evitar duplicidade na navegação da Gestão.
  const contextualGestãoItems = [
    { href: '/gestao?view=agenda', label: 'Agenda e Calendários', key: 'agenda' },
    { href: '/gestao?view=kanban', label: 'Tarefas e Projetos', key: 'kanban' },
    { href: '/gestao?view=escolar', label: 'Escolar e Financeiro', key: 'escolar' },
  ]
  const desktopSidebarWidth = desktopSidebarOpen ? 256 : 18

  return (
    <div
      className="sofi-admin-shell relative h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/*  BACKGROUND ORBS  */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="glow-orb animate-orb"
          style={{
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(0,169,224,0.18) 0%, transparent 70%)',
            top: -200, left: -200,
          }}
        />
        <div
          className="glow-orb animate-orb"
          style={{
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(246,178,33,0.16) 0%, transparent 70%)',
            bottom: -150, right: -100,
            animationDelay: '-4s',
          }}
        />
      </div>

      {/*  MOBILE OVERLAY  */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className="fixed inset-y-0 left-0 z-20 hidden lg:block"
        style={{ width: 14 }}
        onMouseEnter={() => setDesktopSidebarOpen(true)}
      />

      {/* """"""""""""""""""""""""""""""""""""""""""""""""""
          SIDEBAR
          """""""""""""""""""""""""""""""""""""""""""""""""" */}
      <aside
        style={{
          width: 256,
          background: 'var(--bg-sidebar)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '12px 0 40px rgba(0,63,117,0.22)',
        }}
        onMouseEnter={() => setDesktopSidebarOpen(true)}
        onMouseLeave={() => setDesktopSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-30 flex flex-col
          transition-transform duration-300 ease-in-out
          ${desktopSidebarOpen ? 'lg:translate-x-0' : 'lg:-translate-x-[238px]'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/*  LOGO AREA  */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="rounded-[1.35rem] bg-white p-2 shadow-lg shadow-black/10">
              <img
                src="/aps30-logo.png"
                alt="APS30 - Sistema de Gestão"
                className="h-14 w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/*  NAVIGATION (por seções)  */}
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
                              IA
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

                {pathname.startsWith('/gestao') && section.label === 'Operação' && (
                  <div className="mt-2 space-y-1 rounded-2xl border border-white/8 bg-white/[0.025] p-2">
                    <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      Central Operacional
                    </p>
                    {contextualGestãoItems.map(item => {
                      const activeView = currentGestãoView === item.key
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all"
                          style={{
                            background: activeView ? 'rgba(248,163,3,0.14)' : 'transparent',
                            color: activeView ? '#F8A303' : 'rgba(255,255,255,0.55)',
                            border: activeView ? '1px solid rgba(248,163,3,0.2)' : '1px solid transparent',
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: activeView ? '#F8A303' : 'rgba(255,255,255,0.22)' }} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}

                {pathname.startsWith('/escolar-financeiro') && section.label === 'Operação' && (
                  <div className="mt-2 space-y-1 rounded-2xl border border-white/8 bg-white/[0.025] p-2">
                    <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      Suite escolar
                    </p>
                    <Link
                      href="/gestao?view=escolar"
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all"
                      style={{ background: 'rgba(41,171,226,0.14)', color: '#29ABE2', border: '1px solid rgba(41,171,226,0.2)' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-[#29ABE2]" />
                      <span className="truncate">Matrículas, financeiro e documentos</span>
                    </Link>
                  </div>
                )}

              </div>
            )
          })}
        </nav>

        {/*  USER + LOGOUT  */}
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
            <Cog6ToothIcon style={{ width: 17, height: 17, color: 'rgba(255,255,255,0.35)' }} />
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

        {/*  APS COLOR BAND  */}
        <div className="flex h-0.5">
          <div className="flex-1" style={{ background: '#F9C234' }} />
          <div className="flex-1" style={{ background: '#29ABE2' }} />
          <div className="flex-1" style={{ background: '#E07B39' }} />
          <div className="flex-1" style={{ background: '#1B5FAD' }} />
        </div>
      </aside>

      {/* """"""""""""""""""""""""""""""""""""""""""""""""""
          MAIN AREA
          """""""""""""""""""""""""""""""""""""""""""""""""" */}
      <div
        className="relative z-10 flex h-full min-w-0 flex-col overflow-hidden"
        style={{ marginLeft: desktopSidebarWidth }}
      >

        {/*  TOP BAR  */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
          style={{
            background: 'var(--bg-topbar)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(0,63,117,0.10)',
            boxShadow: '0 12px 28px rgba(0,63,117,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl transition-colors"
              style={{ color: 'rgba(0,63,117,0.75)' }}
            >
              <Bars3Icon className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs hidden sm:block"
                style={{ color: 'rgba(0,63,117,0.45)' }}
              >
                Sistema de Gestão - APS30
              </span>
              {currentPage && (
                <>
                  <ChevronRightIcon
                    className="w-3 h-3 hidden sm:block"
                    style={{ color: 'rgba(0,63,117,0.20)' }}
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
            {/* RK Command Palette trigger */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{
                background: 'rgba(0,63,117,0.05)',
                border: '1px solid rgba(0,63,117,0.10)',
                color: 'rgba(0,63,117,0.55)',
              }}
            >
              <MagnifyingGlassIcon className="w-3.5 h-3.5" />
              <span className="text-xs">Buscar...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'rgba(0,63,117,0.07)', border: '1px solid rgba(0,63,117,0.1)' }}>
                Ctrl+K
              </kbd>
            </button>
            {/* Mobile search */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden p-2 rounded-xl transition-all"
              style={{ color: 'rgba(0,63,117,0.55)' }}
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>

            {/* Live clock */}
            <LiveClock />

            {/* Keyboard shortcuts hint */}
            <button onClick={() => setShortcutsOpen(true)} className="hidden lg:flex items-center gap-1 p-2 rounded-xl transition-all hover:bg-white/5"
              style={{ color: 'rgba(0,63,117,0.42)' }} title="Atalhos (?)">
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(0,63,117,0.06)', border: '1px solid rgba(0,63,117,0.10)' }}>?</kbd>
            </button>

            {/* Bell   Notificações */}
            <Link href="/notificacoes"
              className="relative p-2 rounded-xl transition-all hover:bg-white/5"
              style={{ color: 'rgba(0,63,117,0.55)' }}
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
              style={{ borderLeft: '1px solid rgba(0,63,117,0.10)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center
                           text-xs font-bold text-black flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #F6B221, #FFD15C)',
                  boxShadow: '0 10px 22px rgba(246,178,33,0.24)',
                }}
              >
                {userInitial}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-none" style={{ color: 'rgba(11,31,54,0.88)' }}>
                  {userName}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(11,31,54,0.48)' }}>
                  {userRole}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/*  DOT GRID TEXTURE  */}
        <div className="absolute inset-0 dot-grid pointer-events-none" style={{ zIndex: -1 }} />

        {/*  PAGE CONTENT  */}
        <main className="sofi-content flex-1 overflow-y-auto p-5 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/*  AI ASSISTANT FLOAT  */}
      {!pathname?.startsWith('/inovacao') && <AiAssistant />}

      {/*  COMMAND PALETTE RK  */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/*  KEYBOARD SHORTCUTS MODAL  */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/*  MOBILE BOTTOM NAV  */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,63,117,0.10)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[ 
          { href: '/gestao',       icon: 'C', label: 'Centro' },
          { href: '/escolar-financeiro', icon: 'E', label: 'Escola' },
          { href: '/academico',    icon: 'A', label: 'Acad.' },
          { href: '/pessoas',      icon: 'P', label: 'Pessoas' },
          { href: '/inovacao',     icon: 'I', label: 'IA' },
        ].map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
              style={{ color: active ? '#003F75' : 'rgba(0,63,117,0.45)', background: active ? 'rgba(0,169,224,0.10)' : 'transparent' }}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[9px] font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

