'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import CommandPalette from '@/components/ui/CommandPalette'
import AiAssistant from '@/components/ai/AiAssistant'
import {
  AcademicCapIcon,
  ArchiveBoxIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  AcademicCapIcon as AcademicCapIconSolid,
  ArchiveBoxIcon as ArchiveBoxIconSolid,
  BuildingLibraryIcon as BuildingLibraryIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  HomeIcon as HomeIconSolid,
  RocketLaunchIcon as RocketLaunchIconSolid,
  UsersIcon as UsersIconSolid,
} from '@heroicons/react/24/solid'

const navSections = [
  {
    label: 'Comando',
    items: [
      { href: '/dashboard', label: 'Visão Geral', icon: HomeIcon, iconSolid: HomeIconSolid, color: '#005DAA', roles: [] },
      { href: '/gestao', label: 'Central Operacional', icon: SparklesIcon, iconSolid: SparklesIcon, color: '#F6B221', roles: [] },
      { href: '/academico', label: 'Acadêmico', icon: AcademicCapIcon, iconSolid: AcademicCapIconSolid, color: '#0ABD78', roles: [] },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/pessoas', label: 'Pessoas', icon: UsersIcon, iconSolid: UsersIconSolid, color: '#8B5CF6', roles: [] },
      { href: '/escolar-financeiro', label: 'Escolar e Financeiro', icon: BuildingLibraryIcon, iconSolid: BuildingLibraryIconSolid, color: '#00A9E0', roles: [] },
      { href: '/estoque', label: 'Estoque e Patrimônio', icon: ArchiveBoxIcon, iconSolid: ArchiveBoxIconSolid, color: '#E07B39', roles: [] },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/reports', label: 'Relatórios', icon: ChartBarIcon, iconSolid: ChartBarIconSolid, color: '#003F75', roles: ['leader', 'admin'] },
      { href: '/inovacao', label: 'IA da Educação', icon: RocketLaunchIcon, iconSolid: RocketLaunchIconSolid, color: '#0ABD78', roles: [] },
      { href: '/configuracoes', label: 'Configurações', icon: Cog6ToothIcon, iconSolid: Cog6ToothIcon, color: '#536579', roles: [] },
    ],
  },
]

const hiddenNavItems = [
  { href: '/tasks', label: 'Tarefas e Projetos', icon: SparklesIcon, iconSolid: SparklesIcon, color: '#F6B221', roles: [] },
  { href: '/events', label: 'Eventos', icon: SparklesIcon, iconSolid: SparklesIcon, color: '#8B5CF6', roles: [] },
  { href: '/announcements', label: 'Mural', icon: SparklesIcon, iconSolid: SparklesIcon, color: '#00A9E0', roles: [] },
  { href: '/notificacoes', label: 'Notificações', icon: BellIcon, iconSolid: BellIcon, color: '#FF4757', roles: [] },
]

const navItems = [...navSections.flatMap(section => section.items), ...hiddenNavItems]

