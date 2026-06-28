'use client'
import { useEffect, useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  phoneNumber: string
  contactName: string | null
  stage: string
  score: number
  lastMessageAt: string | null
  lastMessageText: string | null
  isGroup: boolean
  labels: { labelType: string }[]
}

interface Message {
  id: string
  content: string
  contentType: string
  timestamp: string
  fromPhone: string
  ackStatus: number
  generatedByAI: boolean
}

interface Conversation {
  id: string
  leadId: string
  lastMessageAt: string | null
  messageCount: number
  lead: { id: string; phoneNumber: string; contactName: string | null; stage: string }
  messages: Message[]
}

interface Analytics {
  totalLeads: number
  totalMessages: number
  messagesLast7Days: number
  byStage: { stage: string; count: number }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Conversas', 'Leads', 'Bot', 'Analytics'] as const
type Tab = typeof TABS[number]

const STAGE_LABELS: Record<string, string> = {
  inbox: 'Caixa de Entrada',
  interested: 'Interessado',
  negotiation: 'Negociação',
  enrolled: 'Matriculado',
  lost: 'Perdido'
}

const STAGE_COLORS: Record<string, string> = {
  inbox: '#4A9EFF',
  interested: '#F8A303',
  negotiation: '#8B5CF6',
  enrolled: '#0ABD78',
  lost: '#FF4757'
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [tab, setTab] = useState<Tab>('Conversas')
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'qr' | 'connected'>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  // ─── SSE connection ─────────────────────────────────────────────────────

  const connectSSE = () => {
    if (sseRef.current) sseRef.current.close()

    const token = document.cookie.match(/(?:^|; )accessToken=([^;]+)/)?.[1] || ''
    // EventSource não suporta headers — token via query param, proxiado para backend
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000/api')
      .replace(/\/$/, '')
    const es = new EventSource(`${backendUrl}/whatsapp/events?token=${encodeURIComponent(token)}`)
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data)
        if (event === 'status') setWaStatus(data.status)
        if (event === 'qr') setQrCode(data.qr)
      } catch {}
    }

    es.onerror = () => {
      setTimeout(connectSSE, 5000)
    }
  }

  useEffect(() => {
    // Load initial status
    api.get('/whatsapp/status').then(r => {
      setWaStatus(r.data.status)
      if (r.data.qr) setQrCode(r.data.qr)
    }).catch(() => {})

    connectSSE()
    return () => sseRef.current?.close()
  }, [])

  // ─── Connect WhatsApp ────────────────────────────────────────────────────

  const handleConnect = async () => {
    setWaStatus('connecting')
    await api.post('/whatsapp/connect').catch(() => {})
  }

  const handleDisconnect = async () => {
    await api.post('/whatsapp/disconnect').catch(() => {})
    setWaStatus('disconnected')
    setQrCode(null)
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>WhatsApp CRM</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Gestão de leads via WhatsApp</p>
            </div>
          </div>

          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: waStatus === 'connected' ? '#0ABD78' : waStatus === 'qr' || waStatus === 'connecting' ? '#F8A303' : '#FF4757',
              boxShadow: waStatus === 'connected' ? '0 0 6px #0ABD78' : undefined
            }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {waStatus === 'connected' ? 'Conectado' : waStatus === 'qr' ? 'Aguardando QR' : waStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
            </span>
            {waStatus === 'disconnected' && (
              <button onClick={handleConnect} style={{
                background: '#0ABD78', border: 'none', borderRadius: 6, padding: '4px 12px',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>Conectar</button>
            )}
            {waStatus === 'connected' && (
              <button onClick={handleDisconnect} style={{
                background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.3)',
                borderRadius: 6, padding: '4px 12px', color: '#FF4757', fontSize: 12, cursor: 'pointer'
              }}>Desconectar</button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div style={{
            background: 'rgba(248,163,3,0.08)', border: '1px solid rgba(248,163,3,0.2)',
            margin: '12px 24px', borderRadius: 12, padding: '16px',
            display: 'flex', alignItems: 'center', gap: 16
          }}>
            <img src={qrCode} alt="QR Code" style={{ width: 160, height: 160, borderRadius: 8, background: '#fff', padding: 4 }} />
            <div>
              <p style={{ color: '#F8A303', fontWeight: 600, margin: '0 0 4px' }}>Escaneie o QR Code</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
                Abra o WhatsApp no celular → Menu → Aparelhos conectados → Conectar aparelho
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: tab === t ? '#4A9EFF' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s'
            }}>{t}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {tab === 'Conversas' && <ConversasTab waConnected={waStatus === 'connected'} />}
          {tab === 'Leads' && <LeadsTab />}
          {tab === 'Bot' && <BotTab />}
          {tab === 'Analytics' && <AnalyticsTab />}
        </div>
      </div>
    </AdminLayout>
  )
}

