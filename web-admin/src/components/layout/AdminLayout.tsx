'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/users', icon: '👥', label: 'Usuários' },
  { href: '/tasks', icon: '✅', label: 'Tarefas' },
  { href: '/events', icon: '📅', label: 'Eventos' },
  { href: '/announcements', icon: '📢', label: 'Avisos' },
  { href: '/gamification', icon: '🏆', label: 'Gamificação' },
  { href: '/reports', icon: '📊', label: 'Relatórios' },
  { href: '/roles', icon: '🔑', label: 'Cargos' },
  { href: '/units', icon: '🏫', label: 'Unidades' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        style={{ backgroundColor: '#132C45', width: '256px' }}
        className={`fixed inset-y-0 left-0 z-30 flex flex-col transform transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand */}
        <div className="flex flex-col items-center py-8 px-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Logo emblem */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '2px solid #F8A303' }}>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#F8A303' }} />
              <div className="w-7 h-1 rounded-full" style={{ backgroundColor: '#F8A303' }} />
              <div className="w-1 h-3 rounded-full" style={{ backgroundColor: '#F8A303' }} />
            </div>
          </div>
          <h1 className="text-white font-bold text-xl tracking-wide">APS Sul</h1>
          <p className="text-xs font-medium tracking-widest mt-0.5" style={{ color: '#F8A303' }}>
            EDUCAÇÃO ADVENTISTA
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p className="text-xs font-semibold px-3 mb-3" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '1px' }}>
            MENU
          </p>
          <ul className="space-y-1">
            {navItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
                    style={{
                      backgroundColor: isActive ? 'rgba(248,163,3,0.15)' : 'transparent',
                      borderLeft: isActive ? '3px solid #F8A303' : '3px solid transparent',
                    }}
                  >
                    <span className="text-lg w-6 text-center">{item.icon}</span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isActive ? '#F8A303' : 'rgba(255,255,255,0.75)' }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10"
          >
            <span className="text-lg">🚪</span>
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              ☰
            </button>
            <div>
              <p className="text-xs text-gray-400 font-medium">APS Sul — Educação Adventista</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: '#132C45' }}>
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
