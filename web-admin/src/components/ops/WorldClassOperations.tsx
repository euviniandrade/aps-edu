'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import {
  AcademicCapIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  EnvelopeIcon,
  PlusIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type HubTab = 'agenda' | 'escola' | 'pessoas'
type Priority = 'Alta' | 'Media' | 'Baixa'
type WorkItem = { id: string; title: string; owner: string; area: string; stage: string; priority: Priority; due: string }
type Admission = { id: string; family: string; student: string; stage: string; value: number; next: string }
type Person = { id: string; name: string; role: string; pulse: number; training: string; nextReview: string }
type FinanceLine = { id: string; label: string; type: 'Receita' | 'Despesa'; amount: number; status: string; due: string }
type Asset = { id: string; name: string; location: string; qty: number; min: number; status: string }
type KnowledgeItem = { id: string; title: string; type: string; owner: string; status: string }
type Automation = { id: string; trigger: string; action: string; status: 'Ativa' | 'Rascunho' }

type ManagementState = {
  work: WorkItem[]
  admissions: Admission[]
  people: Person[]
  finance: FinanceLine[]
  assets: Asset[]
  knowledge: KnowledgeItem[]
  automations: Automation[]
  updatedAt?: string
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MANAGEMENT_CACHE_KEY = 'aps_edu_management_state_v2'

const fallbackState: ManagementState = {
  work: [
    { id: 'T-1024', title: 'Fechar roteiro de matriculas 2026', owner: 'Secretaria', area: 'Escola', stage: 'Em andamento', priority: 'Alta', due: 'Hoje' },
    { id: 'T-1025', title: 'Revisar compras de tecnologia', owner: 'Operacao', area: 'Ativos', stage: 'Aguardando aprovacao', priority: 'Alta', due: 'Amanha' },
    { id: 'T-1026', title: 'Preparar treinamento de coordenadores', owner: 'Pessoas', area: 'Treinamento', stage: 'Planejado', priority: 'Media', due: '17/06' },
  ],
  admissions: [
    { id: 'MAT-2041', family: 'Familia Silva', student: 'Pedro Silva - 6 ano', stage: 'Visita pedagogica', value: 1850, next: 'Confirmar presenca da familia' },
    { id: 'MAT-2042', family: 'Familia Andrade', student: 'Livia Andrade - 1 ano', stage: 'Proposta enviada', value: 1620, next: 'Enviar documentacao' },
  ],
  people: [
    { id: 'P-1', name: 'Coordenacao pedagogica', role: 'Lideranca escolar', pulse: 86, training: 'Avaliacao formativa', nextReview: '20/06' },
    { id: 'P-2', name: 'Secretaria escolar', role: 'Atendimento e matricula', pulse: 78, training: 'Jornada da familia', nextReview: '18/06' },
    { id: 'P-3', name: 'Operacao e suporte', role: 'Processos internos', pulse: 72, training: 'SLA e rotina visual', nextReview: '21/06' },
  ],
  finance: [
    { id: 'F-1', label: 'Matriculas previstas', type: 'Receita', amount: 3470, status: 'Previsto', due: 'Hoje' },
    { id: 'F-2', label: 'Compra de materiais pedagogicos', type: 'Despesa', amount: 980, status: 'A aprovar', due: 'Amanha' },
  ],
  assets: [
    { id: 'A-1', name: 'Kits de matricula', location: 'Secretaria APS', qty: 42, min: 60, status: 'Repor' },
    { id: 'A-2', name: 'Projetores multimidia', location: 'Sala de recursos', qty: 4, min: 5, status: 'Critico' },
  ],
  knowledge: [
    { id: 'D-1', title: 'Politica de matricula 2026', type: 'Documento', owner: 'Secretaria', status: 'Revisao' },
    { id: 'D-2', title: 'Ata do comite executivo', type: 'Nota', owner: 'Direcao', status: 'Publicada' },
  ],
  automations: [
    { id: 'AU-1', trigger: 'Tarefa vence hoje', action: 'Notificar responsavel e resumir risco para a direcao', status: 'Ativa' },
    { id: 'AU-2', trigger: 'Estoque abaixo do minimo', action: 'Criar solicitacao de compra e pedir aprovacao', status: 'Ativa' },
  ],
}

const agendaBase = [
  { time: '08:30', title: 'Abertura e prioridades do dia', area: 'Comando', color: '#F8A303' },
  { time: '09:30', title: 'Famílias em matrícula e visitas', area: 'Escola', color: '#29ABE2' },
  { time: '11:00', title: 'Despachos financeiros pendentes', area: 'Financeiro', color: '#4A9EFF' },
  { time: '14:00', title: 'Compras, estoque e patrimônio', area: 'Operação', color: '#E07B39' },
  { time: '16:00', title: 'Pessoas, treinamento e acompanhamento', area: 'Pessoas', color: '#8B5CF6' },
]

function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20 ${className}`}>
      {children}
    </section>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-white/25 ${props.className || ''}`} />
}

