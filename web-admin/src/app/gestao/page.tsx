'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import AdvancedSuite from '@/components/ops/AdvancedSuite'
import api from '@/lib/api'
import {
  ArrowPathIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  MegaphoneIcon,
  PlusIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type Task = {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | string
  priority: 'low' | 'medium' | 'high' | string
  dueDate?: string
  assignedTo?: { id: string; name: string }
  unit?: { id: string; name: string }
  progressPercent?: number
}

type EventItem = {
  id: string
  name: string
  status?: string
  startDate: string
  endDate?: string
  location?: string
  unit?: { id: string; name: string }
  progressPercent?: number
}

type Announcement = {
  id: string
  title: string
  content: string
  type?: string
  isRead?: boolean
  totalReads?: number
  createdAt?: string
}

type UserItem = { id: string; name: string; email?: string; unit?: { id: string; name: string }; role?: { name: string; slug?: string } }
type UnitItem = { id: string; name: string; city?: string; leader?: { name: string } }

type InventoryItem = {
  id: string
  name: string
  category: string
  location: string
  quantity: number
  min: number
  unit: string
  updatedAt: string
}

type QuickTaskForm = {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueDate: string
  assignedToId: string
  unitId: string
}

type QuickEventForm = {
  name: string
  description: string
  startDate: string
  endDate: string
  location: string
  unitId: string
}

type QuickAnnouncementForm = {
  title: string
  content: string
  type: 'info' | 'warning' | 'urgent'
}

const INVENTORY_KEY = 'aps_edu_inventory_v1'

const initialInventory: InventoryItem[] = [
  { id: 'EST-001', name: 'Kits de matricula', category: 'Secretaria', location: 'Secretaria APS', quantity: 42, min: 60, unit: 'APS', updatedAt: 'Hoje' },
  { id: 'EST-002', name: 'Projetores multimidia', category: 'Tecnologia', location: 'Sala de Recursos', quantity: 4, min: 5, unit: 'CAEA', updatedAt: 'Ontem' },
  { id: 'EST-003', name: 'Materiais de limpeza', category: 'Operacao', location: 'Almoxarifado Central', quantity: 22, min: 25, unit: 'CAIS', updatedAt: 'Hoje' },
]

function todayPlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em andamento',
    completed: 'Concluida',
    planned: 'Planejado',
    ongoing: 'Em andamento',
    done: 'Concluido',
  }
  return map[status || ''] || status || 'Aberto'
}

function statusColor(status?: string) {
  if (status === 'completed' || status === 'done') return '#0ABD78'
  if (status === 'in_progress' || status === 'ongoing') return '#4A9EFF'
  return '#F8A303'
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg ${className}`} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'white',
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-10 w-full rounded-lg px-3 text-sm outline-none ${props.className || ''}`} style={{ ...inputStyle, ...props.style }} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-20 w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className || ''}`} style={{ ...inputStyle, ...props.style }} />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 w-full rounded-lg px-3 text-sm outline-none ${props.className || ''}`} style={{ ...inputStyle, ...props.style }} />
}

