'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PaperAirplaneIcon,
  PlusIcon,
  QrCodeIcon,
  SparklesIcon,
  TagIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type StageId = 'novo' | 'contato' | 'interessado' | 'agendado' | 'convertido'
type TabId = 'inbox' | 'kanban' | 'campanhas' | 'contatos' | 'agente'

interface WaContact {
  id: string
  name: string
  phone: string
  unit: string
  tags: string[]
  stage: StageId
  score: number
  lastMessage: string
  lastAt: string
  unread: number
  consent: boolean
}

interface WaMessage {
  id: string
  contactId: string
  from: 'lead' | 'agent' | 'sofi'
  text: string
  at: string
}

interface Campaign {
  id: string
  name: string
  segment: string
  status: 'rascunho' | 'programada' | 'ativa'
  recipients: number
  template: string
}

const STORAGE_KEY = 'aps_edu_whatsapp_crm_v1'

const stages: { id: StageId; label: string; color: string }[] = [
  { id: 'novo', label: 'Novo', color: '#4A9EFF' },
  { id: 'contato', label: 'Tentativa', color: '#F8A303' },
  { id: 'interessado', label: 'Interessado', color: '#A78BFA' },
  { id: 'agendado', label: 'Agendado', color: '#0ABD78' },
  { id: 'convertido', label: 'Convertido', color: '#34D399' },
]

const seedContacts: WaContact[] = [
  {
    id: 'c1',
    name: 'Tatiane Alvarenga',
    phone: '5511979861056',
    unit: 'Call Center',
    tags: ['retorno', 'matrícula', 'família'],
    stage: 'interessado',
    score: 92,
    lastMessage: 'Ele está se adaptando bem. Obrigada pelo retorno.',
    lastAt: '10:42',
    unread: 2,
    consent: true,
  },
  {
    id: 'c2',
    name: 'Pamela Souza',
    phone: '551121281010',
    unit: 'Educação Infantil',
    tags: ['potencial', 'tour 360'],
    stage: 'contato',
    score: 74,
    lastMessage: 'Gostaria de receber valores e horários.',
    lastAt: '09:18',
    unread: 0,
    consent: true,
  },
  {
    id: 'c3',
    name: 'Joelma Martins',
    phone: '551195875657',
    unit: 'Ensino Fundamental',
    tags: ['bolsa', 'agendamento'],
    stage: 'agendado',
    score: 86,
    lastMessage: 'Pode ser amanhã às 15h.',
    lastAt: 'Ontem',
    unread: 1,
    consent: true,
  },
  {
    id: 'c4',
    name: 'Michele Sena',
    phone: '551198606197',
    unit: 'Rematrícula',
    tags: ['perdido', 'reativação'],
    stage: 'novo',
    score: 51,
    lastMessage: 'Vou conversar com meu esposo e retorno.',
    lastAt: '2 dias',
    unread: 0,
    consent: false,
  },
]

const seedMessages: WaMessage[] = [
  { id: 'm1', contactId: 'c1', from: 'lead', text: 'Olá, bom dia! Tudo bem com você?', at: '10:40' },
  { id: 'm2', contactId: 'c1', from: 'agent', text: 'Bom dia, Tatiane! Tudo bem. Como está a adaptação?', at: '10:41' },
  { id: 'm3', contactId: 'c1', from: 'lead', text: 'Ele está se adaptando bem. Obrigada pelo retorno.', at: '10:42' },
]

const seedCampaigns: Campaign[] = [
  {
    id: 'cp1',
    name: 'Tour 360 das unidades',
    segment: 'Interessados com opt-in',
    status: 'programada',
    recipients: 128,
    template: 'Olá, {{nome}}! Temos um tour virtual da unidade {{unidade}} para você conhecer melhor nossa proposta.',
  },
  {
    id: 'cp2',
    name: 'Reativação de visitas',
    segment: 'Leads sem retorno há 30 dias',
    status: 'rascunho',
    recipients: 74,
    template: 'Olá, {{nome}}. Posso te ajudar a retomar o agendamento da visita?',
  },
]

