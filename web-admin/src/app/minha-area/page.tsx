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

interface TaskCreatedEvent extends Event {
  detail?: { tasks?: PersonalTask[] }
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

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parsePersonalTasksFromText(text: string): Partial<PersonalTask>[] {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const pieces = text
    .split(/\n|;|(?:^|\s)\d+[.)]\s+/g)
    .map(item => item.trim())
    .filter(item => item.length > 12 && !/^crie|^criar|^adicione|^adicionar/i.test(item))

  return pieces.slice(0, 12).map(raw => {
    const durationMatch = raw.match(/(\d+)\s*(h|hora|horas|min|minuto|minutos)/i)
    const duration = durationMatch
      ? durationMatch[2].toLowerCase().startsWith('h') ? Number(durationMatch[1]) * 60 : Number(durationMatch[1])
      : 30
    const dateMatch = raw.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/)
    let dueDate = ''
    if (/hoje/i.test(raw)) dueDate = toIsoDate(today)
    else if (/amanh[ãa]/i.test(raw)) dueDate = toIsoDate(tomorrow)
    else if (dateMatch) {
      const year = dateMatch[3] ? Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : today.getFullYear()
      dueDate = toIsoDate(new Date(year, Number(dateMatch[2]) - 1, Number(dateMatch[1])))
    }

    const title = raw
      .replace(/\([^)]*\)/g, '')
      .replace(/prazo\s*:?\s*(hoje|amanh[ãa]|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/ig, '')
      .replace(/\d+\s*(h|hora|horas|min|minuto|minutos)/ig, '')
      .replace(/^\s*[-–•]\s*/, '')
      .trim()
    const lower = raw.toLowerCase()
    const category: PersonalTask['category'] = /campanha|instagram|tiktok|marketing|drone|conte[úu]do|postar/.test(lower)
      ? 'campanha'
      : /pessoal/.test(lower) ? 'pessoal' : 'trabalho'
    const priority: PersonalTask['priority'] = dueDate === toIsoDate(today) || /urgente|prioridade|hoje/.test(lower) ? 'high' : 'medium'

    return { title, duration, dueDate, category, priority, notes: raw }
  }).filter(task => !!task.title)
}

// ─── CREDENTIALS VAULT (local-only, PIN-derived encryption) ─────────
const VAULT_KEY = 'aps_edu_vault_v2'
const VAULT_PIN_KEY = 'aps_edu_vault_pin'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function deriveVaultBits(pin: string, salt: Uint8Array, usage: 'verify' | 'encrypt') {
  const pinBytes = new TextEncoder().encode(pin)
  const material = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(pinBytes),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  if (usage === 'verify') {
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 210_000, hash: 'SHA-256' },
      material,
      256
    )
    return new Uint8Array(bits)
  }
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function setVaultPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveVaultBits(pin, salt, 'verify') as Uint8Array
  localStorage.setItem(VAULT_PIN_KEY, JSON.stringify({
    v: 3,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hash),
  }))
}

async function verifyVaultPin(pin: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(VAULT_PIN_KEY)
    if (!raw) return false
    if (!raw.trim().startsWith('{')) return raw === pin
    const stored = JSON.parse(raw)
    const salt = base64ToBytes(stored.salt)
    const expected = base64ToBytes(stored.hash)
    const actual = await deriveVaultBits(pin, salt, 'verify') as Uint8Array
    if (actual.length !== expected.length) return false
    return actual.every((byte, i) => byte === expected[i])
  } catch {
    return false
  }
}

async function saveVault(creds: Credential[], pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveVaultBits(pin, salt, 'encrypt') as CryptoKey
  const plain = new TextEncoder().encode(JSON.stringify(creds))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plain)
  )
  localStorage.setItem(VAULT_KEY, JSON.stringify({
    v: 3,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  }))
}

async function loadVault(pin: string): Promise<Credential[] | null> {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (!raw) return []
    if (!raw.trim().startsWith('{')) {
      const decoded = decodeURIComponent(escape(atob(raw)))
      const sep = decoded.lastIndexOf('|||')
      if (sep === -1) return null
      const storedPin = decoded.slice(sep + 3)
      if (storedPin !== pin) return null
      return JSON.parse(decoded.slice(0, sep))
    }
    const stored = JSON.parse(raw)
    const key = await deriveVaultBits(pin, base64ToBytes(stored.salt), 'encrypt') as CryptoKey
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(stored.iv)) },
      key,
      toArrayBuffer(base64ToBytes(stored.data))
    )
    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    return null
  }
}

