'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { ACADEMIC_UPDATED_EVENT, academicEventsFromState, readAcademicState, type AcademicState } from '@/lib/academic'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CloudIcon,
  LinkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

type CalendarEvent = {
  id: string
  title: string
  start: string
  end?: string
  provider?: string
  source?: string
  location?: string
  description?: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dateKey(value: string) {
  return value.slice(0, 10)
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || '--:--'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function eventDateLabel(value: string) {
  const date = new Date(`${dateKey(value)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function icsDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value = '') {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function downloadIcs(events: CalendarEvent[]) {
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APS EDU//Agenda Central//PT-BR',
    'CALSCALE:GREGORIAN',
    ...events.flatMap(event => [
      'BEGIN:VEVENT',
      `UID:${event.id}@aps-edu`,
      `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end || event.start)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description || event.source || event.provider || '')}`,
      `LOCATION:${escapeIcs(event.location || '')}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aps-edu-agenda-${todayIso()}.ics`
  link.click()
  URL.revokeObjectURL(url)
}

export default function AgendaPage() {
  const [academic, setAcademic] = useState<AcademicState | null>(null)
  const [external, setExternal] = useState<CalendarEvent[]>([])
  const [loadingExternal, setLoadingExternal] = useState(false)
  const [externalError, setExternalError] = useState('')
  const [range, setRange] = useState<'7' | '30' | '90'>('30')
  const [filter, setFilter] = useState<'todos' | 'academico' | 'externo'>('todos')

  const academicEvents = useMemo<CalendarEvent[]>(() => {
    if (!academic) return []
    return academicEventsFromState(academic).map(event => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      provider: 'academic',
      source: event.source,
      location: event.location,
      description: event.description,
    }))
  }, [academic])

  async function refreshExternal() {
    setLoadingExternal(true)
    setExternalError('')
    const from = new Date()
    const to = addDays(from, Number(range))
    try {
      const response = await api.get('/calendar', {
        params: { from: from.toISOString(), to: to.toISOString() },
      })
      setExternal(Array.isArray(response.data?.events) ? response.data.events : [])
    } catch (error: any) {
      setExternal([])
      setExternalError(error?.response?.data?.error || 'Nenhuma agenda externa conectada ou disponível agora.')
    } finally {
      setLoadingExternal(false)
    }
  }

  useEffect(() => {
    const update = () => setAcademic(readAcademicState())
    update()
    window.addEventListener(ACADEMIC_UPDATED_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(ACADEMIC_UPDATED_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  useEffect(() => {
    void refreshExternal()
  }, [range])

  const events = useMemo(() => {
    const all = [...academicEvents, ...external]
      .filter(event => Boolean(event.start))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    if (filter === 'academico') return all.filter(event => event.provider === 'academic')
    if (filter === 'externo') return all.filter(event => event.provider !== 'academic')
    return all
  }, [academicEvents, external, filter])

  const today = todayIso()
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = dateKey(event.start)
    acc[key] = [...(acc[key] || []), event]
    return acc
  }, {})
  const overdueAcademic = academicEvents.filter(event => dateKey(event.start) < today).length

  return (
    <AdminLayout>
      <div className="space-y-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-lg border border-[#dbe6ef] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Agenda unificada</p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-none text-[#0f172a]">Calendário central</h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#64748b]">
                  Prazos acadêmicos, tarefas e calendários externos em uma visão única, com exportação para Apple Calendar e Google Agenda.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={refreshExternal} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dbe6ef] bg-white px-4 text-sm font-black text-[#334155]">
                  <ArrowPathIcon className={`h-4 w-4 ${loadingExternal ? 'animate-spin' : ''}`} /> Atualizar
                </button>
                <button onClick={() => downloadIcs(events)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#006b7a] px-4 text-sm font-black text-white">
                  <ArrowDownTrayIcon className="h-4 w-4" /> Exportar .ics
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric icon={CalendarDaysIcon} label="Compromissos" value={events.length} detail="no filtro atual" />
              <Metric icon={CheckCircleIcon} label="Acadêmico" value={academicEvents.length} detail="atividades abertas" />
              <Metric icon={CloudIcon} label="Externos" value={external.length} detail="Google, Microsoft ou iCloud" />
              <Metric icon={LinkIcon} label="Atrasados" value={overdueAcademic} detail="prazos acadêmicos" />
            </div>
          </div>

          <aside className="rounded-lg border border-[#dbe6ef] bg-[#f9fcff] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Conexões</p>
            <h2 className="mt-2 text-2xl font-black text-[#0f172a]">Sincronização real</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#64748b]">
              A plataforma consulta o backend criptografado. Quando não houver conta conectada, você ainda pode exportar um arquivo .ics para iPhone, Mac ou Google Agenda.
            </p>
            {externalError && <p className="mt-4 rounded-lg border border-[#fde7c4] bg-[#fff8ed] px-4 py-3 text-xs font-bold text-[#9a5b00]">{externalError}</p>}
            <a href="/integracoes" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#00a9a4] px-4 text-sm font-black text-white">
              <PlusIcon className="h-4 w-4" /> Conectar ferramentas
            </a>
          </aside>
        </section>

        <section className="rounded-lg border border-[#dbe6ef] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                ['todos', 'Todos'],
                ['academico', 'Acadêmico'],
                ['externo', 'Externos'],
              ].map(([id, label]) => (
                <button key={id} onClick={() => setFilter(id as any)} className={`h-10 rounded-lg px-4 text-xs font-black ${filter === id ? 'bg-[#006b7a] text-white' : 'bg-[#eef5f8] text-[#334155]'}`}>
                  {label}
                </button>
              ))}
            </div>
            <select value={range} onChange={event => setRange(event.target.value as any)} className="h-10 rounded-lg border border-[#dbe6ef] bg-white px-3 text-sm font-bold text-[#172033] outline-none">
              <option value="7">Próximos 7 dias</option>
              <option value="30">Próximos 30 dias</option>
              <option value="90">Próximos 90 dias</option>
            </select>
          </div>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-[420px] divide-y divide-[#edf2f7]">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date} className="grid gap-3 p-4 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-black capitalize text-[#0f172a]">{eventDateLabel(date)}</p>
                    <p className="mt-1 text-xs font-bold text-[#64748b]">{items.length} compromisso{items.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="grid gap-2">
                    {items.map(event => (
                      <a key={`${event.provider}-${event.id}`} href={event.provider === 'academic' ? '/academico' : '/integracoes'} className="grid gap-2 rounded-lg border border-[#dbe6ef] bg-[#f9fcff] p-4 text-left no-underline sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:items-center">
                        <span className="text-sm font-black text-[#006b7a]">{timeLabel(event.start)}</span>
                        <span className="min-w-0">
                          <b className="block text-sm font-black text-[#172033]">{event.title}</b>
                          <small className="mt-1 block text-xs font-bold text-[#64748b]">{event.location || event.source || event.provider || 'APS EDU'}</small>
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#64748b]">{event.provider === 'academic' ? 'Acadêmico' : event.provider || 'Externo'}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              {!events.length && (
                <div className="grid min-h-[360px] place-items-center p-8 text-center">
                  <div>
                    <CalendarDaysIcon className="mx-auto h-10 w-10 text-[#94a3b8]" />
                    <h2 className="mt-3 text-xl font-black text-[#0f172a]">Nenhum compromisso encontrado</h2>
                    <p className="mt-2 max-w-md text-sm font-semibold text-[#64748b]">Cadastre atividades no Acadêmico ou conecte uma agenda externa em Integrações.</p>
                  </div>
                </div>
              )}
            </div>
            <aside className="border-t border-[#e2e8f0] p-4 lg:border-l lg:border-t-0">
              <h2 className="text-base font-black text-[#0f172a]">Fluxo recomendado</h2>
              <div className="mt-4 grid gap-3">
                {['Crie matérias e atividades no Acadêmico.', 'Conecte Google Agenda ou Microsoft Calendar.', 'Exporte .ics quando quiser usar no iOS/macOS.', 'Use o Kanban para transformar compromissos em execução.'].map(text => (
                  <div key={text} className="rounded-lg border border-[#dbe6ef] bg-white p-3 text-sm font-bold leading-6 text-[#475569]">{text}</div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: any; label: string; value: number; detail: string }) {
  return (
    <div className="rounded-lg border border-[#dbe6ef] bg-[#fbfdff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#718096]">{label}</p>
          <p className="mt-2 text-3xl font-black text-[#0f172a]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[#64748b]">{detail}</p>
        </div>
        <Icon className="h-6 w-6 text-[#00a9a4]" />
      </div>
    </div>
  )
}
