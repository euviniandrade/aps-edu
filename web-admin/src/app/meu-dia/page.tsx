'use client'
import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import Cookies from 'js-cookie'
import { useToast } from '@/contexts/ToastContext'

const LS_HABITS   = 'apsedu_habits'
const LS_NOTES    = 'apsedu_quicknotes'
const LS_FOCUS    = 'apsedu_focus'
const LS_CHECKIN  = 'apsedu_checkin'

function todayKey() { return new Date().toISOString().slice(0, 10) }

const MOODS = [
  { label: 'Ótimo',    emoji: '😄', color: '#0ABD78' },
  { label: 'Bem',      emoji: '🙂', color: '#4A9EFF' },
  { label: 'Normal',   emoji: '😐', color: '#F8A303' },
  { label: 'Cansado',  emoji: '😴', color: '#8B5CF6' },
  { label: 'Estressado', emoji: '😤', color: '#FF4757' },
]

const DEFAULT_HABITS = [
  { id: '1', label: 'Devocional / Oração', icon: '🙏' },
  { id: '2', label: 'Exercício físico',    icon: '🏃' },
  { id: '3', label: 'Leitura',             icon: '📚' },
  { id: '4', label: 'Água 8 copos',        icon: '💧' },
  { id: '5', label: 'Sono de qualidade',   icon: '😴' },
  { id: '6', label: 'Sem redes sociais −1h', icon: '📵' },
]

