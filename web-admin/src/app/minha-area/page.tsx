'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import Cookies from 'js-cookie'
import {
  CheckCircleIcon, PlusIcon, ClockIcon, FireIcon,
  TrashIcon, PencilIcon, MagnifyingGlassIcon,
  BellIcon, LockClosedIcon, EyeIcon, EyeSlashIcon,
  StarIcon, TrophyIcon, BoltIcon, XMarkIcon,
  ArrowPathIcon, PlayIcon, PauseIcon, CheckIcon,
  KeyIcon, GlobeAltIcon, TagIcon, CalendarDaysIcon,
  ChartBarIcon, FaceSmileIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'

// ─── TYPES ───────────────────────────────────────────────────
interface PersonalTask {
  id: string
  title: string
  category: 'trabalho' | 'campanha' | 'pessoal'
  duration: number
  status: 'pending' | 'in-progress' | 'done'
  priority: 'high' | 'medium' | 'low'
  notes?: string
  dueDate?: string
  completedAt?: string
  xp: number
  createdAt: string
}

interface Credential {
  id: string
  service: string
  url?: string
  email: string
  password: string
  notes?: string
  category: string
  createdAt: string
}

interface WorkDay {
  startHour: number
  startMin: number
  endHour: number
  endMin: number
}

// ─── HELPERS ─────────────────────────────────────────────────
function getGreeting(name: string): { text: string; emoji: string } {
  const h = new Date().getHours()
  if (h < 12) return { text: `Bom dia, ${name}!`, emoji: '🌅' }
  if (h < 18) return { text: `Boa tarde, ${name}!`, emoji: '☀️' }
  return { text: `Boa noite, ${name}!`, emoji: '🌙' }
}

function fmtTime(totalMin: number): string {
  if (totalMin <= 0) return '0min'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}min`
}

function calcXpLevel(xp: number) {
  const level = Math.floor(xp / 100) + 1
  const progress = xp % 100
  return { level, progress, next: 100 }
}

// ─── CREDENTIALS VAULT (localStorage, PIN-protected) ─────────
const VAULT_KEY = 'aps_edu_vault_v2'
const VAULT_PIN_KEY = 'aps_edu_vault_pin'

function saveVault(creds: Credential[], pin: string) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(creds) + '|||' + pin)))
  localStorage.setItem(VAULT_KEY, encoded)
}

function loadVault(pin: string): Credential[] | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (!raw) return []
    const decoded = decodeURIComponent(escape(atob(raw)))
    const sep = decoded.lastIndexOf('|||')
    if (sep === -1) return null
    const storedPin = decoded.slice(sep + 3)
    if (storedPin !== pin) return null
    return JSON.parse(decoded.slice(0, sep))
  } catch { return null }
}

function hasPinSet(): boolean {
  return !!localStorage.getItem(VAULT_PIN_KEY)
}

function verifyPin(pin: string): boolean {
  return localStorage.getItem(VAULT_PIN_KEY) === pin
}

function setPin(pin: string) {
  localStorage.setItem(VAULT_PIN_KEY, pin)
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const p = await Notification.requestPermission()
  return p === 'granted'
}

function sendNotif(title: string, body: string, icon = '/icons/icon-192x192.png') {
  if (typeof window === 'undefined') return
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon })
}

// ─── CAT PRIORITY ─────────────────────────────────────────────
const CAT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  trabalho:  { label: 'Trabalho',  color: '#4A9EFF', bg: 'rgba(74,158,255,0.12)' },
  campanha:  { label: 'Campanha',  color: '#F8A303', bg: 'rgba(248,163,3,0.12)' },
  pessoal:   { label: 'Pessoal',   color: '#0ABD78', bg: 'rgba(10,189,120,0.12)' },
}
const PRI_STYLE: Record<string, { label: string; color: string }> = {
  high:   { label: 'Alta',  color: '#FF4757' },
  medium: { label: 'Média', color: '#F8A303' },
  low:    { label: 'Baixa', color: '#0ABD78' },
}

// ─── WORKDAY TIMER COMPONENT ──────────────────────────────────
function WorkDayTimer({ tasks }: { tasks: PersonalTask[] }) {
  const [wd, setWd] = useState<WorkDay>({ startHour: 8, startMin: 0, endHour: 18, endMin: 0 })
  const [editing, setEditing] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const saved = localStorage.getItem('aps_workday')
    if (saved) try { setWd(JSON.parse(saved)) } catch {}
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const startTotal  = wd.startHour * 60 + wd.startMin
  const endTotal    = wd.endHour   * 60 + wd.endMin
  const nowTotal    = now.getHours() * 60 + now.getMinutes()
  const dayDuration = endTotal - startTotal
  const elapsed     = Math.max(0, Math.min(nowTotal - startTotal, dayDuration))
  const remaining   = Math.max(0, endTotal - nowTotal)
  const pct         = dayDuration > 0 ? Math.min(100, (elapsed / dayDuration) * 100) : 0

  const pendingMin  = tasks.filter(t => t.status !== 'done').reduce((a, t) => a + (t.duration || 0), 0)
  const fitsCount   = tasks.filter(t => t.status !== 'done').reduce((acc, t) => {
    if (acc.time + t.duration <= remaining) { acc.count++; acc.time += t.duration }
    return acc
  }, { count: 0, time: 0 }).count

  const saveWd = (w: WorkDay) => {
    setWd(w); localStorage.setItem('aps_workday', JSON.stringify(w)); setEditing(false)
  }

  return (
    <div className="rounded-2xl p-5 mb-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5" style={{ color: '#F8A303' }} />
          <span className="text-sm font-bold text-white">Meu Dia de Trabalho</span>
        </div>
        <button onClick={() => setEditing(!editing)}
          className="text-xs px-3 py-1 rounded-lg transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.09)' }}>
          {editing ? 'Fechar' : '⚙️ Configurar'}
        </button>
      </div>

      {editing && (
        <WorkDayEditor wd={wd} onSave={saveWd} />
      )}

      {/* Progress bar */}
      <div className="relative h-3 rounded-full overflow-hidden mb-4"
        style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: remaining < 60
              ? 'linear-gradient(90deg,#FF4757,#FF6B6B)'
              : 'linear-gradient(90deg,#F8A303,#FDC347)',
          }} />
        {/* Current time marker */}
        <div className="absolute top-0 bottom-0 w-0.5 rounded-full"
          style={{ left: `${pct}%`, background: 'white', opacity: 0.8 }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Início', value: `${String(wd.startHour).padStart(2,'0')}:${String(wd.startMin).padStart(2,'0')}`, color: '#4A9EFF' },
          { label: 'Término', value: `${String(wd.endHour).padStart(2,'0')}:${String(wd.endMin).padStart(2,'0')}`, color: '#8B5CF6' },
          { label: remaining > 0 ? '⏳ Restam' : '✅ Encerrado', value: remaining > 0 ? fmtTime(remaining) : '--', color: remaining < 60 && remaining > 0 ? '#FF4757' : '#0ABD78' },
          { label: '🎯 Cabem agora', value: `${fitsCount} tarefa${fitsCount !== 1 ? 's' : ''}`, color: '#F8A303' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-lg font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {pendingMin > 0 && (
        <div className="mt-3 p-3 rounded-xl flex items-center gap-2 text-xs"
          style={{ background: 'rgba(248,163,3,0.07)', border: '1px solid rgba(248,163,3,0.15)' }}>
          <span>📋</span>
          <span style={{ color: 'rgba(255,200,80,0.8)' }}>
            Você tem <strong>{fmtTime(pendingMin)}</strong> de trabalho pendente em{' '}
            <strong>{tasks.filter(t => t.status !== 'done').length} tarefas</strong>.
            {remaining > 0 && remaining < pendingMin && (
              <span style={{ color: '#FF4757' }}> Não dá pra tudo hoje — priorize!</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function WorkDayEditor({ wd, onSave }: { wd: WorkDay; onSave: (w: WorkDay) => void }) {
  const [v, setV] = useState(wd)
  return (
    <div className="rounded-xl p-4 mb-4 grid grid-cols-2 gap-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {[
        { label: 'Início', hKey: 'startHour', mKey: 'startMin' },
        { label: 'Término', hKey: 'endHour',   mKey: 'endMin'   },
      ].map(({ label, hKey, mKey }) => (
        <div key={label}>
          <p className="text-xs text-white/40 mb-1.5 uppercase tracking-widest">{label}</p>
          <div className="flex gap-2">
            <input type="number" min={0} max={23}
              value={(v as any)[hKey]}
              onChange={e => setV(p => ({ ...p, [hKey]: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg text-sm text-center font-bold outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            <span className="text-white self-center font-bold">:</span>
            <input type="number" min={0} max={59}
              value={(v as any)[mKey]}
              onChange={e => setV(p => ({ ...p, [mKey]: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg text-sm text-center font-bold outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
          </div>
        </div>
      ))}
      <div className="col-span-2">
        <button onClick={() => onSave(v)}
          className="w-full py-2 rounded-xl text-sm font-bold text-black"
          style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
          Salvar horário
        </button>
      </div>
    </div>
  )
}

// ─── TASK CARD ────────────────────────────────────────────────
function TaskCard({
  task, onUpdate, onDelete
}: {
  task: PersonalTask
  onUpdate: (id: string, upd: Partial<PersonalTask>) => void
  onDelete: (id: string) => void
}) {
  const [timer, setTimer] = useState(task.duration * 60)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cat  = CAT_STYLE[task.category]  || CAT_STYLE.trabalho
  const pri  = PRI_STYLE[task.priority]  || PRI_STYLE.medium
  const done = task.status === 'done'

  useEffect(() => {
    setTimer(task.duration * 60)
    setRunning(false)
  }, [task.duration])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimer(p => {
          if (p <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            sendNotif('⏰ Tempo esgotado!', `"${task.title}" — ${task.duration} min concluídos!`)
            return 0
          }
          return p - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const timerMin = Math.floor(timer / 60)
  const timerSec = timer % 60
  const timerPct = task.duration > 0 ? ((task.duration * 60 - timer) / (task.duration * 60)) * 100 : 0

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-300 group"
      style={{
        background: done ? 'rgba(10,189,120,0.05)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${done ? 'rgba(10,189,120,0.2)' : 'rgba(255,255,255,0.07)'}`,
        opacity: done ? 0.7 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Complete toggle */}
        <button onClick={() => onUpdate(task.id, { status: done ? 'pending' : 'done' })}
          className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
          style={{
            borderColor: done ? '#0ABD78' : 'rgba(255,255,255,0.2)',
            background: done ? '#0ABD78' : 'transparent',
          }}>
          {done && <CheckIcon className="w-3.5 h-3.5 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold text-white leading-snug ${done ? 'line-through opacity-50' : ''}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* XP badge */}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(248,163,3,0.15)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
                +{task.xp}xp
              </span>
              <button onClick={() => onDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                style={{ color: 'rgba(255,71,87,0.6)' }}>
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30` }}>
              {cat.label}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${pri.color}15`, color: pri.color, border: `1px solid ${pri.color}30` }}>
              {pri.label}
            </span>
            <span className="text-[10px] flex items-center gap-1"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              <ClockIcon className="w-3 h-3" />{fmtTime(task.duration)}
            </span>
            {task.dueDate && (
              <span className="text-[10px] flex items-center gap-1"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                <CalendarDaysIcon className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
          </div>

          {task.notes && (
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {task.notes}
            </p>
          )}

          {/* Timer bar (only if not done) */}
          {!done && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${timerPct}%`,
                    background: running ? 'linear-gradient(90deg,#4A9EFF,#8B5CF6)' : 'rgba(255,255,255,0.1)',
                  }} />
              </div>
              <span className="text-xs font-mono font-bold tabular-nums flex-shrink-0"
                style={{ color: running ? '#4A9EFF' : 'rgba(255,255,255,0.3)' }}>
                {String(timerMin).padStart(2,'0')}:{String(timerSec).padStart(2,'0')}
              </span>
              <button
                onClick={() => {
                  if (!running && task.status !== 'in-progress') onUpdate(task.id, { status: 'in-progress' })
                  setRunning(r => !r)
                }}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: running ? 'rgba(255,71,87,0.2)' : 'rgba(74,158,255,0.15)',
                  border: `1px solid ${running ? 'rgba(255,71,87,0.3)' : 'rgba(74,158,255,0.3)'}`,
                }}>
                {running
                  ? <PauseIcon className="w-3 h-3" style={{ color: '#FF4757' }} />
                  : <PlayIcon  className="w-3 h-3" style={{ color: '#4A9EFF' }} />
                }
              </button>
              <button onClick={() => { setTimer(task.duration * 60); setRunning(false) }}
                className="flex-shrink-0 p-1 rounded-lg"
                style={{ color: 'rgba(255,255,255,0.2)' }}>
                <ArrowPathIcon className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TASK FORM ────────────────────────────────────────────────
function TaskForm({ onAdd, onClose }: { onAdd: (t: Partial<PersonalTask>) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    title: '', category: 'trabalho', duration: 30, priority: 'medium', notes: '', dueDate: ''
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="rounded-2xl p-5 mb-4 animate-scale-in"
      style={{ background: 'rgba(248,163,3,0.06)', border: '1px solid rgba(248,163,3,0.2)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Nova Tarefa</h3>
        <button onClick={onClose}><XMarkIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
      </div>
      <div className="space-y-3">
        <input
          type="text" placeholder="O que você precisa fazer?"
          value={form.title} onChange={e => set('title', e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none text-white"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && form.title.trim() && (onAdd(form), onClose())}
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Categoria</p>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <option value="trabalho">Trabalho</option>
              <option value="campanha">Campanha</option>
              <option value="pessoal">Pessoal</option>
            </select>
          </div>
          <div>
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Duração (min)</p>
            <input type="number" min={5} max={480} value={form.duration}
              onChange={e => set('duration', parseInt(e.target.value) || 30)}
              className="w-full px-2.5 py-2 rounded-lg text-xs outline-none text-white text-center font-bold"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Prioridade</p>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Prazo (opcional)</p>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Notas</p>
            <input type="text" placeholder="Detalhe rápido..." value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs outline-none text-white"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
            +{Math.max(5, Math.ceil(form.duration / 15) * 5)} XP ao concluir
          </div>
          <button onClick={() => { if (form.title.trim()) { onAdd(form); onClose() } }}
            disabled={!form.title.trim()}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
            Adicionar Tarefa
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CREDENTIALS VAULT ────────────────────────────────────────
function CredentialsVault() {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin]           = useState('')
  const [pinError, setPinError] = useState('')
  const [creds, setCreds]       = useState<Credential[]>([])
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPwd, setShowPwd]   = useState<Record<string, boolean>>({})
  const [isSetup, setIsSetup]   = useState(false)
  const [confirmPin, setConfirmPin] = useState('')

  useEffect(() => {
    setIsSetup(!hasPinSet())
  }, [])

  const unlock = () => {
    if (isSetup) {
      if (pin.length < 4) { setPinError('PIN deve ter pelo menos 4 dígitos'); return }
      if (pin !== confirmPin) { setPinError('PINs não coincidem'); return }
      localStorage.setItem(VAULT_PIN_KEY, pin)
      saveVault([], pin)
      setCreds([])
      setUnlocked(true)
    } else {
      if (!verifyPin(pin)) { setPinError('PIN incorreto'); return }
      const loaded = loadVault(pin)
      if (loaded === null) { setPinError('Erro ao carregar cofre'); return }
      setCreds(loaded)
      setUnlocked(true)
    }
    setPinError('')
  }

  const save = (newCreds: Credential[]) => {
    setCreds(newCreds)
    saveVault(newCreds, pin)
  }

  const addCred = (c: Omit<Credential, 'id' | 'createdAt'>) => {
    const newCreds = [...creds, { ...c, id: Date.now().toString(), createdAt: new Date().toISOString() }]
    save(newCreds)
  }

  const delCred = (id: string) => save(creds.filter(c => c.id !== id))

  const filtered = creds.filter(c =>
    c.service.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.category || '').toLowerCase().includes(search.toLowerCase())
  )

  if (!unlocked) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center gap-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,rgba(248,163,3,0.2),rgba(253,195,71,0.1))', border: '1px solid rgba(248,163,3,0.25)' }}>
          <LockClosedIcon className="w-8 h-8" style={{ color: '#F8A303' }} />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-white">{isSetup ? 'Criar PIN do Cofre' : 'Cofre de Credenciais'}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {isSetup ? 'Defina um PIN para proteger suas senhas' : 'Digite seu PIN para acessar'}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <input
            type="password" placeholder="PIN (mínimo 4 dígitos)" value={pin}
            onChange={e => { setPin(e.target.value); setPinError('') }}
            onKeyDown={e => e.key === 'Enter' && unlock()}
            className="w-full px-4 py-3 rounded-xl text-sm text-center text-white outline-none font-mono tracking-widest"
            style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${pinError ? 'rgba(255,71,87,0.4)' : 'rgba(255,255,255,0.1)'}` }} />
          {isSetup && (
            <input
              type="password" placeholder="Confirmar PIN" value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value); setPinError('') }}
              onKeyDown={e => e.key === 'Enter' && unlock()}
              className="w-full px-4 py-3 rounded-xl text-sm text-center text-white outline-none font-mono tracking-widest"
              style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${pinError ? 'rgba(255,71,87,0.4)' : 'rgba(255,255,255,0.1)'}` }} />
          )}
          {pinError && <p className="text-xs text-center" style={{ color: '#FF4757' }}>{pinError}</p>}
          <button onClick={unlock}
            className="w-full py-3 rounded-xl text-sm font-bold text-black"
            style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
            {isSetup ? 'Criar Cofre' : 'Desbloquear'}
          </button>
        </div>
        <p className="text-[10px] text-center max-w-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          🔒 Dados armazenados apenas neste dispositivo. Nunca enviados ao servidor.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input type="text" placeholder="Buscar serviço, email..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{creds.length} credencial{creds.length !== 1 ? 'is' : ''}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setUnlocked(false); setPin(''); setCreds([]) }}
            className="p-2 rounded-xl" style={{ color: 'rgba(255,255,255,0.3)' }} title="Bloquear cofre">
            <LockClosedIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-black"
            style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
            <PlusIcon className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {showForm && <CredentialForm onAdd={addCred} onClose={() => setShowForm(false)} />}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <KeyIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{creds.length === 0 ? 'Nenhuma credencial ainda' : 'Nenhuma encontrada'}</p>
          </div>
        )}
        {filtered.map(c => (
          <div key={c.id} className="rounded-xl p-4 group"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {c.url ? '🌐' : '🔑'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{c.service}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.url && (
                      <a href={c.url.startsWith('http') ? c.url : `https://${c.url}`} target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-lg" style={{ color: 'rgba(74,158,255,0.6)' }}>
                        <GlobeAltIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => delCred(c.id)} className="p-1.5 rounded-lg" style={{ color: 'rgba(255,71,87,0.6)' }}>
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {c.category && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-2"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}>
                    {c.category}
                  </span>
                )}
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-12 text-white/30 uppercase tracking-widest">Email</span>
                    <code className="text-xs text-white/70 flex-1 truncate">{c.email}</code>
                    <button onClick={() => navigator.clipboard?.writeText(c.email)}
                      className="text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      copiar
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-12 text-white/30 uppercase tracking-widest">Senha</span>
                    <code className="text-xs flex-1 truncate"
                      style={{ color: showPwd[c.id] ? '#F8A303' : 'rgba(255,255,255,0.3)' }}>
                      {showPwd[c.id] ? c.password : '••••••••••••'}
                    </code>
                    <button onClick={() => setShowPwd(p => ({ ...p, [c.id]: !p[c.id] }))}
                      className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {showPwd[c.id] ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => navigator.clipboard?.writeText(c.password)}
                      className="text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      copiar
                    </button>
                  </div>
                </div>
                {c.notes && <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{c.notes}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CredentialForm({ onAdd, onClose }: { onAdd: (c: Omit<Credential, 'id' | 'createdAt'>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ service: '', url: '', email: '', password: '', notes: '', category: 'Geral' })
  const [showPwd, setShowPwd] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div className="rounded-xl p-4 mb-4 animate-scale-in"
      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-white">Nova Credencial</p>
        <button onClick={onClose}><XMarkIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[
          { k: 'service',  p: 'Nome do serviço *', full: false },
          { k: 'category', p: 'Categoria',          full: false },
          { k: 'url',      p: 'URL (ex: gmail.com)',full: false },
          { k: 'email',    p: 'Email / Usuário *',  full: false },
        ].map(({ k, p, full }) => (
          <input key={k} type="text" placeholder={p} value={(form as any)[k]}
            onChange={e => set(k, e.target.value)}
            className={`${full ? 'col-span-2' : ''} px-3 py-2 rounded-lg text-xs text-white outline-none`}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <div className="relative mb-2">
        <input type={showPwd ? 'text' : 'password'} placeholder="Senha *" value={form.password}
          onChange={e => set('password', e.target.value)}
          className="w-full px-3 py-2 pr-10 rounded-lg text-xs text-white outline-none font-mono"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
        <button onClick={() => setShowPwd(p => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          {showPwd ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </button>
      </div>
      <input type="text" placeholder="Notas opcionais" value={form.notes}
        onChange={e => set('notes', e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none mb-3"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
      <button onClick={() => { if (form.service && form.email && form.password) { onAdd(form); onClose() } }}
        disabled={!form.service || !form.email || !form.password}
        className="w-full py-2 rounded-xl text-sm font-bold text-black disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#8B5CF6,#A78BFA)' }}>
        Salvar no Cofre
      </button>
    </div>
  )
}

// ─── GAMIFICATION PANEL ───────────────────────────────────────
function GamificationPanel({ tasks }: { tasks: PersonalTask[] }) {
  const doneTasks   = tasks.filter(t => t.status === 'done')
  const totalXp     = doneTasks.reduce((a, t) => a + (parseInt(t.xp as any) || 0), 0)
  const { level, progress } = calcXpLevel(totalXp)
  const today       = new Date().toDateString()
  const doneToday   = doneTasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === today).length
  const byCategory  = Object.fromEntries(
    ['trabalho','campanha','pessoal'].map(c => [c, doneTasks.filter(t => t.category === c).length])
  )

  const achievements = [
    { label: 'Primeira tarefa',     done: doneTasks.length >= 1,  icon: '🌟', color: '#F8A303' },
    { label: '5 tarefas concluídas',done: doneTasks.length >= 5,  icon: '🔥', color: '#FF6B35' },
    { label: '10 tarefas concluídas',done: doneTasks.length >= 10, icon: '💎', color: '#4A9EFF' },
    { label: 'Nível 5',             done: level >= 5,              icon: '⚡', color: '#8B5CF6' },
    { label: '500 XP acumulados',   done: totalXp >= 500,          icon: '👑', color: '#F9C234' },
    { label: '3 tarefas hoje',      done: doneToday >= 3,          icon: '🚀', color: '#0ABD78' },
  ]

  return (
    <div className="space-y-4">
      {/* XP + Level */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(248,163,3,0.06)', border: '1px solid rgba(248,163,3,0.15)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-0.5">Nível</p>
            <p className="text-4xl font-black" style={{ color: '#F8A303' }}>{level}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-white">{totalXp}</p>
            <p className="text-xs text-white/40 uppercase tracking-widest">XP Total</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-0.5">Hoje</p>
            <p className="text-3xl font-black" style={{ color: '#0ABD78' }}>{doneToday}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span>Nível {level}</span><span>{progress}/100 XP → Nível {level+1}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#F8A303,#FDC347)' }} />
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(byCategory).map(([cat, count]) => {
          const style = CAT_STYLE[cat]
          return (
            <div key={cat} className="rounded-xl p-4 text-center"
              style={{ background: style.bg, border: `1px solid ${style.color}25` }}>
              <p className="text-2xl font-black" style={{ color: style.color }}>{count}</p>
              <p className="text-[10px] mt-0.5 uppercase tracking-widest" style={{ color: style.color, opacity: 0.7 }}>
                {style.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Achievements */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-sm font-bold text-white mb-4">🏆 Conquistas</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {achievements.map(a => (
            <div key={a.label}
              className="rounded-xl p-3 flex items-center gap-2.5 transition-all"
              style={{
                background: a.done ? `${a.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${a.done ? `${a.color}30` : 'rgba(255,255,255,0.06)'}`,
                opacity: a.done ? 1 : 0.4,
              }}>
              <span className="text-xl">{a.icon}</span>
              <p className="text-xs font-medium text-white leading-snug">{a.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── AI ASSISTANT PANEL ───────────────────────────────────────
function AiAssistantPanel({ tasks, workDay, userName, onTaskCreated, onEventCreated, onWorkDayUpdated }: {
  tasks: PersonalTask[]
  workDay: WorkDay
  userName: string
  onTaskCreated?: () => void
  onEventCreated?: () => void
  onWorkDayUpdated?: (w: WorkDay) => void
}) {
  const CHAT_KEY = 'aps_sofi_chat_v2'
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const greetedRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const fallback = (period: string) => {
    const p = period.charAt(0).toUpperCase() + period.slice(1)
    const pending = tasks.filter(t => t.status !== 'done')
    if (pending.length > 0)
      return `${p}, ${userName}! 👋 Tenho ${pending.length} tarefa${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''} para você. Até que horas vai trabalhar hoje?`
    return `${p}, ${userName}! 👋 Sou a Sofi. Sua lista está vazia — boa hora para planejar. Até que horas vai trabalhar hoje?`
  }

  // Salva mensagens no localStorage sempre que mudam
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-60))) } catch {}
    }
  }, [messages])

  useEffect(() => {
    if (greetedRef.current) return
    greetedRef.current = true

    // Tenta restaurar conversa salva
    try {
      const saved = localStorage.getItem(CHAT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
          return // não cumprimenta de novo
        }
      }
    } catch {}

    // Primeira vez — cumprimenta
    setLoading(true)
    const h = new Date().getHours()
    const period = h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite'
    const pending = tasks.filter(t => t.status !== 'done')
    const promptCtx = pending.length > 0
      ? `Tenho ${pending.length} tarefas pendentes.`
      : 'Minha lista está vazia.'
    api.post('/ai/chat', {
      messages: [{ role: 'user', content: `${period}! ${promptCtx} Me cumprimente pelo nome (${userName}), se apresente como Sofi e pergunte ate que horas vou trabalhar hoje. Max 2 linhas.` }],
      context: { tasks, workDay, userName },
    }).then(r => {
      const content = r.data?.content || r.data?.message || ''
      setMessages([{ role: 'assistant', content: content || fallback(period) }])
    }).catch(() => {
      setMessages([{ role: 'assistant', content: fallback(period) }])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  const executeAction = async (action: { type: string; data: any }) => {
    try {
      if (action.type === 'create_task') {
        await api.post('/personal', action.data)
        onTaskCreated?.()
      } else if (action.type === 'create_event') {
        await api.post('/calendar', action.data)
        onEventCreated?.()
      } else if (action.type === 'send_email') {
        await api.post('/gmail', action.data)
      } else if (action.type === 'open_url') {
        if (action.data?.url) window.open(action.data.url, '_blank')
      } else if (action.type === 'update_workday') {
        const d = action.data as Partial<WorkDay>
        const updated = { ...workDay, ...d }
        localStorage.setItem('aps_workday', JSON.stringify(updated))
        onWorkDayUpdated?.(updated)
      }
    } catch (e) {
      // falha silenciosa — mensagem já foi exibida
    }
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || loading) return
    const userMsg = { role: 'user' as const, content: text }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    if (!override) setInput('')
    setLoading(true)
    try {
      const r = await api.post('/ai/chat', { messages: newMsgs, context: { tasks, workDay, userName } })
      const content = r.data?.content || r.data?.message || ''
      const action = r.data?.action
      setMessages(p => [...p, { role: 'assistant', content: content || 'Não obtive resposta. Pode reformular?' }])
      if (action) await executeAction(action)
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    }
    setLoading(false)
  }

  const clearChat = () => {
    localStorage.removeItem(CHAT_KEY)
    greetedRef.current = false
    setMessages([])
    setLoading(true)
    const h = new Date().getHours()
    const period = h < 12 ? 'bom dia' : h < 18 ? 'boa tarde' : 'boa noite'
    api.post('/ai/chat', {
      messages: [{ role: 'user', content: `${period}! Me cumprimente pelo nome (${userName}) e pergunte ate que horas vou trabalhar hoje. Max 2 linhas.` }],
      context: { tasks, workDay, userName },
    }).then(r => {
      const content = r.data?.content || r.data?.message || ''
      setMessages([{ role: 'assistant', content: content || fallback(period) }])
    }).catch(() => {
      setMessages([{ role: 'assistant', content: fallback(period) }])
    }).finally(() => setLoading(false))
  }

  const QUICK = ['O que temos pra hoje?', 'Priorize minhas tarefas', 'Crie uma tarefa para amanhã', 'Como está a campanha?']

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: 440 }}>
      {/* Header com botão limpar */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {messages.length > 0 ? `${messages.length} mensagens salvas` : 'Nova conversa'}
        </p>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(255,71,87,0.08)', color: 'rgba(255,71,87,0.6)', border: '1px solid rgba(255,71,87,0.15)' }}>
            🗑 Nova conversa
          </button>
        )}
      </div>
      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 p-4 rounded-2xl mb-3"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg,rgba(248,163,3,0.2),rgba(253,195,71,0.1))', border: '1px solid rgba(248,163,3,0.25)' }}>
              🤖
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Iniciando Sofi...</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm mb-0.5"
                style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>🤖</div>
            )}
            <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user' ? {
                background: 'linear-gradient(135deg,rgba(248,163,3,0.18),rgba(253,195,71,0.08))',
                border: '1px solid rgba(248,163,3,0.25)',
                color: '#FDC347',
                borderBottomRightRadius: 4,
              } : {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                borderBottomLeftRadius: 4,
              }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>🤖</div>
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: '#F8A303', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK.map(q => (
            <button key={q} onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded-xl transition-all"
              style={{ background: 'rgba(248,163,3,0.08)', color: 'rgba(248,163,3,0.7)', border: '1px solid rgba(248,163,3,0.15)' }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pergunte sobre tarefas, agenda, campanha, promotores..."
          className="flex-1 px-4 py-3 rounded-xl text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          className="px-5 py-3 rounded-xl font-bold text-black disabled:opacity-40 transition-all"
          style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
          ➤
        </button>
      </div>
    </div>
  )
}

// ─── GOOGLE CALENDAR VIEW ─────────────────────────────────────
function CalendarView({ tasks }: { tasks: PersonalTask[] }) {
  const [gcalEvents, setGcalEvents] = useState<any[]>([])
  const [loadingCal, setLoadingCal] = useState(true)
  const [anchor, setAnchor] = useState(new Date())
  const today = new Date()

  const fetchEvents = () => {
    setLoadingCal(true)
    api.get('/calendar', { params: { days: 90 } })
      .then(r => setGcalEvents(Array.isArray(r.data) ? r.data : []))
      .catch(() => setGcalEvents([]))
      .finally(() => setLoadingCal(false))
  }

  useEffect(() => { fetchEvents() }, [])

  const getWeekDates = (d: Date) => {
    const start = new Date(d)
    const day = start.getDay()
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return x })
  }

  const weekDates = getWeekDates(anchor)

  const navigate = (dir: number) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() + dir * 7)
    setAnchor(d)
  }

  const tasksOnDate = (d: Date) =>
    tasks.filter(t => t.dueDate && new Date(t.dueDate + 'T12:00').toDateString() === d.toDateString())

  const gcalOnDate = (d: Date) =>
    gcalEvents.filter(e => {
      const s = new Date(e.start), en = new Date(e.end)
      const ds = new Date(d); ds.setHours(0,0,0,0)
      const de = new Date(d); de.setHours(23,59,59,999)
      return s <= de && en >= ds
    })

  // build a color map per calendar name
  const calColors: Record<string, string> = {}
  gcalEvents.forEach(e => { if (e.calendarName) calColors[e.calendarName] = e.calendarColor || '#4285F4' })

  const viewDates = view === 'day' ? [today] : weekDates

  return (
    <div>
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="px-2.5 py-1.5 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>←</button>
          <span className="text-xs font-semibold text-white">
            {weekDates[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} –{' '}
            {weekDates[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => navigate(1)} className="px-2.5 py-1.5 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>→</button>
          <button onClick={() => setAnchor(new Date())}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-2">
          {loadingCal && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>⟳ Sincronizando...</span>
          )}
          <button onClick={fetchEvents}
            className="text-[10px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
            style={{ background: 'rgba(66,133,244,0.08)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.2)' }}>
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Calendars legend */}
      {Object.keys(calColors).length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {Object.entries(calColors).map(([name, color]) => (
            <span key={name} className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
              {name}
            </span>
          ))}
          {tasks.some(t => t.dueDate) && (
            <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#F8A303' }} />
              Tarefas (prazo)
            </span>
          )}
        </div>
      )}

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString()
          const dayTasks = tasksOnDate(d)
          const dayEvents = gcalOnDate(d)
          return (
            <div key={i} className="rounded-xl p-2.5"
              style={{
                background: isToday ? 'rgba(248,163,3,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isToday ? 'rgba(248,163,3,0.25)' : 'rgba(255,255,255,0.06)'}`,
                minHeight: 120,
              }}>
              <p className="text-[11px] font-bold mb-2 leading-none"
                style={{ color: isToday ? '#F8A303' : 'rgba(255,255,255,0.35)' }}>
                {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                <span className="block text-[13px] font-extrabold mt-0.5"
                  style={{ color: isToday ? '#F8A303' : 'rgba(255,255,255,0.7)' }}>
                  {d.getDate()}
                </span>
              </p>
              <div className="space-y-1">
                {/* Google Calendar events */}
                {dayEvents.map((e, ei) => {
                  const color = e.calendarColor || '#4285F4'
                  const timeLabel = e.allDay
                    ? ''
                    : new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' '
                  return (
                    <div key={e.id || ei}
                      className="text-[9px] px-1.5 py-1 rounded-md truncate leading-snug cursor-default"
                      style={{ background: color + '22', color: color, border: `1px solid ${color}44` }}
                      title={`${e.title}${e.location ? ' • ' + e.location : ''}`}>
                      {timeLabel}{e.title}
                    </div>
                  )
                })}
                {/* Tasks due on this date */}
                {dayTasks.map(t => {
                  const cat = CAT_STYLE[t.category] || CAT_STYLE.trabalho
                  return (
                    <div key={t.id}
                      className={`text-[9px] px-1.5 py-1 rounded-md truncate leading-snug ${t.status === 'done' ? 'opacity-40 line-through' : ''}`}
                      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}33` }}
                      title={t.title}>
                      📋 {t.title}
                    </div>
                  )
                })}
                {dayEvents.length === 0 && dayTasks.length === 0 && (
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.12)' }}>—</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {!loadingCal && gcalEvents.length === 0 && tasks.filter(t => t.dueDate).length === 0 && (
        <div className="text-center py-10 mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
          <CalendarDaysIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum evento encontrado nos próximos 90 dias</p>
          <p className="text-xs mt-1 opacity-60">Verifique se autorizou o acesso ao Google Calendar no Apps Script</p>
        </div>
      )}
    </div>
  )
}

// ─── GOOGLE WORKSPACE PANEL ───────────────────────────────────
function GoogleWorkspacePanel() {
  const [emails, setEmails]   = useState<any[]>([])
  const [files, setFiles]     = useState<any[]>([])
  const [loadingG, setLoadingG] = useState(true)

  useEffect(() => {
    setLoadingG(true)
    Promise.all([
      api.get('/gmail', { params: { q: 'is:unread', limit: 5 } }).catch(() => ({ data: [] })),
      api.get('/drive', { params: { limit: 6 } }).catch(() => ({ data: [] })),
    ]).then(([gmailRes, driveRes]) => {
      setEmails(Array.isArray(gmailRes.data) ? gmailRes.data : [])
      setFiles(Array.isArray(driveRes.data) ? driveRes.data : [])
    }).finally(() => setLoadingG(false))
  }, [])

  const unread = emails.filter(e => e.unread).length

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {/* Gmail */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">📧</span>
            <span className="text-sm font-bold text-white">Gmail</span>
            {unread > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#FF4757', color: '#fff' }}>{unread}</span>
            )}
          </div>
          <a href="https://mail.google.com" target="_blank" rel="noreferrer"
            className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
            Abrir →
          </a>
        </div>
        <div className="p-3 space-y-2">
          {loadingG ? <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Carregando...</p>
          : emails.length === 0 ? <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Nenhum email não lido ✅</p>
          : emails.map(e => (
            <div key={e.id} className="flex items-start gap-2 p-2 rounded-xl" style={{ background: e.unread ? 'rgba(248,163,3,0.06)' : 'transparent' }}>
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: e.unread ? '#F8A303' : 'rgba(255,255,255,0.15)' }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{e.subject}</p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{e.from?.replace(/<.*>/, '').trim()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drive */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">📁</span>
            <span className="text-sm font-bold text-white">Google Drive</span>
          </div>
          <a href="https://drive.google.com" target="_blank" rel="noreferrer"
            className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
            Abrir →
          </a>
        </div>
        <div className="p-3 space-y-1.5">
          {loadingG ? <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Carregando...</p>
          : files.length === 0 ? <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Nenhum arquivo encontrado</p>
          : files.map(f => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-xl transition-all hover:bg-white/5">
              <span className="text-base flex-shrink-0">{f.icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-white truncate">{f.name}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {new Date(f.modifiedAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function MinhaAreaPage() {
  const router  = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser]       = useState<any>(null)
  const [tasks, setTasks]     = useState<PersonalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'inicio'|'ia'|'tarefas'|'calendario'|'campanha'|'credenciais'|'conquistas'>('inicio')
  const [workDay, setWorkDay] = useState<WorkDay>({ startHour: 8, startMin: 0, endHour: 18, endMin: 0 })
  const [showForm, setShowForm]   = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch]   = useState('')
  const [notifGranted, setNotifGranted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const uc = Cookies.get('user')
      if (uc) setUser(JSON.parse(uc))
    } catch {}
    if ('Notification' in window) setNotifGranted(Notification.permission === 'granted')
    const saved = localStorage.getItem('aps_workday')
    if (saved) try { setWorkDay(JSON.parse(saved)) } catch {}
    loadTasks()
  }, [])

  // Notification reminder every 30 min
  useEffect(() => {
    if (!notifGranted) return
    const t = setInterval(() => {
      const pending = tasks.filter(t => t.status !== 'done')
      if (pending.length > 0) {
        sendNotif(
          `📋 ${pending.length} tarefa${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}`,
          pending.slice(0, 3).map(t => `• ${t.title}`).join('\n')
        )
      }
    }, 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [tasks, notifGranted])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await api.get('/personal')
      setTasks(res.data.tasks || [])
    } catch { setTasks([]) }
    finally { setLoading(false) }
  }

  const addTask = async (data: Partial<PersonalTask>) => {
    try {
      const res = await api.post('/personal', data)
      setTasks(p => [res.data, ...p])
    } catch {}
  }

  const updateTask = async (id: string, upd: Partial<PersonalTask>) => {
    // Optimistic update
    setTasks(p => p.map(t => t.id === id ? { ...t, ...upd } : t))
    try {
      await api.put(`/personal/${id}`, upd)
      if (upd.status === 'done') {
        const t = tasks.find(x => x.id === id)
        sendNotif('✅ Tarefa concluída!', `"${t?.title}" — +${t?.xp} XP`)
      }
    } catch { loadTasks() }
  }

  const deleteTask = async (id: string) => {
    setTasks(p => p.filter(t => t.id !== id))
    try { await api.delete(`/personal/${id}`) } catch { loadTasks() }
  }

  if (!mounted) return null

  const greeting = user ? getGreeting(user.name?.split(' ')[0] || 'Vinicius') : { text: 'Olá!', emoji: '👋' }

  const filteredTasks = tasks
    .filter(t => filterCat === 'all' || t.category === filterCat)
    .filter(t => filterStatus === 'all' || t.status === filterStatus)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      const pri = { high: 0, medium: 1, low: 2 }
      return (pri[a.priority] || 1) - (pri[b.priority] || 1)
    })

  const tabs = [
    { id: 'inicio',       label: '🏠 Início',        show: true },
    { id: 'ia',           label: '🤖 IA Assistente',  show: true },
    { id: 'tarefas',      label: '📋 Tarefas',        show: true },
    { id: 'calendario',   label: '📅 Calendário',     show: true },
    { id: 'campanha',     label: '🎯 Campanha',       show: true },
    { id: 'credenciais',  label: '🔑 Credenciais',    show: true },
    { id: 'conquistas',   label: '🏆 Conquistas',     show: true },
  ]

  const pendingCount = tasks.filter(t => t.status !== 'done').length
  const doneToday    = tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length
  const totalXp      = tasks.filter(t => t.status === 'done').reduce((a, t) => a + (parseInt(t.xp as any) || 0), 0)
  const { level }    = calcXpLevel(totalXp)

  return (
    <AdminLayout>
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 animate-fade-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">{greeting.emoji}</span>
            <h1 className="text-2xl font-extrabold text-white">{greeting.text}</h1>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}Sua área pessoal e privada
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* XP pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(248,163,3,0.1)', border: '1px solid rgba(248,163,3,0.2)' }}>
            <StarSolid className="w-3.5 h-3.5" style={{ color: '#F8A303' }} />
            <span className="text-xs font-bold" style={{ color: '#F8A303' }}>Nível {level} · {totalXp} XP</span>
          </div>
          {/* Notification button */}
          <button
            onClick={async () => { const ok = await requestNotifPermission(); setNotifGranted(ok) }}
            className="p-2 rounded-xl transition-all"
            style={{
              background: notifGranted ? 'rgba(10,189,120,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${notifGranted ? 'rgba(10,189,120,0.25)' : 'rgba(255,255,255,0.09)'}`,
              color: notifGranted ? '#0ABD78' : 'rgba(255,255,255,0.4)',
            }}
            title={notifGranted ? 'Notificações ativas' : 'Ativar notificações'}>
            <BellIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── QUICK STATS ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 animate-fade-in-up">
        {[
          { label: 'Pendentes',   value: pendingCount, color: '#F8A303', icon: '📋' },
          { label: 'Feitas hoje', value: doneToday,    color: '#0ABD78', icon: '✅' },
          { label: 'Total',       value: tasks.length, color: '#4A9EFF', icon: '📊' },
          { label: 'XP Total',    value: totalXp,      color: '#8B5CF6', icon: '⚡' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ───────────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 animate-fade-in-up delay-100">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg,rgba(248,163,3,0.2),rgba(253,195,71,0.1))' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t.id ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.07)'}`,
              color: tab === t.id ? '#F8A303' : 'rgba(255,255,255,0.5)',
            }}>
            {t.label}
            {t.id === 'tarefas' && pendingCount > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: '#FF4757', color: 'white' }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: INÍCIO ────────────────────────────────────── */}
      {tab === 'inicio' && (
        <div className="animate-fade-in-up">
          {/* AI CHAT — primeiro elemento visível */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)', boxShadow: '0 0 12px rgba(248,163,3,0.35)' }}>
                🤖
              </div>
              <div>
                <p className="text-sm font-extrabold text-white leading-none">Sofi — Assistente IA</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>tarefas · agenda · Google Calendar · campanha</p>
              </div>
            </div>
            <AiAssistantPanel
              tasks={tasks}
              workDay={workDay}
              userName={user?.name?.split(' ')[0] || 'Vinicius'}
              onTaskCreated={loadTasks}
              onEventCreated={() => {}}
              onWorkDayUpdated={w => setWorkDay(w)}
            />
          </div>

          <WorkDayTimer tasks={tasks} />

          {/* Today's tasks */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-bold text-white">Tarefas de Hoje</h2>
              <button onClick={() => setTab('tarefas')}
                className="text-xs px-3 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Ver todas →
              </button>
            </div>
            <div className="p-4 space-y-3">
              {tasks.filter(t => t.status !== 'done').slice(0, 5).length === 0 ? (
                <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <CheckSolid className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: '#0ABD78' }} />
                  <p className="text-sm">Nenhuma tarefa pendente! 🎉</p>
                </div>
              ) : (
                tasks.filter(t => t.status !== 'done').slice(0, 5).map(t => (
                  <TaskCard key={t.id} task={t} onUpdate={updateTask} onDelete={deleteTask} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GOOGLE WORKSPACE (visível na aba início) ─────────── */}
      {tab === 'inicio' && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🔗</span>
            <p className="text-xs font-bold text-white">Google Workspace</p>
          </div>
          <GoogleWorkspacePanel />
        </div>
      )}

      {/* ── TAB: IA ASSISTENTE ────────────────────────────────── */}
      {tab === 'ia' && (
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)', boxShadow: '0 0 14px rgba(248,163,3,0.3)' }}>
              🤖
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Sofi — Assistente IA</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tarefas · Google Calendar · Campanha · Promotores
              </p>
            </div>
          </div>
          <AiAssistantPanel
            tasks={tasks}
            workDay={workDay}
            userName={user?.name?.split(' ')[0] || 'Vinicius'}
            onTaskCreated={loadTasks}
            onEventCreated={() => {}}
          />
        </div>
      )}

      {/* ── TAB: TAREFAS / CAMPANHA ─────────────────────────── */}
      {(tab === 'tarefas' || tab === 'campanha') && (
        <div className="animate-fade-in-up">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input type="text" placeholder="Buscar tarefa..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <option value="all">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="in-progress">Em andamento</option>
              <option value="done">Concluídas</option>
            </select>
            {tab === 'tarefas' && (
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <option value="all">Todas as categorias</option>
                <option value="trabalho">Trabalho</option>
                <option value="campanha">Campanha</option>
                <option value="pessoal">Pessoal</option>
              </select>
            )}
            <button onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-black ml-auto"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
              <PlusIcon className="w-4 h-4" /> Nova Tarefa
            </button>
          </div>

          {showForm && (
            <TaskForm
              onAdd={(data) => addTask({ ...data, category: tab === 'campanha' ? 'campanha' : data.category as any })}
              onClose={() => setShowForm(false)}
            />
          )}

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(tab === 'campanha'
                ? filteredTasks.filter(t => t.category === 'campanha')
                : filteredTasks
              ).length === 0 ? (
                <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <CheckCircleIcon className="w-14 h-14 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma tarefa ainda</p>
                  <button onClick={() => setShowForm(true)}
                    className="mt-3 text-xs px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
                    Criar primeira tarefa
                  </button>
                </div>
              ) : (
                (tab === 'campanha'
                  ? filteredTasks.filter(t => t.category === 'campanha')
                  : filteredTasks
                ).map(task => (
                  <TaskCard key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CALENDÁRIO ──────────────────────────────────────── */}
      {tab === 'calendario' && (
        <div className="animate-fade-in-up">
          <CalendarView tasks={tasks} />
        </div>
      )}

      {/* ── TAB: CREDENCIAIS ─────────────────────────────────── */}
      {tab === 'credenciais' && (
        <div className="animate-fade-in-up">
          <CredentialsVault />
        </div>
      )}

      {/* ── TAB: CONQUISTAS ──────────────────────────────────── */}
      {tab === 'conquistas' && (
        <div className="animate-fade-in-up">
          <GamificationPanel tasks={tasks} />
        </div>
      )}
    </AdminLayout>
  )
}
