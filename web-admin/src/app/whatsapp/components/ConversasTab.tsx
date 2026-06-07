'use client'

import { useRef, useEffect, useState } from 'react'
import {
  ArrowPathIcon, MagnifyingGlassIcon, TrashIcon, SparklesIcon,
  ArchiveBoxIcon, ArchiveBoxArrowDownIcon, PaperAirplaneIcon,
  LockClosedIcon, BookmarkIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import type {
  Contact, Message, Stage, ContactLabel, QuickReply,
  InternalNote, WaState,
} from '../types'
import { LABELS, STAGES, STAGE_COLORS } from '../types'
import {
  apiFetch, fmtTs, loadQuickReplies, saveQuickReplies,
  sortMessagesChronologically, mapMessageItem, now2, saveNotes,
  loadNotes,
} from '../utils'

interface ConversasTabProps {
  selected: Contact | null
  selectedId: string
  setSelectedId: (id: string) => void
  contacts: Contact[]
  setContacts: (c: Contact[] | ((prev: Contact[]) => Contact[])) => void
  messages: Message[]
  setMessages: (m: Message[] | ((prev: Message[]) => Message[])) => void
  loadMessages: (chatId: string) => void
  loadingMsgs: boolean
  sending: boolean
  composer: string
  setComposer: (text: string) => void
  waState: WaState | null
  stages: Record<string, Stage>
  archivedChats: Set<string>
  labelsByPhone: Record<string, ContactLabel[]>
  internalNotes: InternalNote[]
  setInternalNotes: (notes: InternalNote[] | ((prev: InternalNote[]) => InternalNote[])) => void
  contactsFetching: boolean
  syncingContacts: boolean
  setSyncingContacts: (b: boolean) => void
  search: string
  setSearch: (s: string) => void
  hideUnnamed: boolean
  setHideUnnamed: (b: boolean) => void
  showArchived: boolean
  setShowArchived: (b: boolean) => void
  labelFilter: ContactLabel | 'all'
  setLabelFilter: (l: ContactLabel | 'all') => void
  filteredContacts: Contact[]
  namedCount: number
  unnamedCount: number
  persistStage: (phone: string, stage: Stage) => void
  archiveCurrentChat: (chatId: string, archive: boolean) => void
  toggleLabel: (phone: string, label: ContactLabel) => void
  sendMessage: () => void
  deleteMsg: (msgId: string, fromMe: boolean) => void
  suggestAiReply: (baseText?: string) => void
  setChatHandoff: (paused: boolean) => void
  hasRealName: (c: Contact) => boolean
  aiSuggesting: boolean
}

export function ConversasTab(props: ConversasTabProps) {
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [qrDropdown, setQrDropdown] = useState(false)
  const [qrFilter, setQrFilter] = useState('')
  const [showQrManager, setShowQrManager] = useState(false)
  const [newQrTitle, setNewQrTitle] = useState('')
  const [newQrText, setNewQrText] = useState('')
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    setQuickReplies(loadQuickReplies())
    props.setInternalNotes(loadNotes())
  }, [])

  const scrollMessagesToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (!messagesScrollRef.current) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesScrollRef.current?.scrollTo({ top: messagesScrollRef.current.scrollHeight, behavior })
      })
    })
  }

  useEffect(() => {
    scrollMessagesToBottom('auto')
  }, [props.messages, props.selectedId])

  const addNote = () => {
    const text = props.composer.trim()
    if (!text || !props.selected) return
    const note: InternalNote = {
      id: crypto.randomUUID(),
      chatId: props.selected.chatId,
      text,
      at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    const updated = [...props.internalNotes, note]
    props.setInternalNotes(updated)
    saveNotes(updated)
    props.setComposer('')
  }

  const addQuickReply = () => {
    if (!newQrTitle.trim() || !newQrText.trim()) return
    const updated = [...quickReplies, { id: crypto.randomUUID(), title: newQrTitle.trim(), text: newQrText.trim() }]
    setQuickReplies(updated)
    saveQuickReplies(updated)
    setNewQrTitle('')
    setNewQrText('')
  }

  const deleteQuickReply = (id: string) => {
    const updated = quickReplies.filter(r => r.id !== id)
    setQuickReplies(updated)
    saveQuickReplies(updated)
  }

  const applyQuickReply = (text: string) => {
    props.setComposer(text)
    setQrDropdown(false)
    setQrFilter('')
  }

  const currentNotes = props.selected ? props.internalNotes.filter(n => n.chatId === props.selected.chatId) : []

  return (
    <div className="flex flex-1 gap-2 overflow-hidden min-h-0">
      {/* Sidebar — Lista de contatos */}
      <aside
        className={`flex flex-col shrink-0 rounded-2xl overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-72' : 'w-0 opacity-0 pointer-events-none'}`}
        style={{
          background: 'rgba(255,255,255,0.035)',
          border: sidebarOpen ? '1px solid rgba(255,255,255,0.07)' : 'none',
        }}
      >
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={props.search}
              onChange={e => props.setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 px-1 gap-2 flex-wrap">
            <p className="text-[10px] text-white/30">
              {props.filteredContacts.length} de {props.namedCount + props.unnamedCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => props.setHideUnnamed(!props.hideUnnamed)}
                className="flex items-center gap-1 text-[10px] font-bold transition-colors"
                style={{ color: props.hideUnnamed ? '#F8A303' : 'rgba(255,255,255,0.3)' }}
              >
                {props.hideUnnamed ? `👤 +${props.unnamedCount} s/ nome` : '👤 Ocultar s/ nome'}
              </button>
              <button
                onClick={() => props.setShowArchived(!props.showArchived)}
                className="flex items-center gap-1 text-[10px] font-bold transition-colors"
                style={{ color: props.showArchived ? '#0ABD78' : 'rgba(255,255,255,0.3)' }}
              >
                <ArchiveBoxIcon className="w-3.5 h-3.5" />
                {props.showArchived ? 'Ativos' : `Arq (${props.archivedChats.size})`}
              </button>
            </div>
          </div>

          <div className="mt-2">
            <select
              value={props.labelFilter}
              onChange={e => props.setLabelFilter(e.target.value as ContactLabel | 'all')}
              className="w-full text-[11px] rounded-xl px-2 py-1.5 outline-none font-bold text-white/70"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <option value="all">Todos os selos</option>
              {LABELS.map(lb => (
                <option key={lb} value={lb}>
                  {lb}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {props.filteredContacts.length === 0 && (
            <div className="p-6 text-center">
              {!props.waState?.ready ? (
                <p className="text-xs text-white/30">Conecte o WhatsApp primeiro</p>
              ) : props.contactsFetching ? (
                <div className="flex flex-col items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-white/30" />
                  <p className="text-xs text-white/30">Buscando conversas…</p>
                </div>
              ) : props.contacts.length === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-white/40">Nenhuma conversa carregada ainda.</p>
                  <button
                    onClick={async () => {
                      props.setSyncingContacts(true)
                      try {
                        await apiFetch('contacts-sync', { method: 'POST', body: '{}' })
                        // loadContacts() será chamado pelo pai
                      } finally {
                        props.setSyncingContacts(false)
                      }
                    }}
                    disabled={props.syncingContacts}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-2 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}
                  >
                    {props.syncingContacts ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="w-4 h-4" />
                    )}
                    {props.syncingContacts ? 'Sincronizando...' : 'Sincronizar conversas'}
                  </button>
                  <p className="text-[10px] text-white/20">Carrega todos os chats do celular</p>
                </div>
              ) : props.hideUnnamed ? (
                <p className="text-xs text-white/30">{`Nenhum contato com nome (${props.unnamedCount} ocultos)`}</p>
              ) : (
                <p className="text-xs text-white/30">Nenhuma conversa encontrada</p>
              )}
            </div>
          )}

          {props.filteredContacts.map(c => (
            <button
              key={c.chatId}
              onClick={() => {
                props.setSelectedId(c.chatId)
                props.setContacts(prev =>
                  prev.map(x => (x.chatId === c.chatId ? { ...x, unread: 0 } : x))
                )
              }}
              className="w-full text-left p-3 border-b transition-colors hover:bg-white/[0.03]"
              style={{
                background: props.selected?.chatId === c.chatId ? 'rgba(10,189,120,0.09)' : undefined,
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-3">
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl.startsWith('/wa-avatar/') ? `/api/v1${c.avatarUrl}` : c.avatarUrl}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    style={{ border: `2px solid ${STAGE_COLORS[props.stages[c.phone] || 'Inbox']}` }}
                    onError={e => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold shrink-0 text-sm text-white"
                    style={{
                      background: `linear-gradient(135deg, ${STAGE_COLORS[props.stages[c.phone] || 'Inbox']}aa, ${STAGE_COLORS[props.stages[c.phone] || 'Inbox']}55)`,
                      border: `2px solid ${STAGE_COLORS[props.stages[c.phone] || 'Inbox']}`,
                    }}
                  >
                    {(c.name || c.phone || '?').charAt(0).toUpperCase()}
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
                  {c.unread > 0 && (
                    <span
                      className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold text-black"
                      style={{ background: '#0ABD78' }}
                    >
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat — Painel principal */}
      <div
        className="flex-1 flex flex-col min-w-0 min-h-0 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {!props.selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {sidebarOpen ? '← Ocultar lista' : '→ Ver contatos'}
            </button>
            <p className="text-sm text-white/25">Selecione um contato</p>
          </div>
        ) : (
          <>
            {/* Header chat */}
            <div
              className="px-4 py-3 border-b flex items-center gap-3 shrink-0 flex-wrap"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white/40 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                title={sidebarOpen ? 'Ocultar lista' : 'Mostrar lista'}
              >
                {sidebarOpen ? '◀' : '▶'}
              </button>

              {props.selected.avatarUrl ? (
                <img
                  src={props.selected.avatarUrl.startsWith('/wa-avatar/') ? `/api/v1${props.selected.avatarUrl}` : props.selected.avatarUrl}
                  alt={props.selected.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                  onError={e => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold shrink-0 text-white"
                  style={{
                    background: `linear-gradient(135deg,${STAGE_COLORS[props.stages[props.selected.phone] || 'Inbox']},${STAGE_COLORS[props.stages[props.selected.phone] || 'Inbox']}88)`,
                  }}
                >
                  {(props.selected.name || '?').charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white">{props.selected.name}</p>
                <p className="text-[11px] text-white/35">
                  {props.selected.isGroup
                    ? `Grupo · ${props.selected.phone.replace('@g.us', '').replace(/(\d{10,})/, '+$1')}`
                    : `+${props.selected.phone}`}
                </p>
              </div>

              <select
                value={props.stages[props.selected.phone] || 'Inbox'}
                onChange={e => props.persistStage(props.selected!.phone, e.target.value as Stage)}
                className="text-xs rounded-lg px-2 py-1 outline-none font-bold"
                style={{
                  background: `${STAGE_COLORS[props.stages[props.selected.phone] || 'Inbox']}20`,
                  color: STAGE_COLORS[props.stages[props.selected.phone] || 'Inbox'],
                  border: `1px solid ${STAGE_COLORS[props.stages[props.selected.phone] || 'Inbox']}40`,
                }}
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button
                onClick={() => props.persistStage(props.selected!.phone, 'Hoje')}
                className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                style={{
                  background: 'rgba(14,165,233,0.12)',
                  color: '#0EA5E9',
                  border: '1px solid rgba(14,165,233,0.25)',
                }}
              >
                Kanban
              </button>

              <button
                onClick={() => props.setChatHandoff(false)}
                className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                style={{
                  background: 'rgba(248,163,3,0.12)',
                  color: '#F8A303',
                  border: '1px solid rgba(248,163,3,0.25)',
                }}
              >
                IA ativa
              </button>

              <button
                onClick={() => props.setChatHandoff(true)}
                className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  color: '#EF4444',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                Pausar IA
              </button>

              <button
                onClick={() => props.archiveCurrentChat(props.selected!.chatId, !props.archivedChats.has(props.selected!.chatId))}
                className="p-2 rounded-xl transition-colors"
                style={{
                  background: props.archivedChats.has(props.selected.chatId)
                    ? 'rgba(10,189,120,0.12)'
                    : 'rgba(255,255,255,0.05)',
                  color: props.archivedChats.has(props.selected.chatId)
                    ? '#0ABD78'
                    : 'rgba(255,255,255,0.4)',
                }}
              >
                <ArchiveBoxArrowDownIcon className="w-4 h-4" />
              </button>

              <button
                onClick={() => props.loadMessages(props.selected!.chatId)}
                className="p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <ArrowPathIcon className={`w-4 h-4 ${props.loadingMsgs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Labels */}
            <div className="px-4 pt-2 flex items-center gap-1.5 flex-wrap">
              {LABELS.map(lb => {
                const active = (props.labelsByPhone[props.selected!.phone] || []).includes(lb)
                return (
                  <button
                    key={lb}
                    onClick={() => props.toggleLabel(props.selected!.phone, lb)}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold"
                    style={{
                      background: active ? 'rgba(248,163,3,0.16)' : 'rgba(255,255,255,0.05)',
                      color: active ? '#F8A303' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${active ? 'rgba(248,163,3,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {lb}
                  </button>
                )
              })}
            </div>

            {/* Mensagens */}
            <div
              ref={messagesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2"
            >
              {props.loadingMsgs && (
                <div className="text-center py-8">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-white/30 mx-auto" />
                </div>
              )}
              {!props.loadingMsgs && props.messages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-xs text-white/25">Sem histórico armazenado</p>
                  <p className="text-[10px] text-white/15 mt-1">Novas mensagens aparecerão aqui em tempo real</p>
                </div>
              )}
              {props.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`group/msg flex items-end gap-1.5 ${msg.from === 'lead' ? 'justify-start' : 'justify-end'}`}
                >
                  {msg.from !== 'lead' && (
                    <button
                      onClick={() => props.deleteMsg(msg.id, msg.from !== 'lead')}
                      className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg shrink-0"
                      style={{ color: 'rgba(239,68,68,0.5)' }}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div
                    className="max-w-[75%] rounded-2xl px-4 py-2.5"
                    style={{
                      background:
                        msg.from === 'lead'
                          ? 'rgba(255,255,255,0.08)'
                          : msg.from === 'sofi'
                            ? 'rgba(248,163,3,0.15)'
                            : 'rgba(10,189,120,0.18)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {msg.from === 'sofi' && (
                      <p className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest mb-1">
                        Sofi IA
                      </p>
                    )}
                    <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-white/25">{msg.at}</span>
                      {msg.from !== 'lead' && (
                        <span
                          className="text-[11px]"
                          style={{
                            color:
                              msg.ack === 3
                                ? '#34B7F1'
                                : msg.ack === 2
                                  ? 'rgba(255,255,255,0.5)'
                                  : 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {msg.ack === 1 ? '✓' : msg.ack === 2 ? '✓✓' : msg.ack === 3 ? '✓✓' : '🕐'}
                        </span>
                      )}
                    </div>
                  </div>

                  {msg.from === 'lead' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => props.suggestAiReply(msg.text)}
                        className="p-1 rounded-lg"
                        style={{
                          color: '#F8A303',
                          background: 'rgba(248,163,3,0.10)',
                        }}
                      >
                        <SparklesIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => props.deleteMsg(msg.id, false)}
                        className="p-1 rounded-lg"
                        style={{ color: 'rgba(239,68,68,0.5)' }}
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Notas internas */}
            {currentNotes.length > 0 && (
              <div className="px-4 pb-2 space-y-1">
                {currentNotes.map(n => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2 p-2 rounded-xl text-xs"
                    style={{
                      background: 'rgba(248,163,3,0.07)',
                      border: '1px solid rgba(248,163,3,0.15)',
                    }}
                  >
                    <LockClosedIcon className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-amber-200/70 flex-1 whitespace-pre-wrap">{n.text}</span>
                    <span className="text-white/20 shrink-0">{n.at}</span>
                    <button
                      onClick={() => {
                        const upd = props.internalNotes.filter(x => x.id !== n.id)
                        props.setInternalNotes(upd)
                        saveNotes(upd)
                      }}
                      className="shrink-0 text-red-400/40 hover:text-red-400/80"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Composer */}
            <div className="p-3 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              {!props.waState?.ready && !noteMode && (
                <p className="text-xs text-amber-400/70 mb-2 text-center">WhatsApp desconectado</p>
              )}

              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setNoteMode(false)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all"
                  style={{
                    background: !noteMode ? 'rgba(10,189,120,0.18)' : 'rgba(255,255,255,0.05)',
                    color: !noteMode ? '#0ABD78' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <PaperAirplaneIcon className="w-3 h-3 inline mr-1" />
                  Mensagem
                </button>
                <button
                  onClick={() => setNoteMode(true)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all"
                  style={{
                    background: noteMode ? 'rgba(248,163,3,0.18)' : 'rgba(255,255,255,0.05)',
                    color: noteMode ? '#F8A303' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <LockClosedIcon className="w-3 h-3 inline mr-1" />
                  Nota Interna
                </button>
                <button
                  onClick={() => setShowQrManager(v => !v)}
                  className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  <BookmarkIcon className="w-3 h-3 inline mr-1" />
                  Respostas Rápidas
                </button>
              </div>

              {qrDropdown && (
                <div className="mb-2 rounded-xl overflow-hidden"
                  style={{
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}>
                  <input
                    value={qrFilter}
                    onChange={e => setQrFilter(e.target.value)}
                    autoFocus
                    placeholder="Buscar resposta..."
                    className="w-full px-3 py-2 text-xs text-white outline-none bg-transparent border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                  />
                  {quickReplies
                    .filter(
                      r =>
                        !qrFilter ||
                        r.title.toLowerCase().includes(qrFilter.toLowerCase()) ||
                        r.text.toLowerCase().includes(qrFilter.toLowerCase())
                    )
                    .map(r => (
                      <button
                        key={r.id}
                        onClick={() => applyQuickReply(r.text)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] border-b transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                      >
                        <p className="font-bold text-white/80">/{r.title}</p>
                        <p className="text-white/40 truncate mt-0.5">{r.text}</p>
                      </button>
                    ))}
                  {quickReplies.length === 0 && (
                    <p className="px-3 py-2 text-xs text-white/30">Nenhuma resposta salva. Crie abaixo.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => props.suggestAiReply()}
                  disabled={!props.selected || props.aiSuggesting || noteMode}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center disabled:opacity-30 shrink-0"
                  style={{
                    background: 'rgba(248,163,3,0.12)',
                    color: '#F8A303',
                    border: '1px solid rgba(248,163,3,0.25)',
                  }}
                >
                  {props.aiSuggesting ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => setQrDropdown(v => !v)}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-xs font-extrabold"
                  style={{
                    background: qrDropdown ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                    color: qrDropdown ? '#818cf8' : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${qrDropdown ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  /
                </button>

                <input
                  value={props.composer}
                  onChange={e => {
                    const v = e.target.value
                    props.setComposer(v)
                    if (v.startsWith('/') && !noteMode) setQrDropdown(true)
                    else setQrDropdown(false)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      noteMode ? addNote() : props.sendMessage()
                    }
                    if (e.key === 'Escape') setQrDropdown(false)
                  }}
                  placeholder={
                    noteMode
                      ? '📝 Nota interna (só você vê)…'
                      : 'Digite uma mensagem… (/ para respostas rápidas)'
                  }
                  disabled={props.sending}
                  className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none"
                  style={{
                    background: noteMode ? 'rgba(248,163,3,0.06)' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${noteMode ? 'rgba(248,163,3,0.2)' : 'rgba(255,255,255,0.09)'}`,
                  }}
                />

                <button
                  onClick={noteMode ? addNote : props.sendMessage}
                  disabled={!props.composer.trim() || (!noteMode && props.sending)}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-black disabled:opacity-40 shrink-0"
                  style={{
                    background: noteMode
                      ? 'linear-gradient(135deg,#F8A303,#fb923c)'
                      : 'linear-gradient(135deg,#0ABD78,#34D399)',
                  }}
                >
                  {props.sending && !noteMode ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : noteMode ? (
                    <LockClosedIcon className="w-4 h-4" />
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Gerenciador de Respostas Rápidas */}
            {showQrManager && (
              <div
                className="border-t p-3 space-y-2 shrink-0"
                style={{
                  borderColor: 'rgba(255,255,255,0.07)',
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                <p className="text-xs font-extrabold text-white/50 uppercase tracking-widest">
                  Respostas Rápidas
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {quickReplies.map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <span className="text-indigo-400 font-bold shrink-0">/{r.title}</span>
                      <span className="text-white/40 flex-1 truncate">{r.text}</span>
                      <button
                        onClick={() => applyQuickReply(r.text)}
                        className="text-green-400/70 hover:text-green-400 shrink-0"
                      >
                        ▶
                      </button>
                      <button
                        onClick={() => deleteQuickReply(r.id)}
                        className="text-red-400/40 hover:text-red-400 shrink-0"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {quickReplies.length === 0 && (
                    <p className="text-white/25 text-xs">Nenhuma resposta salva ainda.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newQrTitle}
                    onChange={e => setNewQrTitle(e.target.value)}
                    placeholder="Título (ex: saudacao)"
                    className="w-28 px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  <input
                    value={newQrText}
                    onChange={e => setNewQrText(e.target.value)}
                    placeholder="Texto da resposta…"
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs text-white outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  <button
                    onClick={addQuickReply}
                    disabled={!newQrTitle.trim() || !newQrText.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