export default function GestaoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [units, setUnits] = useState<UnitItem[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventoryQuery, setInventoryQuery] = useState('')

  const [taskForm, setTaskForm] = useState<QuickTaskForm>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: todayPlus(2),
    assignedToId: '',
    unitId: '',
  })
  const [eventForm, setEventForm] = useState<QuickEventForm>({
    name: '',
    description: '',
    startDate: todayPlus(7),
    endDate: todayPlus(7),
    location: '',
    unitId: '',
  })
  const [announcementForm, setAnnouncementForm] = useState<QuickAnnouncementForm>({
    title: '',
    content: '',
    type: 'info',
  })
  const [inventoryForm, setInventoryForm] = useState({
    name: '',
    category: '',
    location: '',
    quantity: 1,
    min: 1,
    unit: '',
  })

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [dashRes, taskRes, eventRes, announcementRes, userRes, unitRes] = await Promise.allSettled([
        api.get('/reports/dashboard'),
        api.get('/tasks?limit=12'),
        api.get('/events?limit=8'),
        api.get('/announcements?limit=8'),
        api.get('/users?limit=100'),
        api.get('/units'),
      ])

      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.data)
      if (taskRes.status === 'fulfilled') setTasks(taskRes.value.data?.tasks || [])
      if (eventRes.status === 'fulfilled') setEvents(eventRes.value.data?.events || [])
      if (announcementRes.status === 'fulfilled') setAnnouncements(Array.isArray(announcementRes.value.data) ? announcementRes.value.data : [])
      if (userRes.status === 'fulfilled') setUsers(userRes.value.data?.users || userRes.value.data || [])
      if (unitRes.status === 'fulfilled') setUnits(unitRes.value.data?.units || unitRes.value.data || [])

      const failures = [dashRes, taskRes, eventRes, announcementRes, userRes, unitRes].filter(item => item.status === 'rejected')
      if (failures.length) setError('Alguns dados nao carregaram. As ferramentas locais continuam disponiveis.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    try {
      const saved = JSON.parse(localStorage.getItem(INVENTORY_KEY) || 'null')
      setInventory(Array.isArray(saved) ? saved : initialInventory)
    } catch {
      setInventory(initialInventory)
    }
  }, [])

  useEffect(() => {
    if (inventory.length) localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory))
  }, [inventory])

  const metrics = useMemo(() => {
    const overdue = tasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed').length
    const lowStock = inventory.filter(item => item.quantity <= item.min).length
    const unread = announcements.filter(item => !item.isRead).length
    return [
      { label: 'Tarefas abertas', value: tasks.filter(task => task.status !== 'completed').length, color: '#0ABD78', icon: CheckCircleIcon },
      { label: 'Atrasos', value: overdue, color: overdue ? '#FF4757' : '#0ABD78', icon: BellAlertIcon },
      { label: 'Eventos ativos', value: events.length, color: '#8B5CF6', icon: CalendarDaysIcon },
      { label: 'Estoque critico', value: lowStock, color: lowStock ? '#F8A303' : '#0ABD78', icon: CubeIcon },
      { label: 'Pessoas', value: users.length || dashboard?.totalActiveUsers || 0, color: '#4A9EFF', icon: UserGroupIcon },
      { label: 'Avisos novos', value: unread, color: '#F9C234', icon: MegaphoneIcon },
    ]
  }, [tasks, events, announcements, inventory, users, dashboard])

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.toLowerCase()
    return inventory.filter(item => `${item.name} ${item.category} ${item.location} ${item.unit}`.toLowerCase().includes(q))
  }, [inventory, inventoryQuery])

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    setSaving('task')
    try {
      const res = await api.post('/tasks', {
        ...taskForm,
        description: taskForm.description || undefined,
        assignedToId: taskForm.assignedToId || undefined,
        unitId: taskForm.unitId || undefined,
        dueDate: taskForm.dueDate || undefined,
      })
      setTasks(prev => [res.data, ...prev].slice(0, 12))
      setTaskForm({ title: '', description: '', priority: 'medium', dueDate: todayPlus(2), assignedToId: '', unitId: '' })
    } finally {
      setSaving('')
    }
  }

  async function updateTaskStatus(task: Task, status: string) {
    setSaving(task.id)
    try {
      const res = await api.put(`/tasks/${task.id}`, { status })
      setTasks(prev => prev.map(item => item.id === task.id ? { ...item, ...res.data } : item))
    } finally {
      setSaving('')
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!eventForm.name.trim()) return
    setSaving('event')
    try {
      const res = await api.post('/events', {
        ...eventForm,
        description: eventForm.description || undefined,
        location: eventForm.location || undefined,
        unitId: eventForm.unitId || undefined,
        startDate: new Date(`${eventForm.startDate}T09:00:00`).toISOString(),
        endDate: new Date(`${eventForm.endDate || eventForm.startDate}T10:00:00`).toISOString(),
      })
      setEvents(prev => [res.data, ...prev].slice(0, 8))
      setEventForm({ name: '', description: '', startDate: todayPlus(7), endDate: todayPlus(7), location: '', unitId: '' })
    } finally {
      setSaving('')
    }
  }

  async function publishAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) return
    setSaving('announcement')
    try {
      const res = await api.post('/announcements', announcementForm)
      setAnnouncements(prev => [{ ...res.data, isRead: true }, ...prev].slice(0, 8))
      setAnnouncementForm({ title: '', content: '', type: 'info' })
    } finally {
      setSaving('')
    }
  }

  function addInventory(e: React.FormEvent) {
    e.preventDefault()
    if (!inventoryForm.name.trim()) return
    const item: InventoryItem = {
      id: `EST-${Date.now().toString().slice(-6)}`,
      ...inventoryForm,
      quantity: Number(inventoryForm.quantity) || 0,
      min: Number(inventoryForm.min) || 0,
      updatedAt: 'Agora',
    }
    setInventory(prev => [item, ...prev])
    setInventoryForm({ name: '', category: '', location: '', quantity: 1, min: 1, unit: '' })
  }

  function adjustInventory(id: string, delta: number) {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta), updatedAt: 'Agora' } : item))
  }

  return (
    <AdminLayout>
      <div className="min-h-full p-4 lg:p-8 space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>Educacao Adventista / Centro operacional</div>
            <h1 className="mt-3 text-3xl font-black text-white lg:text-5xl">Centro de Gestao APS EDU</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.52)' }}>
              Criar, acompanhar e resolver trabalho real da rede em uma unica tela.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadData} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <Link href="/minha-area" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-black" style={{ background: '#F8A303' }}>
              <SparklesIcon className="h-4 w-4" /> Minha central
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm font-semibold" style={{ background: 'rgba(248,163,3,0.12)', border: '1px solid rgba(248,163,3,0.25)', color: '#F8A303' }}>
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {metrics.map(metric => {
            const Icon = metric.icon
            return (
              <Card key={metric.label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>{metric.label}</p>
                    <p className="mt-2 text-3xl font-black" style={{ color: metric.color }}>{metric.value}</p>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ background: `${metric.color}18`, border: `1px solid ${metric.color}35` }}>
                    <Icon className="h-5 w-5" style={{ color: metric.color }} />
                  </div>
                </div>
              </Card>
            )
          })}
        </section>

        <AdvancedSuite />

        <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Criar tarefa</h2>
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-white/35" />
            </div>
            <form onSubmit={createTask} className="mt-4 space-y-3">
              <Field label="Titulo"><TextInput value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Ex: Revisar campanha de matriculas" /></Field>
              <Field label="Descricao"><TextArea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Contexto, objetivo e entrega esperada" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prioridade">
                  <Select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as QuickTaskForm['priority'] })}>
                    <option value="low">Baixa</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </Select>
                </Field>
                <Field label="Prazo"><TextInput type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Responsavel">
                  <Select value={taskForm.assignedToId} onChange={e => setTaskForm({ ...taskForm, assignedToId: e.target.value })}>
                    <option value="">Sem responsavel</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </Select>
                </Field>
                <Field label="Unidade">
                  <Select value={taskForm.unitId} onChange={e => setTaskForm({ ...taskForm, unitId: e.target.value })}>
                    <option value="">Padrao</option>
                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </Select>
                </Field>
              </div>
              <button disabled={saving === 'task'} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-black disabled:opacity-60" style={{ background: '#F8A303' }}>
                <PlusIcon className="h-4 w-4" /> {saving === 'task' ? 'Criando...' : 'Criar tarefa'}
              </button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Criar evento</h2>
              <CalendarDaysIcon className="h-5 w-5 text-white/35" />
            </div>
            <form onSubmit={createEvent} className="mt-4 space-y-3">
              <Field label="Nome"><TextInput value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="Ex: Encontro de coordenadores" /></Field>
              <Field label="Descricao"><TextArea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Objetivo, publico e entregas" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio"><TextInput type="date" value={eventForm.startDate} onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })} /></Field>
                <Field label="Fim"><TextInput type="date" value={eventForm.endDate} onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Local"><TextInput value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Local" /></Field>
                <Field label="Unidade">
                  <Select value={eventForm.unitId} onChange={e => setEventForm({ ...eventForm, unitId: e.target.value })}>
                    <option value="">Padrao</option>
                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </Select>
                </Field>
              </div>
              <button disabled={saving === 'event'} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: '#8B5CF6' }}>
                <PlusIcon className="h-4 w-4" /> {saving === 'event' ? 'Criando...' : 'Criar evento'}
              </button>
            </form>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Publicar comunicado</h2>
              <MegaphoneIcon className="h-5 w-5 text-white/35" />
            </div>
            <form onSubmit={publishAnnouncement} className="mt-4 space-y-3">
              <Field label="Titulo"><TextInput value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} placeholder="Ex: Prazo de relatorios" /></Field>
              <Field label="Mensagem"><TextArea value={announcementForm.content} onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })} placeholder="Mensagem para a rede" /></Field>
              <Field label="Tipo">
                <Select value={announcementForm.type} onChange={e => setAnnouncementForm({ ...announcementForm, type: e.target.value as QuickAnnouncementForm['type'] })}>
                  <option value="info">Informacao</option>
                  <option value="warning">Atencao</option>
                  <option value="urgent">Urgente</option>
                </Select>
              </Field>
              <button disabled={saving === 'announcement'} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-black disabled:opacity-60" style={{ background: '#29ABE2' }}>
                <PlusIcon className="h-4 w-4" /> {saving === 'announcement' ? 'Publicando...' : 'Publicar'}
              </button>
            </form>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="flex items-center justify-between border-b p-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-lg font-black text-white">Fila de trabalho</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Atualize status sem sair do cockpit.</p>
              </div>
              <Link href="/tasks" className="rounded-lg px-3 py-2 text-xs font-black" style={{ background: 'rgba(255,255,255,0.06)', color: 'white' }}>Abrir tudo</Link>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {tasks.length === 0 && <p className="p-5 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Nenhuma tarefa carregada.</p>}
              {tasks.map(task => (
                <div key={task.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-white">{task.title}</p>
                    <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>
                      {task.assignedTo?.name || 'Sem responsavel'} · {task.unit?.name || 'Sem unidade'} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ color: statusColor(task.status), background: `${statusColor(task.status)}18` }}>{statusLabel(task.status)}</span>
                    <button disabled={saving === task.id} onClick={() => updateTaskStatus(task, 'in_progress')} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50" style={{ background: 'rgba(74,158,255,0.18)' }}>Andamento</button>
                    <button disabled={saving === task.id} onClick={() => updateTaskStatus(task, 'completed')} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50" style={{ background: 'rgba(10,189,120,0.18)' }}>Concluir</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b p-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-lg font-black text-white">Agenda e mural</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Proximos eventos e comunicados ativos.</p>
              </div>
              <Link href="/events" className="rounded-lg px-3 py-2 text-xs font-black" style={{ background: 'rgba(255,255,255,0.06)', color: 'white' }}>Eventos</Link>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                {events.slice(0, 4).map(event => (
                  <div key={event.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm font-bold text-white">{event.name}</p>
                    <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{new Date(event.startDate).toLocaleDateString('pt-BR')} · {event.location || event.unit?.name || 'Sem local'}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {announcements.slice(0, 3).map(item => (
                  <div key={item.id} className="rounded-lg p-3" style={{ background: 'rgba(41,171,226,0.08)', border: '1px solid rgba(41,171,226,0.15)' }}>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'rgba(255,255,255,0.52)' }}>{item.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Cadastrar estoque</h2>
              <CubeIcon className="h-5 w-5 text-white/35" />
            </div>
            <form onSubmit={addInventory} className="mt-4 space-y-3">
              <Field label="Item"><TextInput value={inventoryForm.name} onChange={e => setInventoryForm({ ...inventoryForm, name: e.target.value })} placeholder="Nome do material ou ativo" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria"><TextInput value={inventoryForm.category} onChange={e => setInventoryForm({ ...inventoryForm, category: e.target.value })} placeholder="Categoria" /></Field>
                <Field label="Unidade"><TextInput value={inventoryForm.unit} onChange={e => setInventoryForm({ ...inventoryForm, unit: e.target.value })} placeholder="APS, CAEA..." /></Field>
              </div>
              <Field label="Local"><TextInput value={inventoryForm.location} onChange={e => setInventoryForm({ ...inventoryForm, location: e.target.value })} placeholder="Almoxarifado, sala..." /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade"><TextInput type="number" value={inventoryForm.quantity} onChange={e => setInventoryForm({ ...inventoryForm, quantity: Number(e.target.value) })} /></Field>
                <Field label="Minimo"><TextInput type="number" value={inventoryForm.min} onChange={e => setInventoryForm({ ...inventoryForm, min: Number(e.target.value) })} /></Field>
              </div>
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-black" style={{ background: '#F8A303' }}>
                <PlusIcon className="h-4 w-4" /> Adicionar item
              </button>
            </form>
          </Card>

          <Card>
            <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-lg font-black text-white">Estoque operacional</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Entradas e saidas salvas neste painel.</p>
              </div>
              <TextInput value={inventoryQuery} onChange={e => setInventoryQuery(e.target.value)} placeholder="Buscar estoque..." className="md:w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>
                    <th className="px-5 py-3">Item</th>
                    <th className="px-5 py-3">Local</th>
                    <th className="px-5 py-3">Qtd</th>
                    <th className="px-5 py-3">Min</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(item => {
                    const critical = item.quantity <= item.min
                    return (
                      <tr key={item.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <td className="px-5 py-3">
                          <p className="text-sm font-bold text-white">{item.name}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.category} · {item.unit}</p>
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.58)' }}>{item.location}</td>
                        <td className="px-5 py-3 text-sm font-black text-white">{item.quantity}</td>
                        <td className="px-5 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.58)' }}>{item.min}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ color: critical ? '#FF4757' : '#0ABD78', background: critical ? 'rgba(255,71,87,0.12)' : 'rgba(10,189,120,0.12)' }}>
                            {critical ? 'Repor' : 'Ok'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => adjustInventory(item.id, -1)} className="rounded-lg px-2.5 py-1 text-xs font-black text-white" style={{ background: 'rgba(255,255,255,0.08)' }}>-1</button>
                            <button onClick={() => adjustInventory(item.id, 1)} className="rounded-lg px-2.5 py-1 text-xs font-black text-white" style={{ background: 'rgba(10,189,120,0.16)' }}>+1</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </AdminLayout>
  )
}
