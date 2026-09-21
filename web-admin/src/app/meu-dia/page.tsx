'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Cookies from 'js-cookie'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  DocumentTextIcon,
  FlagIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const LS_HABITS = 'apsedu_habits'
const LS_NOTES = 'apsedu_quicknotes'
const LS_FOCUS = 'apsedu_focus'
const LS_CHECKIN = 'apsedu_checkin'

const MOODS = [
  { label: 'Excelente', value: 5, mark: '5' },
  { label: 'Bem', value: 4, mark: '4' },
  { label: 'Regular', value: 3, mark: '3' },
  { label: 'Cansado', value: 2, mark: '2' },
  { label: 'Difícil', value: 1, mark: '1' },
]

const DEFAULT_HABITS = [
  { id: '1', label: 'Devocional ou oração' },
  { id: '2', label: 'Exercício físico' },
  { id: '3', label: 'Leitura' },
  { id: '4', label: 'Água: 8 copos' },
  { id: '5', label: 'Sono de qualidade' },
  { id: '6', label: 'Uma hora sem redes sociais' },
]

const PHRASES = [
  'Tudo posso naquele que me fortalece. - Fp 4:13',
  'O Senhor é meu pastor e nada me faltará. - Sl 23:1',
  'Seja forte e corajoso. Não se apavore. - Js 1:9',
  'Confie no Senhor de todo o seu coração. - Pv 3:5',
  'Aquele que começou a boa obra em você a completará. - Fp 1:6',
  'Porque sou eu que conheço os planos que tenho para você. - Jr 29:11',
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(value?: string) {
  if (!value) return 'Dia todo'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value.slice(0, 5)
    : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Panel({
  title,
  eyebrow,
  icon: Icon,
  action,
  children,
  className = '',
}: {
  title: string
  eyebrow?: string
  icon: React.ElementType
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-bold uppercase text-slate-400">{eyebrow}</p>}
            <h2 className="truncate text-base font-bold text-slate-900">{title}</h2>
          </div>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

export default function MeuDiaPage() {
  const [userName, setUserName] = useState('Administrador')
  const [tasks, setTasks] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarState, setCalendarState] = useState<'loading' | 'connected' | 'offline'>('loading')
  const [focus, setFocus] = useState('')
  const [focusInput, setFocusInput] = useState('')
  const [note, setNote] = useState('')
  const [habits, setHabits] = useState<Record<string, boolean>>({})
  const [mood, setMood] = useState<number | null>(null)

  const dateKey = todayKey()
  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [tasksResult, calendarResult] = await Promise.allSettled([
      api.get('/tasks'),
      fetch(`/api/calendar?from=${encodeURIComponent(`${dateKey}T00:00:00-03:00`)}&to=${encodeURIComponent(`${dateKey}T23:59:59-03:00`)}`),
    ])

    if (tasksResult.status === 'fulfilled') {
      const data = tasksResult.value.data
      setTasks(Array.isArray(data) ? data : data?.items || data?.tasks || [])
    }

    if (calendarResult.status === 'fulfilled' && calendarResult.value.ok) {
      const data = await calendarResult.value.json()
      setEvents(Array.isArray(data) ? data : data?.events || data?.items || [])
      setCalendarState('connected')
    } else {
      setCalendarState('offline')
    }
    setLoading(false)
  }, [dateKey])

  useEffect(() => {
    try {
      const raw = Cookies.get('user')
      if (raw) {
        const parsed = JSON.parse(decodeURIComponent(raw))
        setUserName(parsed?.name?.split(' ')[0] || 'Administrador')
      }
    } catch {}

    setFocus(localStorage.getItem(`${LS_FOCUS}_${dateKey}`) || '')
    setFocusInput(localStorage.getItem(`${LS_FOCUS}_${dateKey}`) || '')
    setNote(localStorage.getItem(`${LS_NOTES}_${dateKey}`) || '')
    try {
      setHabits(JSON.parse(localStorage.getItem(`${LS_HABITS}_${dateKey}`) || '{}'))
      const savedMood = JSON.parse(localStorage.getItem(`${LS_CHECKIN}_${dateKey}`) || 'null')
      setMood(typeof savedMood === 'number' ? savedMood : savedMood?.value ?? null)
    } catch {}
    loadData()
  }, [dateKey, loadData])

  const openTasks = useMemo(
    () => tasks.filter(task => !['done', 'completed', 'concluido'].includes(String(task.status).toLowerCase())),
    [tasks],
  )
  const urgentTasks = useMemo(
    () => openTasks.filter(task => ['high', 'alta', 'urgent'].includes(String(task.priority).toLowerCase())).slice(0, 4),
    [openTasks],
  )
  const remainingTasks = openTasks.filter(task => !urgentTasks.some(urgent => urgent.id === task.id)).slice(0, 6)
  const completedHabits = Object.values(habits).filter(Boolean).length

  function saveFocus() {
    const clean = focusInput.trim()
    setFocus(clean)
    localStorage.setItem(`${LS_FOCUS}_${dateKey}`, clean)
  }

  function saveNote(value: string) {
    setNote(value)
    localStorage.setItem(`${LS_NOTES}_${dateKey}`, value)
  }

  function toggleHabit(id: string) {
    const next = { ...habits, [id]: !habits[id] }
    setHabits(next)
    localStorage.setItem(`${LS_HABITS}_${dateKey}`, JSON.stringify(next))
  }

  function chooseMood(value: number) {
    setMood(value)
    localStorage.setItem(`${LS_CHECKIN}_${dateKey}`, JSON.stringify(value))
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-teal-700">Painel pessoal</p>
            <h1 className="text-3xl font-bold text-slate-950">Bom dia, {userName}.</h1>
            <p className="mt-1 text-sm capitalize text-slate-500">{todayLabel}</p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${calendarState === 'connected' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <span className={`h-2 w-2 rounded-full ${calendarState === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {calendarState === 'loading' ? 'Verificando Google Agenda' : calendarState === 'connected' ? 'Google Agenda sincronizada' : 'Google Agenda desconectada'}
          </div>
        </header>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-950">
          <SparklesIcon className="mr-2 inline h-4 w-4 text-amber-600" />
          {PHRASES[new Date().getDay() % PHRASES.length]}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr_0.9fr]">
          <Panel title="Foco principal" eyebrow="Prioridade do dia" icon={FlagIcon}>
            <textarea
              value={focusInput}
              onChange={event => setFocusInput(event.target.value)}
              placeholder="Qual resultado tornaria o seu dia produtivo?"
              className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="truncate text-xs text-slate-500">{focus ? `Salvo: ${focus}` : 'Ainda não definido'}</span>
              <button onClick={saveFocus} className="rounded-md bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800">Salvar foco</button>
            </div>
          </Panel>

          <Panel title="Como você está?" eyebrow="Check-in" icon={SparklesIcon}>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map(item => (
                <button
                  key={item.value}
                  onClick={() => chooseMood(item.value)}
                  className={`flex min-h-24 flex-col items-center justify-center rounded-md border p-2 transition ${mood === item.value ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  title={item.label}
                >
                  <span className="text-xl font-bold">{item.mark}</span>
                  <span className="mt-1 text-[10px] font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Hábitos"
            eyebrow={`${completedHabits} de ${DEFAULT_HABITS.length} concluídos`}
            icon={CheckCircleIcon}
          >
            <div className="space-y-2">
              {DEFAULT_HABITS.map(habit => (
                <button key={habit.id} onClick={() => toggleHabit(habit.id)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-slate-50">
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded border ${habits[habit.id] ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {habits[habit.id] && <CheckIcon className="h-4 w-4" />}
                  </span>
                  <span className={`text-sm ${habits[habit.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{habit.label}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
          <Panel
            title="Agenda de hoje"
            eyebrow="Compromissos"
            icon={CalendarDaysIcon}
            action={<button onClick={loadData} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Atualizar"><ArrowPathIcon className="h-4 w-4" /></button>}
          >
            {loading ? <EmptyState>Carregando a agenda...</EmptyState> : events.length === 0 ? <EmptyState>Nenhum compromisso sincronizado para hoje.</EmptyState> : (
              <div className="divide-y divide-slate-100">
                {events.map(event => (
                  <div key={event.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="w-14 flex-none text-sm font-bold text-teal-700">{formatTime(event.start?.dateTime || event.start?.date || event.start)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{event.summary || event.title || 'Compromisso sem título'}</p>
                      <p className="truncate text-xs text-slate-500">{event.location || event.organizer?.displayName || event.calendar || 'Google Agenda'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Notas rápidas" eyebrow="Salvas neste dispositivo" icon={DocumentTextIcon}>
            <textarea
              value={note}
              onChange={event => saveNote(event.target.value)}
              placeholder="Registre ideias, decisões e lembretes do dia..."
              className="min-h-52 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            />
            <p className="mt-2 text-right text-[11px] text-slate-400">Salvamento automático</p>
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Prioridades" eyebrow={`${urgentTasks.length} tarefas urgentes`} icon={ClockIcon}>
            {urgentTasks.length === 0 ? <EmptyState>Nenhuma tarefa urgente. Ótimo sinal.</EmptyState> : (
              <div className="space-y-2">
                {urgentTasks.map(task => <TaskRow key={task.id} task={task} accent="rose" />)}
              </div>
            )}
          </Panel>
          <Panel title="Demais tarefas" eyebrow={`${openTasks.length} em aberto`} icon={CheckCircleIcon}>
            {remainingTasks.length === 0 ? <EmptyState>Nenhuma outra tarefa em aberto.</EmptyState> : (
              <div className="space-y-2">
                {remainingTasks.map(task => <TaskRow key={task.id} task={task} accent="teal" />)}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  )
}

function TaskRow({ task, accent }: { task: any; accent: 'rose' | 'teal' }) {
  const due = task.dueDate || task.due_date || task.deadline
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{task.title || task.name}</p>
        <p className="truncate text-xs text-slate-500">{task.project?.name || task.category || 'Tarefa geral'}</p>
      </div>
      <span className={`flex-none rounded px-2 py-1 text-[10px] font-bold ${accent === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'}`}>
        {due ? new Date(`${String(due).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}
      </span>
    </div>
  )
}