function hasPinSet(): boolean {
  return !!localStorage.getItem(VAULT_PIN_KEY)
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
function WorkDayTimer({ tasks, workDay: extWd, onWorkDayUpdated }: {
  tasks: PersonalTask[]
  workDay?: WorkDay
  onWorkDayUpdated?: (w: WorkDay) => void
}) {
  const [wd, setWd] = useState<WorkDay>(extWd || { startHour: 8, startMin: 0, endHour: 18, endMin: 0 })
  const [editing, setEditing] = useState(false)
  const [now, setNow] = useState(new Date())
  const [flash, setFlash] = useState(false)

  // Sync com Sofi em tempo real
  useEffect(() => {
    if (extWd) {
      const changed = extWd.endHour !== wd.endHour || extWd.endMin !== wd.endMin
        || extWd.startHour !== wd.startHour || extWd.startMin !== wd.startMin
      if (changed) { setWd(extWd); setFlash(true); setTimeout(() => setFlash(false), 2000) }
    }
  }, [extWd])

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

  const pendingTasks = tasks.filter(t => t.status !== 'done')
  const pendingMin   = pendingTasks.reduce((a, t) => a + (t.duration || 0), 0)
  const fitsCount    = pendingTasks.reduce((acc, t) => {
    if (acc.time + (t.duration || 0) <= remaining) { acc.count++; acc.time += (t.duration || 0) }
    return acc
  }, { count: 0, time: 0 }).count

  // Tempo estimado de conclusão se começar agora
  const estFinishMin  = nowTotal + pendingMin
  const estFinishHour = Math.floor(estFinishMin / 60) % 24
  const estFinishMins = estFinishMin % 60

  const saveWd = (w: WorkDay) => {
    setWd(w)
    localStorage.setItem('aps_workday', JSON.stringify(w))
    onWorkDayUpdated?.(w)
    setEditing(false)
  }

  return (
    <div className="rounded-2xl p-5 mb-5 transition-all duration-500"
      style={{
        background: flash ? 'rgba(248,163,3,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${flash ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: flash ? '0 0 20px rgba(248,163,3,0.15)' : 'none',
      }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5" style={{ color: flash ? '#F8A303' : '#F8A303' }} />
          <span className="text-sm font-bold text-white">Meu Dia de Trabalho</span>
          {flash && (
            <span className="text-[10px] px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: 'rgba(248,163,3,0.2)', color: '#F8A303' }}>
              ✨ Atualizado pela Sofi
            </span>
          )}
        </div>
        <button onClick={() => setEditing(!editing)}
          className="text-xs px-3 py-1 rounded-lg transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.09)' }}>
          {editing ? 'Fechar' : '⚙️ Configurar'}
        </button>
      </div>

      {editing && <WorkDayEditor wd={wd} onSave={saveWd} />}

      {/* Progress bar */}
      <div className="relative h-3 rounded-full overflow-hidden mb-1"
        style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: remaining < 60
              ? 'linear-gradient(90deg,#FF4757,#FF6B6B)'
              : 'linear-gradient(90deg,#F8A303,#FDC347)',
          }} />
        <div className="absolute top-0 bottom-0 w-0.5 rounded-full"
          style={{ left: `${pct}%`, background: 'white', opacity: 0.8 }} />
      </div>
      <div className="flex justify-between text-[9px] mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
        <span>{String(wd.startHour).padStart(2,'0')}:{String(wd.startMin).padStart(2,'0')}</span>
        <span>{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} agora</span>
        <span>{String(wd.endHour).padStart(2,'0')}:{String(wd.endMin).padStart(2,'0')}</span>
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
        <div className="mt-3 p-3 rounded-xl space-y-1 text-xs"
          style={{ background: remaining < pendingMin ? 'rgba(255,71,87,0.06)' : 'rgba(248,163,3,0.07)', border: `1px solid ${remaining < pendingMin ? 'rgba(255,71,87,0.2)' : 'rgba(248,163,3,0.15)'}` }}>
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span style={{ color: remaining < pendingMin ? 'rgba(255,150,150,0.9)' : 'rgba(255,200,80,0.9)' }}>
              <strong>{pendingTasks.length} tarefas</strong> · <strong>{fmtTime(pendingMin)}</strong> de trabalho pendente
              {remaining > 0 && remaining < pendingMin && <span style={{ color: '#FF4757' }}> — não dá pra tudo hoje! Priorize.</span>}
            </span>
          </div>
          {pendingMin > 0 && remaining > 0 && (
            <div className="flex items-center gap-2">
              <span>🏁</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                Se começar agora, termina por volta das{' '}
                <strong style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {String(estFinishHour).padStart(2,'0')}:{String(estFinishMins).padStart(2,'0')}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i)
const MINUTES_5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

const selectStyle = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'white',
  borderRadius: '0.5rem',
  padding: '8px 6px',
  fontSize: '0.85rem',
  fontWeight: 700,
  textAlign: 'center' as const,
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
  WebkitAppearance: 'none' as const,
  MozAppearance: 'none' as const,
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
          <div className="flex items-center gap-1">
            <select
              value={(v as any)[hKey]}
              onChange={e => setV(p => ({ ...p, [hKey]: parseInt(e.target.value) }))}
              style={selectStyle}>
              {HOURS_24.map(h => (
                <option key={h} value={h} style={{ background: '#1a1a2e', color: 'white' }}>
                  {String(h).padStart(2, '0')}
                </option>
              ))}
            </select>
            <span className="text-white font-bold text-lg">:</span>
            <select
              value={(v as any)[mKey]}
              onChange={e => setV(p => ({ ...p, [mKey]: parseInt(e.target.value) }))}
              style={selectStyle}>
              {MINUTES_5.map(m => (
                <option key={m} value={m} style={{ background: '#1a1a2e', color: 'white' }}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
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
  const [form, setForm] = useState<{
    title: string
    category: PersonalTask['category']
    duration: number
    priority: PersonalTask['priority']
    notes: string
    dueDate: string
  }>({
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
  const [vaultBusy, setVaultBusy] = useState(false)

  useEffect(() => {
    setIsSetup(!hasPinSet())
  }, [])

  const unlock = async () => {
    if (!crypto?.subtle) {
      setPinError('Criptografia do navegador indisponível.')
      return
    }
    setVaultBusy(true)
    if (isSetup) {
      if (pin.length < 4) { setPinError('PIN deve ter pelo menos 4 dígitos'); setVaultBusy(false); return }
      if (pin !== confirmPin) { setPinError('PINs não coincidem'); setVaultBusy(false); return }
      await setVaultPin(pin)
      await saveVault([], pin)
      setCreds([])
      setUnlocked(true)
    } else {
      if (!await verifyVaultPin(pin)) { setPinError('PIN incorreto'); setVaultBusy(false); return }
      const loaded = await loadVault(pin)
      if (loaded === null) { setPinError('Erro ao carregar cofre'); setVaultBusy(false); return }
      setCreds(loaded)
      await saveVault(loaded, pin)
      setUnlocked(true)
    }
    setPinError('')
    setVaultBusy(false)
  }

  const save = async (newCreds: Credential[]) => {
    setCreds(newCreds)
    await saveVault(newCreds, pin)
  }

  const addCred = async (c: Omit<Credential, 'id' | 'createdAt'>) => {
    const newCreds = [...creds, { ...c, id: Date.now().toString(), createdAt: new Date().toISOString() }]
    await save(newCreds)
  }

  const delCred = async (id: string) => save(creds.filter(c => c.id !== id))

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
          <button onClick={unlock} disabled={vaultBusy}
            className="w-full py-3 rounded-xl text-sm font-bold text-black disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
            {vaultBusy ? 'Protegendo...' : isSetup ? 'Criar Cofre' : 'Desbloquear'}
          </button>
        </div>
        <p className="text-[10px] text-center max-w-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          🔒 Dados criptografados neste dispositivo com chave derivada do PIN. Nunca enviados ao servidor.
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
function AiAssistantPanel({ tasks, workDay, userName, onTaskCreated, onEventCreated, onWorkDayUpdated, onWorkspaceRefresh }: {
  tasks: PersonalTask[]
  workDay: WorkDay
  userName: string
  onTaskCreated?: () => void
  onEventCreated?: () => void
  onWorkDayUpdated?: (w: WorkDay) => void
  onWorkspaceRefresh?: () => void
}) {
  const CHAT_KEY = 'aps_sofi_chat_v2'
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; display?: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const greetedRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Attachment state
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachPreview, setAttachPreview] = useState<string>('') // emoji + filename label
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Voice state ────────────────────────────────────────────
  const [isListening, setIsListening]     = useState(false)
  const [isSpeaking, setIsSpeaking]       = useState(false)
  const [voiceEnabled, setVoiceEnabled]   = useState(false)
  const recognitionRef = useRef<any>(null)

  // Init speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev ? prev + ' ' + transcript : transcript)
      setIsListening(false)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend   = () => setIsListening(false)
    recognitionRef.current = rec
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const speakText = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/[*_`#[\]()]/g, '').slice(0, 500)
    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang = 'pt-BR'
    utter.rate = 1.05
    utter.pitch = 1.0
    const voices = window.speechSynthesis.getVoices()
    const ptVoice = voices.find(v => v.lang.startsWith('pt'))
    if (ptVoice) utter.voice = ptVoice
    utter.onstart = () => setIsSpeaking(true)
    utter.onend   = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utter)
  }

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }

  function getFileEmoji(file: File) {
    if (file.type.startsWith('image/')) return '📷'
    if (file.type.startsWith('audio/')) return '🎵'
    if (file.type.startsWith('video/')) return '🎬'
    if (file.type.includes('pdf')) return '📕'
    return '📄'
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachedFile(file)
    setAttachPreview(`${getFileEmoji(file)} ${file.name}`)
  }

  const clearAttachment = () => {
    setAttachedFile(null)
    setAttachPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function processAttachment(file: File): Promise<{ text?: string; imageBase64?: string; imageMimeType?: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] || result

        if (file.type.startsWith('image/')) {
          resolve({ imageBase64: base64, imageMimeType: file.type })
          return
        }

        if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileBase64: base64, mimeType: file.type, fileName: file.name }),
            })
            const data = await res.json()
            resolve({ text: data.text ? `[AUDIO_TRANSCRIBED:${file.name}]\n${data.text}` : `[Áudio: ${file.name} — sem fala detectada]` })
          } catch {
            resolve({ text: `[Áudio: ${file.name}]` })
          }
          return
        }

        // All document types: txt, csv, pdf, docx, doc, etc.
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: base64, mimeType: file.type, fileName: file.name }),
          })
          const data = await res.json()
          if (data.text) {
            // Trunca para ~12000 chars (~3000 tokens) para não ultrapassar limite Groq free tier
            const MAX_CHARS = 12_000
            const rawText = data.text as string
            const truncated = rawText.length > MAX_CHARS
              ? rawText.substring(0, MAX_CHARS) + '\n\n[... texto truncado — documento muito longo ...]'
              : rawText
            resolve({ text: `[DOC_CONTENT:${file.name}]\n${truncated}` })
          } else {
            resolve({ text: `[Arquivo: ${file.name} — não foi possível extrair texto]` })
          }
        } catch {
          resolve({ text: `[Arquivo: ${file.name}]` })
        }
      }
      reader.readAsDataURL(file)
    })
  }

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
        const res = await api.post('/personal', action.data)
        setMessages(p => [...p, { role: 'assistant', content: `✅ Tarefa criada e destacada: **${res.data?.title || action.data?.title || 'Nova tarefa'}**` }])
        onTaskCreated?.()
      } else if (action.type === 'create_tasks') {
        const items = Array.isArray(action.data?.tasks) ? action.data.tasks : []
        const created: PersonalTask[] = []
        for (const item of items) {
          if (!item?.title) continue
          const res = await api.post('/personal', item)
          created.push(res.data)
        }
        if (created.length) {
          setMessages(p => [...p, { role: 'assistant', content: `✅ ${created.length} tarefas criadas e destacadas:\n${created.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}` }])
          onTaskCreated?.()
        }
      } else if (action.type === 'create_event') {
        await api.post('/calendar', action.data)
        onEventCreated?.()
      } else if (action.type === 'send_email') {
        await api.post('/gmail', action.data)
      } else if (action.type === 'open_url') {
        if (action.data?.url) window.open(action.data.url, '_blank')
      } else if (action.type === 'refresh_workspace') {
        onWorkspaceRefresh?.()
      } else if (action.type === 'update_workday') {
        const d = action.data as Partial<WorkDay>
        const updated = { ...workDay, ...d }
        localStorage.setItem('aps_workday', JSON.stringify(updated))
        onWorkDayUpdated?.(updated)

      // ── BUSCA NA INTERNET ──────────────────────────────────
      } else if (action.type === 'web_search') {
        setLoading(true)
        try {
          const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: action.data.query }),
          })
          const searchData = await res.json()
          // Monta contexto de busca e pede à IA para resumir
          const searchContext = searchData.answer
            ? `Resposta direta: ${searchData.answer}\n\n`
            : ''
          const resultsText = (searchData.results || [])
            .map((r: any, i: number) => `${i+1}. ${r.title}: ${r.snippet}`)
            .join('\n')
          const searchPrompt = `[RESULTADO DA BUSCA por "${action.data.query}"]\n${searchContext}${resultsText}\n\n---\nCom base nesses resultados, responda à pergunta original de forma clara e resumida em português.`
          const aiRes = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: searchPrompt }),
          })
          const aiData = await aiRes.json()
          const summary = aiData.content || searchContext + resultsText || 'Não encontrei resultados relevantes.'
          setMessages(p => [...p, { role: 'assistant', content: `🔍 **Pesquisa: "${action.data.query}"**\n\n${summary}` }])
        } catch {
          setMessages(p => [...p, { role: 'assistant', content: '❌ Não consegui pesquisar na internet agora.' }])
        }
        setLoading(false)

      // ── GERAÇÃO DE IMAGENS ─────────────────────────────────
      } else if (action.type === 'generate_image') {
        setLoading(true)
        try {
          const res = await fetch('/api/imagine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: action.data.prompt, style: action.data.style }),
          })
          const imgData = await res.json()
          if (imgData.imageBase64) {
            const imgSrc = `data:${imgData.mimeType};base64,${imgData.imageBase64}`
            setMessages(p => [...p, {
              role: 'assistant',
              content: `[IMAGE:${imgSrc}]`,
              display: `🎨 Imagem gerada!`,
            }])
          } else {
            setMessages(p => [...p, { role: 'assistant', content: `❌ Não consegui gerar a imagem: ${imgData.error}` }])
          }
        } catch {
          setMessages(p => [...p, { role: 'assistant', content: '❌ Erro ao gerar imagem.' }])
        }
        setLoading(false)
      }
    } catch (e) {
      // falha silenciosa — mensagem já foi exibida
    }
  }

  const send = async (override?: string) => {
    const baseText = (override ?? input).trim()
    if ((!baseText && !attachedFile) || loading) return

    let finalText = baseText
    let imageBase64: string | undefined
    let imageMimeType: string | undefined
    const file = attachedFile

    if (file) {
      setLoading(true)
      const processed = await processAttachment(file)
      if (processed.imageBase64) {
        imageBase64 = processed.imageBase64
        imageMimeType = processed.imageMimeType
        finalText = baseText || 'Analise esta imagem detalhadamente e descreva o que vê. Se houver texto, leia-o. Se for um documento, extraia as informações principais.'
      } else if (processed.text) {
        const isAudio = processed.text.startsWith('[AUDIO_TRANSCRIBED:')
        const isDoc = processed.text.startsWith('[DOC_CONTENT:')
        let instruction = ''
        if (isAudio) {
          instruction = `\n\n---\nSOFI, você recebeu a transcrição de um áudio do usuário. Analise o conteúdo transcrito: identifique o tema principal, pontos-chave e contexto. ${baseText ? 'O usuário também disse: ' + baseText : 'Responda de forma natural como se tivesse ouvido o áudio, resuma o conteúdo e pergunte se precisa de algo.'}`
        } else if (isDoc) {
          instruction = `\n\n---\nSOFI, você acabou de receber e ler o conteúdo completo do documento acima. Faça uma análise profissional e inteligente: (1) Resumo executivo em 3-5 pontos principais, (2) Informações mais relevantes e dados importantes encontrados, (3) Pergunte se o usuário quer algo específico sobre o conteúdo. ${baseText ? 'O usuário também pediu: ' + baseText : ''} Responda como uma secretária profissional e eficiente.`
        }
        finalText = processed.text + instruction
      }
      clearAttachment()
    }

    if (!finalText) return

    // Monta display visível no chat (mascara conteúdo de arquivos)
    let displayText = baseText
    if (file) {
      const icon = file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('audio/') ? '🎵' : '📎'
      const fileChip = `${icon} ${file.name}`
      displayText = baseText ? `${fileChip}\n${baseText}` : fileChip
    }

    const userMsg = { role: 'user' as const, content: finalText, display: displayText || undefined }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    if (!override) setInput('')
    setLoading(true)

    const asksTasks = /(minhas tarefas|tarefas de hoje|o que tenho.*fazer|quais.*tarefas|lista.*tarefas)/i.test(baseText)
    const createsTasks = /(crie|criar|adicione|adicionar|nova tarefa|novas tarefas)/i.test(baseText)
    if (asksTasks && !createsTasks && !file) {
      const pending = tasks.filter(t => t.status !== 'done')
      const today = new Date().toISOString().slice(0, 10)
      const todayTasks = pending.filter(t => t.dueDate === today)
      const source = todayTasks.length ? todayTasks : pending
      const answer = source.length
        ? `Você tem ${source.length} tarefa${source.length !== 1 ? 's' : ''} ${todayTasks.length ? 'para hoje' : 'pendente' + (source.length !== 1 ? 's' : '')}:\n${source.map((t, i) => `${i + 1}. ${t.title} (${fmtTime(t.duration)}${t.dueDate ? `, prazo: ${new Date(t.dueDate + 'T12:00').toLocaleDateString('pt-BR')}` : ''})`).join('\n')}`
        : 'Sua lista de tarefas está vazia agora. Posso criar tarefas para você e elas vão aparecer em destaque aqui e no calendário da sua área.'
      setMessages(p => [...p, { role: 'assistant', content: answer }])
      speakText(answer)
      setLoading(false)
      return
    }

    if (createsTasks && !file) {
      const parsedTasks = parsePersonalTasksFromText(baseText)
      if (parsedTasks.length > 1) {
        try {
          const created: PersonalTask[] = []
          for (const item of parsedTasks) {
            const res = await api.post('/personal', item)
            created.push(res.data)
          }
          window.dispatchEvent(new CustomEvent('personal_tasks_updated', { detail: { tasks: created } }))
          const answer = `✅ ${created.length} tarefas criadas, destacadas e colocadas no calendário da sua área quando têm prazo:\n${created.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}`
          setMessages(p => [...p, { role: 'assistant', content: answer }])
          speakText(answer)
        } catch (err: any) {
          const msg = err?.response?.data?.error || err?.message || 'Erro ao criar tarefas'
          setMessages(p => [...p, { role: 'assistant', content: `❌ ${msg}` }])
        }
        setLoading(false)
        return
      }
    }

    try {
      // For vision messages, call the gemini proxy directly
      let r: any
      if (imageBase64 && imageMimeType) {
        const visionRes = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: finalText, imageBase64, imageMimeType }),
        })
        const visionData = await visionRes.json()
        r = { data: { content: visionData.content || visionData.error || 'Não consegui analisar a imagem.' } }
      } else {
        // Envia no máx as últimas 12 mensagens; usa 'content' real (não 'display' mascarado)
        const trimmedMsgs = newMsgs.slice(-12).map(({ role, content }) => ({ role, content }))
        r = await api.post('/ai/chat', { messages: trimmedMsgs, context: { tasks, workDay, userName } })
      }
      // Garante que content é sempre string (nunca objeto)
      const rawContent = r.data?.content ?? r.data?.message ?? ''
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
      const action = r.data?.action
      const rawErr = r.data?.error
      const errMsg = rawErr ? (typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr)) : ''
      const fallbackMsg = errMsg
        ? `❌ Erro no servidor: ${errMsg}`
        : 'Não obtive resposta. Pode reformular?'
      const finalContent = content || fallbackMsg
      setMessages(p => [...p, { role: 'assistant', content: finalContent }])
      speakText(finalContent)
      if (action) await executeAction(action)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro de conexão'
      setMessages(p => [...p, { role: 'assistant', content: `❌ ${msg}` }])
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
              {(() => {
                const txt = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
                if (txt.startsWith('[IMAGE:')) {
                  const src = txt.replace('[IMAGE:', '').replace(/\]$/, '')
                  return (
                    <div>
                      <img src={src} alt="Imagem gerada pela Sofi" className="rounded-xl max-w-full" style={{ maxHeight: 320 }} />
                      <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>🎨 Gerado pela Sofi</p>
                    </div>
                  )
                }
                const display = m.display ?? txt
                return typeof display === 'string' ? display : JSON.stringify(display)
              })()}
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

      {/* Attachment preview chip */}
      {attachPreview && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA' }}>
            <span>{attachPreview}</span>
            <button onClick={clearAttachment} className="ml-1 hover:text-red-400 transition-colors" style={{ color: '#FF4757' }}>×</button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="space-y-2">
        {/* Voice controls bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListening}
            disabled={!recognitionRef.current}
            title={recognitionRef.current ? (isListening ? 'Parar gravação' : 'Falar para Sofi') : 'Voz não suportada neste navegador'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
            style={{
              background: isListening ? 'rgba(255,71,87,0.15)' : 'rgba(255,255,255,0.05)',
              border: isListening ? '1px solid rgba(255,71,87,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: isListening ? '#FF4757' : 'rgba(255,255,255,0.4)',
            }}>
            {isListening ? (
              <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Gravando...</>
            ) : (
              <><span>🎤</span> Falar</>
            )}
          </button>
          <button
            onClick={() => setVoiceEnabled(v => !v)}
            title={voiceEnabled ? 'Desativar voz da Sofi' : 'Ativar voz da Sofi'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: voiceEnabled ? 'rgba(10,189,120,0.12)' : 'rgba(255,255,255,0.05)',
              border: voiceEnabled ? '1px solid rgba(10,189,120,0.25)' : '1px solid rgba(255,255,255,0.08)',
              color: voiceEnabled ? '#0ABD78' : 'rgba(255,255,255,0.4)',
            }}>
            {voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF'}
          </button>
          {isSpeaking && (
            <button onClick={stopSpeaking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold animate-pulse"
              style={{ background: 'rgba(248,163,3,0.12)', border: '1px solid rgba(248,163,3,0.25)', color: '#F8A303' }}>
              ⏹ Parar fala
            </button>
          )}
          <span className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
            {voiceEnabled ? '🎙️ Sofi falará as respostas' : 'Clique 🔇 para ativar voz'}
          </span>
        </div>

        {/* Text input row */}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => !loading && fileInputRef.current?.click()}
            disabled={loading}
            className="px-3 py-3 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
            title="Anexar arquivo"
            style={{
              background: attachedFile ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)',
              border: attachedFile ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: attachedFile ? '#A78BFA' : 'rgba(255,255,255,0.4)',
            }}>
            📎
          </button>
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={isListening ? '🎤 Ouvindo...' : 'Pergunte sobre tarefas, agenda, campanha, promotores...'}
            className="flex-1 px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
            style={{
              background: isListening ? 'rgba(255,71,87,0.06)' : 'rgba(255,255,255,0.06)',
              border: isListening ? '1px solid rgba(255,71,87,0.3)' : '1px solid rgba(255,255,255,0.1)',
            }} />
          <button onClick={() => send()} disabled={loading || (!input.trim() && !attachedFile)}
            className="px-5 py-3 rounded-xl font-bold text-black disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
            ➤
          </button>
        </div>
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

  // modal state
  const [sel, setSel] = useState<Record<string, any> | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editLoc, setEditLoc] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchEvents = () => {
    setLoadingCal(true)
    api.get('/calendar', { params: { days: 90 } })
      .then(r => setGcalEvents(Array.isArray(r.data) ? r.data : []))
      .catch(() => setGcalEvents([]))
      .finally(() => setLoadingCal(false))
  }

  useEffect(() => { fetchEvents() }, [])

  const openEvent = (e: any) => {
    setSel(e)
    setEditMode(false)
    setEditTitle(e.title)
    setEditStart(toLocalInput(e.start))
    setEditEnd(toLocalInput(e.end))
    setEditDesc(e.description || '')
    setEditLoc(e.location || '')
  }

  const closeModal = () => { setSel(null); setEditMode(false) }

  const saveEdit = async () => {
    if (!sel) return
    setSaving(true)
    try {
      const evId = sel.id.replace(/@.*/, '') // remove @google.com suffix
      await api.put(`/calendar/${encodeURIComponent(sel.id)}`, {
        title: editTitle,
        start: new Date(editStart).toISOString(),
        end: new Date(editEnd).toISOString(),
        description: editDesc,
        location: editLoc,
      })
      setGcalEvents(prev => prev.map(ev => ev.id === sel.id
        ? { ...ev, title: editTitle, start: new Date(editStart).toISOString(), end: new Date(editEnd).toISOString(), description: editDesc, location: editLoc }
        : ev
      ))
      setSel(s => s ? { ...s, title: editTitle, start: new Date(editStart).toISOString(), end: new Date(editEnd).toISOString(), description: editDesc, location: editLoc } : null)
      setEditMode(false)
    } catch { alert('Erro ao salvar. Verifique se o Apps Script está atualizado.') }
    setSaving(false)
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Excluir este evento do Google Calendar?')) return
    setDeleting(true)
    try {
      await api.delete(`/calendar/${encodeURIComponent(id)}`)
      setGcalEvents(prev => prev.filter(ev => ev.id !== id))
      closeModal()
    } catch { alert('Erro ao excluir.') }
    setDeleting(false)
  }

  const gcalWeekLink = (d: Date) => {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
    return `https://calendar.google.com/calendar/r/week/${y}/${m}/${day}`
  }

  function toLocalInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2,'0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function fmtEventDate(e: any) {
    const s = new Date(e.start)
    const en = new Date(e.end)
    if (e.allDay) {
      const same = s.toDateString() === en.toDateString()
      return same
        ? s.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
        : `${s.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${en.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    const date = s.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const t1 = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const t2 = en.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${date} · ${t1} – ${t2}`
  }

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

      {/* ── TODAY SECTION ──────────────────────────────── */}
      {(() => {
        const todayEvents = Array.isArray(gcalEvents) ? gcalOnDate(today) : []
        const todayTasks = Array.isArray(tasks) ? tasksOnDate(today) : []
        const allToday = [
          ...todayEvents.map(e => ({ type: 'event' as const, data: e })),
          ...todayTasks.map(t => ({ type: 'task' as const, data: t })),
        ].sort((a, b) => {
          const aTime = a.type === 'event' ? new Date(a.data.start).getTime() : Infinity
          const bTime = b.type === 'event' ? new Date(b.data.start).getTime() : Infinity
          return aTime - bTime
        })
        return (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#F8A303' }}>📅 Hoje</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              {allToday.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(248,163,3,0.12)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
                  {allToday.length} item{allToday.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {allToday.length === 0 ? (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>
                Nenhum compromisso para hoje 🎉
              </div>
            ) : (
              <div className="space-y-1.5">
                {allToday.map((item, idx) => {
                  if (item.type === 'event') {
                    const e = item.data
                    const color = e.calendarColor || '#4285F4'
                    const timeLabel = e.allDay ? 'Dia todo' : new Date(e.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <button key={`ev-${idx}`} onClick={() => openEvent(e)}
                        className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all hover:brightness-110"
                        style={{ background: color + '12', border: `1px solid ${color}30` }}>
                        <div className="flex-shrink-0 text-center" style={{ minWidth: 40 }}>
                          <p className="text-[10px] font-bold" style={{ color }}>{timeLabel}</p>
                        </div>
                        <div className="w-px h-6 flex-shrink-0 rounded" style={{ background: color + '60' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{e.title}</p>
                          {e.location && <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>📍 {e.location}</p>}
                          {e.calendarName && <p className="text-[10px]" style={{ color: color + 'AA' }}>{e.calendarName}</p>}
                        </div>
                        <span className="text-[10px] flex-shrink-0" style={{ color: color + '99' }}>↗</span>
                      </button>
                    )
                  } else {
                    const t = item.data as typeof tasks[0]
                    const cat = CAT_STYLE[t.category] || CAT_STYLE.trabalho
                    return (
                      <div key={`tk-${idx}`} className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                        style={{ background: cat.bg, border: `1px solid ${cat.color}33` }}>
                        <div className="flex-shrink-0 text-center" style={{ minWidth: 40 }}>
                          <p className="text-[10px] font-bold" style={{ color: cat.color }}>prazo</p>
                        </div>
                        <div className="w-px h-6 flex-shrink-0 rounded" style={{ background: cat.color + '60' }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${t.status === 'done' ? 'line-through opacity-40' : ''}`} style={{ color: 'rgba(255,255,255,0.9)' }}>
                            📋 {t.title}
                          </p>
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── THIS WEEK SECTION ──────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>📆 Esta Semana</span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {weekDates[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – {weekDates[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
        </span>
      </div>

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
                    <button key={e.id || ei}
                      onClick={() => openEvent(e)}
                      className="w-full text-left text-[9px] px-1.5 py-1 rounded-md truncate leading-snug transition-all hover:brightness-125 active:scale-95"
                      style={{ background: color + '22', color: color, border: `1px solid ${color}44` }}
                      title={`${e.title}${e.location ? ' • ' + e.location : ''} — clique para ver detalhes`}>
                      {timeLabel}{e.title}
                    </button>
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

      {/* ── EVENT DETAIL MODAL ────────────────────────────── */}
      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden relative animate-fade-in-up"
            style={{ background: '#0D0F1A', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
            onClick={ev => ev.stopPropagation()}>

            {/* color bar */}
            <div className="h-1 w-full" style={{ background: sel.calendarColor || '#4285F4' }} />

            {/* header */}
            <div className="px-5 pt-4 pb-3 flex items-start justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: sel.calendarColor || '#4285F4' }} />
                <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {sel.calendarName || 'Google Calendar'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
                    style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
                    ✏️ Editar
                  </button>
                )}
                <a href={gcalWeekLink(new Date(sel.start))} target="_blank" rel="noreferrer"
                  className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: 'rgba(66,133,244,0.1)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.2)' }}>
                  Abrir ↗
                </a>
                <button onClick={closeModal}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* body */}
            <div className="px-5 py-4 space-y-4">
              {/* title */}
              {editMode ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-lg font-bold bg-transparent text-white border-b outline-none pb-1"
                  style={{ borderColor: sel.calendarColor || '#4285F4' }} />
              ) : (
                <h3 className="text-lg font-bold text-white leading-snug">{sel.title}</h3>
              )}

              {/* date / time */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Data e Horário
                </p>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Início</p>
                      <input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    </div>
                    <div>
                      <p className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Fim</p>
                      <input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white">{fmtEventDate(sel)}</p>
                )}
              </div>

              {/* location */}
              {(editMode || sel.location) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    📍 Local
                  </p>
                  {editMode ? (
                    <input value={editLoc} onChange={e => setEditLoc(e.target.value)}
                      placeholder="Local do evento..."
                      className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                  ) : (
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{sel.location}</p>
                  )}
                </div>
              )}

              {/* description */}
              {(editMode || sel.description) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    📝 Descrição
                  </p>
                  {editMode ? (
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                      rows={3} placeholder="Adicione uma descrição..."
                      className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.65)' }}>{sel.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* footer actions */}
            <div className="px-5 pb-5 flex gap-2 flex-wrap"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
              {editMode ? (
                <>
                  <button onClick={saveEdit} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
                    {saving ? 'Salvando...' : '✅ Salvar alterações'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(true)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
                    ✏️ Editar evento
                  </button>
                  <button onClick={() => deleteEvent(sel.id)} disabled={deleting}
                    className="px-4 py-2.5 rounded-xl text-sm disabled:opacity-50"
                    style={{ background: 'rgba(255,71,87,0.1)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.2)' }}>
                    {deleting ? '...' : '🗑'}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// ─── GOOGLE WORKSPACE PANEL ───────────────────────────────────
function GoogleWorkspacePanel({ refreshKey }: { refreshKey?: number }) {
  const [emails, setEmails]   = useState<any[]>([])
  const [files, setFiles]     = useState<any[]>([])
  const [loadingG, setLoadingG] = useState(true)

  const loadWorkspace = () => {
    setLoadingG(true)
    Promise.all([
      api.get('/gmail', { params: { q: 'newer_than:1d', limit: 8 } }).catch(() => ({ data: [] })),
      api.get('/drive', { params: { limit: 8 } }).catch(() => ({ data: [] })),
    ]).then(([gmailRes, driveRes]) => {
      setEmails(Array.isArray(gmailRes.data) ? gmailRes.data : [])
      setFiles(Array.isArray(driveRes.data) ? driveRes.data : [])
    }).finally(() => setLoadingG(false))
  }

  useEffect(() => { loadWorkspace() }, [refreshKey])

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
          <div className="flex items-center gap-1.5">
            <button onClick={loadWorkspace}
              className="text-[10px] px-2 py-1 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
              🔄
            </button>
            <a href="https://mail.google.com" target="_blank" rel="noreferrer"
              className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
              Abrir →
            </a>
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          {loadingG ? <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Carregando...</p>
          : emails.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>✅ Nenhum email não lido</p>
            </div>
          ) : emails.map(e => (
            <a key={e.id}
              href={`https://mail.google.com/mail/u/0/#inbox/${e.id}`}
              target="_blank" rel="noreferrer"
              className="flex items-start gap-2.5 p-2.5 rounded-xl transition-all hover:bg-white/5 cursor-pointer block"
              style={{ background: e.unread ? 'rgba(248,163,3,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${e.unread ? 'rgba(248,163,3,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ background: e.unread ? '#F8A303' : 'rgba(255,255,255,0.15)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: e.unread ? 'white' : 'rgba(255,255,255,0.65)' }}>
                  {e.subject}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {e.from?.replace(/<.*>/, '').trim()}
                </p>
                {e.snippet && (
                  <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {e.snippet}
                  </p>
                )}
              </div>
              <span className="text-[9px] flex-shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {new Date(e.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
              </span>
            </a>
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
  const [workDay, setWorkDay] = useState<WorkDay>({ startHour: 8, startMin: 0, endHour: 18, endMin: 0 })
  const [wsRefreshKey, setWsRefreshKey] = useState(0)
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

    // Listen for workday updates from floating Sofi on other pages
    const handleWdUpdate = (e: any) => {
      const updated = e.detail as WorkDay
      if (updated) { setWorkDay(updated); localStorage.setItem('aps_workday', JSON.stringify(updated)) }
    }
    const handleTasksUpdated = (e: TaskCreatedEvent) => {
      const created = e.detail?.tasks || []
      setSearch('')
      setFilterCat('all')
      setFilterStatus('all')
      if (created.length) setTasks(p => [...created, ...p.filter(t => !created.some(c => c.id === t.id))])
      loadTasks()
    }
    window.addEventListener('workday_updated', handleWdUpdate)
    window.addEventListener('personal_tasks_updated', handleTasksUpdated)
    return () => {
      window.removeEventListener('workday_updated', handleWdUpdate)
      window.removeEventListener('personal_tasks_updated', handleTasksUpdated)
    }
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
      setSearch('')
      setFilterCat('all')
      setFilterStatus('all')
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

  const pendingCount = tasks.filter(t => t.status !== 'done').length
  const doneToday    = tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length
  const totalXp      = tasks.filter(t => t.status === 'done').reduce((a, t) => a + (parseInt(t.xp as any) || 0), 0)
  const { level }    = calcXpLevel(totalXp)
  const highlightedTasks = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      const today = new Date().toISOString().slice(0, 10)
      const aToday = a.dueDate === today ? -1 : 0
      const bToday = b.dueDate === today ? -1 : 0
      if (aToday !== bToday) return aToday - bToday
      const pri = { high: 0, medium: 1, low: 2 }
      return (pri[a.priority] || 1) - (pri[b.priority] || 1)
    })
    .slice(0, 4)
  const filtersActive = !!search.trim() || filterCat !== 'all' || filterStatus !== 'all'
  const clearTaskFilters = () => {
    setSearch('')
    setFilterCat('all')
    setFilterStatus('all')
  }

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

      {/* ══════════════════════════════════════════════════════
           SEÇÃO 1 — CALENDÁRIO GOOGLE (destaque principal)
      ══════════════════════════════════════════════════════ */}
      {highlightedTasks.length > 0 && (
        <section className="mb-6 animate-fade-in-up">
          <div className="rounded-2xl p-4"
            style={{ background: 'linear-gradient(135deg, rgba(248,163,3,0.14), rgba(10,189,120,0.08))', border: '1px solid rgba(248,163,3,0.24)' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-extrabold text-white">Tarefas em destaque</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Sempre visíveis, mesmo quando filtros ou busca escondem a lista.
                </p>
              </div>
              {filtersActive && (
                <button onClick={clearTaskFilters}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#FDC347' }}>
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {highlightedTasks.map(task => {
                const pri = PRI_STYLE[task.priority] || PRI_STYLE.medium
                return (
                  <div key={task.id} className="rounded-2xl p-3"
                    style={{ background: 'rgba(3,7,18,0.38)', border: `1px solid ${pri.color}33` }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-white leading-snug">{task.title}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${pri.color}18`, color: pri.color, border: `1px solid ${pri.color}30` }}>
                        {pri.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
                      <span>{fmtTime(task.duration)}</span>
                      {task.dueDate && <span>Prazo {new Date(task.dueDate + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <section className="mb-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.25)' }}>
              📅
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white leading-none">Calendário Google</h2>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Todos os seus compromissos sincronizados
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <CalendarView tasks={tasks} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
           SEÇÃO 2 — SOFI IA + TAREFAS (lado a lado)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6 animate-fade-in-up">

        {/* ── SOFI IA ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)', boxShadow: '0 0 10px rgba(248,163,3,0.3)' }}>
              🤖
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-none">Sofi — IA Assistente</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                tarefas · agenda · gmail · drive
              </p>
            </div>
          </div>
          <AiAssistantPanel
            tasks={tasks}
            workDay={workDay}
            userName={user?.name?.split(' ')[0] || 'Vinicius'}
            onTaskCreated={loadTasks}
            onEventCreated={() => {}}
            onWorkDayUpdated={w => setWorkDay(w)}
            onWorkspaceRefresh={() => setWsRefreshKey(k => k + 1)}
          />
        </div>

        {/* ── TAREFAS ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'rgba(248,163,3,0.12)', border: '1px solid rgba(248,163,3,0.2)' }}>
                📋
              </div>
              <div>
                <p className="text-sm font-extrabold text-white leading-none">
                  Tarefas
                  {pendingCount > 0 && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold align-middle"
                      style={{ background: '#FF4757', color: 'white' }}>{pendingCount}</span>
                  )}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {tasks.filter(t => t.status === 'done').length} concluídas · {tasks.length} total
                </p>
              </div>
            </div>
            <button onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
              <PlusIcon className="w-3.5 h-3.5" /> Nova
            </button>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[120px]">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input type="text" placeholder="Buscar..." value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
                name="task-search"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="px-2 py-1.5 rounded-xl text-xs text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <option value="all">Todas</option>
              <option value="trabalho">Trabalho</option>
              <option value="campanha">Campanha</option>
              <option value="pessoal">Pessoal</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-1.5 rounded-xl text-xs text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <option value="all">Status</option>
              <option value="pending">Pendentes</option>
              <option value="in-progress">Em andamento</option>
              <option value="done">Concluídas</option>
            </select>
          </div>

          {showForm && (
            <div className="mb-3">
              <TaskForm onAdd={addTask} onClose={() => setShowForm(false)} />
            </div>
          )}

          <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 480px)', minHeight: 200 }}>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="h-16 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <CheckCircleIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{tasks.length > 0 && filtersActive ? 'Tarefas ocultas pelos filtros' : 'Nenhuma tarefa'}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {tasks.length > 0 && filtersActive && (
                    <button onClick={clearTaskFilters}
                      className="text-xs px-4 py-1.5 rounded-xl"
                      style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.2)' }}>
                      Mostrar minhas {tasks.length} tarefas
                    </button>
                  )}
                  <button onClick={() => setShowForm(true)}
                    className="text-xs px-4 py-1.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.09)' }}>
                    Criar tarefa
                  </button>
                </div>
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
           SEÇÃO 3 — JORNADA DE TRABALHO
      ══════════════════════════════════════════════════════ */}
      <div className="mb-6 animate-fade-in-up">
        <WorkDayTimer tasks={tasks} workDay={workDay} onWorkDayUpdated={w => setWorkDay(w)} />
      </div>

      {/* ══════════════════════════════════════════════════════
           SEÇÃO 4 — GOOGLE WORKSPACE (Gmail + Drive)
      ══════════════════════════════════════════════════════ */}
      <section className="mb-6 animate-fade-in-up">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{ background: 'rgba(10,189,120,0.12)', border: '1px solid rgba(10,189,120,0.2)' }}>
            🔗
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white leading-none">Google Workspace</h2>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Gmail · Drive integrados</p>
          </div>
        </div>
        <GoogleWorkspacePanel refreshKey={wsRefreshKey} />
      </section>

      {/* ══════════════════════════════════════════════════════
           SEÇÃO 5 — CONQUISTAS + CREDENCIAIS (lado a lado)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-fade-in-up">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
              🏆
            </div>
            <h2 className="text-sm font-extrabold text-white">Conquistas & XP</h2>
          </div>
          <GamificationPanel tasks={tasks} />
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.18)' }}>
              🔑
            </div>
            <h2 className="text-sm font-extrabold text-white">Cofre de Senhas</h2>
          </div>
          <CredentialsVault />
        </section>
      </div>

    </AdminLayout>
  )
}