export default function MeuDiaPage() {
  const { success, info } = useToast()
  const [user, setUser]   = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Focus task
  const [focus, setFocus]       = useState('')
  const [focusInput, setFocusInput] = useState('')
  const [editingFocus, setEditingFocus] = useState(false)

  // Quick notes
  const [note, setNote]         = useState('')

  // Habits
  const [habits, setHabits]     = useState<Record<string, boolean>>({})

  // Mood check-in
  const [mood, setMood]         = useState<number | null>(null)

  // Priority tasks (my tasks)
  const [myTasks, setMyTasks]   = useState<any[]>([])

  // Phrase of the day
  const PHRASES = [
    'Tudo posso naquele que me fortalece. — Fp 4:13',
    'O Senhor é meu pastor e nada me faltará. — Sl 23:1',
    'Seja forte e corajoso. Não se apavore. — Js 1:9',
    'Confie no SENHOR de todo o seu coração. — Pv 3:5',
    'Aquele que começou a boa obra em você a completará. — Fp 1:6',
    'Porque sou eu que conheço os planos que tenho para você. — Jr 29:11',
  ]
  const phrase = PHRASES[new Date().getDay() % PHRASES.length]

  const today = new Date()
  const todayStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    // Load user
    try {
      const raw = Cookies.get('user')
      if (raw) setUser(JSON.parse(decodeURIComponent(raw)))
    } catch {}

    // Load persisted data
    const savedFocus  = localStorage.getItem(LS_FOCUS  + '_' + todayKey()) || ''
    const savedNote   = localStorage.getItem(LS_NOTES  + '_' + todayKey()) || ''
    const savedHabits = JSON.parse(localStorage.getItem(LS_HABITS + '_' + todayKey()) || '{}')
    const savedMood   = localStorage.getItem(LS_CHECKIN + '_' + todayKey())
    setFocus(savedFocus)
    setFocusInput(savedFocus)
    setNote(savedNote)
    setHabits(savedHabits)
    setMood(savedMood !== null ? Number(savedMood) : null)

    // Fetch tasks + events
    Promise.all([
      api.get('/tasks?limit=50&status=pending'),
      api.get('/tasks?limit=50&status=in_progress'),
      api.get('/events?limit=30'),
    ]).then(([pending, inProgress, evRes]) => {
      const allTasks = [...(pending.data.tasks || []), ...(inProgress.data.tasks || [])]
      setMyTasks(allTasks)
      setEvents(evRes.data.events || evRes.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const saveFocus = () => {
    localStorage.setItem(LS_FOCUS + '_' + todayKey(), focusInput)
    setFocus(focusInput)
    setEditingFocus(false)
    success('Foco do dia definido!', focusInput)
  }

  const saveNote = useCallback((val: string) => {
    setNote(val)
    localStorage.setItem(LS_NOTES + '_' + todayKey(), val)
  }, [])

  const toggleHabit = (id: string) => {
    const next = { ...habits, [id]: !habits[id] }
    setHabits(next)
    localStorage.setItem(LS_HABITS + '_' + todayKey(), JSON.stringify(next))
  }

  const setMoodToday = (idx: number) => {
    setMood(idx)
    localStorage.setItem(LS_CHECKIN + '_' + todayKey(), String(idx))
    success(`Check-in: ${MOODS[idx].label}!`, 'Seu humor de hoje foi registrado.')
  }

  // Today's events
  const todayEvents = events.filter(ev => {
    const start = new Date(ev.startDate || ev.startDateTime || ev.date || '')
    return start.toDateString() === today.toDateString()
  }).sort((a, b) => new Date(a.startDate || a.date || '').getTime() - new Date(b.startDate || b.date || '').getTime())

  // Urgent tasks
  const urgentTasks = myTasks.filter(t => t.priority === 'critical' || t.priority === 'high').slice(0, 5)
  const pendingTasks = myTasks.filter(t => t.priority !== 'critical' && t.priority !== 'high').slice(0, 5)

  const completedHabits = Object.values(habits).filter(Boolean).length
  const habitPct = Math.round((completedHabits / DEFAULT_HABITS.length) * 100)

  const firstName = (user?.name || 'Colaborador').split(' ')[0]
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="text-sm mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {todayStr}
            </p>
          </div>
          {mood !== null && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: `${MOODS[mood].color}15`, border: `1px solid ${MOODS[mood].color}30`, color: MOODS[mood].color }}
            >
              <span>{MOODS[mood].emoji}</span>
              <span className="font-semibold">{MOODS[mood].label}</span>
            </div>
          )}
        </div>

        {/* Verse */}
        <div
          className="mt-3 px-4 py-3 rounded-xl text-sm italic"
          style={{
            background: 'rgba(248,163,3,0.06)',
            border: '1px solid rgba(248,163,3,0.15)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          ✨ {phrase}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── COL 1: Focus + Mood + Habits ── */}
        <div className="space-y-4">

          {/* Focus do Dia */}
          <div
            className="rounded-2xl p-5 animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">🎯 Foco Principal Hoje</h2>
              {!editingFocus && (
                <button
                  onClick={() => setEditingFocus(true)}
                  className="text-xs px-2 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                >
                  {focus ? 'Editar' : 'Definir'}
                </button>
              )}
            </div>

            {editingFocus ? (
              <div className="space-y-2">
                <textarea
                  value={focusInput}
                  onChange={e => setFocusInput(e.target.value)}
                  placeholder="Ex: Finalizar relatório de matrículas..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveFocus}
                    className="flex-1 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000' }}
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => { setEditingFocus(false); setFocusInput(focus) }}
                    className="px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : focus ? (
              <p
                className="text-sm leading-relaxed font-medium"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  background: 'rgba(248,163,3,0.08)',
                  border: '1px solid rgba(248,163,3,0.2)',
                  borderLeft: '3px solid #F8A303',
                  padding: '10px 12px',
                  borderRadius: 10,
                }}
              >
                {focus}
              </p>
            ) : (
              <button
                onClick={() => setEditingFocus(true)}
                className="w-full rounded-xl py-6 flex flex-col items-center gap-1.5 transition-colors"
                style={{ border: '2px dashed rgba(248,163,3,0.2)', color: 'rgba(255,255,255,0.2)' }}
              >
                <span className="text-2xl">🎯</span>
                <p className="text-xs">Clique para definir seu foco de hoje</p>
              </button>
            )}
          </div>

          {/* Mood Check-in */}
          <div
            className="rounded-2xl p-5 animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h2 className="text-sm font-bold text-white mb-3">💭 Como você está hoje?</h2>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => setMoodToday(idx)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-110"
                  style={{
                    background: mood === idx ? `${m.color}18` : 'rgba(255,255,255,0.04)',
                    border: mood === idx ? `1.5px solid ${m.color}40` : '1px solid rgba(255,255,255,0.07)',
                    flex: '1 1 0',
                  }}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-[9px] font-medium" style={{ color: mood === idx ? m.color : 'rgba(255,255,255,0.3)' }}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Habits */}
          <div
            className="rounded-2xl p-5 animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white">⚡ Hábitos do Dia</h2>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: habitPct === 100 ? 'rgba(10,189,120,0.15)' : 'rgba(255,255,255,0.06)',
                  color: habitPct === 100 ? '#0ABD78' : 'rgba(255,255,255,0.4)',
                }}
              >
                {completedHabits}/{DEFAULT_HABITS.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${habitPct}%`,
                  background: habitPct === 100
                    ? 'linear-gradient(90deg, #0ABD78, #4ade80)'
                    : 'linear-gradient(90deg, #F8A303, #FDC347)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              {DEFAULT_HABITS.map(h => (
                <button
                  key={h.id}
                  onClick={() => toggleHabit(h.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left"
                  style={{
                    background: habits[h.id] ? 'rgba(10,189,120,0.08)' : 'rgba(255,255,255,0.03)',
                    border: habits[h.id] ? '1px solid rgba(10,189,120,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all flex-shrink-0"
                    style={{
                      background: habits[h.id] ? '#0ABD78' : 'rgba(255,255,255,0.08)',
                      border: habits[h.id] ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {habits[h.id] && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-base leading-none">{h.icon}</span>
                  <span style={{ color: habits[h.id] ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)', textDecoration: habits[h.id] ? 'line-through' : 'none' }}>
                    {h.label}
                  </span>
                </button>
              ))}
            </div>
            {habitPct === 100 && (
              <p className="text-center text-sm mt-3" style={{ color: '#0ABD78' }}>
                🎉 Todos os hábitos do dia concluídos!
              </p>
            )}
          </div>
        </div>

        {/* ── COL 2: Agenda Hoje + Tarefas Urgentes ── */}
        <div className="space-y-4">

          {/* Agenda hoje */}
          <div
            className="rounded-2xl overflow-hidden animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-bold text-white">📅 Agenda de Hoje</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {todayEvents.length} evento{todayEvents.length !== 1 ? 's' : ''} hoje
              </p>
            </div>
            <div className="p-3">
              {loading ? (
                <div className="py-8 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2" style={{ borderColor: 'rgba(248,163,3,0.2)', borderTopColor: '#F8A303' }} />
                </div>
              ) : todayEvents.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm">Nenhum evento hoje</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((ev: any) => {
                    const start = new Date(ev.startDate || ev.date || '')
                    const time  = isNaN(start.getTime()) ? '' : start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{
                          background: 'rgba(248,163,3,0.06)',
                          border: '1px solid rgba(248,163,3,0.15)',
                          borderLeft: '3px solid #F8A303',
                        }}
                      >
                        <div className="text-center flex-shrink-0 w-12">
                          <p className="text-sm font-bold" style={{ color: '#F8A303' }}>{time || '—'}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{ev.title}</p>
                          {ev.location && (
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              📍 {ev.location}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tarefas Urgentes */}
          <div
            className="rounded-2xl overflow-hidden animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-bold text-white">🚨 Tarefas Urgentes</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Alta prioridade e críticas
              </p>
            </div>
            <div className="p-3">
              {urgentTasks.length === 0 ? (
                <div className="text-center py-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <p className="text-2xl mb-1">✅</p>
                  <p className="text-sm">Sem urgências!</p>
                </div>
              ) : urgentTasks.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 p-3 mb-2 rounded-xl"
                  style={{
                    background: t.priority === 'critical' ? 'rgba(255,71,87,0.06)' : 'rgba(224,123,57,0.06)',
                    border: `1px solid ${t.priority === 'critical' ? 'rgba(255,71,87,0.18)' : 'rgba(224,123,57,0.18)'}`,
                    borderLeft: `3px solid ${t.priority === 'critical' ? '#FF4757' : '#E07B39'}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.title}</p>
                    {t.dueDate && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,71,87,0.7)' }}>
                        ⏰ Vence: {new Date(t.dueDate).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: t.priority === 'critical' ? 'rgba(255,71,87,0.15)' : 'rgba(224,123,57,0.15)',
                      color: t.priority === 'critical' ? '#FF4757' : '#E07B39',
                    }}
                  >
                    {t.priority === 'critical' ? 'Crítica' : 'Alta'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL 3: Notas Rápidas + Outras tarefas ── */}
        <div className="space-y-4">

          {/* Notas Rápidas */}
          <div
            className="rounded-2xl overflow-hidden animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">📝 Notas Rápidas</h2>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Auto-salva</span>
              </div>
            </div>
            <div className="p-3">
              <textarea
                value={note}
                onChange={e => saveNote(e.target.value)}
                placeholder="Anotações rápidas do dia, ideias, lembretes pessoais..."
                rows={9}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none leading-relaxed"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.75)',
                }}
              />
            </div>
          </div>

          {/* Demais tarefas */}
          <div
            className="rounded-2xl overflow-hidden animate-fade-in-up"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-bold text-white">📋 Demais Tarefas</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {pendingTasks.length + urgentTasks.length} pendente{pendingTasks.length + urgentTasks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="p-3">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <p className="text-sm">Tudo em dia!</p>
                </div>
              ) : pendingTasks.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-2.5 mb-1.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
                  />
                  <p className="text-sm text-white flex-1 truncate">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
