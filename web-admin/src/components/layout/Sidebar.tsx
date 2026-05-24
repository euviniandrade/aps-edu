'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

interface NavItem {
  href: string
  icon: string
  label: string
  adminOnly?: boolean
  leaderOnly?: boolean
  badge?: string
}

const navItems: NavItem[] = [
  { href: '/dashboard',     icon: '🏠', label: 'Dashboard' },
  { href: '/meu-dia',       icon: '🎯', label: 'Meu Dia' },
  { href: '/tasks',         icon: '✅', label: 'Tarefas' },
  { href: '/events',        icon: '📅', label: 'Eventos' },
  { href: '/announcements', icon: '📣', label: 'Mural' },
  { href: '/minha-area',    icon: '🤖', label: 'Sofi IA' },
  { href: '/gamification',  icon: '🏆', label: 'Gamificação' },
  { href: '/reports',       icon: '📊', label: 'Relatórios', leaderOnly: true },
  { href: '/feedback',      icon: '💬', label: 'Feedback' },
  { href: '/users',         icon: '👥', label: 'Usuários',   adminOnly: true },
  { href: '/units',         icon: '🏫', label: 'Unidades',   adminOnly: true },
  { href: '/roles',         icon: '🔐', label: 'Perfis',     adminOnly: true },
  { href: '/promotores',    icon: '⭐', label: 'Promotores', adminOnly: true },
]

function getRoleFromUser(user: any): string {
  return user?.role?.name?.toLowerCase() || user?.role?.toLowerCase() || 'member'
}

function isAdmin(role: string) {
  return ['admin', 'super_admin', 'administrator', 'administrador'].some(r => role.includes(r))
}
function isLeader(role: string) {
  return isAdmin(role) || ['leader', 'coordinator', 'lider', 'coordenador', 'diretor'].some(r => role.includes(r))
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const raw = Cookies.get('user')
      if (raw) setUser(JSON.parse(decodeURIComponent(raw)))
    } catch {}
  }, [])

  const role    = getRoleFromUser(user)
  const admin   = isAdmin(role)
  const leader  = isLeader(role)

  const visibleItems = navItems.filter(item => {
    if (item.adminOnly  && !admin)  return false
    if (item.leaderOnly && !leader) return false
    return true
  })

  const logout = () => {
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
    Cookies.remove('user')
    router.push('/login')
  }

  const userName  = user?.name || 'Usuário'
  const userInitial = userName[0]?.toUpperCase() || 'U'

  return (
    <aside
      className="min-h-screen flex flex-col transition-all duration-300"
      style={{
        width: collapsed ? 64 : 220,
        background: 'linear-gradient(180deg, #0a0f2e 0%, #080c20 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #F8A303, #FDC347)',
            boxShadow: '0 4px 12px rgba(248,163,3,0.3)',
          }}
        >
          🎓
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-sm leading-tight whitespace-nowrap">APS EDU</div>
            <div className="text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {admin ? 'Administrador' : leader ? 'Liderança' : 'Colaborador'}
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                active
                  ? 'text-white'
                  : 'text-blue-200/60 hover:text-white hover:bg-white/5'
              )}
              style={active ? {
                background: 'rgba(248,163,3,0.12)',
                color: '#F8A303',
                border: '1px solid rgba(248,163,3,0.18)',
              } : {}}
            >
              <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
              {active && !collapsed && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#F8A303' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + Settings */}
      <div className="p-2 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Link
          href="/configuracoes"
          title={collapsed ? 'Configurações' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-blue-200/60 hover:text-white hover:bg-white/5"
        >
          <span className="text-base flex-shrink-0">⚙️</span>
          {!collapsed && <span>Configurações</span>}
        </Link>
        <button
          onClick={logout}
          title={collapsed ? 'Sair' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-blue-200/60 hover:text-white hover:bg-white/5"
        >
          <span className="text-base flex-shrink-0">🚪</span>
          {!collapsed && <span>Sair</span>}
        </button>
        {!collapsed && user && (
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000' }}
            >
              {userInitial}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {user?.email || ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
