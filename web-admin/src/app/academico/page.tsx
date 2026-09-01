'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import {
  type AcademicActivity,
  type AcademicModule,
  type AcademicState,
  type AcademicSubject,
  academicEventsFromState,
  fetchAcademicState,
  readAcademicState,
  saveAcademicState,
  writeAcademicState,
} from '@/lib/academic'

const colors = ['#005DAA', '#0ABD78', '#F8A303', '#8B5CF6', '#E07B39', '#0AB5C8']

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function dateLabel(value: string) {
  if (!value) return 'Sem data'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })
}

function daysUntil(value: string) {
  if (!value) return 999
  const today = new Date(`${todayIso()}T00:00:00`)
  const target = new Date(`${value}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export default function AcademicoPage() {
  const [state, setState] = useState<AcademicState>(() => readAcademicState())
  const [semesterId, setSemesterId] = useState('')
  const [moduleId, setModuleId] = useState('todos')
  const [subjectName, setSubjectName] = useState('')
  const [activityTitle, setActivityTitle] = useState('')
  const [activitySubjectId, setActivitySubjectId] = useState('')
  const [activityDate, setActivityDate] = useState(todayIso())
  const [syncMessage, setSyncMessage] = useState('')
  const [remoteLoaded, setRemoteLoaded] = useState(false)

  useEffect(() => {
    setSemesterId(current => current || state.semesters.find(semester => semester.active)?.id || state.semesters[0]?.id || '')
  }, [state.semesters])

  useEffect(() => {
    let active = true
    fetchAcademicState()
      .then(remoteState => {
        if (!active) return
        writeAcademicState(remoteState)
        setState(remoteState)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setRemoteLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    writeAcademicState(state)
    if (!remoteLoaded) return
    const timer = window.setTimeout(() => {
      saveAcademicState(state).catch(() => {})
    }, 500)
    return () => window.clearTimeout(timer)
  }, [state, remoteLoaded])

  const activeModules = useMemo(
    () => state.modules.filter(module => module.semesterId === semesterId),
    [state.modules, semesterId],
  )

  const visibleSubjects = useMemo(() => {
    return state.subjects.filter(subject =>
      subject.semesterId === semesterId &&
      (moduleId === 'todos' || subject.moduleId === moduleId)
    )
  }, [state.subjects, semesterId, moduleId])

  const visibleSubjectIds = useMemo(() => new Set(visibleSubjects.map(subject => subject.id)), [visibleSubjects])

  const visibleActivities = useMemo(() => {
    return state.activities
      .filter(activity => visibleSubjectIds.has(activity.subjectId))
      .sort((a, b) => `${a.dueDate} ${a.time}`.localeCompare(`${b.dueDate} ${b.time}`))
  }, [state.activities, visibleSubjectIds])

  const upcoming = useMemo(
    () => state.activities
      .filter(activity => activity.status !== 'concluida')
      .sort((a, b) => `${a.dueDate} ${a.time}`.localeCompare(`${b.dueDate} ${b.time}`))
      .slice(0, 6),
    [state.activities],
  )

  const completed = state.activities.filter(activity => activity.status === 'concluida').length
  const progress = state.activities.length ? Math.round((completed / state.activities.length) * 100) : 0
  const academicEvents = academicEventsFromState(state)

  function updateState(updater: (current: AcademicState) => AcademicState) {
    setState(current => updater(current))
  }

  function addSubject() {
    const name = subjectName.trim()
    if (!name) return
    const targetModule = moduleId !== 'todos' ? moduleId : activeModules[0]?.id
    if (!semesterId || !targetModule) return
    updateState(current => ({
      ...current,
      subjects: [
        {
          id: uid('sub'),
          semesterId,
          moduleId: targetModule,
          name,
          professor: 'A definir',
          room: 'Sala / AVA',
          schedule: 'Definir horário',
          color: colors[current.subjects.length % colors.length],
          credits: 4,
        },
        ...current.subjects,
      ],
    }))
    setSubjectName('')
  }

  function addActivity() {
    const title = activityTitle.trim()
    const subjectId = activitySubjectId || visibleSubjects[0]?.id
    if (!title || !subjectId) return
    updateState(current => ({
      ...current,
      activities: [
        {
          id: uid('act'),
          subjectId,
          title,
          type: 'atividade',
          dueDate: activityDate || todayIso(),
          time: '20:00',
          status: 'pendente',
          priority: 'media',
          notes: '',
        },
        ...current.activities,
      ],
    }))
    setActivityTitle('')
  }

  function addModule() {
    updateState(current => ({
      ...current,
      modules: [
        ...current.modules,
        { id: uid('mod'), semesterId, name: `Novo módulo ${activeModules.length + 1}`, focus: 'Organize disciplinas, atividades e leituras.' },
      ],
    }))
  }

  function updateSubject(subjectId: string, patch: Partial<AcademicSubject>) {
    updateState(current => ({
      ...current,
      subjects: current.subjects.map(subject => subject.id === subjectId ? { ...subject, ...patch } : subject),
    }))
  }

  function updateActivity(activityId: string, patch: Partial<AcademicActivity>) {
    updateState(current => ({
      ...current,
      activities: current.activities.map(activity => activity.id === activityId ? { ...activity, ...patch } : activity),
    }))
  }

  function removeActivity(activityId: string) {
    updateState(current => ({ ...current, activities: current.activities.filter(activity => activity.id !== activityId) }))
  }

  function syncAgenda() {
    writeAcademicState(state)
    setSyncMessage(`${academicEvents.length} compromisso${academicEvents.length === 1 ? '' : 's'} acadêmico${academicEvents.length === 1 ? '' : 's'} na agenda geral.`)
    window.setTimeout(() => setSyncMessage(''), 2600)
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_22px_70px_rgba(0,63,117,0.10)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6B7F94]">Ambiente acadêmico</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-[#001B3F] sm:text-4xl">Portal de estudos</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5D7085]">
                  Organize semestres, módulos, matérias, prazos e compromissos da faculdade em um painel único.
                </p>
              </div>
              <button
                type="button"
                onClick={syncAgenda}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F8A303] px-4 text-sm font-black text-[#001B3F] shadow-[0_14px_30px_rgba(248,163,3,0.22)]"
              >
                <CalendarDaysIcon className="h-4 w-4" />
                Sincronizar agenda
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Semestre" value={state.semesters.find(item => item.id === semesterId)?.period || '-'} />
              <Metric label="Matérias" value={String(visibleSubjects.length)} />
              <Metric label="Prazos abertos" value={String(state.activities.filter(item => item.status !== 'concluida').length)} />
              <Metric label="Progresso" value={`${progress}%`} />
            </div>
          </div>

          <div className="rounded-[28px] border border-[#D8E5F0] bg-[#F7FBFF] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6B7F94]">Agenda geral</p>
            <h2 className="mt-1 text-2xl font-black text-[#001B3F]">Próximos prazos</h2>
            <div className="mt-4 space-y-2">
              {upcoming.map(activity => (
                <ActivityMini key={activity.id} activity={activity} subject={state.subjects.find(subject => subject.id === activity.subjectId)} />
              ))}
              {!upcoming.length && <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-[#6B7F94]">Nenhum prazo aberto.</p>}
            </div>
            {syncMessage && <p className="mt-3 rounded-2xl bg-[#0ABD78]/12 px-4 py-3 text-xs font-black text-[#007A4D]">{syncMessage}</p>}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/88 p-4 shadow-[0_20px_60px_rgba(0,63,117,0.08)]">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {state.semesters.map(semester => (
              <button
                key={semester.id}
                type="button"
                onClick={() => { setSemesterId(semester.id); setModuleId('todos') }}
                className={`h-11 rounded-2xl px-4 text-sm font-black transition ${semesterId === semester.id ? 'bg-[#005DAA] text-white' : 'bg-[#EAF4FF] text-[#005DAA]'}`}
              >
                {semester.name} · {semester.period}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setModuleId('todos')}
              className={`h-10 rounded-2xl px-4 text-xs font-black ${moduleId === 'todos' ? 'bg-[#001B3F] text-white' : 'bg-white text-[#003F75]'}`}
            >
              Todos os módulos
            </button>
            {activeModules.map(module => (
              <button
                key={module.id}
                type="button"
                onClick={() => setModuleId(module.id)}
                className={`h-10 rounded-2xl px-4 text-xs font-black ${moduleId === module.id ? 'bg-[#001B3F] text-white' : 'bg-white text-[#003F75]'}`}
              >
                {module.name}
              </button>
            ))}
            <button type="button" onClick={addModule} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F8A303] text-[#001B3F]">
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/80 bg-white/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6B7F94]">Matriz curricular</p>
                  <h2 className="mt-1 text-2xl font-black text-[#001B3F]">Matérias</h2>
                </div>
                <AcademicCapIcon className="h-8 w-8 text-[#005DAA]" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input value={subjectName} onChange={event => setSubjectName(event.target.value)} placeholder="Nova matéria" className="h-11 rounded-2xl border border-[#C9DBEA] bg-white px-4 text-sm font-bold text-[#001B3F] outline-none" />
                <button type="button" onClick={addSubject} className="h-11 rounded-2xl bg-[#005DAA] px-4 text-sm font-black text-white">Adicionar</button>
              </div>
              <div className="mt-4 grid gap-3">
                {visibleSubjects.map(subject => (
                  <SubjectCard key={subject.id} subject={subject} modules={state.modules} onUpdate={patch => updateSubject(subject.id, patch)} />
                ))}
                {!visibleSubjects.length && <Empty title="Nenhuma matéria nesse filtro" text="Adicione uma matéria ou escolha outro módulo." />}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6B7F94]">Atividades e datas</p>
                <h2 className="mt-1 text-2xl font-black text-[#001B3F]">Plano de entregas</h2>
              </div>
              <ClipboardDocumentListIcon className="h-8 w-8 text-[#0ABD78]" />
            </div>
            <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_170px_150px_auto]">
              <input value={activityTitle} onChange={event => setActivityTitle(event.target.value)} placeholder="Nova atividade, prova ou leitura" className="h-11 rounded-2xl border border-[#C9DBEA] bg-white px-4 text-sm font-bold text-[#001B3F] outline-none" />
              <select value={activitySubjectId} onChange={event => setActivitySubjectId(event.target.value)} className="h-11 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-sm font-bold text-[#001B3F] outline-none">
                <option value="">Matéria</option>
                {visibleSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
              <input type="date" value={activityDate} onChange={event => setActivityDate(event.target.value)} className="h-11 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-sm font-bold text-[#001B3F] outline-none" />
              <button type="button" onClick={addActivity} className="h-11 rounded-2xl bg-[#0ABD78] px-4 text-sm font-black text-white">Criar</button>
            </div>
            <div className="mt-4 grid gap-3">
              {visibleActivities.map(activity => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  subject={state.subjects.find(subject => subject.id === activity.subjectId)}
                  onUpdate={patch => updateActivity(activity.id, patch)}
                  onRemove={() => removeActivity(activity.id)}
                />
              ))}
              {!visibleActivities.length && <Empty title="Nenhuma entrega cadastrada" text="Crie uma atividade para ela aparecer aqui e na agenda geral." />}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#D8E5F0] bg-white px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#001B3F]">{value}</p>
    </div>
  )
}

function SubjectCard({ subject, modules, onUpdate }: { subject: AcademicSubject; modules: AcademicModule[]; onUpdate: (patch: Partial<AcademicSubject>) => void }) {
  return (
    <div className="rounded-[22px] border border-[#D8E5F0] bg-[#F7FBFF] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 rounded-full" style={{ background: subject.color }} />
        <div className="min-w-0 flex-1">
          <input value={subject.name} onChange={event => onUpdate({ name: event.target.value })} className="w-full bg-transparent text-lg font-black text-[#001B3F] outline-none" />
          <p className="mt-1 text-xs font-bold text-[#6B7F94]">{modules.find(module => module.id === subject.moduleId)?.name || 'Módulo'}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input value={subject.professor} onChange={event => onUpdate({ professor: event.target.value })} placeholder="Professor" className="h-10 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-xs font-bold text-[#001B3F] outline-none" />
        <input value={subject.schedule} onChange={event => onUpdate({ schedule: event.target.value })} placeholder="Horário" className="h-10 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-xs font-bold text-[#001B3F] outline-none" />
        <input value={subject.room} onChange={event => onUpdate({ room: event.target.value })} placeholder="Sala / AVA" className="h-10 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-xs font-bold text-[#001B3F] outline-none" />
      </div>
    </div>
  )
}

function ActivityRow({ activity, subject, onUpdate, onRemove }: { activity: AcademicActivity; subject?: AcademicSubject; onUpdate: (patch: Partial<AcademicActivity>) => void; onRemove: () => void }) {
  const due = daysUntil(activity.dueDate)
  const danger = due < 0 || (due <= 3 && activity.status !== 'concluida')
  return (
    <div className="rounded-[22px] border border-[#D8E5F0] bg-[#F7FBFF] p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_120px_118px_130px_36px] lg:items-center">
        <div className="min-w-0">
          <input value={activity.title} onChange={event => onUpdate({ title: event.target.value })} className="w-full bg-transparent text-base font-black text-[#001B3F] outline-none" />
          <p className="mt-1 text-xs font-bold text-[#6B7F94]">{subject?.name || 'Matéria'} · {activity.type}</p>
        </div>
        <input type="date" value={activity.dueDate} onChange={event => onUpdate({ dueDate: event.target.value })} className="h-10 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-xs font-bold text-[#001B3F] outline-none" />
        <input type="time" value={activity.time} onChange={event => onUpdate({ time: event.target.value })} className="h-10 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-xs font-bold text-[#001B3F] outline-none" />
        <select value={activity.status} onChange={event => onUpdate({ status: event.target.value as AcademicActivity['status'] })} className="h-10 rounded-2xl border border-[#C9DBEA] bg-white px-3 text-xs font-bold text-[#001B3F] outline-none">
          <option value="pendente">Pendente</option>
          <option value="em-andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
        </select>
        <button type="button" onClick={onRemove} className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#FF4757]">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-black ${danger ? 'bg-[#FF4757]/12 text-[#C93446]' : 'bg-white text-[#6B7F94]'}`}>
          {due < 0 ? `${Math.abs(due)} dia(s) em atraso` : due === 0 ? 'Hoje' : `${due} dia(s)`}
        </span>
        <select value={activity.type} onChange={event => onUpdate({ type: event.target.value as AcademicActivity['type'] })} className="h-8 rounded-full border border-[#C9DBEA] bg-white px-3 text-xs font-black text-[#003F75] outline-none">
          <option value="atividade">Atividade</option>
          <option value="prova">Prova</option>
          <option value="trabalho">Trabalho</option>
          <option value="leitura">Leitura</option>
          <option value="estudo">Estudo</option>
          <option value="aula">Aula</option>
        </select>
      </div>
    </div>
  )
}

function ActivityMini({ activity, subject }: { activity: AcademicActivity; subject?: AcademicSubject }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#001B3F]">{activity.title}</p>
          <p className="mt-1 text-xs font-bold text-[#6B7F94]">{subject?.name || 'Matéria'} · {dateLabel(activity.dueDate)} às {activity.time}</p>
        </div>
        {activity.status === 'concluida' ? <CheckCircleIcon className="h-5 w-5 text-[#0ABD78]" /> : <SparklesIcon className="h-5 w-5 text-[#F8A303]" />}
      </div>
    </div>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#C9DBEA] bg-white p-6 text-center">
      <p className="font-black text-[#001B3F]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[#6B7F94]">{text}</p>
    </div>
  )
}