function openSofi(prompt: string) {
  window.dispatchEvent(new CustomEvent('aps:open-sofi', { detail: { prompt } }))
}

function priorityColor(value: Priority) {
  return value === 'Alta' ? '#FF4757' : value === 'Media' ? '#F8A303' : '#0ABD78'
}

function PriorityBadge({ value }: { value: Priority }) {
  const color = priorityColor(value)
  return <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ color, background: `${color}18`, border: `1px solid ${color}22` }}>{value}</span>
}

export default function WorldClassOperations() {
  const [tab, setTab] = useState<HubTab>('agenda')
  const [state, setState] = useState<ManagementState>(fallbackState)
  const [source, setSource] = useState<'api' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickOwner, setQuickOwner] = useState('Vinicius')
  const [chatPrompt, setChatPrompt] = useState('Analise minha agenda, tarefas, escola, financeiro e pessoas. Diga o que eu preciso resolver agora.')

  const totals = useMemo(() => {
    const revenue = state.finance.filter(item => item.type === 'Receita').reduce((sum, item) => sum + item.amount, 0)
    const expense = state.finance.filter(item => item.type === 'Despesa').reduce((sum, item) => sum + item.amount, 0)
    const criticalAssets = state.assets.filter(item => item.qty <= item.min).length
    const highPriority = state.work.filter(item => item.priority === 'Alta').length
    const peoplePulse = Math.round(state.people.reduce((sum, item) => sum + item.pulse, 0) / Math.max(1, state.people.length))
    return { revenue, expense, balance: revenue - expense, criticalAssets, highPriority, peoplePulse }
  }, [state])

  const sofiContext = useMemo(() => {
    const base = {
      tarefas: state.work.map(item => ({ titulo: item.title, dono: item.owner, area: item.area, status: item.stage, prioridade: item.priority, prazo: item.due })),
      matriculas: state.admissions,
      financeiro: state.finance,
      pessoas: state.people,
      estoque: state.assets,
    }
    if (tab === 'agenda') {
      return `Sofi, atue como minha gestora executiva. Organize minha agenda de hoje, priorize tarefas, encontre conflitos e diga o que devo fazer agora. Contexto: ${JSON.stringify(base)}`
    }
    if (tab === 'escola') {
      return `Sofi, atue como gestora escolar e financeira. Analise matriculas, familias, receitas, despesas, estoque e aprovacoes. Gere plano de acao objetivo. Contexto: ${JSON.stringify(base)}`
    }
    return `Sofi, atue como gestora de pessoas. Analise pulso, desempenho, treinamentos, riscos de sobrecarga e proximos check-ins. Gere acoes praticas. Contexto: ${JSON.stringify(base)}`
  }, [state, tab])

  function readLocalState() {
    try {
      const raw = localStorage.getItem(MANAGEMENT_CACHE_KEY)
      return raw ? { ...fallbackState, ...JSON.parse(raw) } : fallbackState
    } catch {
      return fallbackState
    }
  }

  function saveLocalState(next: ManagementState) {
    try { localStorage.setItem(MANAGEMENT_CACHE_KEY, JSON.stringify(next)) } catch {}
  }

  function updateLocal(updater: (current: ManagementState) => ManagementState) {
    setState(current => {
      const next = updater(current)
      saveLocalState(next)
      return next
    })
    setSource('local')
  }

  function applyState(next: ManagementState) {
    const hydrated = { ...fallbackState, ...next }
    setState(hydrated)
    saveLocalState(hydrated)
    setSource('api')
  }

  async function loadManagement() {
    setLoading(true)
    try {
      const res = await api.get('/management')
      applyState(res.data)
    } catch {
      setState(readLocalState())
      setSource('local')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadManagement() }, [])

  useEffect(() => {
    const handleManagementUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ManagementState>).detail
      if (detail) setState({ ...fallbackState, ...detail })
    }
    window.addEventListener('management_state_updated', handleManagementUpdate as EventListener)
    return () => window.removeEventListener('management_state_updated', handleManagementUpdate as EventListener)
  }, [])

  async function addQuickWork(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    const payload = { title: quickTitle, owner: quickOwner || 'Sofi IA', area: tab === 'agenda' ? 'Comando' : tab === 'escola' ? 'Escola' : 'Pessoas', priority: 'Alta' as Priority, due: 'Hoje' }
    setQuickTitle('')
    try {
      const res = await api.post('/management/work', payload)
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, work: [{ id: `T-${Date.now()}`, ...payload, stage: 'Novo' }, ...prev.work] }))
    }
  }

  async function advanceWork(id: string) {
    try {
      const res = await api.patch(`/management/work/${id}/advance`)
      applyState(res.data)
    } catch {
      const map: Record<string, string> = { Novo: 'Planejado', Planejado: 'Em andamento', 'Em andamento': 'Em revisao', 'Aguardando aprovacao': 'Em andamento', 'Em revisao': 'Concluido' }
      updateLocal(prev => ({ ...prev, work: prev.work.map(item => item.id === id ? { ...item, stage: map[item.stage] || 'Em andamento' } : item) }))
    }
  }

  async function addAdmission() {
    try {
      const res = await api.post('/management/admissions', {})
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, admissions: [{ id: `MAT-${Date.now()}`, family: 'Nova familia', student: 'Aluno em qualificacao', stage: 'Contato inicial', value: 1500, next: 'Agendar visita pedagogica' }, ...prev.admissions] }))
    }
  }

  async function addFinance(type: FinanceLine['type']) {
    try {
      const res = await api.post('/management/finance', { type })
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, finance: [{ id: `F-${Date.now()}`, label: type === 'Receita' ? 'Nova receita escolar' : 'Nova despesa operacional', type, amount: type === 'Receita' ? 1200 : 450, status: 'Previsto', due: 'Esta semana' }, ...prev.finance] }))
    }
  }

  async function adjustAsset(id: string, delta: number) {
    try {
      const res = await api.patch(`/management/assets/${id}/adjust`, { delta })
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, assets: prev.assets.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta), status: Math.max(0, item.qty + delta) <= item.min ? 'Repor' : 'Ok' } : item) }))
    }
  }

  const agendaEvents = useMemo(() => [
    ...agendaBase,
    ...state.work.filter(item => item.due === 'Hoje').slice(0, 4).map((item, index) => ({
      time: `${17 + index}:00`,
      title: item.title,
      area: item.area,
      color: priorityColor(item.priority),
    })),
  ], [state.work])

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Hoje" value={state.work.filter(item => item.due === 'Hoje').length.toString()} detail="tarefas na agenda" color="#F8A303" />
        <MetricCard label="Prioridade" value={totals.highPriority.toString()} detail="itens criticos" color="#FF4757" />
        <MetricCard label="Matriculas" value={money.format(state.admissions.reduce((sum, item) => sum + item.value, 0))} detail={`${state.admissions.length} familias`} color="#29ABE2" />
        <MetricCard label="Saldo" value={money.format(totals.balance)} detail="previsto" color="#4A9EFF" />
        <MetricCard label="Pessoas" value={`${totals.peoplePulse}%`} detail="pulso medio" color="#8B5CF6" />
      </section>

      <section className="grid gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-1.5 md:grid-cols-3">
        {[
          { id: 'agenda', label: 'Agenda', icon: CalendarDaysIcon, color: '#F8A303' },
          { id: 'escola', label: 'Escola e financeiro', icon: AcademicCapIcon, color: '#29ABE2' },
          { id: 'pessoas', label: 'Pessoas', icon: UserGroupIcon, color: '#8B5CF6' },
        ].map(item => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button key={item.id} onClick={() => setTab(item.id as HubTab)} className="flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black transition" style={{ color: active ? item.color : 'rgba(255,255,255,0.55)', background: active ? `${item.color}16` : 'transparent', border: active ? `1px solid ${item.color}55` : '1px solid transparent' }}>
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          )
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-[1.2rem] border border-[#F8A303]/20 bg-[#F8A303]/[0.08] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-[#F8A303]/30 bg-[#F8A303]/15">
            <SparklesIcon className="h-5 w-5 text-[#F8A303]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white">Sofi integrada nesta aba</p>
            <p className="truncate text-xs font-semibold text-white/42">Agenda, tarefas, escola, financeiro e pessoas entram no contexto da conversa.</p>
          </div>
        </div>
        <button onClick={() => openSofi(sofiContext)} className="h-10 rounded-2xl bg-[#F8A303] px-4 text-sm font-black text-black">
          Abrir Sofi com contexto
        </button>
      </section>

      <form onSubmit={addQuickWork} className="grid gap-2 rounded-[1.2rem] border border-white/10 bg-[#080A12] p-3 md:grid-cols-[minmax(220px,1fr)_180px_48px]">
        <Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Criar tarefa rapida..." />
        <Input value={quickOwner} onChange={event => setQuickOwner(event.target.value)} placeholder="Responsavel" />
        <button className="flex h-11 items-center justify-center rounded-2xl bg-[#F8A303] text-black"><PlusIcon className="h-5 w-5" /></button>
      </form>

      {tab === 'agenda' && <AgendaWorkspace state={state} events={agendaEvents} chatPrompt={chatPrompt} setChatPrompt={setChatPrompt} onAdvance={advanceWork} loading={loading} source={source} />}
      {tab === 'escola' && <SchoolFinanceWorkspace state={state} totals={totals} onAddAdmission={addAdmission} onAddFinance={addFinance} onAdjustAsset={adjustAsset} />}
      {tab === 'pessoas' && <PeopleWorkspace people={state.people} work={state.work.filter(item => item.area === 'Pessoas' || item.area === 'Treinamento')} />}
    </div>
  )
}

function MetricCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-2 truncate text-2xl font-black leading-tight" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-white/38">{detail}</p>
    </div>
  )
}

function AgendaWorkspace({ state, events, chatPrompt, setChatPrompt, onAdvance, loading, source }: { state: ManagementState; events: typeof agendaBase; chatPrompt: string; setChatPrompt: (value: string) => void; onAdvance: (id: string) => void; loading: boolean; source: string }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return date
  })

  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F8A303]">Agenda completa</p>
              <h2 className="mt-1 text-2xl font-black text-white">{today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-white/45">{loading ? 'Sincronizando...' : source === 'api' ? 'API conectada' : 'Modo local'}</span>
          </div>
        </div>
        <div className="grid gap-px bg-white/10 lg:grid-cols-7">
          {days.map(day => (
            <div key={day.toISOString()} className="min-h-28 bg-[#10121A] p-3">
              <p className="text-xs font-black uppercase text-white/35">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
              <p className="mt-1 text-xl font-black text-white">{day.getDate()}</p>
              {day.toDateString() === today.toDateString() && <span className="mt-2 inline-flex rounded-full bg-[#F8A303]/15 px-2.5 py-1 text-[10px] font-black text-[#F8A303]">Hoje</span>}
            </div>
          ))}
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {events.map(item => (
              <div key={`${item.time}-${item.title}`} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-[70px_1fr_120px] md:items-center">
                <p className="font-mono text-sm font-black" style={{ color: item.color }}>{item.time}</p>
                <div>
                  <p className="font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-white/35">{item.area}</p>
                </div>
                <span className="w-fit rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/50">Agenda</span>
              </div>
            ))}
          </div>
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#F8A303]/30 bg-[#F8A303]/12 p-3"><SparklesIcon className="h-6 w-6 text-[#F8A303]" /></div>
            <div>
              <h3 className="font-black text-white">Chat Sofi</h3>
              <p className="text-xs font-semibold text-white/38">Comando rapido do dia</p>
            </div>
          </div>
          <textarea value={chatPrompt} onChange={event => setChatPrompt(event.target.value)} className="mt-4 min-h-36 w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none" />
          <button onClick={() => openSofi(chatPrompt)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A303] text-sm font-black text-black">
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
            Abrir conversa com Sofi
          </button>
        </Surface>

        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 p-4">
            <h3 className="font-black text-white">Tarefas de hoje</h3>
          </div>
          <div className="divide-y divide-white/10">
            {state.work.slice(0, 6).map(item => <TaskRow key={item.id} item={item} onAdvance={onAdvance} />)}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function SchoolFinanceWorkspace({ state, totals, onAddAdmission, onAddFinance, onAdjustAsset }: { state: ManagementState; totals: { revenue: number; expense: number; balance: number; criticalAssets: number }; onAddAdmission: () => void; onAddFinance: (type: FinanceLine['type']) => void; onAdjustAsset: (id: string, delta: number) => void }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Receitas" value={money.format(totals.revenue)} detail="previstas" color="#0ABD78" />
          <MetricCard label="Despesas" value={money.format(totals.expense)} detail="em aberto" color="#FF4757" />
          <MetricCard label="Saldo" value={money.format(totals.balance)} detail="projetado" color="#4A9EFF" />
        </div>
        <Surface className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Gestao escolar</h2>
              <p className="text-sm text-white/40">Matriculas, familias e proximas acoes.</p>
            </div>
            <button onClick={onAddAdmission} className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#29ABE2] px-4 text-sm font-black text-black"><PlusIcon className="h-4 w-4" /> Nova familia</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-white/[0.035] text-left text-xs uppercase tracking-[0.12em] text-white/34"><tr><th className="px-5 py-3">Familia</th><th className="px-5 py-3">Etapa</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Proxima acao</th></tr></thead>
              <tbody>{state.admissions.map(item => <tr key={item.id} className="border-t border-white/10"><td className="px-5 py-4"><p className="font-black text-white">{item.family}</p><p className="text-xs text-white/38">{item.student}</p></td><td className="px-5 py-4 text-sm text-white/65">{item.stage}</td><td className="px-5 py-4 text-sm font-black text-[#0ABD78]">{money.format(item.value)}</td><td className="px-5 py-4 text-sm text-white/55">{item.next}</td></tr>)}</tbody>
            </table>
          </div>
        </Surface>
      </div>

      <div className="space-y-5">
        <Surface className="p-5">
          <h3 className="font-black text-white">Financeiro</h3>
          <div className="mt-4 flex gap-2">
            <button onClick={() => onAddFinance('Receita')} className="h-10 flex-1 rounded-2xl bg-[#0ABD78] text-sm font-black text-black">Receita</button>
            <button onClick={() => onAddFinance('Despesa')} className="h-10 flex-1 rounded-2xl bg-[#FF4757] text-sm font-black text-white">Despesa</button>
          </div>
          <div className="mt-4 space-y-3">
            {state.finance.map(item => <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{item.label}</p><p className="text-sm font-black" style={{ color: item.type === 'Receita' ? '#0ABD78' : '#FF4757' }}>{money.format(item.amount)}</p></div><p className="mt-1 text-xs text-white/35">{item.status} - {item.due}</p></div>)}
          </div>
        </Surface>

        <Surface className="p-5">
          <h3 className="font-black text-white">Estoque e patrimonio</h3>
          <div className="mt-4 space-y-3">
            {state.assets.map(item => {
              const critical = item.qty <= item.min
              return (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{item.name}</p><p className="text-xs text-white/35">{item.location}</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: critical ? '#FF4757' : '#0ABD78', background: critical ? 'rgba(255,71,87,0.14)' : 'rgba(10,189,120,0.14)' }}>{item.status}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-3"><p className="text-2xl font-black text-white">{item.qty}<span className="ml-1 text-xs text-white/35">/ min. {item.min}</span></p><div className="flex gap-2"><button onClick={() => onAdjustAsset(item.id, -1)} className="h-9 w-11 rounded-xl bg-white/[0.06] font-black text-white">-</button><button onClick={() => onAdjustAsset(item.id, 1)} className="h-9 w-11 rounded-xl bg-[#E07B39] font-black text-black">+</button></div></div>
                </div>
              )
            })}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function PeopleWorkspace({ people, work }: { people: Person[]; work: WorkItem[] }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4 xl:grid-cols-3">
        {people.map(item => (
          <Surface key={item.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black text-white">{item.name}</h3>
                <p className="mt-1 text-sm text-white/42">{item.role}</p>
              </div>
              <span className="rounded-full bg-[#8B5CF6]/15 px-3 py-1 text-xs font-black text-[#A78BFA]">{item.pulse}%</span>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-[#8B5CF6]" style={{ width: `${item.pulse}%` }} /></div>
            <div className="mt-5 rounded-2xl bg-white/[0.04] p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Trilha</p>
              <p className="mt-1 text-sm font-bold text-white">{item.training}</p>
              <p className="mt-1 text-xs text-white/40">Proxima avaliacao: {item.nextReview}</p>
            </div>
          </Surface>
        ))}
      </div>

      <div className="space-y-5">
        <Surface className="p-5">
          <h3 className="font-black text-white">People analytics</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard label="Pulso" value={`${Math.round(people.reduce((sum, item) => sum + item.pulse, 0) / Math.max(1, people.length))}%`} detail="media" color="#8B5CF6" />
            <MetricCard label="Trilhas" value={people.length.toString()} detail="ativas" color="#0ABD78" />
          </div>
        </Surface>
        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 p-4"><h3 className="font-black text-white">Acoes de pessoas</h3></div>
          <div className="divide-y divide-white/10">
            {work.length === 0 && <p className="p-4 text-sm text-white/38">Nenhuma acao de pessoas em aberto.</p>}
            {work.map(item => <TaskRow key={item.id} item={item} onAdvance={() => {}} />)}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function TaskRow({ item, onAdvance }: { item: WorkItem; onAdvance: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="font-black text-white">{item.title}</p>
        <p className="mt-1 text-sm text-white/42">{item.owner} - {item.area} - {item.due}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge value={item.priority} />
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">{item.stage}</span>
        <button onClick={() => onAdvance(item.id)} className="rounded-full bg-[#F8A303] px-3 py-1 text-xs font-black text-black">Avancar</button>
      </div>
    </div>
  )
}
