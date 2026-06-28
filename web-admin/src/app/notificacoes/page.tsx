'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

const LS_KEY = 'apsedu_notifications'

interface Notif {
  id: string
  type: 'task_overdue' | 'task_assigned' | 'event_reminder' | 'announcement' | 'system' | 'ai_insight'
  title: string
  body: string
  read: boolean
  createdAt: string
  link?: string
  priority: 'high' | 'medium' | 'low'
}

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  task_overdue:   { icon: '🚨', color: '#FF4757', label: 'Tarefa atrasada' },
  task_assigned:  { icon: '📋', color: '#4A9EFF', label: 'Tarefa atribuída' },
  event_reminder: { icon: '📅', color: '#F8A303', label: 'Lembrete de evento' },
  announcement:   { icon: '📣', color: '#0ABD78', label: 'Comunicado' },
  system:         { icon: '⚙️', color: '#8B5CF6', label: 'Sistema' },
  ai_insight:     { icon: '🤖', color: '#F9C234', label: 'Insight IA' },
}
const PRIORITY_COLOR = { high: '#FF4757', medium: '#F8A303', low: 'rgba(255,255,255,0.3)' }

function generateSmartNotifs(tasks: any[], events: any[]): Notif[] {
  const notifs: Notif[] = []
  const now = new Date()

  // Overdue tasks
  tasks.filter(t => t.status === 'overdue').slice(0, 3).forEach(t => {
    notifs.push({
      id: `overdue-${t.id}`,
      type: 'task_overdue',
      title: `Tarefa atrasada: ${t.title}`,
      body: `Esta tarefa venceu em ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'data não definida'} e ainda está pendente.`,
      read: false,
      createdAt: new Date().toISOString(),
      link: '/tasks',
      priority: 'high',
    })
  })

  // Upcoming events (next 24h)
  events.filter(ev => {
    const start = new Date(ev.startDate || ev.date || '')
    const diff = start.getTime() - now.getTime()
    return diff > 0 && diff < 86_400_000
  }).slice(0, 3).forEach(ev => {
    const start = new Date(ev.startDate || ev.date || '')
    const hours = Math.round((start.getTime() - now.getTime()) / 3_600_000)
    notifs.push({
      id: `event-${ev.id}`,
      type: 'event_reminder',
      title: `Evento em ${hours}h: ${ev.title}`,
      body: `${ev.location ? `📍 ${ev.location}` : ''} — ${start.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`,
      read: false,
      createdAt: new Date().toISOString(),
      link: '/events',
      priority: hours < 2 ? 'high' : 'medium',
    })
  })

  // Critical tasks
  tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').slice(0, 2).forEach(t => {
    notifs.push({
      id: `critical-${t.id}`,
      type: 'task_assigned',
      title: `⚡ Tarefa crítica pendente`,
      body: `"${t.title}" está marcada como crítica e aguarda ação.`,
      read: false,
      createdAt: new Date().toISOString(),
      link: '/tasks',
      priority: 'high',
    })
  })

  // AI insight
  notifs.push({
    id: 'ai-daily',
    type: 'ai_insight',
    title: '✨ Insight do dia',
    body: `Você tem ${tasks.filter(t => t.status === 'pending').length} tarefas pendentes. ${tasks.filter(t => t.status === 'overdue').length > 0 ? `⚠️ ${tasks.filter(t => t.status === 'overdue').length} delas estão em atraso!` : 'Continue assim! 🎉'}`,
    read: false,
    createdAt: new Date().toISOString(),
    priority: 'low',
  })

  return notifs
}

export default function NotificaçõesPage() {
  const { success } = useToast()
  const [notifs, setNotifs]     = useState<Notif[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'unread' | 'high'>('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [tasksRes, eventsRes] = await Promise.all([
          api.get('/tasks?limit=100'),
          api.get('/events?limit=50'),
        ])
        const tasks  = tasksRes.data.tasks || []
        const events = eventsRes.data.events || eventsRes.data || []
        const generated = generateSmartNotifs(tasks, events)

        // Merge with saved read-state
        const saved: Record<string, boolean> = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
        const merged = generated.map(n => ({ ...n, read: saved[n.id] ?? n.read }))
        setNotifs(merged)
      } catch { } finally { setLoading(false) }
    }
    load()
  }, [])

  const markRead = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    localStorage.setItem(LS_KEY, JSON.stringify({ ...saved, [id]: true }))
  }

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    const saved: Record<string, boolean> = {}
    notifs.forEach(n => { saved[n.id] = true })
    localStorage.setItem(LS_KEY, JSON.stringify(saved))
    success('Tudo lido!', 'Todas as notificações foram marcadas como lidas.')
  }

  const filtered = notifs.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'high')   return n.priority === 'high'
    return true
  })

  const unreadCount = notifs.filter(n => !n.read).length

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const min  = Math.floor(diff / 60000)
    if (min < 1)  return 'agora mesmo'
    if (min < 60) return `${min}min atrás`
    const h = Math.floor(min / 60)
    if (h < 24)   return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white">Notificações</h1>
            {unreadCount > 0 && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,71,87,0.15)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.25)' }}
              >
                {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Central de alertas e atualizações em tempo real
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
          >
            ✓ Marcar tudo lido
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'unread', 'high'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: filter === f ? 'rgba(248,163,3,0.12)' : 'rgba(255,255,255,0.04)',
              border: filter === f ? '1px solid rgba(248,163,3,0.25)' : '1px solid rgba(255,255,255,0.07)',
              color: filter === f ? '#F8A303' : 'rgba(255,255,255,0.4)',
            }}
          >
            {f === 'all' ? `Todas (${notifs.length})` : f === 'unread' ? `Não lidas (${unreadCount})` : '🔴 Urgentes'}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: 'rgba(248,163,3,0.2)', borderTopColor: '#F8A303' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-sm font-semibold text-white">Tudo em dia!</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhuma notificação nessa categoria</p>
          </div>
        ) : (
          filtered.map((notif, idx) => {
            const meta = TYPE_META[notif.type] || TYPE_META.system
            return (
              <div
                key={notif.id}
                className="flex items-start gap-4 p-5 cursor-pointer transition-all"
                style={{
                  borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: notif.read ? 'transparent' : 'rgba(255,255,255,0.015)',
                  opacity: notif.read ? 0.6 : 1,
                }}
                onClick={() => markRead(notif.id)}
              >
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}
                >
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{notif.title}</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {notif.body}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      )}
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${meta.color}12`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${PRIORITY_COLOR[notif.priority]}12`,
                        color: PRIORITY_COLOR[notif.priority],
                      }}
                    >
                      {notif.priority === 'high' ? '🔴 Alta' : notif.priority === 'medium' ? '🟡 Média' : '🟢 Baixa'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </AdminLayout>
  )
}
