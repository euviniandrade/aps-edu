'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'
import {
  HomeIcon,
  UsersIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  MegaphoneIcon,
  TrophyIcon,
  ChartBarIcon,
  ChatBubbleLeftEllipsisIcon,
  KeyIcon,
  BuildingLibraryIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UsersIcon as UsersIconSolid,
  CheckCircleIcon as CheckIconSolid,
  CalendarDaysIcon as CalendarIconSolid,
  MegaphoneIcon as MegaphoneIconSolid,
  TrophyIcon as TrophyIconSolid,
  ChartBarIcon as ChartIconSolid,
  ChatBubbleLeftEllipsisIcon as ChatIconSolid,
  KeyIcon as KeyIconSolid,
  BuildingLibraryIcon as BuildingIconSolid,
} from '@heroicons/react/24/solid'

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    href: '/users',
    label: 'Usuários',
    icon: UsersIcon,
    iconSolid: UsersIconSolid,
  },
  {
    href: '/tasks',
    label: 'Tarefas',
    icon: CheckCircleIcon,
    iconSolid: CheckIconSolid,
  },
  {
    href: '/events',
    label: 'Eventos',
    icon: CalendarDaysIcon,
    iconSolid: CalendarIconSolid,
  },
  {
    href: '/announcements',
    label: 'Avisos',
    icon: MegaphoneIcon,
    iconSolid: MegaphoneIconSolid,
  },
  {
    href: '/gamification',
    label: 'Gamificação',
    icon: TrophyIcon,
    iconSolid: TrophyIconSolid,
  },
  {
    href: '/reports',
    label: 'Relatórios',
    icon: ChartBarIcon,
    iconSolid: ChartIconSolid,
  },
  {
    href: '/feedback',
    label: 'Feedback',
    icon: ChatBubbleLeftEllipsisIcon,
    iconSolid: ChatIconSolid,
  },
  {
    href: '/roles',
    label: 'Cargos',
    icon: KeyIcon,
    iconSolid: KeyIconSolid,
  },
  {
    href: '/units',
    label: 'Unidades',
    icon: BuildingLibraryIcon,
    iconSolid: BuildingIconSolid,
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
    Cookies.remove('user')
    localStorage.removeItem('token')
    router.push('/login')
  }

  // Get current page label for topbar
  const currentPage = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  // User info from cookie
  const userCookie = typeof window !== 'undefined' ? Cookies.get('user') : null
  const user = userCookie ? JSON.parse(userCookie) : null
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'A'
  const userName = user?.name ?? 'Administrador'

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F0F4FA' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside
        style={{ backgroundColor: '#1B3A6B', width: '256px' }}
        className={`fixed inset-y-0 left-0 z-30 flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <img src="/icon-ea-white.svg" alt="EA" className="h-6 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">
              Educação Adventista
            </p>
            <p
              className="text-[10px] font-medium tracking-widest truncate mt-0.5"
              style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em' }}
            >
              APS SUL
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p
            className="text-[10px] font-bold px-3 mb-2 uppercase tracking-[0.15em]"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Menu
          </p>

          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = isActive ? item.iconSolid : item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative"
                    style={{
                      backgroundColor: isActive
                        ? 'rgba(248,163,3,0.15)'
                        : 'transparent',
                    }}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        style={{ backgroundColor: '#F8A303' }}
                      />
                    )}
                    <Icon
                      className="flex-shrink-0 transition-colors"
                      style={{
                        width: 18,
                        height: 18,
                        color: isActive ? '#F8A303' : 'rgba(255,255,255,0.55)',
                      }}
                    />
                    <span
                      className="text-sm font-medium flex-1 transition-colors"
                      style={{
                        color: isActive ? '#F8A303' : 'rgba(255,255,255,0.75)',
                      }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <ChevronRightIcon
                        style={{ width: 14, height: 14, color: '#F8A303', opacity: 0.6 }}
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* User card */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: '#F8A303' }}
            >
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">{userName}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Administrador
              </p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all hover:bg-white/10 group"
          >
            <ArrowRightOnRectangleIcon
              style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.45)' }}
              className="group-hover:text-white transition-colors"
            />
            <span
              className="text-sm font-medium group-hover:text-white transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              Sair
            </span>
          </button>
        </div>

        {/* Bottom APS30 color band */}
        <div className="flex h-1">
          <div className="flex-1" style={{ backgroundColor: '#F9C234' }} />
          <div className="flex-1" style={{ backgroundColor: '#29ABE2' }} />
          <div className="flex-1" style={{ backgroundColor: '#E07B39' }} />
          <div className="flex-1" style={{ backgroundColor: '#1B5FAD' }} />
        </div>
      </aside>

      {/* ── MAIN AREA ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Bars3Icon className="w-5 h-5 text-gray-600" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:block">
                Educação Adventista
              </span>
              {currentPage && (
                <>
                  <ChevronRightIcon className="w-3 h-3 text-gray-300 hidden sm:block" />
                  <span className="text-sm font-semibold" style={{ color: '#1B3A6B' }}>
                    {currentPage.label}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <BellIcon className="w-5 h-5 text-gray-500" />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: '#F8A303' }}
              />
            </button>

            {/* Avatar */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: '#1B3A6B' }}
              >
                {userInitial}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-700 leading-none">{userName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
