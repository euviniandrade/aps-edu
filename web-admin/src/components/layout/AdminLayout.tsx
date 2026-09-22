'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import CommandPalette from '@/components/ui/CommandPalette'
import AiAssistant from '@/components/ai/AiAssistant'
import { AcademicCapIcon, ArchiveBoxIcon, ArrowRightOnRectangleIcon, Bars3Icon, BellIcon, BuildingLibraryIcon, CalendarDaysIcon, ChartBarIcon, ChevronDownIcon, ChevronRightIcon, Cog6ToothIcon, DocumentTextIcon, HomeIcon, MagnifyingGlassIcon, PuzzlePieceIcon, RectangleGroupIcon, SparklesIcon, Squares2X2Icon, UsersIcon, ClipboardDocumentListIcon, ChatBubbleLeftRightIcon, BoltIcon } from '@heroicons/react/24/outline'
import styles from './workspace-shell.module.css'

const groups = [
  { name: 'Meu espaço', items: [
    { href: '/dashboard', name: 'Visão geral', icon: HomeIcon },
    { href: '/meu-dia', name: 'Meu dia', icon: SparklesIcon },
    { href: '/kanban', name: 'Tarefas e Kanban', icon: RectangleGroupIcon },
    { href: '/agenda', name: 'Calendário', icon: CalendarDaysIcon },
    { href: '/academico', name: 'Acadêmico', icon: AcademicCapIcon },
    { href: '/minha-area', name: 'Notas e arquivos', icon: DocumentTextIcon },
  ] },
  { name: 'Gestão da rede', items: [
    { href: '/pessoas', name: 'Pessoas', icon: UsersIcon },
    { href: '/escolar-financeiro', name: 'Escolar e financeiro', icon: BuildingLibraryIcon },
    { href: '/estoque', name: 'Estoque e patrimônio', icon: ArchiveBoxIcon },
    { href: '/events', name: 'Eventos', icon: CalendarDaysIcon },
    { href: '/announcements', name: 'Mural', icon: ChatBubbleLeftRightIcon },
    { href: '/reports', name: 'Relatórios', icon: ChartBarIcon },
  ] },
  { name: 'Ferramentas', items: [
    { href: '/integracoes', name: 'Google, Apple e integrações', icon: PuzzlePieceIcon },
    { href: '/automacoes', name: 'Automações', icon: BoltIcon },
    { href: '/inovacao', name: 'IA da Educação', icon: SparklesIcon },
    { href: '/gestao', name: 'Central operacional', icon: Squares2X2Icon },
    { href: '/tasks', name: 'Tarefas da rede', icon: ClipboardDocumentListIcon },
    { href: '/units', name: 'Unidades', icon: BuildingLibraryIcon },
    { href: '/users', name: 'Usuários e acessos', icon: UsersIcon },
    { href: '/configuracoes', name: 'Configurações', icon: Cog6ToothIcon },
  ] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [mobile, setMobile] = useState(false)
  const [palette, setPalette] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [user, setUser] = useState<{name?: string; role?: string | {name?: string}} | null>(null)
  useEffect(() => {
    setQuery(window.location.search)
    setMobile(false)
    try { const raw = Cookies.get('user'); if (raw) setUser(JSON.parse(decodeURIComponent(raw))) } catch {}
  }, [pathname])
  useEffect(() => {
    let prefix = false
    let timer: ReturnType<typeof setTimeout>
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette(true); return }
      if (event.key === 'Escape') { setMobile(false); setPalette(false) }
      if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]')) return
      if (prefix) {
        prefix = false
        const route = ({d:'/dashboard',g:'/gestao',a:'/academico',p:'/pessoas',r:'/reports'} as Record<string,string>)[event.key.toLowerCase()]
        if (route) { event.preventDefault(); router.push(route) }
      } else if (event.key.toLowerCase() === 'g') { prefix = true; timer = setTimeout(() => { prefix = false }, 1000) }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); clearTimeout(timer) }
  }, [router])
  function active(href: string) { return href.includes('?') ? pathname === href.split('?')[0] && query.includes('view=kanban') : pathname === href }
  const current = groups.flatMap(group => group.items).find(item => active(item.href))
  const role = typeof user?.role === 'string' ? user.role : user?.role?.name
  function logout() { ['accessToken','refreshToken','user'].forEach(name => Cookies.remove(name)); localStorage.removeItem('token'); router.push('/login') }
  return <div className={styles.shell}>
    {mobile && <button className={styles.scrim} onClick={() => setMobile(false)} aria-label="Fechar navegação" />}
    <aside className={`${styles.sidebar} ${mobile ? styles.open : ''}`}>
      <Link href="/dashboard" className={styles.brand} aria-label="SOFI Educação Adventista"><span className={styles.brandIcon}><img src="/icon-ea.svg" alt="" /></span><div><strong>SOFI<span>OS</span></strong><small>Education Intelligence System</small></div></Link>
      <button className={styles.workspaceSwitch} onClick={() => setPalette(true)}><span className={styles.workspaceMark}>A</span><span>APS Command<small>Operação, pessoas e estudos</small></span><ChevronDownIcon /></button>
      <nav className={styles.navigation} aria-label="Navegação principal">{groups.map(group => <div key={group.name} className={styles.group}>
        <button className={styles.groupLabel} aria-expanded={!collapsed.includes(group.name)} onClick={() => setCollapsed(prev => prev.includes(group.name) ? prev.filter(name => name !== group.name) : [...prev, group.name])}>{group.name}<ChevronDownIcon style={{transform:collapsed.includes(group.name)?'rotate(-90deg)':undefined}} /></button>
        {!collapsed.includes(group.name) && group.items.map(({icon:Icon,...item}) => <Link key={item.href} href={item.href} aria-current={active(item.href)?'page':undefined} onClick={() => { setQuery(item.href.includes('?')?'?'+item.href.split('?')[1]:''); setMobile(false) }}><Icon /><span>{item.name}</span>{active(item.href) && <span className={styles.activeDot} />}</Link>)}
      </div>)}</nav>
      <Link className={styles.integrationLink} href="/integracoes"><PuzzlePieceIcon /><span>Conecte suas ferramentas<small>Google Workspace e Apple</small></span><ChevronRightIcon /></Link>
      <div className={styles.profile}><span className={styles.avatar}>{user?.name?.[0] || 'A'}</span><div><b>{user?.name || 'Minha conta'}</b><small>{role || 'APS EDU'}</small></div><button onClick={logout} title="Sair" aria-label="Sair"><ArrowRightOnRectangleIcon /></button></div>
    </aside>
    <div className={styles.body}>
      <header className={styles.topbar}><div className={styles.breadcrumb}><button className={styles.menuButton} aria-label="Abrir navegação" onClick={() => setMobile(true)}><Bars3Icon /></button><Squares2X2Icon /><span>SOFI OS</span><ChevronRightIcon /><b>{current?.name || 'APS EDU'}</b></div><div className={styles.topActions}><span className={styles.systemStatus}><i />Sistema ativo</span><button className={styles.search} onClick={() => setPalette(true)} aria-label="Buscar na plataforma"><MagnifyingGlassIcon /><span>Comando rápido</span><kbd>Ctrl K</kbd></button><Link href="/notificacoes" title="Notificações" aria-label="Notificações"><BellIcon /></Link><Link href="/configuracoes" className={styles.avatar} title="Minha conta">{user?.name?.[0] || 'A'}</Link></div></header>
      <main className={`${styles.main} sofi-content`}><div className={styles.inner}>{children}</div></main>
    </div>
    {!pathname.startsWith('/inovacao') && <AiAssistant />}
    <CommandPalette open={palette} onClose={() => setPalette(false)} />
  </div>
}

