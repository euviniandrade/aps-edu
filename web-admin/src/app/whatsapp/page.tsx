'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Pusher from 'pusher-js'
import AdminLayout from '@/components/layout/AdminLayout'
import Cookies from 'js-cookie'
import {
  ArrowPathIcon, CheckCircleIcon, MagnifyingGlassIcon,
  PaperAirplaneIcon, QrCodeIcon, TrashIcon, XCircleIcon,
  UserGroupIcon, ChatBubbleLeftRightIcon, FunnelIcon,
  ArrowUpTrayIcon, PlayIcon, StopIcon, ClipboardDocumentIcon,
  ArrowDownTrayIcon, ArchiveBoxIcon, ArchiveBoxArrowDownIcon,
  SparklesIcon, CommandLineIcon,
} from '@heroicons/react/24/outline'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Tab = 'chats' | 'kanban' | 'mass' | 'groups' | 'ai'

const STAGES = ['Inbox', 'Hoje', 'Acompanhar', 'Pessoal', 'Concluido', 'Pausado'] as const
type Stage = typeof STAGES[number]

const STAGE_COLORS: Record<Stage, string> = {
  Inbox:      '#6366F1',
  Hoje:       '#F8A303',
  Acompanhar: '#0EA5E9',
  Pessoal:    '#EC4899',
  Concluido:  '#22C55E',
  Pausado:    '#6B7280',
}

const LABELS = ['VIP', 'Familia', 'Trabalho', 'Igreja', 'Follow-up', 'Urgente'] as const
type ContactLabel = typeof LABELS[number]

interface Contact {
  chatId: string; phone: string; name: string
  lastMessage: string; lastAt: string; unread: number; timestamp: number
  avatarUrl?: string
  isGroup?: boolean
  stage?: Stage
}
interface Message {
  id: string; from: 'lead' | 'agent' | 'sofi'; text: string; at: string; name?: string; ts?: number
}
interface WaState { connected: boolean; ready: boolean; qrDataUrl?: string | null; error?: string | null }
interface Group   { id: string; name: string; description: string; participants: number; members: { id: string; phone: string; admin: boolean }[] }
interface MassRecipient { phone: string; nome?: string; empresa?: string; avatarUrl?: string; [key: string]: string | undefined }
interface AiState {
  mode: 'paused' | 'assist' | 'auto'
  tone: string
  maxChars: number
  allowGroups: boolean
  activePlaybook?: string
  playbooks?: Record<'vendas' | 'suporte' | 'pessoal', string>
  training: string[]
  hasGeminiKey?: boolean
}

interface InstagramRule {
  id: string
  keyword: string
  action: string
  enabled: boolean
  targetStage: string
}

interface InstagramState {
  connected: boolean
  pageId?: string
  businessId: string
  hasPageToken: boolean
  hasVerifyToken: boolean
  automationEnabled: boolean
  requireFollowGate: boolean
  rules: InstagramRule[]
}

interface InstagramEvent {
  id?: string
  at?: string
  type: string
  fromId?: string
  fromName?: string
  text?: string
  ruleId?: string | null
  userId?: string
  error?: string
}

function extractProxyMessage(payload: any, fallback: string): string {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (payload?.message) return String(payload.message)
  if (payload?.error) return String(payload.error)
  return fallback
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getToken = () => Cookies.get('accessToken')
const heads = () => ({ 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) })

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`/api/whatsapp-live/${path}`, { ...opts, headers: { ...heads(), ...(opts?.headers || {}) }, cache: 'no-store' })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

function normPhone(raw: string) {
  return (raw || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
}
function fmtTs(ts: any) {
  const n = Number(ts); if (!n || n <= 0) return ''
  const ms = n < 1e10 ? n * 1000 : n; const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yday = new Date(today); yday.setDate(today.getDate() - 1)
  if (d.toDateString() === yday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
const now2 = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function msgTimestamp(msg: Partial<Message> & { ts?: number }) {
  if (typeof msg.ts === 'number' && Number.isFinite(msg.ts)) return msg.ts
  const fromAt = msg.at ? new Date(msg.at).getTime() : 0
  return Number.isFinite(fromAt) ? fromAt : 0
}

function sortMessagesChronologically(list: Message[]) {
  return [...list].sort((a, b) => msgTimestamp(a) - msgTimestamp(b))
}

function mapMessageItem(m: any): Message {
  const ts = m?.ts
    ? Number(m.ts)
    : m?.at
      ? new Date(m.at).getTime()
      : 0
  return {
    id:   m.id || crypto.randomUUID(),
    from: (m.from === 'agent' || m.from === 'sofi') ? m.from : 'lead',
    text: m.text || '',
    name: m.name || '',
    at:   m.at
      ? (typeof m.at === 'string' && /^\d{2}:\d{2}$/.test(m.at) ? m.at : new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      : now2(),
    ts:   Number.isFinite(ts) ? ts : Date.now(),
  }
}

// ── localStorage CRM ──────────────────────────────────────────────────────────
const CRM_KEY      = 'sofi_crm_stages'
const ARCHIVE_KEY  = 'sofi_crm_archived'
const LABELS_KEY   = 'sofi_crm_labels'

function loadStages(): Record<string, Stage> {
  try { return JSON.parse(localStorage.getItem(CRM_KEY) || '{}') } catch { return {} }
}
function saveStages(m: Record<string, Stage>) {
  try { localStorage.setItem(CRM_KEY, JSON.stringify(m)) } catch {}
}
function loadArchived(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')) } catch { return new Set() }
}
function saveArchived(s: Set<string>) {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...s])) } catch {}
}
function loadLabels(): Record<string, ContactLabel[]> {
  try { return JSON.parse(localStorage.getItem(LABELS_KEY) || '{}') } catch { return {} }
}
function saveLabels(m: Record<string, ContactLabel[]>) {
  try { localStorage.setItem(LABELS_KEY, JSON.stringify(m)) } catch {}
}

// ── Extrai texto de mensagem do Evolution API (webhook format) ────────────────
function extractMsgText(message: any): string {
  if (!message) return ''
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.title ||
    message.documentWithCaptionMessage?.message?.documentMessage?.title ||
    (message.audioMessage        ? '🎤 Áudio'      : '') ||
    (message.imageMessage        ? '📷 Foto'       : '') ||
    (message.videoMessage        ? '🎥 Vídeo'      : '') ||
    (message.documentMessage     ? '📄 Arquivo'    : '') ||
    (message.stickerMessage      ? '🎴 Sticker'    : '') ||
    (message.contactMessage      ? '👤 Contato'    : '') ||
    (message.locationMessage     ? '📍 Localização': '') ||
    (message.reactionMessage     ? `${message.reactionMessage.text} (reação)` : '') ||
    (message.pollCreationMessage ? `📊 ${message.pollCreationMessage.name}` : '') ||
    ''
  )
}

