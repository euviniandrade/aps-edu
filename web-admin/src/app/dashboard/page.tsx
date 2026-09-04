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
  CpuChipIcon,
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
  tasks?: { pending?: number; in_progress?: number; completed?: number; overdue?: number }
  events?: { planned?: number; ongoing?: number; completed?: number }
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function mapRestoredPeople(): Person[] {
  const seen = new Set<string>()
  return (restoredPromoterSubmissions as any[])
    .map(item => {
      const raw = item.raw || {}
      const name = String(item.promoterName || item.name || raw.nome_completo || raw.nome || '').trim()
      const email = String(item.email || raw.email || '').trim()
      const unit = String(item.unit || raw.colegio_unidade || raw.unidade || 'Unidade não informada').trim()
      const role = String(item.role || raw.cargo_funcao || raw.cargo || 'Função não informada').trim()
      return { name, unit, role, email }
    })
    .filter(person => {
      const key = `${person.email || person.name}|${person.unit}|${person.role}`.toLowerCase()
      if (!person.name || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export default function DashboardPage() {
  const restoredPeople = useMemo(mapRestoredPeople, [])
  const [data, setData] = useState<DashboardData | null>(null)
  const [academic, setAcademic] = useState<AcademicState | null>(null)

  useEffect(() => {
    setAcademic(readAcademicState())
    api.get('/reports/dashboard').then(response => setData(response.data)).catch(() => setData(null))
  }, [])

  const units = Array.from(new Set(restoredPeople.map(person => person.unit))).filter(Boolean)
  const promoters = restoredPeople.filter(person => /promotor|promotora/i.test(person.role)).length
  const activeTasks = (data?.tasks?.pending || 0) + (data?.tasks?.in_progress || 0)
  const activeEvents = (data?.events?.planned || 0) + (data?.events?.ongoing || 0)
  const academicEvents = academic ? academicEventsFromState(academic) : []
  const openActivities = academic?.activities.filter(activity => activity.status !== 'concluida').length || 0
  const completedActivities = academic?.activities.filter(activity => activity.status === 'concluida').length || 0
  const academicProgress = academic?.activities.length ? Math.round((completedActivities / academic.activities.length) * 100) : 0
  const nextAcademicEvents = academicEvents
    .filter(event => event.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 4)

  const metrics = [
    { label: 'Pessoas na base', value: restoredPeople.length, detail: `${promoters} promotores mapeados`, icon: UsersIcon, color: '#8B5CF6' },
    { label: 'Unidades conectadas', value: units.length, detail: 'Dados vindos da restauração', icon: CpuChipIcon, color: '#00A9E0' },
    { label: 'Prazos acadêmicos', value: openActivities, detail: `${academicProgress}% concluído`, icon: AcademicCapIcon, color: '#0ABD78' },
    { label: 'Rotinas ativas', value: activeTasks + activeEvents, detail: 'Tarefas e eventos operacionais', icon: CheckCircleIcon, color: '#F6B221' },
  ]

  const modules = [
    { href: '/pessoas', title: 'Pessoas', kicker: 'Base restaurada', text: 'Perfis, contatos, documentos e leitura por unidade.', icon: UsersIcon, color: '#8B5CF6' },
    { href: '/academico', title: 'Acadêmico', kicker: 'Faculdade e agenda', text: 'Semestres, módulos, matérias e compromissos.', icon: AcademicCapIcon, color: '#0ABD78' },
    { href: '/gestao', title: 'Operação', kicker: 'Rotina da rede', text: 'Agenda, tarefas, responsáveis e prioridades.', icon: SparklesIcon, color: '#F6B221' },
    { href: '/reports', title: 'Relatórios', kicker: 'Inteligência', text: 'Ranking, desempenho e leitura executiva.', icon: ChartBarIcon, color: '#00A9E0' },
  ]

  return (
    <AdminLayout>
      <div className="relative z-10 space-y-6">
        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#071426] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:58px_58px]" />
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#F6B221,#00A9E0,#0ABD78,#8B5CF6)]" />
          <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/62 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-[#0ABD78]" />
                APS EDU command center
              </div>
              <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.96] tracking-tight text-[#F8FBFF] sm:text-6xl xl:text-7xl">
                Uma plataforma escolar com ritmo, presença e inteligência.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/58">
                A entrada agora funciona como um cockpit: mostra o estado real da rede, preserva as pessoas restauradas e conecta gestão, acadêmico e relatórios em um fluxo só.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pessoas" className="inline-flex h-[52px] items-center gap-2 rounded-full bg-[#F6B221] px-6 py-4 text-sm font-black text-[#001B3F] shadow-[0_20px_50px_rgba(246,178,33,0.28)] transition hover:-translate-y-0.5 hover:bg-[#FFD15C]">
                  Revisar Pessoas
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link href="/academico" className="inline-flex h-[52px] items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-6 py-4 text-sm font-black text-[#F8FBFF] transition hover:bg-white/[0.12]">
                  Ambiente Acadêmico
                </Link>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl xl:border-l xl:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Status de reconstrução</p>
              <div className="mt-5 space-y-3">
                {[
                  ['Base de pessoas', 'Restaurada e visível', '#0ABD78'],
                  ['Acadêmico', 'Módulos e agenda ativos', '#00A9E0'],
                  ['Relatórios', 'Conectados à base restaurada', '#F6B221'],
                  ['Design system', 'Em nova direção premium', '#8B5CF6'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-[22px] border border-white/10 bg-[#061121]/72 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#F8FBFF]">{label}</p>
                        <p className="mt-1 text-xs font-bold text-white/42">{value}</p>
                      </div>
                      <span className="h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 26px ${color}` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map(metric => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[34px] border border-white/10 bg-[#071426]/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F6B221]">Mapa da experiência</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#F8FBFF]">Quatro módulos que precisam parecer um produto só</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {modules.map(module => {
                const Icon = module.icon
                return (
                  <Link key={module.href} href={module.href} className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#0A1B31]/86 p-5 transition hover:-translate-y-1 hover:border-white/18 hover:bg-[#0E2745]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-[52px] w-[52px] place-items-center rounded-[22px]" style={{ background: `${module.color}20`, color: module.color }}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <ArrowRightIcon className="mt-2 h-5 w-5 text-white/24 transition group-hover:translate-x-1 group-hover:text-white" />
                    </div>
                    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em]" style={{ color: module.color }}>{module.kicker}</p>
                    <h3 className="mt-2 text-2xl font-black text-[#F8FBFF]">{module.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/46">{module.text}</p>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-[#071426]/92 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0ABD78]">Agenda viva</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#F8FBFF]">Próximos movimentos</h2>
              </div>
              <CalendarDaysIcon className="h-8 w-8 text-[#0ABD78]" />
            </div>
            <div className="mt-5 space-y-3">
              {nextAcademicEvents.map(event => (
                <div key={event.id} className="rounded-[24px] border border-white/10 bg-[#0A1B31]/86 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#F8FBFF]">{event.title}</p>
                      <p className="mt-1 text-xs font-bold text-white/42">{event.source || 'Acadêmico'}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-black text-[#F6B221]">
                      {dateFormatter.format(new Date(`${event.date}T12:00:00`))}
                    </span>
                  </div>
                </div>
              ))}
              {!nextAcademicEvents.length && (
                <div className="rounded-[24px] border border-dashed border-white/14 bg-[#0A1B31]/70 p-6 text-center">
                  <p className="text-sm font-black text-[#F8FBFF]">A agenda acadêmica ainda está livre.</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/42">Quando você cadastrar atividades no módulo Acadêmico, elas aparecem aqui automaticamente.</p>
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
    <div className="group rounded-[30px] border border-white/10 bg-[#071426]/92 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/18">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
          <p className="mt-4 text-5xl font-black tracking-tight text-[#F8FBFF]">{value.toLocaleString('pt-BR')}</p>
        </div>
        <span className="grid h-[52px] w-[52px] place-items-center rounded-[22px]" style={{ background: `${color}20`, color }}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-white/46">{detail}</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ width: '68%', background: `linear-gradient(90deg, ${color}, transparent)` }} />
      </div>
    </div>
  )
}

