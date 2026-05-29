'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Cookies from 'js-cookie'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  QrCodeIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Contact {
  chatId: string      // JID original do Baileys (ex: 5511...@s.whatsapp.net ou @lid)
  phone: string       // número normalizado (só dígitos)
  name: string
  lastMessage: string
  lastAt: string      // timestamp formatado
  unread: number
  timestamp: number   // unix seconds
}

interface Message {
  id: string
  from: 'lead' | 'agent' | 'sofi'
  text: string
  at: string
}

interface WaState {
  connected: boolean
  ready: boolean
  qrDataUrl?: string | null
  error?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildHeaders() {
  const token = Cookies.get('accessToken')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/whatsapp-live/${path}`, {
    ...opts,
    headers: { ...buildHeaders(), ...(opts?.headers || {}) },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

function normalizePhone(raw: string): string {
  return (raw || '')
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace('@g.us', '')
    .replace(/@lid$/, '')
    .replace(/\D+@lid$/, '')
}

function formatTs(ts: any): string {
  const n = Number(ts)
  if (!n || n <= 0) return ''
  const ms = n < 1e10 ? n * 1000 : n
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function timeNow() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function isRealContact(c: any): boolean {
  const id = String(c.id || c.chatId || '')
  if (!id || id === 'status@broadcast') return false
  if (id.endsWith('@g.us')) return false          // grupos — fora
  const phone = c.phone || normalizePhone(id)
  return /^\d{7,}$/.test(phone)                  // só números com 7+ dígitos
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [waState, setWaState]         = useState<WaState | null>(null)
  const [contacts, setContacts]       = useState<Contact[]>([])
  const [messages, setMessages]       = useState<Message[]>([])
  const [selectedId, setSelectedId]   = useState<string>('')
  const [search, setSearch]           = useState('')
  const [composer, setComposer]       = useState('')
  const [sending, setSending]         = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sseStatus, setSseStatus]     = useState<'offline' | 'connecting' | 'live'>('offline')
  const [initBusy, setInitBusy]       = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sseAbort       = useRef<AbortController | null>(null)

  const selected = contacts.find(c => c.chatId === selectedId) ?? contacts[0] ?? null

  // ── SSE ──────────────────────────────────────────────────────────────────

  const loadContacts = useCallback(async () => {
    try {
      const data: any[] = await apiFetch('contacts')
      if (!Array.isArray(data)) return
      setContacts(
        data
          .filter(isRealContact)
          .map(c => ({
            chatId:      c.id || c.chatId || '',
            phone:       c.phone || normalizePhone(c.id || c.chatId || ''),
            name:        (c.name && c.name !== c.phone) ? c.name : (c.phone || normalizePhone(c.id || '')),
            lastMessage: c.lastMessage || '',
            lastAt:      formatTs(c.timestamp),
            unread:      c.unreadCount ?? 0,
            timestamp:   c.timestamp ?? 0,
          }))
          .sort((a, b) => b.timestamp - a.timestamp)
      )
    } catch (e) {
      console.error('[WA] loadContacts error', e)
    }
  }, [])

  const loadMessages = useCallback(async (chatId: string) => {
    if (!chatId) return
    setLoadingMsgs(true)
    setMessages([])
    try {
      const data: any[] = await apiFetch(`messages?chatId=${encodeURIComponent(chatId)}&limit=60`)
      if (Array.isArray(data)) {
        setMessages(data.map(m => ({
          id:   m.id || crypto.randomUUID(),
          from: (m.from === 'agent' || m.from === 'sofi') ? m.from : 'lead',
          text: m.text || '',
          at:   m.at
            ? (new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
            : timeNow(),
        })))
      }
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  // SSE — eventos em tempo real
  const connectSSE = useCallback(async (signal: AbortSignal) => {
    setSseStatus('connecting')
    try {
      const token = Cookies.get('accessToken')
      const res = await fetch('/api/whatsapp-live/events', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: 'text/event-stream',
        },
        signal,
        cache: 'no-store',
      })
      if (!res.ok || !res.body) { setSseStatus('offline'); return }
      setSseStatus('live')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let evt = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) { evt = line.slice(7).trim(); continue }
          if (!line.startsWith('data: ')) { evt = ''; continue }
          try {
            const payload = JSON.parse(line.slice(6))
            if (evt === 'state') {
              setWaState(payload)
              if (payload.ready) loadContacts()
            } else if (evt === 'message') {
              const phone     = normalizePhone(payload.chatId || '')
              const incoming: Message = {
                id:   payload.id || crypto.randomUUID(),
                from: payload.from === 'agent' ? 'agent' : payload.from === 'sofi' ? 'sofi' : 'lead',
                text: payload.text || '',
                at:   payload.at
                  ? new Date(payload.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : timeNow(),
              }
              // Adiciona mensagem ao chat aberto
              setSelectedId(prev => {
                const rawPrev = normalizePhone(prev)
                if (rawPrev === phone || prev === payload.chatId) {
                  setMessages(m => [...m, incoming])
                }
                return prev
              })
              // Atualiza lista de contatos
              setContacts(prev => {
                const idx = prev.findIndex(c => c.phone === phone || c.chatId === payload.chatId)
                if (idx >= 0) {
                  const updated = [...prev]
                  updated[idx] = {
                    ...updated[idx],
                    lastMessage: payload.text,
                    lastAt: incoming.at,
                    unread: updated[idx].unread + (payload.from !== 'agent' && payload.from !== 'sofi' ? 1 : 0),
                  }
                  return updated
                }
                return [{
                  chatId:      payload.chatId || `${phone}@s.whatsapp.net`,
                  phone,
                  name:        payload.name || phone,
                  lastMessage: payload.text,
                  lastAt:      incoming.at,
                  unread:      1,
                  timestamp:   Math.floor(Date.now() / 1000),
                }, ...prev]
              })
            }
          } catch {}
          evt = ''
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setSseStatus('offline')
    }
  }, [loadContacts])

  // Inicia SSE + carrega estado inicial
  useEffect(() => {
    let dead = false
    const ctrl = new AbortController()
    sseAbort.current = ctrl

    const run = async () => {
      // Estado inicial via REST
      try {
        const st: WaState = await apiFetch('status')
        setWaState(st)
        if (st.ready) loadContacts()
      } catch {}

      // Loop SSE com reconexão
      while (!dead) {
        await connectSSE(ctrl.signal)
        if (!dead) {
          setSseStatus('offline')
          await new Promise(r => setTimeout(r, 5000))
        }
      }
    }

    run()
    return () => { dead = true; ctrl.abort() }
  }, [connectSSE, loadContacts])

  // Auto-carrega mensagens quando troca de contato
  useEffect(() => {
    if (selectedId && waState?.ready) loadMessages(selectedId)
  }, [selectedId, waState?.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll para o final das mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Ações ─────────────────────────────────────────────────────────────────

  const connectWhatsApp = async () => {
    setInitBusy(true)
    try {
      const st: WaState = await apiFetch('start', { method: 'POST', body: '{}' })
      setWaState(st)
    } catch {}
    finally { setInitBusy(false) }
  }

  const sendMessage = async () => {
    const text = composer.trim()
    if (!text || !selected || !waState?.ready) return
    setSending(true)

    const msg: Message = { id: crypto.randomUUID(), from: 'agent', text, at: timeNow() }
    setMessages(prev => [...prev, msg])
    setComposer('')

    try {
      await apiFetch('send', {
        method: 'POST',
        body: JSON.stringify({ chatId: selected.chatId, phone: selected.phone, text }),
      })
    } catch (e) {
      console.error('[WA] send error', e)
    } finally {
      setSending(false)
    }
  }

  const clearAll = () => {
    try { localStorage.clear() } catch {}
    location.reload()
  }

  // ── Filtros ───────────────────────────────────────────────────────────────

  const filtered = contacts.filter(c => {
    const hay = `${c.name} ${c.phone}`.toLowerCase()
    return hay.includes(search.toLowerCase())
  })

  // ── Render ────────────────────────────────────────────────────────────────

  const statusColor = sseStatus === 'live' ? '#0ABD78' : sseStatus === 'connecting' ? '#F8A303' : '#666'
  const statusLabel = sseStatus === 'live' ? '● ao vivo' : sseStatus === 'connecting' ? '○ conectando' : '○ offline'

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] gap-3">

        {/* Header */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-black font-extrabold text-lg"
              style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
              W
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">WhatsApp CRM</h1>
              <span className="text-xs font-bold" style={{ color: statusColor }}>{statusLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status WhatsApp */}
            <div className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
              style={{
                background: waState?.ready ? 'rgba(10,189,120,0.12)' : 'rgba(248,163,3,0.12)',
                color:      waState?.ready ? '#0ABD78' : '#F8A303',
                border:     `1px solid ${waState?.ready ? 'rgba(10,189,120,0.25)' : 'rgba(248,163,3,0.25)'}`,
              }}>
              {waState?.ready ? <CheckCircleIcon className="w-4 h-4" /> : <QrCodeIcon className="w-4 h-4" />}
              {waState?.ready ? 'WhatsApp conectado' : 'Desconectado'}
            </div>

            {/* Conectar */}
            {!waState?.ready && (
              <button onClick={connectWhatsApp} disabled={initBusy}
                className="px-3 py-2 rounded-xl text-xs font-extrabold text-black disabled:opacity-50"
                style={{ background: '#F8A303' }}>
                {initBusy ? <ArrowPathIcon className="w-4 h-4 animate-spin inline" /> : 'Conectar'}
              </button>
            )}

            {/* Recarregar contatos */}
            <button onClick={loadContacts} title="Recarregar contatos"
              className="p-2 rounded-xl text-white/50 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ArrowPathIcon className="w-4 h-4" />
            </button>

            {/* Limpar dados */}
            <button onClick={clearAll} title="Limpar cache e recarregar"
              className="p-2 rounded-xl text-red-400/60 hover:text-red-400"
              style={{ background: 'rgba(255,71,87,0.06)', border: '1px solid rgba(255,71,87,0.12)' }}>
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* QR Code */}
        {waState?.qrDataUrl && (
          <div className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'rgba(248,163,3,0.07)', border: '1px solid rgba(248,163,3,0.18)' }}>
            <img src={waState.qrDataUrl} alt="QR Code" className="w-28 h-28 rounded-xl bg-white p-1" />
            <div>
              <p className="text-sm font-extrabold text-white">Escaneie o QR Code</p>
              <p className="text-xs text-white/50 mt-1">Abra o WhatsApp → Aparelhos conectados → Conectar aparelho</p>
            </div>
          </div>
        )}

        {/* Erro de conexão */}
        {waState?.error && !waState.qrDataUrl && (
          <div className="rounded-2xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(255,71,87,0.07)', border: '1px solid rgba(255,71,87,0.18)' }}>
            <XCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-xs text-red-300">{waState.error}</p>
          </div>
        )}

        {/* Corpo principal: lista + chat */}
        <div className="flex flex-1 gap-3 overflow-hidden min-h-0">

          {/* Lista de contatos */}
          <aside className="w-72 flex flex-col shrink-0 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* Busca */}
            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar contato..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
                />
              </div>
              <p className="text-[10px] text-white/30 mt-2 px-1">{filtered.length} contatos</p>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 && (
                <div className="p-6 text-center">
                  {waState?.ready
                    ? <p className="text-xs text-white/30">Carregando contatos…</p>
                    : <p className="text-xs text-white/30">Conecte o WhatsApp para ver os contatos</p>
                  }
                </div>
              )}

              {filtered.map(contact => (
                <button
                  key={contact.chatId}
                  onClick={() => {
                    setSelectedId(contact.chatId)
                    // Zera não-lidas
                    setContacts(prev => prev.map(c =>
                      c.chatId === contact.chatId ? { ...c, unread: 0 } : c
                    ))
                  }}
                  className="w-full text-left p-3 border-b transition-colors hover:bg-white/[0.03]"
                  style={{
                    background:   selected?.chatId === contact.chatId ? 'rgba(10,189,120,0.09)' : undefined,
                    borderColor:  'rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-extrabold shrink-0"
                      style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                      {(contact.name || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-bold text-white truncate">{contact.name}</p>
                        <span className="text-[10px] text-white/30 shrink-0">{contact.lastAt}</span>
                      </div>
                      <p className="text-xs text-white/40 truncate mt-0.5">{contact.lastMessage || contact.phone}</p>
                      {contact.unread > 0 && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-black"
                          style={{ background: '#0ABD78' }}>{contact.unread}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Área do chat */}
          <div className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>

            {!selected ? (
              /* Estado vazio */
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-white/25">Selecione um contato para ver a conversa</p>
              </div>
            ) : (
              <>
                {/* Header do chat */}
                <div className="px-4 py-3 border-b flex items-center gap-3"
                  style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-black font-extrabold shrink-0"
                    style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                    {(selected.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{selected.name}</p>
                    <p className="text-[11px] text-white/35">{selected.phone}</p>
                  </div>
                  <button
                    onClick={() => loadMessages(selected.chatId)}
                    title="Recarregar mensagens"
                    className="p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <ArrowPathIcon className={`w-4 h-4 ${loadingMsgs ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {loadingMsgs && (
                    <div className="text-center py-8">
                      <ArrowPathIcon className="w-5 h-5 animate-spin text-white/30 mx-auto" />
                    </div>
                  )}

                  {!loadingMsgs && messages.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-xs text-white/25">Sem histórico armazenado</p>
                      <p className="text-[10px] text-white/15 mt-1">Novas mensagens aparecerão aqui em tempo real</p>
                    </div>
                  )}

                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.from === 'lead' ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className="max-w-[75%] rounded-2xl px-4 py-2.5"
                        style={{
                          background:
                            msg.from === 'lead'  ? 'rgba(255,255,255,0.08)' :
                            msg.from === 'sofi'  ? 'rgba(248,163,3,0.15)'  :
                                                   'rgba(10,189,120,0.18)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        {msg.from === 'sofi' && (
                          <p className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest mb-1">Sofi IA</p>
                        )}
                        <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <p className="text-[10px] text-white/25 mt-1 text-right">{msg.at}</p>
                      </div>
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  {!waState?.ready && (
                    <p className="text-xs text-amber-400/70 mb-2 text-center">
                      WhatsApp desconectado — mensagem não será enviada
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={composer}
                      onChange={e => setComposer(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      placeholder="Digite uma mensagem…"
                      className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }}
                      disabled={sending}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!composer.trim() || sending}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-black disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                      {sending
                        ? <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        : <PaperAirplaneIcon className="w-5 h-5" />
                      }
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