function getRoleLevel(role: string): string {
  const value = role.toLowerCase()
  if (value.includes('admin') || value.includes('administrador')) return 'admin'
  if (
    value.includes('leader') ||
    value.includes('lider') ||
    value.includes('director') ||
    value.includes('diretor') ||
    value.includes('coordinator') ||
    value.includes('coordenador')
  ) {
    return 'leader'
  }
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
    <div className="hidden items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-3 py-2 text-xs font-black text-[#B9C0B3] shadow-[0_12px_34px_rgba(0,0,0,0.22)] md:flex">
      <span className="h-2 w-2 rounded-full bg-[#0ABD78]" />
      {time}
    </div>
  )
}

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const shortcuts = [
    { key: 'Ctrl+K', desc: 'Abrir busca inteligente' },
    { key: '?', desc: 'Ver atalhos' },
    { key: 'G + D', desc: 'Ir para Visão Geral' },
    { key: 'G + G', desc: 'Ir para Central Operacional' },
    { key: 'G + A', desc: 'Ir para Acadêmico' },
    { key: 'G + P', desc: 'Ir para Pessoas' },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#001B3F]/55 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] border border-[#D8E5F0] bg-white p-5 shadow-[0_30px_80px_rgba(0,27,63,0.22)]" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-[#001B3F]">Atalhos</h3>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#F3F7FB] text-[#536579]">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {shortcuts.map(shortcut => (
            <div key={shortcut.key} className="flex items-center justify-between rounded-2xl border border-[#E4EEF7] bg-[#F7FBFF] px-4 py-3">
              <span className="text-sm font-bold text-[#536579]">{shortcut.desc}</span>
              <kbd className="rounded-lg border border-[#C9DBEA] bg-white px-2 py-1 text-xs font-black text-[#003F75]">{shortcut.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const gPressedRef = useRef(false)

  const currentPage = navItems.find(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A'
  const userName = user?.name ?? 'Administrador APS30'
  const userRoleName = user?.role?.name ?? user?.role ?? 'Administrador'
  const roleLevel = getRoleLevel(typeof userRoleName === 'string' ? userRoleName : 'member')

  useEffect(() => {
    try {
      const userCookie = Cookies.get('user')
      if (userCookie) setUser(JSON.parse(decodeURIComponent(userCookie)))
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('aps_edu_last_context_v1', JSON.stringify({
        path: pathname,
        label: currentPage?.label || 'Tela atual',
        recordedAt: new Date().toISOString(),
      }))
    } catch {}
  }, [pathname, currentPage?.label])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      setPaletteOpen(true)
      return
    }

    const tag = (event.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (event.key === '?') {
      setShortcutsOpen(value => !value)
      return
    }
    if (event.key.toLowerCase() === 'g') {
      gPressedRef.current = true
      window.setTimeout(() => { gPressedRef.current = false }, 1000)
      return
    }
    if (gPressedRef.current) {
      const map: Record<string, string> = { d: '/dashboard', g: '/gestao', a: '/academico', p: '/pessoas', r: '/reports', i: '/inovacao' }
      const destination = map[event.key.toLowerCase()]
      if (destination) {
        event.preventDefault()
        router.push(destination)
        gPressedRef.current = false
      }
    }
  }, [router])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function handleLogout() {
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
    Cookies.remove('user')
    localStorage.removeItem('token')
    router.push('/login')
  }

  const sidebar = (
    <aside className="flex h-full w-[250px] flex-col border-r border-white/10 bg-[#141613] text-white">
      <div className="px-5 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-3 py-2">
          <img src="/aps30-logo.png" alt="" className="h-10 w-14 object-contain" />
          <span className="text-lg font-semibold text-[#EDEFEB]">APS EDU<span className="text-[#BCF572]">.</span></span>
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-4 pb-5">
        {navSections.map(section => {
          const visibleItems = section.items.filter(item => {
            if (!item.roles?.length) return true
            if (item.roles.includes('admin') && roleLevel !== 'admin') return false
            if (item.roles.includes('leader') && roleLevel !== 'admin' && roleLevel !== 'leader') return false
            return true
          })
          if (!visibleItems.length) return null

          return (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-normal text-[#90988A]">{section.label}</p>
              <ul className="space-y-1">
                {visibleItems.map(item => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = active ? item.iconSolid : item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className="group flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition hover:bg-white/5"
                        style={{
                          background: active ? '#293221' : undefined,
                          color: active ? '#FFFFFF' : 'rgba(255,255,255,0.66)',
                          boxShadow: active ? 'inset 2px 0 0 #BCF572' : 'none',
                        }}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center">
                          <Icon className="h-4 w-4" style={{ color: active ? '#BCF572' : '#9DA695' }} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {active && <ChevronRightIcon className="h-4 w-4 text-[#B9C0B3]" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.07] p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F6B221] text-sm font-black text-[#001B3F]">{userInitial}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{userName}</p>
            <p className="truncate text-xs font-semibold text-[#B9C0B3]">{userRoleName}</p>
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="mt-2 flex h-11 w-full items-center gap-3 rounded-[16px] px-3 text-sm font-bold text-[#B9C0B3] transition hover:bg-white/[0.06] hover:text-white">
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-[#191B18] text-[#0B1F36]">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#001B3F]/55 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[250px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#191B18]/95 px-4 py-3 backdrop-blur-xl lg:px-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" aria-label="Abrir navegação" onClick={() => setMobileSidebarOpen(value => !value)} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.08] text-white lg:hidden">
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-[#B9C0B3]">
                  <Link href="/dashboard" className="truncate hover:text-white">SOFI APS EDU</Link>
                  {currentPage && (
                    <>
                      <ChevronRightIcon className="h-3 w-3 shrink-0 text-[#B9C0B3]" />
                      <span className="truncate text-[#F6B221]">{currentPage.label}</span>
                    </>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-black text-white sm:text-base">
                  {currentPage?.label || 'Central da plataforma'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-4 text-sm font-bold text-[#B9C0B3] shadow-[0_12px_34px_rgba(0,0,0,0.22)] sm:flex">
                <MagnifyingGlassIcon className="h-4 w-4" />
                Buscar
                <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] font-black text-[#B9C0B3]">Ctrl+K</kbd>
              </button>
              <button type="button" aria-label="Buscar" onClick={() => setPaletteOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.07] text-[#B9C0B3] sm:hidden">
                <MagnifyingGlassIcon className="h-4 w-4" />
              </button>
              <LiveClock />
              <Link href="/notificacoes" aria-label="Notificações" title="Notificações" className="relative grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.07] text-[#B9C0B3]">
                <BellIcon className="h-5 w-5" />
              </Link>
              <button type="button" onClick={() => setShortcutsOpen(true)} className="hidden h-10 rounded-full border border-white/12 bg-white/[0.07] px-3 text-xs font-black text-[#B9C0B3] lg:block">?</button>
              <div className="hidden items-center gap-3 rounded-full border border-white/12 bg-white/[0.07] py-1.5 pl-2 pr-4 shadow-[0_12px_34px_rgba(0,0,0,0.22)] md:flex">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F6B221] text-xs font-black text-[#001B3F]">{userInitial}</div>
                <div>
                  <p className="text-xs font-black leading-none text-white">{userName}</p>
                  <p className="mt-1 text-[10px] font-semibold leading-none text-[#B9C0B3]">{userRoleName}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={`${pathname === '/dashboard' ? '' : 'sofi-content'} relative flex-1 px-4 py-5 sm:px-5 lg:px-7 lg:py-7`}>
          <div className="mx-auto w-full max-w-[1560px]">{children}</div>
        </main>
      </div>

      {!pathname?.startsWith('/inovacao') && <AiAssistant />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