// ── CSV Parser simples ────────────────────────────────────────────────────────
function parseCSV(text: string): MassRecipient[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(/[,;|\t]/).map(h => h.trim().toLowerCase().replace(/["']/g, ''))
  return lines.slice(1).map(line => {
    const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const obj: MassRecipient = { phone: '' }
    headers.forEach((h, i) => {
      if (h === 'telefone' || h === 'phone' || h === 'numero' || h === 'cel' || h === 'celular' || h === 'whatsapp')
        obj.phone = normPhone(cols[i] || '')
      else obj[h] = cols[i] || ''
    })
    // Heurística: se nenhuma col for phone, tenta primeira coluna numérica
    if (!obj.phone) {
      for (let i = 0; i < cols.length; i++) {
        const p = normPhone(cols[i] || '')
        if (p.length >= 8) { obj.phone = p; break }
      }
    }
    return obj
  }).filter(r => r.phone && r.phone.length >= 8)
}

function applyTemplate(template: string, recipient: MassRecipient): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const k = key.toLowerCase()
    if (k === 'nome')     return recipient.nome || recipient.name || 'amigo(a)'
    if (k === 'telefone') return recipient.phone || ''
    if (k === 'empresa')  return recipient.empresa || recipient.company || ''
    return recipient[k] || recipient[key] || `{${key}}`
  })
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function WhatsAppPage() {
  const [platform, setPlatform] = useState<'whatsapp' | 'instagram'>('whatsapp')
  const [tab, setTab]               = useState<Tab>('chats')
  const [waState, setWaState]       = useState<WaState | null>(null)
  const [contacts, setContacts]     = useState<Contact[]>([])
  const [messages, setMessages]     = useState<Message[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch]         = useState('')
  const [composer, setComposer]     = useState('')
  const [sending, setSending]       = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sseStatus, setSseStatus]   = useState<'offline' | 'connecting' | 'live'>('offline')
  const [initBusy, setInitBusy]     = useState(false)
  const [qrDataUrl, setQrDataUrl]   = useState<string | null>(null) // separado do waState — persiste até scan
  const [waConnectNote, setWaConnectNote] = useState('')
  const [waConnectError, setWaConnectError] = useState('')
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kanban
  const [stages, setStages]         = useState<Record<string, Stage>>({})
  const [dragPhone, setDragPhone]   = useState<string | null>(null)

  // Envio em massa
  const [massRecipients, setMassRecipients] = useState<MassRecipient[]>([])
  const [massTemplate, setMassTemplate]     = useState('Olá {nome}! 👋\n\nTudo bem? Entrando em contato da Associação Paulista Sul.')
  const [massDelay, setMassDelay]           = useState(3)
  const [massRunning, setMassRunning]       = useState(false)
  const [massSent, setMassSent]             = useState(0)
  const [massErrors, setMassErrors]         = useState(0)
  const [massLog, setMassLog]               = useState<string[]>([])
  const [massPasteText, setMassPasteText]   = useState('')
  const massStopRef = useRef(false)

  // Arquivados
  const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived]   = useState(false)
  const [hideUnnamed, setHideUnnamed]     = useState(true)
  const [labelsByPhone, setLabelsByPhone] = useState<Record<string, ContactLabel[]>>({})
  const [labelFilter, setLabelFilter] = useState<ContactLabel | 'all'>('all')

  // Grupos
  const [groups, setGroups]         = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [syncingContacts, setSyncingContacts] = useState(false)

  // Sofi IA no WhatsApp
  const [aiState, setAiState] = useState<AiState | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiTrainingText, setAiTrainingText] = useState('')
  const [playbookKey, setPlaybookKey] = useState<'vendas' | 'suporte' | 'pessoal'>('suporte')
  const [instagramState, setInstagramState] = useState<InstagramState | null>(null)
  const [instagramEvents, setInstagramEvents] = useState<InstagramEvent[]>([])
  const [instagramRules, setInstagramRules] = useState<InstagramRule[]>([])
  const [instagramBusy, setInstagramBusy] = useState(false)
  const [instagramError, setInstagramError] = useState('')
  const [igDmUserId, setIgDmUserId] = useState('')
  const [igDmText, setIgDmText] = useState('Olá! Obrigado pelo comentário. Vou te enviar o material por aqui.')

  const messagesScrollRef   = useRef<HTMLDivElement>(null)
  const messagesEndRef      = useRef<HTMLDivElement>(null)
  const sseAbort            = useRef<AbortController | null>(null)
  const prevWaReady         = useRef<boolean>(false)
  const contactsLoaded      = useRef<boolean>(false)
  const disconnectTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = contacts.find(c => c.chatId === selectedId) ?? null
  const filteredInstagramEvents = instagramEvents.filter(ev => {
    if (ev.type !== 'automation_error' || !ev.error) return true
    return !/session has expired|error validating access token/i.test(ev.error)
  })

  // ── Carrega stages e arquivados do localStorage ────────────────────────────
  useEffect(() => {
    setStages(loadStages())
    setArchivedChats(loadArchived())
    setLabelsByPhone(loadLabels())
  }, [])

  const persistStage = (phone: string, stage: Stage) => {
    setStages(prev => { const n = { ...prev, [phone]: stage }; saveStages(n); return n })
    setContacts(prev => prev.map(c => c.phone === phone ? { ...c, stage } : c))
    const contact = contacts.find(c => c.phone === phone || c.chatId === phone)
    apiFetch('stage', {
      method: 'POST',
      body: JSON.stringify({ phone, chatId: contact?.chatId || '', stage }),
    }).catch(() => {})
  }

  // ── Contacts & Messages ─────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const data: any[] = await apiFetch('contacts')
      if (!Array.isArray(data)) return
      const mapped = data
        .filter(c => {
          const id = c.id || c.chatId || ''
          return id && id !== 'status@broadcast'
        })
        .map(c => {
          const id      = c.id || c.chatId || ''
          const isGroup = c.isGroup || id.endsWith('@g.us')
          const phone   = isGroup ? id : (c.phone || normPhone(id))
          return {
            chatId:      id,
            phone,
            name:        c.name || phone,
            avatarUrl:   c.avatarUrl || '',
            lastMessage: c.lastMessage || '',
            lastAt:      fmtTs(c.timestamp),
            unread:      c.unreadCount ?? 0,
            timestamp:   c.timestamp ?? 0,
            isGroup,
            stage:       (STAGES.includes(c.stage) ? c.stage : 'Inbox') as Stage,
          }
        })
        .sort((a, b) => b.timestamp - a.timestamp)
      setContacts(mapped)
      setStages(prev => {
        const next = { ...prev }
        mapped.forEach(c => { next[c.phone] = c.stage || next[c.phone] || 'Inbox' })
        saveStages(next)
        return next
      })
    } catch {}
  }, [])

  const loadMessages = useCallback(async (chatId: string) => {
    if (!chatId) return
    setLoadingMsgs(true); setMessages([])
    try {
      const data: any[] = await apiFetch(`messages?chatId=${encodeURIComponent(chatId)}`)
      if (Array.isArray(data)) {
        setMessages(sortMessagesChronologically(data.map(mapMessageItem)))
      }
    } catch {} finally {
      setLoadingMsgs(false)
      requestAnimationFrame(() => {
        const el = messagesScrollRef.current
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
      })
    }
  }, [])

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = messagesScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior })
      })
    })
  }, [])

  // ── Pusher — WebSocket real-time ──────────────────────────────────────────────
  useEffect(() => {
    const pusher = new Pusher('e86cbcb6b0359bab789f', { cluster: 'sa1' })
    const channel = pusher.subscribe('whatsapp-sofi')

    // Helper: atualiza estado de conexão SEM tocar no QR Code
    // QR Code tem estado independente — persiste até o scan bem-sucedido
    const applyState = (ready: boolean) => {
      if (ready) {
        // Conectado: cancela timer, atualiza estado, limpa QR (scan feito!)
        if (disconnectTimer.current) { clearTimeout(disconnectTimer.current); disconnectTimer.current = null }
        setWaState({ connected: true, ready: true, qrDataUrl: null, error: null })
        setQrDataUrl(null) // QR não é mais necessário
        if (!prevWaReady.current) loadContacts()
        prevWaReady.current = true
      } else {
        // Desconectado: só atualiza UI após 6s contínuos de "não conectado"
        // Evita pisca-pisca quando Evolution API manda vários estados rápidos
        if (disconnectTimer.current) clearTimeout(disconnectTimer.current)
        disconnectTimer.current = setTimeout(() => {
          setWaState(prev => prev?.ready ? prev : { connected: false, ready: false, qrDataUrl: null, error: null })
          prevWaReady.current = false
          disconnectTimer.current = null
        }, 6000)
      }
    }

    // Estado de conexão via polling do relay (a cada 10s)
    channel.bind('state', (payload: any) => { applyState(!!payload?.ready) })

    // Evento de conexão em tempo real do Evolution API
    channel.bind('connection_update', (payload: any) => {
      const state: string = payload?.data?.state || payload?.state || 'close'
      applyState(state === 'open')
    })

    // QR Code disponível — busca via API e exibe até o usuário escanear
    // NÃO some até a conexão ser confirmada como "open"
    channel.bind('qrcode_updated', async () => {
      try {
        const st = await apiFetch('start', { method: 'POST', body: '{}' })
        if (st?.qrDataUrl) {
          setQrDataUrl(st.qrDataUrl)   // QR independente — não some com state changes
          setWaState({ connected: false, ready: false, qrDataUrl: null, error: null })
          prevWaReady.current = false
          if (disconnectTimer.current) { clearTimeout(disconnectTimer.current); disconnectTimer.current = null }
        }
      } catch {}
    })

    // Nova mensagem recebida ou enviada
    channel.bind('messages_upsert', (payload: any) => {
      const raw   = payload?.data || payload
      const items: any[] = Array.isArray(raw) ? raw : [raw]
      for (const item of items) {
        const key    = item?.key || {}
        const chatId = key.remoteJid || item?.remoteJid || ''
        if (!chatId || chatId === 'status@broadcast') continue
        const phone  = normPhone(chatId)
        const fromMe = !!key.fromMe
        const msgId  = key.id || crypto.randomUUID()
        const text   = extractMsgText(item?.message)
        if (!text) continue
        const pushName = item?.pushName || ''
        const ts = item?.messageTimestamp
        const at = ts
          ? new Date(Number(ts) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : now2()
        const tsMs = ts ? Number(ts) * 1000 : Date.now()
        const msg: Message = { id: msgId, from: fromMe ? 'agent' : 'lead', text, name: pushName, at, ts: tsMs }
        setSelectedId(prev => {
          if (prev === chatId || normPhone(prev) === phone)
            setMessages(m => sortMessagesChronologically(m.some(x => x.id === msgId) ? m : [...m, msg]))
          return prev
        })
        setContacts(prev => {
          const idx = prev.findIndex(c => c.chatId === chatId || c.phone === phone)
          const nowTs = Date.now() / 1000
          if (idx >= 0) {
            const u = [...prev]
            u[idx] = { ...u[idx], lastMessage: text, lastAt: at, timestamp: Number(ts) || nowTs, unread: fromMe ? 0 : u[idx].unread + 1 }
            return u.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          }
          return [{ chatId, phone, name: pushName || phone, lastMessage: text, lastAt: at, unread: fromMe ? 0 : 1, timestamp: Number(ts) || nowTs }, ...prev]
        })
      }
    })

    channel.bind('crm_stage_updated', (payload: any) => {
      const stage = payload?.stage as Stage
      if (!STAGES.includes(stage)) return
      const chatId = payload?.chatId || ''
      const phone = payload?.phone || normPhone(chatId)
      setStages(prev => {
        const next = { ...prev, [phone]: stage }
        saveStages(next)
        return next
      })
      setContacts(prev => prev.map(c => (c.chatId === chatId || c.phone === phone) ? { ...c, stage } : c))
    })

    pusher.connection.bind('connected',    () => setSseStatus('live'))
    pusher.connection.bind('disconnected', () => setSseStatus('offline'))
    pusher.connection.bind('connecting',   () => setSseStatus('connecting'))

    return () => {
      if (disconnectTimer.current) clearTimeout(disconnectTimer.current)
      channel.unbind_all()
      pusher.unsubscribe('whatsapp-sofi')
      pusher.disconnect()
    }
  }, [loadContacts]) // eslint-disable-line

  // SSE removido — Pusher substitui completamente

  // ── Polling de mensagens (a cada 3s quando chat aberto) ──────────────────────
  // Detecta novas mensagens comparando IDs com o que já está na tela
  const selectedIdRef = useRef('')
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    let running = true

    const poll = async () => {
      if (!running || !selectedIdRef.current) return
      try {
        const data: any[] = await apiFetch(`messages?chatId=${encodeURIComponent(selectedIdRef.current)}`)
        if (!Array.isArray(data) || !running) return
        const fetched = data
          .map(mapMessageItem)
          .filter(m => m.text && m.id)
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const added = fetched.filter(m => !existingIds.has(m.id))
          if (added.length === 0) return prev
          return sortMessagesChronologically([...prev, ...added])
        })
        scrollMessagesToBottom('auto')
      } catch {}
    }

    // Aguarda 3s antes de iniciar o polling (deixa o load inicial terminar)
    const first = setTimeout(() => {
      poll()
      const iv = setInterval(poll, 3000)
      if (!running) clearInterval(iv)
      // Salva o interval para limpar
      ;(poll as any).__iv = iv
    }, 3000)

    return () => {
      running = false
      clearTimeout(first)
      if ((poll as any).__iv) clearInterval((poll as any).__iv)
    }
  }, [selectedId])

  // ── Polling de contatos (a cada 5s) — atualiza previews e badges ────────────
  useEffect(() => {
    if (!waState?.ready) return
    const iv = setInterval(loadContacts, 5000)
    return () => clearInterval(iv)
  }, [waState?.ready, loadContacts])

  // ── Estado inicial ao montar a página ────────────────────────────────────────
  useEffect(() => {
    apiFetch('status').then(st => {
      if (!st) return
      setWaState(st)
      if (st.state === 'qr' && !st.qrDataUrl) {
        apiFetch('start', { method: 'POST', body: '{}' }).then(next => {
          if (next?.qrDataUrl) setQrDataUrl(next.qrDataUrl)
        }).catch(() => {})
      }
      if (st.ready) { prevWaReady.current = true; loadContacts() }
    }).catch(() => {})
  }, [loadContacts])

  useEffect(() => {
    if (!selectedId || !waState?.ready) return
    loadMessages(selectedId)
    // Auto mark-read: sincroniza com o celular silenciosamente
    const contact = contacts.find(c => c.chatId === selectedId)
    if (contact && contact.unread > 0) {
      // Marcar todas mensagens não lidas como lidas (usamos IDs das mensagens após carregar)
      setTimeout(async () => {
        try {
          const msgs: any[] = await apiFetch(`messages?chatId=${encodeURIComponent(selectedId)}`)
          const unread = (Array.isArray(msgs) ? msgs : [])
            .filter((m: any) => m.from !== 'agent' && m.from !== 'sofi')
            .map((m: any) => ({ id: m.id, fromMe: false }))
          if (unread.length > 0)
            await apiFetch('mark-read', { method: 'POST', body: JSON.stringify({ chatId: selectedId, messages: unread }) })
        } catch {}
      }, 800)
    }
  }, [selectedId, scrollMessagesToBottom]) // eslint-disable-line

  useLayoutEffect(() => {
    if (!selectedId) return
    scrollMessagesToBottom('auto')
  }, [messages, selectedId, scrollMessagesToBottom])

  // ── Ações Chat ──────────────────────────────────────────────────────────────
  const connectWA = async () => {
    setInitBusy(true)
    setWaConnectError('')
    setWaConnectNote('Gerando novo QR Code...')
    setQrDataUrl(null)
    try {
      for (let attempt = 1; attempt <= 4; attempt++) {
        setWaConnectNote(`Gerando novo QR Code... tentativa ${attempt}/4`)
        const st = await apiFetch('start', { method: 'POST', body: '{}' })
        if (st?.connected || st?.ready) {
          setQrDataUrl(null)
          setWaState(st)
          setWaConnectNote('WhatsApp conectado.')
          return
        }
        if (st?.qrDataUrl) {
          // QR Code em estado independente — não vai sumir com eventos de conexão
          setQrDataUrl(st.qrDataUrl)
          setWaState({ connected: false, ready: false, qrDataUrl: null, error: null })
          setWaConnectNote('QR Code gerado. Abra o WhatsApp no celular e escaneie.')
          return
        }
        await sleep(1200 + attempt * 400)
      }

      const status = await apiFetch('status').catch(() => null)
      if (status?.connected || status?.ready) {
        setQrDataUrl(null)
        setWaState(status)
        setWaConnectNote('WhatsApp conectado.')
        return
      }
      setWaConnectError('Nao consegui gerar um QR novo agora. O backend/tunel parece indisponivel ou nao respondeu a tempo.')
      setWaConnectNote('Backend/tunel offline: o QR nao consegue nascer do lado do front.')
    } catch {} finally { setInitBusy(false) }
  }

  const sendMessage = async () => {
    const text = composer.trim()
    if (!text || !selected || !waState?.ready) return
    setSending(true)
    const msgId = crypto.randomUUID()
    const msg: Message = { id: msgId, from: 'agent', text, at: now2(), ts: Date.now() }
    setMessages(prev => sortMessagesChronologically([...prev, msg]))
    scrollMessagesToBottom('auto')
    setComposer('')
    try {
      await apiFetch('send', { method: 'POST', body: JSON.stringify({ chatId: selected.chatId, phone: selected.phone, text }) })
    } catch {
      // Marca a mensagem como falhou
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: `❌ ${m.text}` } : m))
    } finally { setSending(false) }
  }

  // ── Arquivar / Desarquivar ──────────────────────────────────────────────────
  const archiveCurrentChat = async (chatId: string, archive: boolean) => {
    // Atualiza UI imediatamente
    setArchivedChats(prev => {
      const next = new Set(prev)
      archive ? next.add(chatId) : next.delete(chatId)
      saveArchived(next)
      return next
    })
    if (!archive) return // Ao desarquivar, só remove do estado local
    setSelectedId('')
    // Sincroniza com o celular em background
    try { await apiFetch('archive', { method: 'POST', body: JSON.stringify({ chatId, archive }) }) } catch {}
  }

  // ── Deletar mensagem ────────────────────────────────────────────────────────
  const deleteMsg = async (msgId: string, fromMe: boolean) => {
    if (!selected) return
    setMessages(prev => prev.filter(m => m.id !== msgId))
    try { await apiFetch('delete-message', { method: 'POST', body: JSON.stringify({ chatId: selected.chatId, msgId, fromMe }) }) } catch {}
  }

  // ── Grupos ──────────────────────────────────────────────────────────────────
  const loadGroups = async () => {
    setLoadingGroups(true)
    try { const d = await apiFetch('groups'); setGroups(Array.isArray(d) ? d : []) }
    catch {} finally { setLoadingGroups(false) }
  }

  const exportGroupCSV = (g: Group) => {
    const csv = 'telefone,nome\n' + g.members.map(m => `${m.phone},`).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `${g.name.replace(/\W+/g, '_')}.csv`
    a.click()
  }

  const sendGroupToMass = (g: Group) => {
    setMassRecipients(g.members.map(m => ({ phone: m.phone, nome: '' })))
    setTab('mass')
  }

  const toggleLabel = (phone: string, label: ContactLabel) => {
    setLabelsByPhone(prev => {
      const current = new Set(prev[phone] || [])
      if (current.has(label)) current.delete(label)
      else current.add(label)
      const next = { ...prev, [phone]: [...current] as ContactLabel[] }
      saveLabels(next)
      return next
    })
  }

  const addAllContactsWithNames = async () => {
    setSyncingContacts(true)
    try {
      await apiFetch('contacts-sync', { method: 'POST', body: '{}' })
      await loadContacts()
      const data: any[] = await apiFetch('contacts-all')
      if (Array.isArray(data)) {
        setMassRecipients(data
          .filter(c => c.phone && !String(c.phone).includes('@g.us'))
          .map(c => ({ phone: c.phone, nome: c.name || '', avatarUrl: c.avatarUrl || '' })))
      }
    } finally { setSyncingContacts(false) }
  }

  const loadAiState = async () => {
    try {
      const data = await apiFetch('ai-state')
      const activePlaybook = (['vendas','suporte','pessoal'].includes(data.activePlaybook) ? data.activePlaybook : 'suporte') as 'vendas' | 'suporte' | 'pessoal'
      setAiState({
        mode: data.mode || 'assist',
        tone: data.tone || 'humana, educada e objetiva',
        maxChars: data.maxChars || 700,
        allowGroups: !!data.allowGroups,
        activePlaybook,
        playbooks: {
          vendas: data.playbooks?.vendas || '',
          suporte: data.playbooks?.suporte || '',
          pessoal: data.playbooks?.pessoal || '',
        },
        training: Array.isArray(data.training) ? data.training : [],
        hasGeminiKey: !!data.hasGeminiKey,
      })
      setPlaybookKey(activePlaybook)
    } catch {}
  }

  const updateAiMode = async (mode: AiState['mode']) => {
    setAiBusy(true)
    try {
      const data = await apiFetch('ai-control', {
        method: 'POST',
        body: JSON.stringify({ ...(aiState || {}), mode }),
      })
      setAiState(prev => ({ ...(prev || data), ...data, mode }))
    } finally { setAiBusy(false) }
  }

  const updateAiSettings = async () => {
    if (!aiState) return
    setAiBusy(true)
    try {
      const data = await apiFetch('ai-control', { method: 'POST', body: JSON.stringify(aiState) })
      setAiState(prev => ({ ...(prev || aiState), ...data }))
    } finally { setAiBusy(false) }
  }

  const addAiTraining = async () => {
    const text = aiTrainingText.trim()
    if (!text) return
    setAiBusy(true)
    try {
      const data = await apiFetch('ai-training', { method: 'POST', body: JSON.stringify({ text }) })
      setAiState(prev => prev ? { ...prev, training: data.training || prev.training } : prev)
      setAiTrainingText('')
    } finally { setAiBusy(false) }
  }

  const setChatHandoff = async (paused: boolean) => {
    if (!selected) return
    await apiFetch('ai-handoff', { method: 'POST', body: JSON.stringify({ chatId: selected.chatId, paused }) }).catch(() => {})
  }

  const suggestAiReply = async (baseText?: string) => {
    if (!selected || aiSuggesting) return
    setAiSuggesting(true)
    try {
      const text = baseText || [...messages].reverse().find(m => m.from === 'lead')?.text || selected.lastMessage || ''
      const data = await apiFetch('ai-suggest', { method: 'POST', body: JSON.stringify({ chatId: selected.chatId, text }) })
      if (data?.reply) setComposer(data.reply)
    } finally { setAiSuggesting(false) }
  }

  useEffect(() => { loadAiState() }, [])

  const loadInstagram = async () => {
    setInstagramError('')
    try {
      const [stateData, rulesData, eventsData] = await Promise.all([
        apiFetch('instagram-state'),
        apiFetch('instagram-rules'),
        apiFetch('instagram-events'),
      ])
      if (stateData?.ok === false) {
        setInstagramError(extractProxyMessage(stateData, 'Falha ao carregar integração do Instagram'))
        return
      }
      setInstagramState({
        connected: !!stateData.connected,
        pageId: stateData.pageId || '',
        businessId: stateData.businessId || '',
        hasPageToken: !!stateData.hasPageToken,
        hasVerifyToken: !!stateData.hasVerifyToken,
        automationEnabled: !!stateData.automationEnabled,
        requireFollowGate: !!stateData.requireFollowGate,
        rules: Array.isArray(stateData.rules) ? stateData.rules : [],
      })
      if (rulesData?.ok === false) {
        setInstagramError(extractProxyMessage(rulesData, 'Falha ao carregar regras do Instagram'))
      } else {
        setInstagramRules(Array.isArray(rulesData.rules) ? rulesData.rules : [])
      }
      if (eventsData?.ok === false) {
        setInstagramError(extractProxyMessage(eventsData, 'Falha ao carregar eventos do Instagram'))
      } else {
        setInstagramEvents(Array.isArray(eventsData.events) ? eventsData.events : [])
      }
    } catch (err: any) {
      setInstagramError(err?.message || 'Falha ao carregar integração do Instagram')
    }
  }

  const saveInstagramRules = async () => {
    setInstagramBusy(true)
    try {
      const data = await apiFetch('instagram-rules', { method: 'POST', body: JSON.stringify({ rules: instagramRules }) })
      if (data?.ok === false) throw new Error(extractProxyMessage(data, 'Falha ao salvar regras do Instagram'))
      setInstagramRules(Array.isArray(data.rules) ? data.rules : instagramRules)
      setInstagramError('')
    } catch (err: any) {
      setInstagramError(err?.message || 'Falha ao salvar regras do Instagram')
    } finally { setInstagramBusy(false) }
  }

  const updateInstagramControl = async (next: Partial<InstagramState>) => {
    if (!instagramState) return
    const merged = { ...instagramState, ...next }
    setInstagramState(merged)
    setInstagramBusy(true)
    try {
      const data = await apiFetch('instagram-control', {
        method: 'POST',
        body: JSON.stringify({
          pageId: merged.pageId || undefined,
          businessId: merged.businessId || undefined,
          automationEnabled: merged.automationEnabled,
          requireFollowGate: merged.requireFollowGate,
        }),
      })
      if (data?.ok === false) throw new Error(extractProxyMessage(data, 'Falha ao atualizar controle do Instagram'))
      setInstagramError('')
    } catch (err: any) {
      setInstagramError(err?.message || 'Falha ao atualizar controle do Instagram')
    } finally { setInstagramBusy(false) }
  }

  const sendInstagramDmTest = async () => {
    if (!igDmUserId.trim() || !igDmText.trim()) return
    setInstagramBusy(true)
    try {
      const data = await apiFetch('instagram-send-dm', {
        method: 'POST',
        body: JSON.stringify({ userId: igDmUserId.trim(), text: igDmText.trim() }),
      })
      if (data?.ok === false) throw new Error(extractProxyMessage(data, 'Falha ao enviar DM no Instagram'))
      await loadInstagram()
      setIgDmText('')
      setInstagramError('')
    } catch (err: any) {
      setInstagramError(err?.message || 'Falha ao enviar DM no Instagram')
    } finally { setInstagramBusy(false) }
  }

  const connectInstagram = async () => {
    setInstagramBusy(true)
    setInstagramError('')
    try {
      const data = await apiFetch('instagram-control', {
        method: 'POST',
        body: JSON.stringify({
          pageId: instagramState?.pageId || undefined,
          businessId: instagramState?.businessId || undefined,
          automationEnabled: instagramState?.automationEnabled ?? true,
          requireFollowGate: instagramState?.requireFollowGate ?? false,
        }),
      })
      if (data?.ok === false) throw new Error(extractProxyMessage(data, 'Falha ao conectar Instagram'))
      await loadInstagram()
    } catch (err: any) {
      setInstagramError(err?.message || 'Falha ao conectar Instagram')
    } finally { setInstagramBusy(false) }
  }

  // ── Envio em massa ──────────────────────────────────────────────────────────
  const addMassFromPaste = () => {
    const lines = massPasteText.trim().split(/\r?\n/).filter(Boolean)
    const parsed: MassRecipient[] = lines.map(l => {
      const [raw, nome = ''] = l.split(/[,;|\t]/)
      const phone = normPhone(raw || '')
      return { phone, nome: nome.trim() }
    }).filter(r => r.phone.length >= 8)
    setMassRecipients(prev => {
      const phones = new Set(prev.map(r => r.phone))
      return [...prev, ...parsed.filter(r => !phones.has(r.phone))]
    })
    setMassPasteText('')
  }

  const addFromCSVFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const parsed = parseCSV(e.target?.result as string)
      setMassRecipients(prev => {
        const phones = new Set(prev.map(r => r.phone))
        return [...prev, ...parsed.filter(r => !phones.has(r.phone))]
      })
    }
    reader.readAsText(file, 'UTF-8')
  }

  const massLogRef = useRef<HTMLDivElement>(null)

  const startMassSend = async () => {
    if (!waState?.ready || massRecipients.length === 0 || !massTemplate.trim()) return
    setMassRunning(true); setMassSent(0); setMassErrors(0); setMassLog([]); massStopRef.current = false
    for (let i = 0; i < massRecipients.length; i++) {
      if (massStopRef.current) break
      // Verifica se ainda está conectado a cada envio
      if (!waState?.ready) {
        setMassLog(l => [...l, '⚠️ WhatsApp desconectou — envio pausado'])
        break
      }
      const r = massRecipients[i]
      const text = applyTemplate(massTemplate, r)
      try {
        await apiFetch('send', { method: 'POST', body: JSON.stringify({ phone: r.phone, chatId: `${r.phone}@s.whatsapp.net`, text }) })
        setMassSent(s => s + 1)
        setMassLog(l => [...l, `✅ ${r.phone}${r.nome ? ` (${r.nome})` : ''}`])
      } catch {
        setMassErrors(e => e + 1)
        setMassLog(l => [...l, `❌ ${r.phone} — falhou`])
      }
      // Auto-scroll do log
      setTimeout(() => { massLogRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, 50)
      if (i < massRecipients.length - 1 && !massStopRef.current) {
        const delay = (massDelay + (Math.random() - 0.5) * 2) * 1000
        await new Promise(res => setTimeout(res, Math.max(1500, delay)))
      }
    }
    setMassLog(l => [...l, massStopRef.current ? '🛑 Envio interrompido pelo usuário' : '🎉 Envio concluído!'])
    setMassRunning(false)
  }

  // ── Cores / Labels ──────────────────────────────────────────────────────────
  const sseColor = sseStatus === 'live' ? '#0ABD78' : sseStatus === 'connecting' ? '#F8A303' : '#666'
  const sseLabel = sseStatus === 'live' ? '● ao vivo' : sseStatus === 'connecting' ? '○ conectando' : '○ offline'
  // Contato "sem nome" = name é idêntico ao phone ou é puramente numérico (LID)
  const hasRealName = (c: Contact) => c.name && c.name !== c.phone && !/^\d+$/.test(c.name)

  const filteredContacts = contacts.filter(c => {
    const archived = archivedChats.has(c.chatId)
    if (showArchived ? !archived : archived) return false
    if (hideUnnamed && !hasRealName(c)) return false
    if (labelFilter !== 'all' && !(labelsByPhone[c.phone] || []).includes(labelFilter)) return false
    return `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
  })

  const namedCount   = contacts.filter(c => !archivedChats.has(c.chatId) && hasRealName(c)).length
  const unnamedCount = contacts.filter(c => !archivedChats.has(c.chatId) && !hasRealName(c)).length
  const filteredGroups = groups.filter(g =>
    `${g.name} ${g.description}`.toLowerCase().includes(groupSearch.toLowerCase()),
  )

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] gap-3">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-black font-extrabold text-lg"
              style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>W</div>
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">WhatsApp CRM</h1>
              <span className="text-xs font-bold" style={{ color: sseColor }}>{sseLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-1 py-1 rounded-xl flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setPlatform('whatsapp')}
                className="px-3 py-1.5 rounded-lg text-xs font-extrabold"
                style={{ background: platform === 'whatsapp' ? 'rgba(10,189,120,0.18)' : 'transparent', color: platform === 'whatsapp' ? '#0ABD78' : 'rgba(255,255,255,0.65)' }}
              >
                WhatsApp
              </button>
              <button
                onClick={() => { setPlatform('instagram'); loadInstagram() }}
                className="px-3 py-1.5 rounded-lg text-xs font-extrabold"
                style={{ background: platform === 'instagram' ? 'rgba(10,189,120,0.18)' : 'transparent', color: platform === 'instagram' ? '#0ABD78' : 'rgba(255,255,255,0.65)' }}
              >
                Instagram
              </button>
            </div>

            {platform === 'whatsapp' && (
              <>
                {([['chats','Conversas',ChatBubbleLeftRightIcon],['kanban','Kanban',FunnelIcon],['mass','Envio em Massa',PaperAirplaneIcon],['groups','Grupos',UserGroupIcon],['ai','Sofi IA',SparklesIcon]] as [Tab,string,any][]).map(([id,label,Icon]) => (
                  <button key={id} onClick={() => {
                    setTab(id)
                    if (id === 'groups' && groups.length === 0) loadGroups()
                  }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    style={{
                      background: tab === id ? 'rgba(10,189,120,0.18)' : 'rgba(255,255,255,0.06)',
                      color:      tab === id ? '#0ABD78' : 'rgba(255,255,255,0.5)',
                      border:     `1px solid ${tab === id ? 'rgba(10,189,120,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </>
            )}

            <div className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              style={{
                background: platform === 'whatsapp'
                  ? (waState?.ready ? 'rgba(10,189,120,0.12)' : 'rgba(248,163,3,0.12)')
                  : (instagramState?.connected ? 'rgba(10,189,120,0.12)' : 'rgba(248,163,3,0.12)'),
                color: platform === 'whatsapp'
                  ? (waState?.ready ? '#0ABD78' : '#F8A303')
                  : (instagramState?.connected ? '#0ABD78' : '#F8A303'),
                border: `1px solid ${platform === 'whatsapp'
                  ? (waState?.ready ? 'rgba(10,189,120,0.25)' : 'rgba(248,163,3,0.25)')
                  : (instagramState?.connected ? 'rgba(10,189,120,0.25)' : 'rgba(248,163,3,0.25)')}`,
              }}>
              {platform === 'whatsapp'
                ? (waState?.ready ? <CheckCircleIcon className="w-4 h-4" /> : <QrCodeIcon className="w-4 h-4" />)
                : (instagramState?.connected ? <CheckCircleIcon className="w-4 h-4" /> : <CommandLineIcon className="w-4 h-4" />)}
              {platform === 'whatsapp'
                ? (waState?.ready ? 'WhatsApp conectado' : 'WhatsApp desconectado')
                : (instagramState?.connected ? 'Instagram conectado' : 'Instagram desconectado')}
            </div>

            {platform === 'whatsapp' ? (
              !waState?.ready && (
                <button onClick={connectWA} disabled={initBusy}
                  className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-black disabled:opacity-50 flex items-center gap-1.5"
                  style={{ background: '#F8A303' }}>
                  {initBusy ? <ArrowPathIcon className="w-4 h-4 animate-spin inline" /> : <QrCodeIcon className="w-4 h-4" />}
                  {initBusy ? 'Gerando QR...' : 'Conectar'}
                </button>
              )
            ) : (
              <button
                onClick={instagramState?.connected ? loadInstagram : connectInstagram}
                disabled={instagramBusy}
                className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-black disabled:opacity-50"
                style={{ background: '#F8A303' }}
              >
                {instagramBusy ? 'Processando...' : (instagramState?.connected ? 'Sincronizar Instagram' : 'Conectar Instagram')}
              </button>
            )}
            <button onClick={platform === 'whatsapp' ? loadContacts : loadInstagram} className="p-2 rounded-xl text-white/40 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* QR Code — estado independente, persiste até scan */}
        {qrDataUrl && !waState?.ready && (
          <div className="rounded-2xl p-4 flex items-center gap-4 shrink-0"
            style={{ background: 'rgba(248,163,3,0.07)', border: '1px solid rgba(248,163,3,0.18)' }}>
            <img src={qrDataUrl} alt="QR" className="w-36 h-36 rounded-xl bg-white p-1" />
            <div>
              <p className="text-sm font-extrabold text-white">📱 Escaneie o QR Code</p>
              <p className="text-xs text-white/50 mt-1">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
              <p className="text-xs text-amber-400/70 mt-2">O QR expira em ~60s — clique "Conectar" para gerar novo</p>
              {!!waConnectNote && <p className="text-xs text-white/55 mt-2">{waConnectNote}</p>}
              {!!waConnectError && <p className="text-xs text-red-300 mt-2">{waConnectError}</p>}
              <button onClick={connectWA} disabled={initBusy} className="mt-2 px-3 py-1 rounded-lg text-xs font-bold text-black"
                style={{ background: '#F8A303' }}>
                {initBusy ? '...' : '🔄 Novo QR Code'}
              </button>
            </div>
          </div>
        )}

        {!waState?.ready && !qrDataUrl && (waConnectNote || waConnectError) && (
          <div className="rounded-2xl px-4 py-3 shrink-0"
            style={{
              background: waConnectError ? 'rgba(239,68,68,0.12)' : 'rgba(248,163,3,0.08)',
              border: `1px solid ${waConnectError ? 'rgba(239,68,68,0.25)' : 'rgba(248,163,3,0.18)'}`,
            }}>
            <p className="text-xs font-bold text-white/80">{waConnectNote || waConnectError}</p>
            {waConnectError && <p className="text-[11px] text-white/45 mt-1">Se o backend/túnel estiver online, tente mais uma vez. Se não, o QR não consegue nascer do lado do front.</p>}
          </div>
        )}

        {!!instagramError && platform === 'instagram' && (
          <div className="rounded-2xl px-4 py-3 text-xs font-bold text-red-200"
            style={{ background: 'rgba(239,68,68,0.13)', border: '1px solid rgba(239,68,68,0.35)' }}>
            {instagramError}
          </div>
        )}

        {/* ══ TAB: CONVERSAS ══════════════════════════════════════════════════ */}
        {platform === 'whatsapp' && tab === 'chats' && (
          <div className="flex flex-1 gap-3 overflow-hidden min-h-0">

            {/* Lista contatos */}
            <aside className="w-72 flex flex-col shrink-0 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                </div>
                <div className="flex items-center justify-between mt-2 px-1 gap-2 flex-wrap">
                  <p className="text-[10px] text-white/30">
                    {filteredContacts.length} de {namedCount + unnamedCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setHideUnnamed(s => !s)}
                      className="flex items-center gap-1 text-[10px] font-bold transition-colors"
                      style={{ color: hideUnnamed ? '#F8A303' : 'rgba(255,255,255,0.3)' }}>
                      {hideUnnamed ? `👤 +${unnamedCount} s/ nome` : '👤 Ocultar s/ nome'}
                    </button>
                    <button onClick={() => setShowArchived(s => !s)}
                      className="flex items-center gap-1 text-[10px] font-bold transition-colors"
                      style={{ color: showArchived ? '#0ABD78' : 'rgba(255,255,255,0.3)' }}>
                      <ArchiveBoxIcon className="w-3.5 h-3.5" />
                      {showArchived ? 'Ativos' : `Arq (${archivedChats.size})`}
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <select value={labelFilter} onChange={e => setLabelFilter(e.target.value as ContactLabel | 'all')}
                    className="w-full text-[11px] rounded-xl px-2 py-1.5 outline-none font-bold text-white/70"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="all">Todos os selos</option>
                    {LABELS.map(lb => <option key={lb} value={lb}>{lb}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredContacts.length === 0 && (
                  <p className="p-6 text-center text-xs text-white/30">
                    {!waState?.ready
                      ? 'Conecte o WhatsApp primeiro'
                      : contacts.length === 0
                        ? 'Carregando conversas…'
                        : hideUnnamed
                          ? `Nenhum contato com nome (${unnamedCount} ocultos)`
                          : 'Nenhuma conversa encontrada'}
                  </p>
                )}
                {filteredContacts.map(c => (
                  <button key={c.chatId} onClick={() => { setSelectedId(c.chatId); setContacts(prev => prev.map(x => x.chatId === c.chatId ? { ...x, unread: 0 } : x)) }}
                    className="w-full text-left p-3 border-b transition-colors hover:bg-white/[0.03]"
                    style={{ background: selected?.chatId === c.chatId ? 'rgba(10,189,120,0.09)' : undefined, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt={c.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                          style={{ border: `2px solid ${STAGE_COLORS[stages[c.phone] || 'Inbox']}` }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-extrabold shrink-0 text-sm"
                          style={{ background: `${STAGE_COLORS[stages[c.phone] || 'Inbox']}30`, border: `2px solid ${STAGE_COLORS[stages[c.phone] || 'Inbox']}` }}>
                          {(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-bold text-white truncate">{c.name}</p>
                          <span className="text-[10px] text-white/30 shrink-0">{c.lastAt}</span>
                        </div>
                        <p className="text-xs text-white/40 truncate mt-0.5">
                          {c.lastMessage || <span className="italic text-white/20">sem mensagens</span>}
                        </p>
                        {c.unread > 0 && <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-black" style={{ background: '#0ABD78' }}>{c.unread}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Chat */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {!selected ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-white/25">Selecione um contato</p>
                </div>
              ) : (
                <>
                  {/* Header chat */}
                  <div className="px-4 py-3 border-b flex items-center gap-3 shrink-0"
                    style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    {selected.avatarUrl ? (
                      <img src={selected.avatarUrl} alt={selected.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-black font-extrabold shrink-0"
                        style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                        {(selected.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-white truncate">{selected.name}</p>
                      <p className="text-[11px] text-white/35">{selected.phone}</p>
                    </div>
                    {/* Stage selector */}
                    <select value={stages[selected.phone] || 'Inbox'}
                      onChange={e => persistStage(selected.phone, e.target.value as Stage)}
                      className="text-xs rounded-lg px-2 py-1 outline-none font-bold"
                      style={{ background: `${STAGE_COLORS[stages[selected.phone] || 'Inbox']}20`, color: STAGE_COLORS[stages[selected.phone] || 'Inbox'], border: `1px solid ${STAGE_COLORS[stages[selected.phone] || 'Inbox']}40` }}>
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => { setTab('kanban'); persistStage(selected.phone, 'Hoje') }}
                      className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                      style={{ background: 'rgba(14,165,233,0.12)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.25)' }}>
                      Ir para Kanban
                    </button>
                    <button onClick={() => setChatHandoff(false)}
                      title="Liberar a Sofi para responder este atendimento"
                      className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                      style={{ background: 'rgba(248,163,3,0.12)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.25)' }}>
                      IA ativa
                    </button>
                    <button onClick={() => setChatHandoff(true)}
                      title="Pausar a Sofi neste atendimento e assumir manualmente"
                      className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                      Pausar IA
                    </button>
                    <button
                      onClick={() => archiveCurrentChat(selected.chatId, !archivedChats.has(selected.chatId))}
                      title={archivedChats.has(selected.chatId) ? 'Desarquivar' : 'Arquivar (sincroniza no celular)'}
                      className="p-2 rounded-xl transition-colors"
                      style={{
                        background: archivedChats.has(selected.chatId) ? 'rgba(10,189,120,0.12)' : 'rgba(255,255,255,0.05)',
                        color: archivedChats.has(selected.chatId) ? '#0ABD78' : 'rgba(255,255,255,0.4)',
                      }}>
                      <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => loadMessages(selected.chatId)} className="p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <ArrowPathIcon className={`w-4 h-4 ${loadingMsgs ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="px-4 pt-2 flex items-center gap-1.5 flex-wrap">
                    {LABELS.map(lb => {
                      const active = (labelsByPhone[selected.phone] || []).includes(lb)
                      return (
                        <button key={lb} onClick={() => toggleLabel(selected.phone, lb)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{
                            background: active ? 'rgba(248,163,3,0.16)' : 'rgba(255,255,255,0.05)',
                            color: active ? '#F8A303' : 'rgba(255,255,255,0.5)',
                            border: `1px solid ${active ? 'rgba(248,163,3,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          {lb}
                        </button>
                      )
                    })}
                  </div>

                  {/* Mensagens */}
                  <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                    {loadingMsgs && <div className="text-center py-8"><ArrowPathIcon className="w-5 h-5 animate-spin text-white/30 mx-auto" /></div>}
                    {!loadingMsgs && messages.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-xs text-white/25">Sem histórico armazenado</p>
                        <p className="text-[10px] text-white/15 mt-1">Novas mensagens aparecerão aqui em tempo real</p>
                      </div>
                    )}
                    {messages.map(msg => (
                      <div key={msg.id} className={`group/msg flex items-end gap-1.5 ${msg.from === 'lead' ? 'justify-start' : 'justify-end'}`}>
                        {/* Botão deletar — aparece no hover, lado esquerdo para mensagens de agent */}
                        {msg.from !== 'lead' && (
                          <button
                            onClick={() => deleteMsg(msg.id, msg.from !== 'lead')}
                            title="Deletar mensagem (sincroniza no celular)"
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg shrink-0"
                            style={{ color: 'rgba(239,68,68,0.5)' }}>
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="max-w-[75%] rounded-2xl px-4 py-2.5"
                          style={{ background: msg.from === 'lead' ? 'rgba(255,255,255,0.08)' : msg.from === 'sofi' ? 'rgba(248,163,3,0.15)' : 'rgba(10,189,120,0.18)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {msg.from === 'sofi' && <p className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest mb-1">Sofi IA</p>}
                          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-[10px] text-white/25 mt-1 text-right">{msg.at}</p>
                        </div>
                        {/* Botão deletar — lado direito para mensagens do lead */}
                        {msg.from === 'lead' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => suggestAiReply(msg.text)}
                              title="Responder com IA"
                              className="p-1 rounded-lg"
                              style={{ color: '#F8A303', background: 'rgba(248,163,3,0.10)' }}>
                              <SparklesIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMsg(msg.id, false)}
                              title="Deletar mensagem"
                              className="p-1 rounded-lg"
                              style={{ color: 'rgba(239,68,68,0.5)' }}>
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Composer */}
                  <div className="p-3 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    {!waState?.ready && <p className="text-xs text-amber-400/70 mb-2 text-center">WhatsApp desconectado</p>}
                    <div className="flex gap-2">
                      <button onClick={() => suggestAiReply()} disabled={!selected || aiSuggesting}
                        title="Gerar resposta com Sofi"
                        className="w-11 h-11 rounded-2xl flex items-center justify-center disabled:opacity-40 shrink-0"
                        style={{ background: 'rgba(248,163,3,0.12)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.25)' }}>
                        {aiSuggesting ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                      </button>
                      <input value={composer} onChange={e => setComposer(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder="Digite uma mensagem… (Enter para enviar)"
                        disabled={sending}
                        className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }} />
                      <button onClick={sendMessage} disabled={!composer.trim() || sending}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-black disabled:opacity-40 shrink-0"
                        style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                        {sending ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: KANBAN ═════════════════════════════════════════════════════ */}
        {platform === 'whatsapp' && tab === 'kanban' && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
            <div className="flex gap-3 h-full" style={{ minWidth: `${STAGES.length * 220}px` }}>
              {STAGES.map(stage => {
                const cards = contacts.filter(c => (stages[c.phone] || 'Inbox') === stage)
                return (
                  <div key={stage} className="flex flex-col rounded-2xl overflow-hidden shrink-0"
                    style={{ width: 220, background: 'rgba(255,255,255,0.03)', border: `1px solid ${STAGE_COLORS[stage]}25` }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragPhone) persistStage(dragPhone, stage) }}>
                    {/* Coluna header */}
                    <div className="px-3 py-2.5 flex items-center justify-between shrink-0"
                      style={{ background: `${STAGE_COLORS[stage]}15`, borderBottom: `1px solid ${STAGE_COLORS[stage]}25` }}>
                      <span className="text-xs font-extrabold" style={{ color: STAGE_COLORS[stage] }}>{stage}</span>
                      <span className="text-xs font-bold rounded-full px-2 py-0.5"
                        style={{ background: `${STAGE_COLORS[stage]}25`, color: STAGE_COLORS[stage] }}>{cards.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {cards.map(c => (
                        <div key={c.chatId} draggable
                          onDragStart={() => setDragPhone(c.phone)}
                          onDragEnd={() => setDragPhone(null)}
                          onClick={() => { setTab('chats'); setSelectedId(c.chatId) }}
                          className="rounded-xl p-3 cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
                          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${STAGE_COLORS[stage]}20` }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-black font-extrabold text-xs shrink-0"
                              style={{ background: STAGE_COLORS[stage] }}>
                              {(c.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs font-bold text-white truncate">{c.name}</p>
                          </div>
                          <p className="text-[10px] text-white/35">{c.phone}</p>
                          {c.lastMessage && <p className="text-[10px] text-white/40 truncate mt-1">{c.lastMessage}</p>}
                          {c.lastAt && <p className="text-[9px] text-white/20 mt-1 text-right">{c.lastAt}</p>}
                          {/* Stage mini-select */}
                          <select value={stage}
                            onClick={e => e.stopPropagation()}
                            onChange={e => persistStage(c.phone, e.target.value as Stage)}
                            className="mt-2 w-full text-[9px] rounded-lg px-1.5 py-1 outline-none font-bold"
                            style={{ background: `${STAGE_COLORS[stage]}20`, color: STAGE_COLORS[stage], border: `1px solid ${STAGE_COLORS[stage]}40` }}>
                            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      ))}
                      {cards.length === 0 && <p className="text-[10px] text-white/20 text-center py-4">Nenhum contato</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ TAB: ENVIO EM MASSA ═════════════════════════════════════════════ */}
        {platform === 'whatsapp' && tab === 'mass' && (
          <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

            {/* Coluna esquerda: destinatários */}
            <div className="w-80 flex flex-col gap-3 shrink-0 overflow-y-auto">

              {/* Adicionar manualmente */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-extrabold text-white mb-2">➕ Adicionar manualmente</p>
                <p className="text-[10px] text-white/40 mb-2">Cole números (um por linha). Formato: <span className="text-white/60">5511999999999</span> ou com nome: <span className="text-white/60">5511999999999,João</span></p>
                <textarea value={massPasteText} onChange={e => setMassPasteText(e.target.value)}
                  rows={4} placeholder={"5511999999999,João Silva\n5521988887777,Maria"}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                <button onClick={addMassFromPaste} disabled={!massPasteText.trim()}
                  className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold text-black disabled:opacity-40"
                  style={{ background: '#0ABD78' }}>Adicionar</button>
              </div>

              {/* Upload CSV */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-extrabold text-white mb-2">📁 Upload CSV / Excel</p>
                <p className="text-[10px] text-white/40 mb-3">Colunas reconhecidas: <span className="text-white/60">telefone, nome, empresa</span> + qualquer variável personalizada</p>
                <label className="flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px dashed rgba(99,102,241,0.4)' }}>
                  <ArrowUpTrayIcon className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300">Escolher arquivo</span>
                  <input type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) addFromCSVFile(f); e.target.value = '' }} />
                </label>
              </div>

              {/* Importar de contatos */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-extrabold text-white mb-2">👥 Dos meus contatos</p>
                <div className="space-y-1.5">
                  <button onClick={addAllContactsWithNames} disabled={syncingContacts || !waState?.ready}
                    className="w-full py-1.5 rounded-xl text-xs font-bold text-black disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#F8A303,#FCD34D)' }}>
                    {syncingContacts ? 'Sincronizando nomes...' : 'Adicionar todos com nomes'}
                  </button>
                  <button onClick={() => setMassRecipients(contacts.map(c => ({ phone: c.phone, nome: c.name !== c.phone ? c.name : '', avatarUrl: c.avatarUrl || '' })))}
                    className="w-full py-1.5 rounded-xl text-xs font-bold text-white/70 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Todos os contatos ({contacts.length})
                  </button>
                  {STAGES.map(s => {
                    const filtered = contacts.filter(c => (stages[c.phone] || 'Inbox') === s)
                    return filtered.length > 0 ? (
                      <button key={s} onClick={() => setMassRecipients(prev => {
                        const phones = new Set(prev.map(r => r.phone))
                        return [...prev, ...filtered.filter(c => !phones.has(c.phone)).map(c => ({ phone: c.phone, nome: c.name !== c.phone ? c.name : '', avatarUrl: c.avatarUrl || '' }))]
                      })}
                        className="w-full py-1.5 rounded-xl text-xs font-bold hover:opacity-80 transition-opacity"
                        style={{ background: `${STAGE_COLORS[s]}15`, color: STAGE_COLORS[s], border: `1px solid ${STAGE_COLORS[s]}30` }}>
                        {s} ({filtered.length})
                      </button>
                    ) : null
                  })}
                </div>
              </div>

              {/* Lista de destinatários */}
              {massRecipients.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-extrabold text-white">{massRecipients.length} destinatários</p>
                    <button onClick={() => setMassRecipients([])} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">
                      <TrashIcon className="w-3.5 h-3.5 inline" /> Limpar
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {massRecipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg gap-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          {r.avatarUrl ? (
                            <img src={r.avatarUrl} alt={r.nome || r.phone} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold text-black shrink-0"
                              style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}>
                              {(r.nome || r.phone || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[11px] text-white/70">{r.nome || r.name || '—'}</p>
                            <p className="text-[10px] text-white/40">{r.phone}</p>
                          </div>
                        </div>
                        <button onClick={() => setMassRecipients(prev => prev.filter((_, j) => j !== i))} className="text-red-400/40 hover:text-red-400 ml-2">
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Coluna direita: template + envio */}
            <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">

              {/* Editor de template */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-extrabold text-white">✍️ Template da mensagem</p>
                  <div className="flex gap-1">
                    {['{nome}','{telefone}','{empresa}'].map(v => (
                      <button key={v} onClick={() => setMassTemplate(t => t + v)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold hover:opacity-80"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}>{v}</button>
                    ))}
                  </div>
                </div>
                <textarea value={massTemplate} onChange={e => setMassTemplate(e.target.value)}
                  rows={6} placeholder="Digite a mensagem…"
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                {/* Preview */}
                {massRecipients.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(10,189,120,0.07)', border: '1px solid rgba(10,189,120,0.15)' }}>
                    <p className="text-[10px] text-white/40 mb-1">Prévia para {massRecipients[0].nome || massRecipients[0].phone}:</p>
                    <p className="text-xs text-white/80 whitespace-pre-wrap">{applyTemplate(massTemplate, massRecipients[0])}</p>
                  </div>
                )}
              </div>

              {/* Configurações de envio */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-extrabold text-white mb-3">⚙️ Configurações de envio</p>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-[10px] text-white/40">Intervalo entre envios</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="range" min={1} max={30} value={massDelay} onChange={e => setMassDelay(Number(e.target.value))} className="w-28" />
                      <span className="text-xs font-bold text-white">{massDelay}s</span>
                    </div>
                    <p className="text-[9px] text-white/25 mt-0.5">Variação aleatória de ±2s para parecer humano</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-white/40">Tempo estimado</p>
                    <p className="text-sm font-bold text-white/70">
                      {Math.round(massRecipients.length * massDelay / 60)}min {massRecipients.length * massDelay % 60}s
                    </p>
                  </div>
                </div>
              </div>

              {/* Botão enviar + progresso */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3 mb-3">
                  {!massRunning ? (
                    <button onClick={startMassSend}
                      disabled={!waState?.ready || massRecipients.length === 0 || !massTemplate.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-black flex items-center justify-center gap-2 disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                      <PlayIcon className="w-5 h-5" /> Iniciar envio ({massRecipients.length})
                    </button>
                  ) : (
                    <button onClick={() => { massStopRef.current = true }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <StopIcon className="w-5 h-5" /> Parar envio
                    </button>
                  )}
                </div>

                {/* Barra de progresso */}
                {(massSent > 0 || massRunning) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-white/40">
                      <span>✅ {massSent} enviados &nbsp; ❌ {massErrors} erros</span>
                      <span>{massSent + massErrors}/{massRecipients.length}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${massRecipients.length > 0 ? (massSent + massErrors) / massRecipients.length * 100 : 0}%`, background: 'linear-gradient(90deg,#0ABD78,#34D399)' }} />
                    </div>
                    <div ref={massLogRef} className="max-h-40 overflow-y-auto space-y-0.5 mt-2">
                      {massLog.map((l, i) => (
                        <p key={i} className="text-[10px] font-mono" style={{
                          color: l.startsWith('✅') ? '#0ABD78'
                               : l.startsWith('❌') ? '#EF4444'
                               : l.startsWith('⚠️') ? '#F8A303'
                               : 'rgba(255,255,255,0.5)'
                        }}>{l}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: GRUPOS ═════════════════════════════════════════════════════ */}
        {platform === 'whatsapp' && tab === 'ai' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-3 overflow-hidden min-h-0">
            <div className="rounded-2xl p-4 overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-black"
                  style={{ background: 'linear-gradient(135deg,#F8A303,#FCD34D)' }}>
                  <SparklesIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">Sofi no WhatsApp</h2>
                  <p className="text-xs text-white/40">Atendimento automatico com supervisao humana.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['paused','assist','auto'] as AiState['mode'][]).map(mode => (
                  <button key={mode} onClick={() => updateAiMode(mode)} disabled={aiBusy}
                    className="rounded-2xl py-3 text-xs font-extrabold disabled:opacity-50"
                    style={{
                      background: aiState?.mode === mode ? 'rgba(248,163,3,0.18)' : 'rgba(255,255,255,0.05)',
                      color: aiState?.mode === mode ? '#F8A303' : 'rgba(255,255,255,0.55)',
                      border: `1px solid ${aiState?.mode === mode ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {mode === 'paused' ? 'Pausada' : mode === 'assist' ? 'Sugestao' : 'Automatica'}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/35">Tom da Sofi</span>
                  <textarea value={aiState?.tone || ''} onChange={e => setAiState(prev => prev ? { ...prev, tone: e.target.value } : prev)}
                    rows={3} className="mt-1 w-full rounded-2xl px-3 py-2 text-sm text-white outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span>
                    <span className="block text-xs font-bold text-white">Responder grupos</span>
                    <span className="block text-[10px] text-white/35">Use com cuidado em grupos grandes.</span>
                  </span>
                  <input type="checkbox" checked={!!aiState?.allowGroups}
                    onChange={e => setAiState(prev => prev ? { ...prev, allowGroups: e.target.checked } : prev)} />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/35">Limite por resposta</span>
                  <input type="range" min={180} max={1200} value={aiState?.maxChars || 700}
                    onChange={e => setAiState(prev => prev ? { ...prev, maxChars: Number(e.target.value) } : prev)}
                    className="w-full mt-2" />
                  <span className="text-xs text-white/50">{aiState?.maxChars || 700} caracteres</span>
                </label>
                <button onClick={updateAiSettings} disabled={aiBusy || !aiState}
                  className="w-full py-2.5 rounded-2xl text-sm font-extrabold text-black disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F8A303,#FCD34D)' }}>
                  Salvar configuracao da Sofi
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-4 overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">Playbooks e treinamento</h3>
                  <p className="text-xs text-white/40">Defina como a Sofi age em vendas, suporte e conversas pessoais.</p>
                </div>
                <span className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                  style={{ background: aiState?.hasGeminiKey ? 'rgba(10,189,120,0.12)' : 'rgba(239,68,68,0.12)', color: aiState?.hasGeminiKey ? '#0ABD78' : '#EF4444' }}>
                  {aiState?.hasGeminiKey ? 'Gemini ativo' : 'Sem chave Gemini'}
                </span>
              </div>

              <div className="rounded-2xl p-3 mb-4"
                style={{ background: 'rgba(248,163,3,0.06)', border: '1px solid rgba(248,163,3,0.18)' }}>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['vendas','suporte','pessoal'] as const).map(key => (
                    <button key={key}
                      onClick={() => {
                        setPlaybookKey(key)
                        setAiState(prev => prev ? { ...prev, activePlaybook: key } : prev)
                      }}
                      className="rounded-xl py-2 text-xs font-extrabold capitalize"
                      style={{
                        background: playbookKey === key ? 'rgba(248,163,3,0.18)' : 'rgba(255,255,255,0.05)',
                        color: playbookKey === key ? '#F8A303' : 'rgba(255,255,255,0.55)',
                        border: `1px solid ${playbookKey === key ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {key}
                    </button>
                  ))}
                </div>
                <textarea
                  value={aiState?.playbooks?.[playbookKey] || ''}
                  onChange={e => setAiState(prev => prev ? {
                    ...prev,
                    playbooks: { ...(prev.playbooks || { vendas: '', suporte: '', pessoal: '' }), [playbookKey]: e.target.value },
                  } : prev)}
                  rows={7}
                  placeholder="Escreva regras, frases, limites, objeções e passos que a Sofi deve seguir neste cenário."
                  className="w-full rounded-2xl px-3 py-2 text-sm text-white outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] text-white/35">
                    Playbook ativo: <span className="font-bold text-amber-300">{aiState?.activePlaybook || 'suporte'}</span>
                  </p>
                  <button onClick={updateAiSettings} disabled={aiBusy || !aiState}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold text-black disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#F8A303,#FCD34D)' }}>
                    Salvar playbook
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <input value={aiTrainingText} onChange={e => setAiTrainingText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addAiTraining() }}
                  placeholder="Ex.: Se perguntarem sobre matricula, pedir nome da unidade e telefone."
                  className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                <button onClick={addAiTraining} disabled={aiBusy || !aiTrainingText.trim()}
                  className="px-4 rounded-2xl text-sm font-extrabold text-black disabled:opacity-40"
                  style={{ background: '#0ABD78' }}>
                  Treinar
                </button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {(aiState?.training || []).map((item, i) => (
                  <div key={`${item}-${i}`} className="rounded-2xl p-3"
                    style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs text-white/75 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {platform === 'instagram' && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-3 overflow-hidden min-h-0">
            <div className="rounded-2xl p-4 overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-base font-extrabold text-white mb-2">Instagram Automação</h3>
              <p className="text-xs text-white/45 mb-3">Comentários por palavra-chave, DM automática e gate de seguir perfil.</p>
              <div className="space-y-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs text-white/70">Page ID: <span className="text-white">{instagramState?.pageId || '(não configurado)'}</span></p>
                  <p className="text-xs text-white/70">Business ID: <span className="text-white">{instagramState?.businessId || '(não configurado)'}</span></p>
                  <p className="text-xs mt-1" style={{ color: instagramState?.hasPageToken ? '#0ABD78' : '#F8A303' }}>
                    Token de página: {instagramState?.hasPageToken ? 'ativo' : 'pendente'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: instagramState?.hasVerifyToken ? '#0ABD78' : '#F8A303' }}>
                    Verify token: {instagramState?.hasVerifyToken ? 'ativo' : 'pendente'}
                  </p>
                </div>
                <label className="flex items-center justify-between text-xs text-white/80">
                  <span>Automação ativa</span>
                  <input type="checkbox" checked={!!instagramState?.automationEnabled}
                    onChange={e => updateInstagramControl({ automationEnabled: e.target.checked })} />
                </label>
                <label className="flex items-center justify-between text-xs text-white/80">
                  <span>Exigir follow antes do material</span>
                  <input type="checkbox" checked={!!instagramState?.requireFollowGate}
                    onChange={e => updateInstagramControl({ requireFollowGate: e.target.checked })} />
                </label>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-white">Regras por palavra-chave</p>
                  {instagramRules.map((rule, idx) => (
                    <div key={rule.id || idx} className="grid grid-cols-[1fr_110px_70px] gap-2">
                      <input value={rule.keyword}
                        onChange={e => setInstagramRules(prev => prev.map((r, i) => i === idx ? { ...r, keyword: e.target.value } : r))}
                        className="px-2 py-2 rounded-lg text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                      <input value={rule.targetStage || 'Acompanhar'}
                        onChange={e => setInstagramRules(prev => prev.map((r, i) => i === idx ? { ...r, targetStage: e.target.value } : r))}
                        className="px-2 py-2 rounded-lg text-xs text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                      <label className="text-[11px] text-white/70 flex items-center justify-center gap-1">
                        <input type="checkbox" checked={rule.enabled !== false}
                          onChange={e => setInstagramRules(prev => prev.map((r, i) => i === idx ? { ...r, enabled: e.target.checked } : r))} />
                        on
                      </label>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => setInstagramRules(prev => [...prev, { id: crypto.randomUUID(), keyword: '', action: 'dm_material', enabled: true, targetStage: 'Acompanhar' }])}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      + regra
                    </button>
                    <button onClick={saveInstagramRules} disabled={instagramBusy}
                      className="px-3 py-2 rounded-xl text-xs font-extrabold text-black disabled:opacity-50"
                      style={{ background: '#F8A303' }}>
                      Salvar regras
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-4 overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-base font-extrabold text-white mb-3">Direct e eventos</h3>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-3">
                <input value={igDmUserId} onChange={e => setIgDmUserId(e.target.value)} placeholder="ID do usuário Instagram"
                  className="px-3 py-2 rounded-xl text-xs text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                <input value={igDmText} onChange={e => setIgDmText(e.target.value)} placeholder="Mensagem"
                  className="px-3 py-2 rounded-xl text-xs text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                <button onClick={sendInstagramDmTest} disabled={instagramBusy || !igDmUserId.trim() || !igDmText.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-extrabold text-black disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                  Enviar DM
                </button>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-white/80">Últimos eventos</p>
                <button onClick={loadInstagram} className="text-xs text-amber-300">Atualizar</button>
              </div>
              <div className="space-y-2">
                {filteredInstagramEvents.length === 0 && <p className="text-xs text-white/35">Sem eventos recentes.</p>}
                {filteredInstagramEvents.map((ev, i) => (
                  <div key={`${ev.id || i}-${ev.type}`} className="rounded-xl p-2"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[11px] text-white font-bold">{ev.type}</p>
                    <p className="text-[11px] text-white/50">{ev.fromName || ev.fromId || ev.userId || ''}</p>
                    {!!ev.text && <p className="text-[11px] text-white/70 mt-1 line-clamp-2">{ev.text}</p>}
                    {!!ev.error && <p className="text-[11px] text-red-300 mt-1">{ev.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {platform === 'whatsapp' && tab === 'groups' && (
          <div className="flex-1 flex gap-3 overflow-hidden min-h-0">

            {/* Lista de grupos */}
            <div className="w-72 flex flex-col shrink-0 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-extrabold text-white">{groups.length} grupos</p>
                <button onClick={loadGroups} disabled={loadingGroups}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <ArrowPathIcon className={`w-4 h-4 ${loadingGroups ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Pesquisar grupo..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingGroups && <div className="p-6 text-center"><ArrowPathIcon className="w-5 h-5 animate-spin text-white/30 mx-auto" /></div>}
                {!loadingGroups && filteredGroups.length === 0 && (
                  <p className="p-6 text-center text-xs text-white/30">{waState?.ready ? 'Nenhum grupo encontrado' : 'Conecte o WhatsApp primeiro'}</p>
                )}
                {filteredGroups.map(g => (
                  <button key={g.id} onClick={() => setSelectedGroup(g)}
                    className="w-full text-left p-3 border-b transition-colors hover:bg-white/[0.03]"
                    style={{ background: selectedGroup?.id === g.id ? 'rgba(99,102,241,0.09)' : undefined, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-extrabold shrink-0 text-sm"
                        style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}>
                        {(g.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{g.name}</p>
                        <p className="text-[10px] text-white/40">{g.participants} membros</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detalhe do grupo */}
            <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {!selectedGroup ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-white/25">Selecione um grupo</p>
                </div>
              ) : (
                <>
                  {/* Header grupo */}
                  <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-extrabold text-white">{selectedGroup.name}</p>
                        <p className="text-xs text-white/40">{selectedGroup.members.length} membros com número identificável</p>
                        {selectedGroup.description && <p className="text-[11px] text-white/30 mt-0.5">{selectedGroup.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => exportGroupCSV(selectedGroup)} title="Exportar CSV"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}>
                          <ArrowDownTrayIcon className="w-4 h-4" /> CSV
                        </button>
                        <button onClick={() => {
                          const nums = selectedGroup.members.map(m => m.phone).join('\n')
                          navigator.clipboard.writeText(nums)
                        }} title="Copiar números"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                          style={{ background: 'rgba(248,163,3,0.15)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.3)' }}>
                          <ClipboardDocumentIcon className="w-4 h-4" /> Copiar
                        </button>
                        <button onClick={() => sendGroupToMass(selectedGroup)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-black"
                          style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                          <PaperAirplaneIcon className="w-4 h-4" /> Envio em Massa
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lista de membros */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {selectedGroup.members.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-black font-extrabold text-xs shrink-0"
                            style={{ background: m.admin ? 'linear-gradient(135deg,#F8A303,#FCD34D)' : 'linear-gradient(135deg,#6366F1,#818CF8)' }}>
                            {m.phone.slice(-2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-white/70 font-mono truncate">+{m.phone}</p>
                            {m.admin && <p className="text-[9px] text-amber-400 font-bold">Admin</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedGroup.members.length === 0 && (
                      <p className="text-center text-xs text-white/30 py-8">Nenhum membro com número identificável neste grupo.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