function timeNow() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function statusStyle(status: Campaign['status']) {
  if (status === 'ativa') return { label: 'Ativa', color: '#0ABD78' }
  if (status === 'programada') return { label: 'Programada', color: '#F8A303' }
  return { label: 'Rascunho', color: '#A78BFA' }
}

export default function WhatsAppCrmPage() {
  const [tab, setTab] = useState<TabId>('inbox')
  const [connected, setConnected] = useState(false)
  const [contacts, setContacts] = useState<WaContact[]>(seedContacts)
  const [messages, setMessages] = useState<WaMessage[]>(seedMessages)
  const [campaigns, setCampaigns] = useState<Campaign[]>(seedCampaigns)
  const [selectedId, setSelectedId] = useState('c1')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('Todos')
  const [composer, setComposer] = useState('')
  const [aiDraft, setAiDraft] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [bulkText, setBulkText] = useState(seedCampaigns[0].template)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      setConnected(!!parsed.connected)
      setContacts(parsed.contacts || seedContacts)
      setMessages(parsed.messages || seedMessages)
      setCampaigns(parsed.campaigns || seedCampaigns)
      setSelectedId(parsed.selectedId || 'c1')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ connected, contacts, messages, campaigns, selectedId }))
    } catch {}
  }, [connected, contacts, messages, campaigns, selectedId])

  const selected = contacts.find(c => c.id === selectedId) || contacts[0]
  const allTags = useMemo(() => ['Todos', ...Array.from(new Set(contacts.flatMap(c => c.tags)))], [contacts])
  const filteredContacts = contacts.filter(contact => {
    const haystack = `${contact.name} ${contact.phone} ${contact.unit} ${contact.tags.join(' ')}`.toLowerCase()
    const matchesSearch = haystack.includes(search.toLowerCase())
    const matchesTag = tagFilter === 'Todos' || contact.tags.includes(tagFilter)
    return matchesSearch && matchesTag
  })
  const selectedMessages = messages.filter(m => m.contactId === selected?.id)
  const optedIn = contacts.filter(c => c.consent).length
  const unread = contacts.reduce((sum, c) => sum + c.unread, 0)
  const avgScore = Math.round(contacts.reduce((sum, c) => sum + c.score, 0) / contacts.length)

  const sendMessage = (text = composer, from: WaMessage['from'] = 'agent') => {
    if (!selected || !text.trim()) return
    const msg: WaMessage = { id: crypto.randomUUID(), contactId: selected.id, from, text: text.trim(), at: timeNow() }
    setMessages(prev => [...prev, msg])
    setContacts(prev => prev.map(contact => contact.id === selected.id
      ? { ...contact, lastMessage: text.trim(), lastAt: msg.at, unread: from === 'lead' ? contact.unread + 1 : 0 }
      : contact
    ))
    setComposer('')
  }

  const moveContact = (contactId: string, stage: StageId) => {
    setContacts(prev => prev.map(contact => contact.id === contactId ? { ...contact, stage } : contact))
  }

  const extractContacts = (mode: 'geral' | 'segmentado' | 'grupos' | 'selo') => {
    const newContact: WaContact = {
      id: crypto.randomUUID(),
      name: mode === 'grupos' ? 'Grupo Pais Interessados' : mode === 'selo' ? 'Lead com selo Tour' : 'Novo contato extraído',
      phone: `55${Math.floor(11000000000 + Math.random() * 89999999999)}`,
      unit: mode === 'segmentado' ? 'Segmento APS' : 'Importação WhatsApp',
      tags: [mode, 'importado'],
      stage: 'novo',
      score: 60 + Math.floor(Math.random() * 30),
      lastMessage: 'Contato importado para qualificação.',
      lastAt: timeNow(),
      unread: 0,
      consent: mode !== 'grupos',
    }
    setContacts(prev => [newContact, ...prev])
    setSelectedId(newContact.id)
  }

  const generateAiDraft = async () => {
    if (!selected) return
    setAiBusy(true)
    const prompt = `Você é a Sofi, agente humanizada de WhatsApp da Associação Paulista Sul.
Crie uma resposta curta, calorosa e objetiva para este lead.

Contato: ${selected.name}
Telefone: ${selected.phone}
Unidade/segmento: ${selected.unit}
Tags: ${selected.tags.join(', ')}
Última mensagem: ${selected.lastMessage}

Regras: português do Brasil, tom humano, sem parecer robô, até 450 caracteres, terminar com uma pergunta simples.`
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setAiDraft(data.content || 'Oi! Posso te ajudar com as informações e o melhor próximo passo para sua família?')
    } catch {
      setAiDraft('Oi! Posso te ajudar com as informações e o melhor próximo passo para sua família?')
    } finally {
      setAiBusy(false)
    }
  }

  const createCampaign = () => {
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name: `Campanha ${campaigns.length + 1}`,
      segment: `${optedIn} contatos com opt-in`,
      status: 'rascunho',
      recipients: optedIn,
      template: bulkText,
    }
    setCampaigns(prev => [campaign, ...prev])
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)', boxShadow: '0 16px 36px rgba(10,189,120,0.22)' }}>
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white">WhatsApp CRM APS</h1>
                <p className="text-sm text-white/40">Atendimento, campanhas, extração, Kanban e agente Sofi em um cockpit único.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setConnected(v => !v)}
              className="px-4 py-2.5 rounded-2xl text-sm font-extrabold flex items-center gap-2"
              style={{
                background: connected ? 'rgba(10,189,120,0.14)' : 'rgba(248,163,3,0.16)',
                color: connected ? '#0ABD78' : '#F8A303',
                border: `1px solid ${connected ? 'rgba(10,189,120,0.28)' : 'rgba(248,163,3,0.28)'}`,
              }}>
              {connected ? <CheckCircleIcon className="w-4 h-4" /> : <QrCodeIcon className="w-4 h-4" />}
              {connected ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
            </button>
            <button className="px-4 py-2.5 rounded-2xl text-sm font-bold text-white/65"
              style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Sessão automática ativa
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Conversas', value: contacts.length, icon: ChatBubbleLeftRightIcon, color: '#4A9EFF' },
            { label: 'Não lidas', value: unread, icon: MegaphoneIcon, color: '#F8A303' },
            { label: 'Opt-in válido', value: optedIn, icon: CheckCircleIcon, color: '#0ABD78' },
            { label: 'Score médio', value: `${avgScore}%`, icon: SparklesIcon, color: '#A78BFA' },
          ].map(item => {
            const Icon = item.icon
            return (
            <div key={item.label} className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-extrabold" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-xs text-white/40 mt-1">{item.label}</p>
                </div>
                <Icon className="w-6 h-6" style={{ color: item.color }} />
              </div>
            </div>
            )
          })}
        </section>

        <nav className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'inbox', label: 'Atendimento', icon: ChatBubbleLeftRightIcon },
            { id: 'kanban', label: 'CRM Kanban', icon: ClipboardDocumentCheckIcon },
            { id: 'campanhas', label: 'Envio em massa', icon: MegaphoneIcon },
            { id: 'contatos', label: 'Extração', icon: UserGroupIcon },
            { id: 'agente', label: 'Agente IA', icon: BoltIcon },
          ].map(item => {
            const Icon = item.icon
            return (
            <button key={item.id} onClick={() => setTab(item.id as TabId)}
              className="px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 whitespace-nowrap"
              style={{
                background: tab === item.id ? 'rgba(248,163,3,0.16)' : 'rgba(255,255,255,0.045)',
                color: tab === item.id ? '#F8A303' : 'rgba(255,255,255,0.48)',
                border: `1px solid ${tab === item.id ? 'rgba(248,163,3,0.28)' : 'rgba(255,255,255,0.07)'}`,
              }}>
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
            )
          })}
        </nav>

        {tab === 'inbox' && (
          <section className="grid grid-cols-1 xl:grid-cols-[360px_minmax(420px,1fr)_330px] gap-4">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar lead, telefone, selo..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
                </div>
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {allTags.slice(0, 8).map(tag => (
                    <button key={tag} onClick={() => setTagFilter(tag)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{
                        background: tagFilter === tag ? 'rgba(10,189,120,0.16)' : 'rgba(255,255,255,0.045)',
                        color: tagFilter === tag ? '#0ABD78' : 'rgba(255,255,255,0.42)',
                        border: `1px solid ${tagFilter === tag ? 'rgba(10,189,120,0.28)' : 'rgba(255,255,255,0.07)'}`,
                      }}>{tag}</button>
                  ))}
                </div>
              </div>
              <div className="max-h-[650px] overflow-y-auto">
                {filteredContacts.map(contact => (
                  <button key={contact.id} onClick={() => setSelectedId(contact.id)}
                    className="w-full text-left p-4 border-b transition"
                    style={{
                      background: selected?.id === contact.id ? 'rgba(10,189,120,0.09)' : 'transparent',
                      borderColor: 'rgba(255,255,255,0.06)',
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-black font-extrabold"
                        style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                        {contact.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-white truncate">{contact.name}</p>
                          <span className="text-[10px] text-white/30">{contact.lastAt}</span>
                        </div>
                        <p className="text-xs text-white/35">{contact.phone} · {contact.unit}</p>
                        <p className="text-xs text-white/50 truncate mt-1">{contact.lastMessage}</p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {contact.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: 'rgba(248,163,3,0.11)', color: '#F8A303' }}>{tag}</span>
                          ))}
                          {contact.unread > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-black" style={{ background: '#F8A303' }}>{contact.unread}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden flex flex-col min-h-[680px]"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div>
                  <p className="text-lg font-extrabold text-white">{selected?.name}</p>
                  <p className="text-xs text-white/35">{selected?.phone} · {selected?.unit}</p>
                </div>
                <select value={selected?.stage} onChange={e => selected && moveContact(selected.id, e.target.value as StageId)}
                  className="px-3 py-2 rounded-xl text-xs font-bold outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#F8A303', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}>
                  {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
                </select>
              </div>

              <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                {selectedMessages.map(message => (
                  <div key={message.id} className={`flex ${message.from === 'lead' ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[78%] rounded-2xl px-4 py-3"
                      style={{
                        background: message.from === 'lead' ? 'rgba(255,255,255,0.07)' : message.from === 'sofi' ? 'rgba(248,163,3,0.14)' : 'rgba(10,189,120,0.16)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                      <p className="text-sm leading-6 text-white/82">{message.text}</p>
                      <p className="text-[10px] text-white/28 mt-1">{message.at}</p>
                    </div>
                  </div>
                ))}
              </div>

              {aiDraft && (
                <div className="mx-4 mb-3 rounded-2xl p-3" style={{ background: 'rgba(248,163,3,0.08)', border: '1px solid rgba(248,163,3,0.18)' }}>
                  <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1">Sugestão da Sofi</p>
                  <p className="text-sm text-white/75 leading-6">{aiDraft}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setComposer(aiDraft)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-black" style={{ background: '#F8A303' }}>Usar</button>
                    <button onClick={() => { sendMessage(aiDraft, 'sofi'); setAiDraft('') }} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/70" style={{ background: 'rgba(255,255,255,0.07)' }}>Enviar</button>
                  </div>
                </div>
              )}

              <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex gap-2">
                  <button onClick={generateAiDraft} disabled={aiBusy}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-black disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
                    {aiBusy ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                  </button>
                  <input value={composer} onChange={e => setComposer(e.target.value)} placeholder="Digite uma mensagem..."
                    className="flex-1 px-4 rounded-2xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }} />
                  <button onClick={() => sendMessage()} className="w-11 h-11 rounded-2xl flex items-center justify-center text-black"
                    style={{ background: 'linear-gradient(135deg,#0ABD78,#34D399)' }}>
                    <PaperAirplaneIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-extrabold text-white">Ficha CRM</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.045)' }}>
                    <p className="text-[10px] text-white/30">Score</p>
                    <p className="text-xl font-extrabold" style={{ color: '#F8A303' }}>{selected?.score}%</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.045)' }}>
                    <p className="text-[10px] text-white/30">Opt-in</p>
                    <p className="text-xl font-extrabold" style={{ color: selected?.consent ? '#0ABD78' : '#FF4757' }}>{selected?.consent ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected?.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 rounded-full text-[11px] font-bold" style={{ background: 'rgba(248,163,3,0.1)', color: '#F8A303' }}>
                      <TagIcon className="inline w-3 h-3 mr-1" />{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm font-extrabold text-white">Ações rápidas</p>
                <div className="space-y-2 mt-3">
                  {stages.map(stage => (
                    <button key={stage.id} onClick={() => selected && moveContact(selected.id, stage.id)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-left"
                      style={{ background: `${stage.color}14`, color: stage.color, border: `1px solid ${stage.color}28` }}>
                      Mover para {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        )}

        {tab === 'kanban' && (
          <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {stages.map(stage => {
              const stageContacts = contacts.filter(c => c.stage === stage.id)
              return (
                <div key={stage.id} className="rounded-2xl p-3 min-h-[560px]"
                  style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-extrabold" style={{ color: stage.color }}>{stage.label}</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${stage.color}18`, color: stage.color }}>{stageContacts.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageContacts.map(contact => (
                      <div key={contact.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-sm font-bold text-white">{contact.name}</p>
                        <p className="text-xs text-white/35">{contact.phone}</p>
                        <p className="text-xs text-white/50 mt-2 line-clamp-2">{contact.lastMessage}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[10px] font-bold" style={{ color: stage.color }}>{contact.score}% fit</span>
                          <button onClick={() => { setSelectedId(contact.id); setTab('inbox') }} className="text-[10px] px-2 py-1 rounded-lg text-black" style={{ background: '#F8A303' }}>Abrir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {tab === 'campanhas' && (
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-extrabold text-white">Campanhas WhatsApp</p>
                  <p className="text-xs text-white/35">Envio em massa apenas para contatos com opt-in e segmentação.</p>
                </div>
                <button onClick={createCampaign} className="px-4 py-2 rounded-xl text-sm font-bold text-black" style={{ background: '#F8A303' }}>
                  <PlusIcon className="w-4 h-4 inline mr-1" />Nova campanha
                </button>
              </div>
              <div className="space-y-3">
                {campaigns.map(campaign => {
                  const st = statusStyle(campaign.status)
                  return (
                    <div key={campaign.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-white">{campaign.name}</p>
                          <p className="text-xs text-white/35">{campaign.segment} · {campaign.recipients} contatos</p>
                        </div>
                        <span className="px-2 py-1 rounded-full text-[11px] font-bold" style={{ background: `${st.color}18`, color: st.color }}>{st.label}</span>
                      </div>
                      <p className="text-sm text-white/60 mt-3">{campaign.template}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-extrabold text-white">Composer de campanha</p>
              <p className="text-xs text-white/35 mt-1">{'Use variáveis como {{nome}}, {{unidade}} e respeite opt-in.'}</p>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                className="w-full h-44 mt-4 rounded-2xl p-4 text-sm text-white outline-none resize-none"
                style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-xl p-3" style={{ background: 'rgba(10,189,120,0.1)' }}>
                  <p className="text-[10px] text-white/35">Elegíveis</p>
                  <p className="text-xl font-extrabold" style={{ color: '#0ABD78' }}>{optedIn}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,71,87,0.08)' }}>
                  <p className="text-[10px] text-white/35">Sem opt-in</p>
                  <p className="text-xl font-extrabold" style={{ color: '#FF4757' }}>{contacts.length - optedIn}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'contatos' && (
          <section className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-lg font-extrabold text-white">Extração de contatos</p>
              <p className="text-xs text-white/35 mt-1">Organize contatos gerais, segmentados, por grupos e por selos.</p>
              <div className="space-y-2 mt-4">
                {[
                  { id: 'geral', label: 'Extração geral', desc: 'Importa contatos conversados e qualifica duplicados.' },
                  { id: 'segmentado', label: 'Segmentada', desc: 'Extrai por unidade, campanha, origem ou interesse.' },
                  { id: 'grupos', label: 'Grupos', desc: 'Mapeia grupos e identifica possíveis responsáveis.' },
                  { id: 'selo', label: 'Com selo', desc: 'Importa contatos marcados por tags/selo de atendimento.' },
                ].map(item => (
                  <button key={item.id} onClick={() => extractContacts(item.id as any)}
                    className="w-full text-left rounded-2xl p-3"
                    style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-sm font-bold text-white">{item.label}</p>
                    <p className="text-xs text-white/35 mt-1">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 p-3 text-[10px] uppercase tracking-widest text-white/30 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <span>Contato</span><span>Segmento</span><span>Selos</span><span>Status</span>
              </div>
              {contacts.map(contact => (
                <div key={contact.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 p-3 border-b items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-sm font-bold text-white">{contact.name}</p>
                    <p className="text-xs text-white/35">{contact.phone}</p>
                  </div>
                  <p className="text-xs text-white/55">{contact.unit}</p>
                  <div className="flex gap-1 flex-wrap">{contact.tags.slice(0, 2).map(tag => <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,163,3,0.11)', color: '#F8A303' }}>{tag}</span>)}</div>
                  <p className="text-xs font-bold" style={{ color: contact.consent ? '#0ABD78' : '#FF4757' }}>{contact.consent ? 'Opt-in' : 'Revisar'}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'agente' && (
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {[
              { title: 'Agente humanizado', text: 'Responde rápido, reconhece intenção, pede dados faltantes e transfere para humano quando necessário.', icon: SparklesIcon, color: '#F8A303' },
              { title: 'Governança e handoff', text: 'Define quando a Sofi pode responder, quando precisa aprovação e para qual etapa do Kanban mover.', icon: FunnelIcon, color: '#4A9EFF' },
              { title: 'Memória de atendimento', text: 'Resume histórico, destaca objeções, sentiment, próximos passos e tarefas do atendimento.', icon: ClipboardDocumentCheckIcon, color: '#0ABD78' },
            ].map(item => {
              const Icon = item.icon
              return (
              <div key={item.title} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Icon className="w-7 h-7 mb-4" style={{ color: item.color }} />
                <p className="text-base font-extrabold text-white">{item.title}</p>
                <p className="text-sm text-white/45 leading-6 mt-2">{item.text}</p>
              </div>
              )
            })}
            <div className="xl:col-span-3 rounded-2xl p-5" style={{ background: 'rgba(248,163,3,0.06)', border: '1px solid rgba(248,163,3,0.16)' }}>
              <p className="text-base font-extrabold text-white">Integração técnica whatsapp-web.js</p>
              <p className="text-sm text-white/55 leading-6 mt-2">
                O cockpit já está pronto para operar. A conexão real com WhatsApp Web deve rodar no backend/Fly com sessão persistente, LocalAuth ou RemoteAuth,
                eventos de QR/ready/message e fila de envio. No Vercel a interface consome esse serviço via API.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4">
                {['QR + sessão', 'Eventos em tempo real', 'Fila anti-spam', 'Webhooks para CRM'].map(step => (
                  <div key={step} className="rounded-xl p-3 text-xs font-bold text-white/65" style={{ background: 'rgba(255,255,255,0.045)' }}>{step}</div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
