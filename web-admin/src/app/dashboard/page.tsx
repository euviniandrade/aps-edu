'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AcademicCapIcon, ArrowUpRightIcon, ArrowPathIcon, CalendarDaysIcon, ChartBarIcon, UsersIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'
import submissions from '@/data/restored-promoter-submissions.json'
import { readAcademicState, ACADEMIC_UPDATED_EVENT, type AcademicState } from '@/lib/academic'
import api from '@/lib/api'
import styles from './workspace.module.css'

type Summary = { tasks?: { pending?: number; in_progress?: number }; events?: { planned?: number; ongoing?: number } }
const modules = [
  { href: '/pessoas', name: 'Pessoas', detail: 'Contatos e perfis', icon: UsersIcon, color: '#0877C9' },
  { href: '/academico', name: 'Acadêmico', detail: 'Disciplinas e entregas', icon: AcademicCapIcon, color: '#00A9E0' },
  { href: '/agenda', name: 'Agenda central', detail: 'Google, iOS e prazos', icon: CalendarDaysIcon, color: '#2A9D6F' },
  { href: '/kanban', name: 'Kanban', detail: 'Tarefas e projetos', icon: Squares2X2Icon, color: '#F0A62B' },
  { href: '/reports', name: 'Relatórios', detail: 'Análise e resultados', icon: ChartBarIcon, color: '#6157D8' },
  { href: '/integracoes', name: 'Integrações', detail: 'Google Workspace e Apple', icon: ArrowPathIcon, color: '#53647A' },
]

