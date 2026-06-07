import Cookies from 'js-cookie'
import type { Message, MassRecipient, ContactLabel, Stage, Contact } from './types'
import { LABELS, STAGES } from './types'

// ── Auth & API Helpers
export const getToken = () => Cookies.get('accessToken')

const heads = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
})

export async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`/api/v1/${path}`, {
    ...opts,
    headers: { ...heads(), ...(opts?.headers || {}) },
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

// ── LocalStorage Helpers
export function loadQuickReplies() {
  try {
    return JSON.parse(localStorage.getItem('sofi_quick_replies') || '[]')
  } catch {
    return []
  }
}

export function saveQuickReplies(list: any[]) {
  try {
    localStorage.setItem('sofi_quick_replies', JSON.stringify(list))
  } catch {}
}

export function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem('sofi_internal_notes') || '[]')
  } catch {
    return []
  }
}

export function saveNotes(list: any[]) {
  try {
    localStorage.setItem('sofi_internal_notes', JSON.stringify(list))
  } catch {}
}

export function loadStages(): Record<string, Stage> {
  try {
    return JSON.parse(localStorage.getItem('sofi_crm_stages') || '{}')
  } catch {
    return {}
  }
}

export function saveStages(m: Record<string, Stage>) {
  try {
    localStorage.setItem('sofi_crm_stages', JSON.stringify(m))
  } catch {}
}

export function loadArchived(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('sofi_crm_archived') || '[]'))
  } catch {
    return new Set()
  }
}

export function saveArchived(s: Set<string>) {
  try {
    localStorage.setItem('sofi_crm_archived', JSON.stringify([...s]))
  } catch {}
}

export function loadLabels(): Record<string, ContactLabel[]> {
  try {
    return JSON.parse(localStorage.getItem('sofi_crm_labels') || '{}')
  } catch {
    return {}
  }
}

export function saveLabels(m: Record<string, ContactLabel[]>) {
  try {
    localStorage.setItem('sofi_crm_labels', JSON.stringify(m))
  } catch {}
}

// ── Text & Formatting Helpers
export function normPhone(raw: string) {
  return (raw || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
}

export function fmtTs(ts: any) {
  const n = Number(ts)
  if (!n || n <= 0) return ''
  const ms = n < 1e10 ? n * 1000 : n
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yday = new Date(today)
  yday.setDate(today.getDate() - 1)
  if (d.toDateString() === yday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export const now2 = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function msgTimestamp(msg: Partial<Message> & { ts?: number }) {
  if (typeof msg.ts === 'number' && Number.isFinite(msg.ts)) return msg.ts
  const fromAt = msg.at ? new Date(msg.at).getTime() : 0
  return Number.isFinite(fromAt) ? fromAt : 0
}

export function sortMessagesChronologically(list: Message[]) {
  return [...list].sort((a, b) => msgTimestamp(a) - msgTimestamp(b))
}

export function mapMessageItem(m: any): Message {
  const ts = m?.ts ? Number(m.ts) : m?.at ? new Date(m.at).getTime() : 0
  return {
    id: m.id || crypto.randomUUID(),
    from: m.from === 'agent' || m.from === 'sofi' ? m.from : 'lead',
    text: m.text || '',
    name: m.name || '',
    at:
      m.at && typeof m.at === 'string' && /^\d{2}:\d{2}$/.test(m.at)
        ? m.at
        : new Date(m.at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ts: Number.isFinite(ts) ? ts : Date.now(),
  }
}

export function extractMsgText(message: any): string {
  if (!message) return ''
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.title ||
    message.documentWithCaptionMessage?.message?.documentMessage?.title ||
    (message.audioMessage ? '🎤 Áudio' : '') ||
    (message.imageMessage ? '📷 Foto' : '') ||
    (message.videoMessage ? '🎥 Vídeo' : '') ||
    (message.documentMessage ? '📄 Arquivo' : '') ||
    (message.stickerMessage ? '🎴 Sticker' : '') ||
    (message.contactMessage ? '👤 Contato' : '') ||
    (message.locationMessage ? '📍 Localização' : '') ||
    (message.reactionMessage ? `${message.reactionMessage.text} (reação)` : '') ||
    (message.pollCreationMessage ? `📊 ${message.pollCreationMessage.name}` : '') ||
    ''
  )
}

export function parseCSV(text: string): MassRecipient[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0]
    .split(/[,;|\t]/)
    .map(h => h.trim().toLowerCase().replace(/["']/g, ''))
  return lines
    .slice(1)
    .map(line => {
      const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
      const obj: MassRecipient = { phone: '' }
      headers.forEach((h, i) => {
        if (['telefone', 'phone', 'numero', 'cel', 'celular', 'whatsapp'].includes(h))
          obj.phone = normPhone(cols[i] || '')
        else obj[h] = cols[i] || ''
      })
      if (!obj.phone) {
        for (let i = 0; i < cols.length; i++) {
          const p = normPhone(cols[i] || '')
          if (p.length >= 8) {
            obj.phone = p
            break
          }
        }
      }
      return obj
    })
    .filter(r => r.phone && r.phone.length >= 8)
}

export function applyTemplate(template: string, recipient: MassRecipient): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const k = key.toLowerCase()
    if (k === 'nome') return recipient.nome || recipient.name || 'amigo(a)'
    if (k === 'telefone') return recipient.phone || ''
    if (k === 'empresa') return recipient.empresa || recipient.company || ''
    return recipient[k] || recipient[key] || `{${key}}`
  })
}

export function extractProxyMessage(payload: any, fallback: string): string {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (payload?.message) return String(payload.message)
  if (payload?.error) return String(payload.error)
  return fallback
}

export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function hasRealName(c: Contact): boolean {
  return c.name && c.name !== c.phone && !/^\d+$/.test(c.name)
}

export function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.3)
  } catch {}
}

export function showBrowserNotif(name: string, text: string, chatId: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  const n = new Notification(`💬 ${name}`, {
    body: text,
    icon: '/favicon.ico',
    tag: chatId,
  })
  n.onclick = () => {
    window.focus()
    n.close()
  }
}
