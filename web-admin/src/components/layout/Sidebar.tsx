'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import clsx from 'clsx'

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/users', icon: '👥', label: 'Usuários' },
  { href: '/tasks', icon: '✅', label: 'Tarefas' },
  { href: '/events', icon: '📅', label: 'Eventos' },
  { href: '/announcements', icon: '📣', label: 'Mural' },
  { href: '/gamification', icon: '🏆', label: 'Gamificação' },
  { href: '/reports', icon: '📊', label: 'Relatórios' },
  { href: '/feedback', icon: '💬', label: 'Feedback' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = () => {
    Cookies.remove('accessToken'); Cookies.remove('refreshToken'); Cookies.remove('user')
    router.push('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 flex flex-col">
      <div className="p-5 border-b border-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-lg">🎓</div>
          <div>
            <div className="text-white font-bold text-sm">APS EDU</div>
            <div className="text-blue-300 text-xs">Admin</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              pathname.startsWith(item.href)
                ? 'bg-white/20 text-white'
                : 'text-blue-200 hover:bg-white/10 hover:text-white'
            )}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-blue-700">
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-all w-full">
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  )
}