export default function DashboardPage() {
  const [academic, setAcademic] = useState<AcademicState | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('pending')
  const [today, setToday] = useState('')
  const people = useMemo(() => {
    const seen = new Set<string>()
    return submissions.filter(item => {
      const key = `${item.email || item.promoterName}|${item.unit}|${item.role}`.toLowerCase()
      if (!item.promoterName || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [])
  async function refresh() {
    setLoading(true)
    try { const response = await api.get('/reports/dashboard'); setSummary(response.data) }
    catch { setSummary(null) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    const update = () => {
      setAcademic(readAcademicState())
      const now = new Date()
      setToday(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    }
    update()
    void refresh()
    window.addEventListener(ACADEMIC_UPDATED_EVENT, update)
    window.addEventListener('storage', update)
    window.addEventListener('focus', update)
    return () => {
      window.removeEventListener(ACADEMIC_UPDATED_EVENT, update)
      window.removeEventListener('storage', update)
      window.removeEventListener('focus', update)
    }
  }, [])
  const activities = academic?.activities || []
  const pending = activities.filter(item => item.status !== 'concluida')
  const visible = activities.filter(item => period === 'done' ? item.status === 'concluida' : item.status !== 'concluida' && (period !== 'today' || item.dueDate === today))
    .sort((a, b) => `${a.dueDate}${a.time}`.localeCompare(`${b.dueDate}${b.time}`))
  const completed = activities.length - pending.length
  const progress = activities.length ? Math.round(completed / activities.length * 100) : 0
  const units = useMemo(() => {
    const counts = new Map<string, number>()
    people.forEach(person => counts.set(person.unit || 'Sem unidade', (counts.get(person.unit || 'Sem unidade') || 0) + 1))
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [people])
  const dateLabel = today ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${today}T12:00:00`)) : ''
  return <AdminLayout>
    <div className={styles.workspace}>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>APS EDU / SEU ESPAÇO DE TRABALHO</p><h1>Visão geral<span>.</span></h1><p className={styles.muted}>{dateLabel || 'Carregando data…'}</p></div>
        <div className={styles.actions}><button onClick={refresh} disabled={loading} title="Atualizar indicadores" aria-label="Atualizar indicadores"><ArrowPathIcon className={loading ? styles.spin : ''} /></button><Link className={styles.primary} href="/gestao"><Squares2X2Icon />Abrir operação<ArrowUpRightIcon /></Link></div>
      </div>

      <div className={styles.metrics}>
        <Link href="/pessoas"><span>Pessoas na base restaurada</span><strong>{people.length}</strong><small>{units.length} unidades identificadas <ArrowUpRightIcon /></small></Link>
        <Link href="/academico"><span>Entregas pendentes</span><strong>{academic ? pending.length : '—'}</strong><small>{pending.filter(item => item.dueDate && item.dueDate < today).length} com prazo vencido <ArrowUpRightIcon /></small></Link>
        <Link href="/gestao"><span>Tarefas em aberto</span><strong>{summary ? (summary.tasks?.pending || 0) + (summary.tasks?.in_progress || 0) : '—'}</strong><small>{loading ? 'Consultando operação' : summary ? 'Pendentes e em andamento' : 'Consulta indisponível'}<ArrowUpRightIcon /></small></Link>
        <Link href="/academico"><span>Progresso acadêmico</span><strong>{academic ? `${progress}%` : '—'}</strong><small>{completed} de {activities.length} atividades concluídas <ArrowUpRightIcon /></small></Link>
      </div>

      <nav className={styles.modules} aria-label="Módulos principais">{modules.map(({ icon: Icon, ...module }) => <Link href={module.href} key={module.href}><Icon style={{ color: module.color }} /><div><b>{module.name}</b><span>{module.detail}</span></div><ArrowUpRightIcon /></Link>)}</nav>

      <div className={styles.columns}>
        <section className={styles.agenda}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>SEU PRÓXIMO PASSO</p><h2>Agenda acadêmica</h2></div><Link href="/academico" title="Abrir ambiente acadêmico" aria-label="Abrir ambiente acadêmico"><ArrowUpRightIcon /></Link></div>
          <div className={styles.filters} role="group" aria-label="Filtrar atividades">{[['pending', 'Pendentes'], ['today', 'Hoje'], ['done', 'Concluídas']].map(([id, label]) => <button key={id} aria-pressed={period === id} onClick={() => setPeriod(id)}>{label}</button>)}</div>
          <div className={styles.activityList} aria-live="polite">{visible.map(item => {
            const subject = academic?.subjects.find(subject => subject.id === item.subjectId)
            const overdue = item.status !== 'concluida' && item.dueDate && item.dueDate < today
            return <Link href="/academico" key={item.id} className={styles.activity}><div className={styles.date}><b>{item.dueDate ? item.dueDate.slice(8, 10) : '—'}</b><span>{item.dueDate ? new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.dueDate}T12:00:00`)) : 'Sem data'}</span></div><div className={styles.activityText}><b>{item.title}</b><span>{subject?.name || 'Sem disciplina'}{item.time ? ` · ${item.time}` : ''}</span></div><span className={overdue ? styles.overdue : styles.status}>{overdue ? 'Atrasada' : item.status === 'concluida' ? 'Concluída' : item.type}</span><ArrowUpRightIcon /></Link>
          })}{!visible.length && <div className={styles.empty}><CalendarDaysIcon /><h3>{academic ? 'Nenhuma atividade neste filtro' : 'Carregando atividades'}</h3><Link href="/academico">Abrir acadêmico <ArrowUpRightIcon /></Link></div>}</div>
          <footer className={styles.agendaFooter}><span>{visible.length} atividades · agenda deste dispositivo</span><Link href="/academico">Ver todas <ArrowUpRightIcon /></Link></footer>
        </section>

        <section className={styles.network}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PESSOAS / UNIDADES</p><h2>Sua rede</h2></div><UsersIcon /></div><div className={styles.networkTotal}><strong>{units.length}</strong><span>unidades na<br />base restaurada</span></div><div className={styles.unitList}>{units.slice(0, 6).map(([unit, count]) => <Link href="/pessoas" key={unit}><div><span>{unit}</span><b>{count}</b></div><div className={styles.bar}><span style={{ width: `${count / (units[0]?.[1] || 1) * 100}%` }} /></div></Link>)}</div><Link className={styles.networkLink} href="/pessoas">Explorar pessoas <ArrowUpRightIcon /></Link></section>
      </div>
    </div>
  </AdminLayout>
}