// ─── Conversas Tab ────────────────────────────────────────────────────────────

function ConversasTab({ waConnected }: { waConnected: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadConversations = async () => {
    try {
      const r = await api.get('/whatsapp/conversations?limit=50')
      setConversations(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConversations() }, [])

  const openConversation = async (conv: Conversation) => {
    setActive(conv)
    const r = await api.get(`/whatsapp/conversations/${conv.id}/messages?limit=50`)
    setMessages(r.data)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const sendMessage = async () => {
    if (!text.trim() || !active || !waConnected) return
    setSending(true)
    try {
      await api.post(`/whatsapp/messages/reply/${active.id}`, { text: text.trim() })
      const newMsg: Message = {
        id: `tmp-${Date.now()}`,
        content: text.trim(),
        contentType: 'text',
        timestamp: new Date().toISOString(),
        fromPhone: 'me',
        ackStatus: 1,
        generatedByAI: false
      }
      setMessages(prev => [...prev, newMsg])
      setText('')
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar lista de conversas */}
      <div style={{
        width: 280, borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto', flexShrink: 0
      }}>
        {loading && (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>
            Carregando...
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>
            Nenhuma conversa ainda
          </div>
        )}
        {conversations.map(c => (
          <div
            key={c.id}
            onClick={() => openConversation(c)}
            style={{
              padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: active?.id === c.id ? 'rgba(74,158,255,0.08)' : 'transparent',
              transition: 'background 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.lead.contactName || c.lead.phoneNumber}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{timeAgo(c.lastMessageAt)}</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.messages?.[0]?.content || 'Sem mensagens'}
            </p>
          </div>
        ))}
      </div>

      {/* Área de chat */}
      {!active ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 48 }}>💬</span>
          <span style={{ fontSize: 14 }}>Selecione uma conversa</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat header */}
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4A9EFF, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#fff', fontWeight: 700
            }}>
              {(active.lead.contactName || active.lead.phoneNumber)[0].toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#fff', fontSize: 14 }}>
                {active.lead.contactName || active.lead.phoneNumber}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {active.lead.phoneNumber} · {STAGE_LABELS[active.lead.stage] || active.lead.stage}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(msg => {
              const isMe = msg.fromPhone === 'me'
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '65%', padding: '8px 12px', borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: isMe ? 'linear-gradient(135deg, #0ABD78, #059669)' : 'rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 13, lineHeight: 1.4
                  }}>
                    {msg.content}
                    <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', marginTop: 3, textAlign: 'right' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {msg.generatedByAI && ' 🤖'}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: 8, alignItems: 'flex-end'
          }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={waConnected ? 'Digite uma mensagem... (Enter para enviar)' : 'WhatsApp desconectado'}
              disabled={!waConnected || sending}
              rows={2}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13,
                resize: 'none', outline: 'none', fontFamily: 'inherit'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim() || !waConnected || sending}
              style={{
                background: text.trim() && waConnected ? '#0ABD78' : 'rgba(255,255,255,0.08)',
                border: 'none', borderRadius: 10, padding: '10px 16px', cursor: text.trim() && waConnected ? 'pointer' : 'not-allowed',
                color: '#fff', fontSize: 18, transition: 'all 0.15s'
              }}
            >
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Leads Tab ────────────────────────────────────────────────────────────────

function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [editStage, setEditStage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (stageFilter) params.set('stage', stageFilter)
      const r = await api.get(`/whatsapp/leads?${params}&limit=100`)
      setLeads(r.data.leads)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, stageFilter])

  const updateStage = async () => {
    if (!selected || !editStage) return
    await api.patch(`/whatsapp/leads/${selected.id}`, { stage: editStage })
    setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, stage: editStage } : l))
    setSelected(null)
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none'
          }}
        />
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none'
          }}
        >
          <option value="">Todos os estágios</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Carregando...</p>}

      {/* Leads grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {leads.map(lead => (
          <div
            key={lead.id}
            onClick={() => { setSelected(lead); setEditStage(lead.stage) }}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#fff', fontSize: 14 }}>
                  {lead.contactName || lead.phoneNumber}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{lead.phoneNumber}</p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: `${STAGE_COLORS[lead.stage]}20`,
                color: STAGE_COLORS[lead.stage] || '#fff',
                border: `1px solid ${STAGE_COLORS[lead.stage]}30`
              }}>
                {STAGE_LABELS[lead.stage] || lead.stage}
              </span>
            </div>
            {lead.lastMessageText && (
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.lastMessageText}
              </p>
            )}
            <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
              {lead.labels?.map(l => (
                <span key={l.labelType} style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                  background: 'rgba(74,158,255,0.15)', color: '#4A9EFF'
                }}>{l.labelType}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#0f1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, width: 360
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: 16 }}>Editar Lead</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 16px' }}>
              {selected.contactName || selected.phoneNumber}
            </p>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Estágio</label>
            <select
              value={editStage}
              onChange={e => setEditStage(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none', marginBottom: 16
              }}
            >
              {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={updateStage} style={{
                flex: 1, background: '#4A9EFF', border: 'none', borderRadius: 8, padding: '10px',
                color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13
              }}>Salvar</button>
              <button onClick={() => setSelected(null)} style={{
                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '10px', color: '#fff', cursor: 'pointer', fontSize: 13
              }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bot Tab ──────────────────────────────────────────────────────────────────

function BotTab() {
  const [rules, setRules] = useState<any[]>([])
  const [trigger, setTrigger] = useState('')
  const [response, setResponse] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/whatsapp/bot/rules').then(r => setRules(r.data)).catch(() => {})
  }, [])

  const addRule = async () => {
    if (!trigger.trim() || !response.trim()) return
    setSaving(true)
    try {
      const r = await api.post('/whatsapp/bot/rules', { trigger: trigger.trim(), response: response.trim() })
      setRules(prev => [...prev, r.data])
      setTrigger('')
      setResponse('')
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (rule: any) => {
    const updated = await api.patch(`/whatsapp/bot/rules/${rule.id}`, { isActive: !rule.isActive })
    setRules(prev => prev.map(r => r.id === rule.id ? updated.data : r))
  }

  const deleteRule = async (id: string) => {
    await api.delete(`/whatsapp/bot/rules/${id}`)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', maxWidth: 700 }}>
      <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Regras do Bot Automático</h2>

      {/* Add rule */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: 20, marginBottom: 24
      }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 12px' }}>
          Quando a mensagem contiver a palavra-chave, o bot responde automaticamente.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder="Palavra-chave (ex: preço)"
            style={{
              flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none'
            }}
          />
          <input
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="Resposta automática"
            style={{
              flex: 2, minWidth: 200, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none'
            }}
          />
          <button
            onClick={addRule}
            disabled={!trigger.trim() || !response.trim() || saving}
            style={{
              background: '#0ABD78', border: 'none', borderRadius: 8, padding: '8px 20px',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13
            }}
          >
            {saving ? '...' : '+ Adicionar'}
          </button>
        </div>
      </div>

      {/* Rules list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map(rule => (
          <div key={rule.id} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(74,158,255,0.15)', color: '#4A9EFF', marginRight: 8
              }}>{rule.trigger}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{rule.response}</span>
            </div>
            <button onClick={() => toggleRule(rule)} style={{
              background: rule.isActive ? 'rgba(10,189,120,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${rule.isActive ? 'rgba(10,189,120,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 20, padding: '3px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              color: rule.isActive ? '#0ABD78' : 'rgba(255,255,255,0.4)'
            }}>{rule.isActive ? 'Ativo' : 'Inativo'}</button>
            <button onClick={() => deleteRule(rule.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,71,87,0.6)', fontSize: 16
            }}>✕</button>
          </div>
        ))}
        {rules.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontSize: 13 }}>
            Nenhuma regra cadastrada ainda
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data, setData] = useState<Analytics | null>(null)

  useEffect(() => {
    api.get('/whatsapp/analytics').then(r => setData(r.data)).catch(() => {})
  }, [])

  if (!data) return <div style={{ padding: 24, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Carregando...</div>

  const cards = [
    { label: 'Total de Leads', value: data.totalLeads, icon: '👥', color: '#4A9EFF' },
    { label: 'Total de Mensagens', value: data.totalMessages, icon: '💬', color: '#0ABD78' },
    { label: 'Mensagens (7 dias)', value: data.messagesLast7Days, icon: '📊', color: '#F8A303' }
  ]

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: `${c.color}10`, border: `1px solid ${c.color}25`,
            borderRadius: 12, padding: 20
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value.toLocaleString('pt-BR')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* By stage */}
      <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Leads por Estágio</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500 }}>
        {data.byStage.map(s => {
          const total = data.totalLeads || 1
          const pct = Math.round((s.count / total) * 100)
          const color = STAGE_COLORS[s.stage] || '#fff'
          return (
            <div key={s.stage}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{STAGE_LABELS[s.stage] || s.stage}</span>
                <span style={{ fontSize: 13, color, fontWeight: 600 }}>{s.count} ({pct}%)</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
