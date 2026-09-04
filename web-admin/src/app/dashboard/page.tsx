'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import restoredPromoterSubmissions from '@/data/restored-promoter-submissions.json'
import { academicEventsFromState, readAcademicState, type AcademicState } from '@/lib/academic'
import api from '@/lib/api'
import {
  AcademicCapIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

type Person = {
  name: string
  unit: string
  role: string
  email?: string
}

type DashboardData = {
  tasks?: {
    pending?: number
    in_progress?: number
    completed?: number
    overdue?: number
  }
  events?: {
    planned?: number
    ongoing?: number
    completed?: number
  }
  alerts?: {
    overdueTasksCount?: number
  }
}

const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function mapRestoredPeople(): Person[] {
  const seen = new Set<string>()
  return (restoredPromoterSubmissions as any[])
    .map(item => {
      const raw = item.raw || {}
      const name = String(raw.nome_completo || item.name || '').trim()
      const email = String(raw.email || '').trim()
      const unit = String(raw.colegio_unidade || item.unit || 'Unidade não informada').trim()
      const role = String(raw.cargo_funcao || item.role || 'Função não informada').trim()
      return { name, unit, role, email }
    })
    .filter(person => {
      const key = `${person.email || person.name}|${person.unit}|${person.role}`.toLowerCase()
      if (!person.name || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const restoredPeople = useMemo(mapRestoredPeople, [])
  const [data, setData] = useState<DashboardData | null>(null)
  const [academic, setAcademic] = useState<AcademicState | null>(null)

  useEffect(() => {
    setAcademic(readAcademicState())
    api.get('/reports/dashboard')
      .then(response => setData(response.data))
      .catch(() => setData(null))
  }, [])

  const activeTasks = (data?.tasks?.pending || 0) + (data?.tasks?.in_progress || 0)
  const overdueTasks = data?.tasks?.overdue || 0
  const activeEvents = (data?.events?.planned || 0) + (data?.events?.ongoing || 0)
  const academicEvents = academic ? academicEventsFromState(academic) : []
  const openActivities = academic?.activities.filter(activity => activity.status !== 'concluida').length || 0
  const completedActivities = academic?.activities.filter(activity => activity.status === 'concluida').length || 0
  const academicProgress = academic?.activities.length ? Math.round((completedActivities / academic.activities.length) * 100) : 0
  const units = Array.from(new Set(restoredPeople.map(person => person.unit))).filter(Boolean)
  const nextAcademicEvents = academicEvents
    .filter(event => event.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 5)

  const healthItems = [
    {
      label: 'Pessoas restauradas',
      value: restoredPeople.length,
      detail: `${units.length} unidade${units.length === 1 ? '' : 's'} conectada${units.length === 1 ? '' : 's'}`,
      icon: UsersIcon,
      color: '#005DAA',
    },
    {
      label: 'Prazos acadêmicos',
      value: openActivities,
      detail: `${academicProgress}% do plano concluído`,
      icon: AcademicCapIcon,
      color: '#0ABD78',
    },
    {
      label: 'Tarefas ativas',
      value: activeTasks,
      detail: overdueTasks ? `${overdueTasks} em atraso` : 'Sem atraso crítico informado',
      icon: CheckCircleIcon,
      color: overdueTasks ? '#FF4757' : '#F6B221',
    },
    {
      label: 'Eventos próximos',
      value: activeEvents + nextAcademicEvents.length,
      detail: 'Operação e agenda acadêmica',
      icon: CalendarDaysIcon,
      color: '#8B5CF6',
    },
  ]

  const quickLinks = [
    { href: '/pessoas', label: 'Revisar pessoas', text: 'Promotores, contatos, documentos e perfis.', icon: UsersIcon, color: '#8B5CF6' },
    { href: '/academico', label: 'Organizar faculdade', text: 'Semestres, módulos, matérias e prazos.', icon: AcademicCapIcon, color: '#0ABD78' },
    { href: '/gestao', label: 'Central operacional', text: 'Agenda, projetos, responsabilidades e rotinas.', icon: SparklesIcon, color: '#F6B221' },
    { href: '/reports', label: 'Abrir relatórios', text: 'Ranking, desempenho e análise por pessoa.', icon: ChartBarIcon, color: '#005DAA' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_24px_80px_rgba(0,63,117,0.10)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#005DAA]">Central executiva</span>
                <span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#8A5B00]">Dados preservados</span>
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-[#001B3F] sm:text-5xl">
                APS EDU organizada como uma central de comando.
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#536579]">
                Pessoas, rotina operacional, relatórios e vida acadêmica aparecem conectados na entrada da plataforma, sem depender de páginas vazias para você entender o estado do sistema.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/pessoas" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#003F75] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(0,63,117,0.22)]">
                  Abrir Pessoas
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link href="/academico" className="inline-flex h-12 items-center gap-2 rounded-full border border-[#D8E5F0] bg-white px-5 text-sm font-black text-[#003F75]">
                  Ir para Acadêmico
                </Link>
              </div>
            </div>

            <div className="border-t border-[#E4EEF7] bg-[#F7FBFF] p-6 xl:border-l xl:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A8EA3]">Hoje</p>
              <p className="mt-2 text-2xl font-black capitalize text-[#001B3F]">{todayLabel()}</p>
              <div className="mt-5 rounded-[24px] border border-[#D8E5F0] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF3D6] text-[#8A5B00]">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#001B3F]">Ponto de atenção</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#536579]">
                      Os dados de Pessoas foram restaurados como base de segurança. A próxima etapa é ligar todos os módulos vazios à mesma fonte confiável.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {healthItems.map(item => (
            <MetricCard key={item.label} {...item} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[28px] border border-white bg-white p-5 shadow-[0_20px_60px_rgba(0,63,117,0.08)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A8EA3]">Jornada principal</p>
                <h2 className="mt-1 text-2xl font-black text-[#001B3F]">O que precisa ficar redondo</h2>
              </div>
              <p className="text-sm font-bold text-[#536579]">Design, dados e fluxo no mesmo padrão.</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {quickLinks.map(link => {
                const Icon = link.icon
                return (
                  <Link key={link.href} href={link.href} className="group rounded-[24px] border border-[#D8E5F0] bg-[#F7FBFF] p-4 transition hover:-translate-y-0.5 hover:border-[#BFD3E7] hover:bg-white hover:shadow-[0_18px_45px_rgba(0,63,117,0.10)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-[18px]" style={{ background: `${link.color}16`, color: link.color }}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <ArrowRightIcon className="mt-2 h-4 w-4 text-[#9AAABC] transition group-hover:translate-x-1 group-hover:text-[#003F75]" />
                    </div>
                    <p className="mt-4 text-base font-black text-[#001B3F]">{link.label}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#536579]">{link.text}</p>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white bg-white p-5 shadow-[0_20px_60px_rgba(0,63,117,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7A8EA3]">Agenda unificada</p>
            <h2 className="mt-1 text-2xl font-black text-[#001B3F]">Próximos compromissos</h2>
            <div className="mt-5 space-y-3">
              {nextAcademicEvents.map(event => (
                <div key={event.id} className="rounded-[22px] border border-[#D8E5F0] bg-[#F7FBFF] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#001B3F]">{event.title}</p>
                      <p className="mt-1 text-xs font-bold text-[#536579]">{event.source || 'Acadêmico'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-[#005DAA]">{formatter.format(new Date(`${event.date}T12:00:00`))}</span>
                  </div>
                </div>
              ))}
              {!nextAcademicEvents.length && (
                <div className="rounded-[22px] border border-dashed border-[#C9DBEA] bg-[#F7FBFF] p-5 text-center">
                  <p className="text-sm font-black text-[#001B3F]">Nenhum compromisso acadêmico futuro.</p>
                  <p className="mt-1 text-sm font-semibold text-[#536579]">Cadastre atividades no módulo Acadêmico para alimentar a agenda.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

function MetricCard({ label, value, detail, icon: Icon, color }: {
  label: string
  value: number
  detail: string
  icon: any
  color: string
}) {
  return (
    <div className="rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_50px_rgba(0,63,117,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7A8EA3]">{label}</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-[#001B3F]">{value.toLocaleString('pt-BR')}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-[18px]" style={{ background: `${color}16`, color }}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <p className="mt-3 text-sm font-bold text-[#536579]">{detail}</p>
    </div>
  )
}
