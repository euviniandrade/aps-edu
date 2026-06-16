'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CubeIcon,
  EnvelopeIcon,
  FolderOpenIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type HubTab = 'centro' | 'trabalho' | 'escola' | 'pessoas'
type Priority = 'Alta' | 'Media' | 'Baixa'
type WorkItem = { id: string; title: string; owner: string; area: string; stage: string; priority: Priority; due: string }
type Admission = { id: string; family: string; student: string; stage: string; value: number; next: string }
type Person = {
  id: string
  name: string
  role: string
  pulse: number
  training: string
  nextReview: string
  avatar?: string
  unit?: string
  score?: number
  attendance?: number
  workload?: number
  strengths?: string[]
  risks?: string[]
  nextAction?: string
}
type FinanceLine = { id: string; label: string; type: 'Receita' | 'Despesa'; amount: number; status: string; due: string }
type Asset = {
  id: string
  name: string
  location: string
  qty: number
  min: number
  status: string
  category?: string
  supplier?: string
  unitCost?: number
  lastMove?: string
  owner?: string
  nextAction?: string
}
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
const stageOrder = ['Novo', 'Planejado', 'Em andamento', 'Aguardando aprovação', 'Em revisão', 'Concluído']
const admissionStages = ['Contato inicial', 'Visita pedagógica', 'Proposta enviada', 'Documentação', 'Matriculado']

const fallbackState: ManagementState = {
  work: [
    { id: 'T-1024', title: 'Fechar roteiro de matrículas 2026', owner: 'Secretaria', area: 'Escola', stage: 'Em andamento', priority: 'Alta', due: 'Hoje' },
    { id: 'T-1025', title: 'Revisar compras de tecnologia', owner: 'Operação', area: 'Ativos', stage: 'Aguardando aprovação', priority: 'Alta', due: 'Amanhã' },
    { id: 'T-1026', title: 'Preparar treinamento de coordenadores', owner: 'Pessoas', area: 'Treinamento', stage: 'Planejado', priority: 'Media', due: '17/06' },
    { id: 'T-1027', title: 'Atualizar política de atendimento familiar', owner: 'Direção', area: 'Centro', stage: 'Novo', priority: 'Media', due: 'Esta semana' },
    { id: 'T-1028', title: 'Concluir relatório mensal de desempenho', owner: 'Gestão', area: 'Projetos', stage: 'Em revisão', priority: 'Alta', due: '18/06' },
  ],
  admissions: [
    { id: 'MAT-2041', family: 'Família Silva', student: 'Pedro Silva - 6º ano', stage: 'Visita pedagógica', value: 1850, next: 'Confirmar presença da família' },
    { id: 'MAT-2042', family: 'Família Andrade', student: 'Lívia Andrade - 1º ano', stage: 'Proposta enviada', value: 1620, next: 'Enviar documentação' },
  ],
  people: [
    { id: 'P-1', name: 'Marina Costa', role: 'Coordenação pedagógica', unit: 'Pedagógico', pulse: 86, score: 4.7, attendance: 98, workload: 72, training: 'Avaliação formativa', nextReview: '20/06', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80', strengths: ['liderança', 'currículo', 'famílias'], risks: ['agenda cheia'], nextAction: 'Revisar plano de acompanhamento do 6º ano' },
    { id: 'P-2', name: 'Rafael Almeida', role: 'Secretaria escolar', unit: 'Atendimento', pulse: 78, score: 4.4, attendance: 96, workload: 81, training: 'Jornada da família', nextReview: '18/06', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80', strengths: ['matrículas', 'CRM', 'comunicação'], risks: ['fila de retornos'], nextAction: 'Padronizar follow-up das propostas abertas' },
    { id: 'P-3', name: 'Juliana Martins', role: 'Operação e suporte', unit: 'Operação', pulse: 72, score: 4.1, attendance: 94, workload: 88, training: 'SLA e rotina visual', nextReview: '21/06', avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80', strengths: ['processos', 'estoque', 'suporte'], risks: ['sobrecarga'], nextAction: 'Delegar compras recorrentes e revisar criticidade' },
  ],
  finance: [
    { id: 'F-1', label: 'Matrículas previstas', type: 'Receita', amount: 3470, status: 'Previsto', due: 'Hoje' },
    { id: 'F-2', label: 'Compra de materiais pedagógicos', type: 'Despesa', amount: 980, status: 'A aprovar', due: 'Amanhã' },
  ],
  assets: [
    { id: 'A-1', name: 'Kits de matrícula', category: 'Material de secretaria', location: 'Secretaria APS', qty: 42, min: 60, status: 'Repor', supplier: 'Gráfica parceira', unitCost: 18.9, lastMove: '11/06', owner: 'Secretaria', nextAction: 'Comprar 30 unidades para campanha 2026' },
    { id: 'A-2', name: 'Projetores multimídia', category: 'Tecnologia educacional', location: 'Sala de recursos', qty: 4, min: 5, status: 'Crítico', supplier: 'TI regional', unitCost: 2490, lastMove: '08/06', owner: 'Operação', nextAction: 'Abrir aprovação de compra de 2 unidades' },
    { id: 'A-3', name: 'Chromebooks pedagógicos', category: 'Tecnologia educacional', location: 'Laboratório móvel', qty: 18, min: 16, status: 'Ok', supplier: 'Fornecedor homologado', unitCost: 1480, lastMove: '10/06', owner: 'Pedagógico', nextAction: 'Agendar conferência patrimonial' },
  ],
  knowledge: [
    { id: 'D-1', title: 'Política de matrícula 2026', type: 'Documento', owner: 'Secretaria', status: 'Revisão' },
    { id: 'D-2', title: 'Ata do comitê executivo', type: 'Nota', owner: 'Direção', status: 'Publicada' },
  ],
  automations: [
    { id: 'AU-1', trigger: 'Tarefa vence hoje', action: 'Notificar responsável e resumir risco para a direção', status: 'Ativa' },
    { id: 'AU-2', trigger: 'Estoque abaixo do mínimo', action: 'Criar solicitação de compra e pedir aprovação', status: 'Ativa' },
  ],
}

const agendaBase = [
  { time: '08:30', title: 'Abertura e prioridades do dia', area: 'Centro', color: '#F8A303' },
  { time: '09:30', title: 'Famílias em matrícula e visitas', area: 'Gestão escolar', color: '#29ABE2' },
  { time: '11:00', title: 'Despachos financeiros pendentes', area: 'Financeiro', color: '#4A9EFF' },
  { time: '14:00', title: 'Compras, estoque e patrimônio', area: 'Operação', color: '#E07B39' },
  { time: '16:00', title: 'Pessoas, treinamento e acompanhamento', area: 'Pessoas', color: '#8B5CF6' },
]

function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[1.2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20 ${className}`}>{children}</section>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/25 ${props.className || ''}`} />
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

function hydratedState(raw: Partial<ManagementState>) {
  return {
    ...fallbackState,
    ...raw,
    work: raw.work?.length ? raw.work : fallbackState.work,
    admissions: raw.admissions?.length ? raw.admissions : fallbackState.admissions,
    people: raw.people?.length ? raw.people.map((item, index) => ({ ...fallbackState.people[index % fallbackState.people.length], ...item })) : fallbackState.people,
    finance: raw.finance?.length ? raw.finance : fallbackState.finance,
    assets: raw.assets?.length ? raw.assets.map((item, index) => ({ ...fallbackState.assets[index % fallbackState.assets.length], ...item })) : fallbackState.assets,
    knowledge: raw.knowledge?.length ? raw.knowledge : fallbackState.knowledge,
    automations: raw.automations?.length ? raw.automations : fallbackState.automations,
  }
}

export default function WorldClassOperations() {
  const [tab, setTab] = useState<HubTab>('centro')
  const [state, setState] = useState<ManagementState>(fallbackState)
  const [source, setSource] = useState<'api' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickOwner, setQuickOwner] = useState('Vinicius')
  const [chatPrompt, setChatPrompt] = useState('Analise agenda, tarefas, projetos, escola, financeiro, estoque e pessoas. Diga o que precisa acontecer agora.')

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
      tarefas: state.work,
      matriculas: state.admissions,
      financeiro: state.finance,
      pessoas: state.people,
      estoque: state.assets,
      documentos: state.knowledge,
      automacoes: state.automations,
    }
    if (tab === 'centro') return `Sofi, atue como chefe de gabinete operacional. Organize agenda, prioridades, tarefas e decisões do dia. Contexto: ${JSON.stringify(base)}`
    if (tab === 'trabalho') return `Sofi, atue como PMO executivo. Organize tarefas, projetos, etapas, riscos, dependências e responsáveis. Contexto: ${JSON.stringify(base)}`
    if (tab === 'escola') return `Sofi, atue como diretora escolar e controller financeiro. Analise matrículas, receitas, despesas, documentos e estoque. Contexto: ${JSON.stringify(base)}`
    return `Sofi, atue como gestora de pessoas. Analise desempenho, carga, avaliações, riscos, desenvolvimento e liderança. Contexto: ${JSON.stringify(base)}`
  }, [state, tab])

  function readLocalState() {
    try {
      const raw = localStorage.getItem(MANAGEMENT_CACHE_KEY)
      return raw ? hydratedState(JSON.parse(raw)) : fallbackState
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
    const hydrated = hydratedState(next)
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
      if (detail) setState(hydratedState(detail))
    }
    window.addEventListener('management_state_updated', handleManagementUpdate as EventListener)
    return () => window.removeEventListener('management_state_updated', handleManagementUpdate as EventListener)
  }, [])

  async function addQuickWork(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    const areaMap: Record<HubTab, string> = {
      centro: 'Centro',
      trabalho: 'Projetos',
      escola: 'Escola',
      pessoas: 'Pessoas',
    }
    const payload = { title: quickTitle, owner: quickOwner || 'Sofi IA', area: areaMap[tab], priority: 'Alta' as Priority, due: 'Hoje' }
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
      const map: Record<string, string> = {
        Novo: 'Planejado',
        Planejado: 'Em andamento',
        'Em andamento': 'Em revisão',
        'Aguardando aprovação': 'Em andamento',
        'Em revisão': 'Concluído',
      }
      updateLocal(prev => ({ ...prev, work: prev.work.map(item => item.id === id ? { ...item, stage: map[item.stage] || 'Em andamento' } : item) }))
    }
  }

  async function addAdmission() {
    try {
      const res = await api.post('/management/admissions', {})
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, admissions: [{ id: `MAT-${Date.now()}`, family: 'Nova família', student: 'Aluno em qualificação', stage: 'Contato inicial', value: 1500, next: 'Agendar visita pedagógica' }, ...prev.admissions] }))
    }
  }

  async function addFinance(type: FinanceLine['type']) {
    try {
      const res = await api.post('/management/finance', { type })
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, finance: [{ id: `F-${Date.now()}`, label: type === 'Receita' ? 'Nova receita escolar' : 'Nova despesa operacional', type, amount: type === 'Receita' ? 1200 : 450, status: type === 'Receita' ? 'Previsto' : 'A aprovar', due: 'Esta semana' }, ...prev.finance] }))
    }
  }

  async function adjustAsset(id: string, delta: number) {
    try {
      const res = await api.patch(`/management/assets/${id}/adjust`, { delta })
      applyState(res.data)
    } catch {
      updateLocal(prev => ({
        ...prev,
        assets: prev.assets.map(item => {
          const qty = Math.max(0, item.qty + delta)
          return item.id === id ? { ...item, qty, status: qty <= item.min ? 'Repor' : 'Ok', lastMove: 'Agora' } : item
        }),
      }))
    }
  }

  function addKnowledge(type: string) {
    updateLocal(prev => ({ ...prev, knowledge: [{ id: `D-${Date.now()}`, title: type === 'E-mail' ? 'Rascunho executivo criado pela Sofi' : 'Documento operacional em revisão', type, owner: 'Sofi IA', status: 'Rascunho' }, ...prev.knowledge] }))
  }

  function createAssetPurchase(asset: Asset) {
    const missing = Math.max(asset.min - asset.qty, 1)
    updateLocal(prev => ({
      ...prev,
      work: [{ id: `T-${Date.now()}`, title: `Comprar ${missing + 10} un. de ${asset.name}`, owner: asset.owner || 'Operação', area: 'Ativos', stage: 'Aguardando aprovação', priority: 'Alta', due: 'Hoje' }, ...prev.work],
      finance: [{ id: `F-${Date.now()}`, label: `Reposição: ${asset.name}`, type: 'Despesa', amount: (asset.unitCost || 100) * (missing + 10), status: 'A aprovar', due: 'Hoje' }, ...prev.finance],
    }))
  }

  function createPeopleAction(person: Person, title: string) {
    updateLocal(prev => ({ ...prev, work: [{ id: `T-${Date.now()}`, title, owner: person.name, area: 'Pessoas', stage: 'Novo', priority: person.workload && person.workload > 84 ? 'Alta' : 'Media', due: person.nextReview }, ...prev.work] }))
  }

  const agendaEvents = useMemo(() => [
    ...agendaBase,
    ...state.work.filter(item => item.due === 'Hoje').slice(0, 4).map((item, index) => ({ time: `${17 + index}:00`, title: item.title, area: item.area, color: priorityColor(item.priority) })),
  ], [state.work])

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Hoje" value={state.work.filter(item => item.due === 'Hoje').length.toString()} detail="tarefas do dia" color="#F8A303" />
        <MetricCard label="Prioridade" value={totals.highPriority.toString()} detail="itens críticos" color="#FF4757" />
        <MetricCard label="Matrículas" value={money.format(state.admissions.reduce((sum, item) => sum + item.value, 0))} detail={`${state.admissions.length} famílias`} color="#29ABE2" />
        <MetricCard label="Estoque" value={totals.criticalAssets.toString()} detail="itens em atenção" color="#E07B39" />
        <MetricCard label="Pessoas" value={`${totals.peoplePulse}%`} detail="pulso médio" color="#8B5CF6" />
      </section>

      <section className="grid gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-1.5 md:grid-cols-4">
        {[
          { id: 'centro', label: 'Centro', icon: CalendarDaysIcon, color: '#F8A303' },
          { id: 'trabalho', label: 'Tarefas e projetos', icon: FolderOpenIcon, color: '#0ABD78' },
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
            <p className="text-sm font-black text-white">Sofi integrada em todo o Centro</p>
            <p className="truncate text-xs font-semibold text-white/42">Agenda, tarefas, projetos, escola, financeiro, estoque e pessoas no mesmo contexto.</p>
          </div>
        </div>
        <button onClick={() => openSofi(sofiContext)} className="h-10 rounded-2xl bg-[#F8A303] px-4 text-sm font-black text-black">Abrir Sofi com contexto</button>
      </section>

      <form onSubmit={addQuickWork} className="grid gap-2 rounded-[1.2rem] border border-white/10 bg-[#080A12] p-3 md:grid-cols-[minmax(220px,1fr)_180px_48px]">
        <Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Criar tarefa rápida..." />
        <Input value={quickOwner} onChange={event => setQuickOwner(event.target.value)} placeholder="Responsável" />
        <button className="flex h-11 items-center justify-center rounded-2xl bg-[#F8A303] text-black"><PlusIcon className="h-5 w-5" /></button>
      </form>

      {tab === 'centro' && <CenterWorkspace state={state} events={agendaEvents} chatPrompt={chatPrompt} setChatPrompt={setChatPrompt} onAdvance={advanceWork} loading={loading} source={source} onAddKnowledge={addKnowledge} />}
      {tab === 'trabalho' && <WorkProjectsWorkspace work={state.work} onAdvance={advanceWork} />}
      {tab === 'escola' && <SchoolFinanceWorkspace state={state} totals={totals} onAddAdmission={addAdmission} onAddFinance={addFinance} onAdjustAsset={adjustAsset} onCreatePurchase={createAssetPurchase} onAddKnowledge={addKnowledge} />}
      {tab === 'pessoas' && <PeopleWorkspace people={state.people} work={state.work.filter(item => item.area === 'Pessoas' || item.area === 'Treinamento')} onAdvance={advanceWork} onCreateAction={createPeopleAction} />}
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

function SectionTitle({ icon: Icon, eyebrow, title, action }: { icon: typeof CalendarDaysIcon; eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><Icon className="h-5 w-5 text-white/70" /></div>
        <div>
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">{eyebrow}</p>}
          <h2 className="text-xl font-black text-white">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  )
}

function CenterWorkspace({ state, events, chatPrompt, setChatPrompt, onAdvance, loading, source, onAddKnowledge }: { state: ManagementState; events: typeof agendaBase; chatPrompt: string; setChatPrompt: (value: string) => void; onAdvance: (id: string) => void; loading: boolean; source: string; onAddKnowledge: (type: string) => void }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return date
  })

  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
      <Surface className="overflow-hidden">
        <SectionTitle icon={CalendarDaysIcon} eyebrow="Centro operacional" title={today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} action={<span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-white/45">{loading ? 'Sincronizando...' : source === 'api' ? 'API conectada' : 'Modo local'}</span>} />
        <div className="grid gap-px bg-white/10 lg:grid-cols-7">
          {days.map(day => (
            <div key={day.toISOString()} className="min-h-28 bg-[#10121A] p-3">
              <p className="text-xs font-black uppercase text-white/35">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
              <p className="mt-1 text-xl font-black text-white">{day.getDate()}</p>
              {day.toDateString() === today.toDateString() && <span className="mt-2 inline-flex rounded-full bg-[#F8A303]/15 px-2.5 py-1 text-[10px] font-black text-[#F8A303]">Hoje</span>}
            </div>
          ))}
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {events.map(item => (
              <div key={`${item.time}-${item.title}`} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-[70px_1fr_120px] md:items-center">
                <p className="font-mono text-sm font-black" style={{ color: item.color }}>{item.time}</p>
                <div>
                  <p className="font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-white/35">{item.area}</p>
                </div>
                <button onClick={() => openSofi(`Sofi, prepare briefing para este bloco: ${item.title}, área ${item.area}, horário ${item.time}.`)} className="w-fit rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/65">Briefing</button>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <CommandTile icon={ClockIcon} label="Foco protegido" value="10:00 - 11:00" detail="resolver aprovações e pendências críticas" />
            <CommandTile icon={ShieldCheckIcon} label="Risco do dia" value="Estoque crítico" detail="2 itens abaixo do mínimo operacional" />
            <CommandTile icon={EnvelopeIcon} label="Comunicações" value="3 rascunhos" detail="famílias, equipe e financeiro" />
          </div>
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#F8A303]/30 bg-[#F8A303]/12 p-3"><SparklesIcon className="h-6 w-6 text-[#F8A303]" /></div>
            <div>
              <h3 className="font-black text-white">Chat Sofi</h3>
              <p className="text-xs font-semibold text-white/38">Comando executivo do dia</p>
            </div>
          </div>
          <textarea value={chatPrompt} onChange={event => setChatPrompt(event.target.value)} className="mt-4 min-h-36 w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button onClick={() => openSofi(chatPrompt)} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F8A303] text-sm font-black text-black"><ChatBubbleLeftRightIcon className="h-5 w-5" /> Conversar</button>
            <button onClick={() => onAddKnowledge('E-mail')} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-black text-white"><EnvelopeIcon className="h-5 w-5" /> Criar rascunho</button>
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <SectionTitle icon={ClipboardDocumentListIcon} title="Tarefas do Centro" />
          <div className="divide-y divide-white/10">
            {state.work.slice(0, 6).map(item => <TaskRow key={item.id} item={item} onAdvance={onAdvance} />)}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function WorkProjectsWorkspace({ work, onAdvance }: { work: WorkItem[]; onAdvance: (id: string) => void }) {
  const columns = stageOrder.map(stage => ({ stage, items: work.filter(item => item.stage === stage) }))
  const highPriority = work.filter(item => item.priority === 'Alta')

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Backlog" value={work.filter(item => item.stage === 'Novo').length.toString()} detail="novas demandas" color="#F8A303" />
        <MetricCard label="Em progresso" value={work.filter(item => item.stage === 'Em andamento').length.toString()} detail="execução ativa" color="#0ABD78" />
        <MetricCard label="Aprovação" value={work.filter(item => item.stage === 'Aguardando aprovação').length.toString()} detail="fila executiva" color="#FF4757" />
        <MetricCard label="Projetos" value={new Set(work.map(item => item.area)).size.toString()} detail="frentes ativas" color="#29ABE2" />
      </div>

      <Surface className="overflow-hidden">
        <SectionTitle icon={FolderOpenIcon} eyebrow="PMO" title="Tarefas e projetos dentro do Centro" action={<button onClick={() => openSofi(`Sofi, priorize esta fila de trabalho: ${JSON.stringify(work)}`)} className="h-10 rounded-2xl bg-[#0ABD78] px-4 text-sm font-black text-black">Priorizar com Sofi</button>} />
        <div className="grid gap-4 p-5 xl:grid-cols-3 2xl:grid-cols-6">
          {columns.map(column => (
            <div key={column.stage} className="min-h-72 rounded-3xl border border-white/10 bg-black/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-white">{column.stage}</h3>
                <span className="rounded-full bg-white/[0.07] px-2 py-1 text-xs font-black text-white/55">{column.items.length}</span>
              </div>
              <div className="mt-3 space-y-3">
                {column.items.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-bold text-white/30">Sem itens</p>}
                {column.items.map(item => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-white/38">{item.owner} - {item.area}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <PriorityBadge value={item.priority} />
                      <button onClick={() => onAdvance(item.id)} className="rounded-full bg-[#F8A303] px-3 py-1 text-xs font-black text-black">Avançar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Surface className="overflow-hidden">
          <SectionTitle icon={ClipboardDocumentListIcon} title="Fila crítica" />
          <div className="divide-y divide-white/10">
            {highPriority.map(item => <TaskRow key={item.id} item={item} onAdvance={onAdvance} />)}
          </div>
        </Surface>
        <Surface className="p-5">
          <h3 className="font-black text-white">Projetos por área</h3>
          <div className="mt-4 space-y-3">
            {Array.from(new Set(work.map(item => item.area))).map(area => {
              const count = work.filter(item => item.area === area).length
              return (
                <div key={area} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-white">{area}</p>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">{count} itens</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function SchoolFinanceWorkspace({ state, totals, onAddAdmission, onAddFinance, onAdjustAsset, onCreatePurchase, onAddKnowledge }: { state: ManagementState; totals: { revenue: number; expense: number; balance: number; criticalAssets: number }; onAddAdmission: () => void; onAddFinance: (type: FinanceLine['type']) => void; onAdjustAsset: (id: string, delta: number) => void; onCreatePurchase: (asset: Asset) => void; onAddKnowledge: (type: string) => void }) {
  const [assetQuery, setAssetQuery] = useState('')
  const [assetFilter, setAssetFilter] = useState<'Todos' | 'Criticos' | 'Ok'>('Todos')
  const pipeline = admissionStages.map(stage => ({ stage, items: state.admissions.filter(item => item.stage === stage) }))
  const filteredAssets = state.assets.filter(item => {
    const haystack = `${item.name} ${item.category} ${item.location} ${item.supplier} ${item.owner}`.toLowerCase()
    const matchesQuery = haystack.includes(assetQuery.toLowerCase())
    const critical = item.qty <= item.min
    const matchesFilter = assetFilter === 'Todos' || (assetFilter === 'Criticos' ? critical : !critical)
    return matchesQuery && matchesFilter
  })

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Receitas" value={money.format(totals.revenue)} detail="previstas" color="#0ABD78" />
        <MetricCard label="Despesas" value={money.format(totals.expense)} detail="em aberto" color="#FF4757" />
        <MetricCard label="Saldo" value={money.format(totals.balance)} detail="projetado" color="#4A9EFF" />
        <MetricCard label="Estoque" value={totals.criticalAssets.toString()} detail="reposição ou risco" color="#E07B39" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(480px,0.85fr)]">
        <Surface className="overflow-hidden">
          <SectionTitle icon={AcademicCapIcon} eyebrow="CRM escolar" title="Matrículas e jornada da família" action={<button onClick={onAddAdmission} className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#29ABE2] px-4 text-sm font-black text-black"><PlusIcon className="h-4 w-4" /> Nova família</button>} />
          <div className="grid gap-3 p-5 lg:grid-cols-5">
            {pipeline.map(column => (
              <div key={column.stage} className="min-h-48 rounded-3xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white">{column.stage}</h3>
                  <span className="rounded-full bg-white/[0.07] px-2 py-1 text-xs font-black text-white/55">{column.items.length}</span>
                </div>
                <div className="mt-3 space-y-3">
                  {column.items.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-bold text-white/30">Sem famílias</p>}
                  {column.items.map(item => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="font-black text-white">{item.family}</p>
                      <p className="text-xs text-white/40">{item.student}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-[#0ABD78]">{money.format(item.value)}</span>
                        <button onClick={() => openSofi(`Sofi, conduza o follow-up da família ${item.family}. Etapa: ${item.stage}. Próxima ação: ${item.next}.`)} className="rounded-full bg-[#29ABE2]/15 px-3 py-1 text-xs font-black text-[#29ABE2]">Sofi</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <div className="space-y-5">
          <Surface className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-white">Financeiro escolar</h3>
              <div className="flex gap-2">
                <button onClick={() => onAddFinance('Receita')} className="h-9 rounded-xl bg-[#0ABD78] px-3 text-xs font-black text-black">Receita</button>
                <button onClick={() => onAddFinance('Despesa')} className="h-9 rounded-xl bg-[#FF4757] px-3 text-xs font-black text-white">Despesa</button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {state.finance.map(item => <FinanceRow key={item.id} item={item} />)}
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-white">Documentos e aprovações</h3>
              <button onClick={() => onAddKnowledge('Documento')} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-white">Novo</button>
            </div>
            <div className="mt-4 space-y-3">
              {state.knowledge.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.title}</p>
                    <p className="text-xs text-white/35">{item.type} - {item.owner}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">{item.status}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>

      <Surface className="overflow-hidden">
        <SectionTitle icon={CubeIcon} eyebrow="Almoxarifado e patrimônio" title="Controle de estoque profissional" action={<button onClick={() => openSofi(`Sofi, audite este estoque e defina reposições: ${JSON.stringify(state.assets)}`)} className="h-10 rounded-2xl bg-[#E07B39] px-4 text-sm font-black text-black">Auditar com Sofi</button>} />
        <div className="grid gap-4 border-b border-white/10 p-5 xl:grid-cols-[minmax(260px,1fr)_360px]">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_240px]">
            <Input value={assetQuery} onChange={event => setAssetQuery(event.target.value)} placeholder="Buscar item, local, fornecedor..." />
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
              {(['Todos', 'Criticos', 'Ok'] as const).map(item => (
                <button key={item} onClick={() => setAssetFilter(item)} className="h-9 rounded-xl text-xs font-black transition" style={{ background: assetFilter === item ? '#E07B39' : 'transparent', color: assetFilter === item ? '#05070D' : 'rgba(255,255,255,0.55)' }}>
                  {item === 'Criticos' ? 'Críticos' : item}
                </button>
              ))}
            </div>
          </div>
          <InventorySummary assets={state.assets} />
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-3">
          {filteredAssets.map(item => <AssetCard key={item.id} item={item} onAdjustAsset={onAdjustAsset} onCreatePurchase={onCreatePurchase} />)}
        </div>
      </Surface>

      <InventoryBackOffice assets={state.assets} onCreatePurchase={onCreatePurchase} />
    </section>
  )
}

function PeopleWorkspace({ people, work, onAdvance, onCreateAction }: { people: Person[]; work: WorkItem[]; onAdvance: (id: string) => void; onCreateAction: (person: Person, title: string) => void }) {
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleFilter, setPeopleFilter] = useState<'Todos' | 'Atencao' | 'Alta performance'>('Todos')
  const average = Math.round(people.reduce((sum, item) => sum + item.pulse, 0) / Math.max(1, people.length))
  const overload = people.filter(item => (item.workload || 0) >= 84).length
  const filteredPeople = people.filter(item => {
    const haystack = `${item.name} ${item.role} ${item.unit} ${item.training} ${(item.strengths || []).join(' ')}`.toLowerCase()
    const matchesQuery = haystack.includes(peopleQuery.toLowerCase())
    const attention = item.pulse < 75 || (item.workload || 0) >= 84
    const high = (item.score || 0) >= 4.5 && item.pulse >= 80
    const matchesFilter = peopleFilter === 'Todos' || (peopleFilter === 'Atencao' ? attention : high)
    return matchesQuery && matchesFilter
  })

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Pulso" value={`${average}%`} detail="média da equipe" color="#8B5CF6" />
        <MetricCard label="Avaliação" value={(people.reduce((sum, item) => sum + (item.score || 0), 0) / Math.max(1, people.length)).toFixed(1)} detail="média 0-5" color="#F8A303" />
        <MetricCard label="Presença" value={`${Math.round(people.reduce((sum, item) => sum + (item.attendance || 0), 0) / Math.max(1, people.length))}%`} detail="frequência" color="#0ABD78" />
        <MetricCard label="Sobrecarga" value={overload.toString()} detail="pessoas em atenção" color="#FF4757" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Surface className="overflow-hidden">
          <SectionTitle icon={UserGroupIcon} eyebrow="Equipe Sofi" title="Profissionais, fotos, avaliação e desenvolvimento" action={<button onClick={() => openSofi(`Sofi, gere um plano de desenvolvimento para esta equipe: ${JSON.stringify(people)}`)} className="h-10 rounded-2xl bg-[#8B5CF6] px-4 text-sm font-black text-white">Plano com Sofi</button>} />
          <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-[minmax(220px,1fr)_360px]">
            <Input value={peopleQuery} onChange={event => setPeopleQuery(event.target.value)} placeholder="Buscar profissional, setor, competência..." />
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
              {(['Todos', 'Atencao', 'Alta performance'] as const).map(item => (
                <button key={item} onClick={() => setPeopleFilter(item)} className="h-9 rounded-xl text-[11px] font-black transition" style={{ background: peopleFilter === item ? '#8B5CF6' : 'transparent', color: peopleFilter === item ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                  {item === 'Atencao' ? 'Atenção' : item}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 p-5 xl:grid-cols-3">
            {filteredPeople.map(item => <PersonCard key={item.id} person={item} onCreateAction={onCreateAction} />)}
          </div>
        </Surface>

        <div className="space-y-5">
          <Surface className="overflow-hidden">
            <SectionTitle icon={ClipboardDocumentListIcon} title="Ações de pessoas" />
            <div className="divide-y divide-white/10">
              {work.length === 0 && <p className="p-4 text-sm text-white/38">Nenhuma ação de pessoas em aberto.</p>}
              {work.map(item => <TaskRow key={item.id} item={item} onAdvance={onAdvance} />)}
            </div>
          </Surface>

          <Surface className="p-5">
            <h3 className="font-black text-white">Matriz de desenvolvimento</h3>
            <div className="mt-4 space-y-3">
              {people.map(item => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-white">{item.training}</p>
                    <span className="text-xs font-black text-[#A78BFA]">{item.nextReview}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/38">{item.name} - {item.nextAction}</p>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>

      <PeopleOperatingSystem people={people} onCreateAction={onCreateAction} />
    </section>
  )
}

function CommandTile({ icon: Icon, label, value, detail }: { icon: typeof ClockIcon; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className="h-5 w-5 text-[#F8A303]" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-white/38">{detail}</p>
    </div>
  )
}

function FinanceRow({ item }: { item: FinanceLine }) {
  const color = item.type === 'Receita' ? '#0ABD78' : '#FF4757'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">{item.label}</p>
        <p className="text-sm font-black" style={{ color }}>{money.format(item.amount)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-white/35">
        <span>{item.type}</span>
        <span>{item.status}</span>
        <span>{item.due}</span>
      </div>
    </div>
  )
}

function InventorySummary({ assets }: { assets: Asset[] }) {
  const totalValue = assets.reduce((sum, item) => sum + item.qty * (item.unitCost || 0), 0)
  const critical = assets.filter(item => item.qty <= item.min).length
  const categories = new Set(assets.map(item => item.category || 'Geral')).size
  return (
    <div className="grid grid-cols-3 gap-2">
      <MiniStat label="Valor" value={money.format(totalValue)} />
      <MiniStat label="Críticos" value={critical.toString()} />
      <MiniStat label="Categorias" value={categories.toString()} />
    </div>
  )
}

function InventoryBackOffice({ assets, onCreatePurchase }: { assets: Asset[]; onCreatePurchase: (asset: Asset) => void }) {
  const criticalAssets = assets.filter(item => item.qty <= item.min)
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Surface className="overflow-hidden">
        <SectionTitle icon={ClipboardDocumentListIcon} eyebrow="Compras e auditoria" title="Fila operacional de reposição" />
        <div className="divide-y divide-white/10">
          {criticalAssets.length === 0 && <p className="p-5 text-sm font-semibold text-white/42">Nenhum item abaixo do mínimo.</p>}
          {criticalAssets.map(item => (
            <div key={item.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_160px_160px] lg:items-center">
              <div>
                <p className="font-black text-white">{item.name}</p>
                <p className="mt-1 text-sm text-white/42">{item.nextAction}</p>
              </div>
              <div className="text-sm font-bold text-white/55">Faltam {Math.max(item.min - item.qty, 0)} para o mínimo</div>
              <button onClick={() => onCreatePurchase(item)} className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black">Gerar compra</button>
            </div>
          ))}
        </div>
      </Surface>
      <Surface className="p-5">
        <h3 className="font-black text-white">Movimentações recentes</h3>
        <div className="mt-4 space-y-3">
          {assets.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">{item.name}</p>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/55">{item.status}</span>
              </div>
              <p className="mt-1 text-xs text-white/38">{item.location} - última movimentação em {item.lastMove}</p>
            </div>
          ))}
        </div>
      </Surface>
    </section>
  )
}

function AssetCard({ item, onAdjustAsset, onCreatePurchase }: { item: Asset; onAdjustAsset: (id: string, delta: number) => void; onCreatePurchase: (asset: Asset) => void }) {
  const critical = item.qty <= item.min
  const coverage = Math.min(100, Math.round((item.qty / Math.max(1, item.min)) * 100))
  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-white">{item.name}</p>
          <p className="mt-1 text-xs font-semibold text-white/38">{item.category} - {item.location}</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: critical ? '#FF4757' : '#0ABD78', background: critical ? 'rgba(255,71,87,0.14)' : 'rgba(10,189,120,0.14)' }}>{item.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Atual" value={item.qty.toString()} />
        <MiniStat label="Mínimo" value={item.min.toString()} />
        <MiniStat label="Custo" value={money.format(item.unitCost || 0)} />
      </div>
      <div className="mt-4">
        <div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${coverage}%`, background: critical ? '#FF4757' : '#0ABD78' }} /></div>
        <p className="mt-2 text-xs text-white/38">Fornecedor: {item.supplier} - Responsável: {item.owner}</p>
        <p className="mt-1 text-xs text-white/38">Última movimentação: {item.lastMove}</p>
        <p className="mt-3 text-sm font-bold text-white">{item.nextAction}</p>
      </div>
      <div className="mt-4 grid grid-cols-[48px_48px_1fr] gap-2">
        <button onClick={() => onAdjustAsset(item.id, -1)} className="h-10 rounded-xl bg-white/[0.06] font-black text-white">-</button>
        <button onClick={() => onAdjustAsset(item.id, 1)} className="h-10 rounded-xl bg-[#E07B39] font-black text-black">+</button>
        <button onClick={() => onCreatePurchase(item)} className="h-10 rounded-xl bg-[#F8A303] px-3 text-xs font-black text-black">Comprar / aprovar</button>
      </div>
    </div>
  )
}

function PeopleOperatingSystem({ people, onCreateAction }: { people: Person[]; onCreateAction: (person: Person, title: string) => void }) {
  const reviewQueue = [...people].sort((a, b) => (b.workload || 0) - (a.workload || 0))
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Surface className="overflow-hidden">
        <SectionTitle icon={UserGroupIcon} eyebrow="RH operacional" title="Diretório, avaliação e próxima conversa" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-white/[0.035] text-left text-xs uppercase tracking-[0.12em] text-white/34">
              <tr><th className="px-5 py-3">Profissional</th><th className="px-5 py-3">Setor</th><th className="px-5 py-3">Avaliação</th><th className="px-5 py-3">Carga</th><th className="px-5 py-3">Próxima ação</th></tr>
            </thead>
            <tbody>
              {people.map(item => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-5 py-4"><p className="font-black text-white">{item.name}</p><p className="text-xs text-white/38">{item.role}</p></td>
                  <td className="px-5 py-4 text-sm text-white/60">{item.unit}</td>
                  <td className="px-5 py-4 text-sm font-black text-[#F8A303]">{item.score?.toFixed(1)}</td>
                  <td className="px-5 py-4 text-sm font-black" style={{ color: (item.workload || 0) > 84 ? '#FF4757' : '#0ABD78' }}>{item.workload}%</td>
                  <td className="px-5 py-4 text-sm text-white/55">{item.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
      <Surface className="p-5">
        <h3 className="font-black text-white">Fila de liderança</h3>
        <div className="mt-4 space-y-3">
          {reviewQueue.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{item.name}</p>
                  <p className="mt-1 text-xs text-white/38">{item.risks?.join(', ') || 'sem risco registrado'}</p>
                </div>
                <span className="rounded-full bg-[#8B5CF6]/15 px-3 py-1 text-xs font-black text-[#A78BFA]">{item.nextReview}</span>
              </div>
              <button onClick={() => onCreateAction(item, `Registrar feedback e plano de desenvolvimento de ${item.name}`)} className="mt-3 h-9 w-full rounded-xl bg-[#8B5CF6] px-3 text-xs font-black text-white">Criar feedback</button>
            </div>
          ))}
        </div>
      </Surface>
    </section>
  )
}

function PersonCard({ person, onCreateAction }: { person: Person; onCreateAction: (person: Person, title: string) => void }) {
  const workload = person.workload || 0
  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-start gap-3">
        <img src={person.avatar} alt={person.name} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black text-white">{person.name}</h3>
          <p className="text-xs font-semibold text-white/42">{person.role}</p>
          <p className="mt-1 text-xs font-black text-[#A78BFA]">{person.unit}</p>
        </div>
        <span className="rounded-full bg-[#8B5CF6]/15 px-3 py-1 text-xs font-black text-[#A78BFA]">{person.score?.toFixed(1)}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Pulso" value={`${person.pulse}%`} />
        <MiniStat label="Presença" value={`${person.attendance}%`} />
        <MiniStat label="Carga" value={`${workload}%`} />
      </div>
      <div className="mt-4 space-y-2">
        <Progress label="Engajamento" value={person.pulse} color="#8B5CF6" />
        <Progress label="Carga de trabalho" value={workload} color={workload > 84 ? '#FF4757' : '#F8A303'} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(person.strengths || []).map(item => <span key={item} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/55">{item}</span>)}
      </div>
      <div className="mt-4 rounded-2xl bg-white/[0.04] p-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Próxima ação</p>
        <p className="mt-1 text-sm font-bold text-white">{person.nextAction}</p>
        <p className="mt-1 text-xs text-white/38">Avaliação: {person.nextReview}</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={() => onCreateAction(person, `Realizar 1:1 com ${person.name}`)} className="h-10 rounded-xl bg-[#8B5CF6] px-3 text-xs font-black text-white">Criar 1:1</button>
        <button onClick={() => openSofi(`Sofi, analise o perfil profissional de ${person.name}: ${JSON.stringify(person)}. Gere feedback, plano de desenvolvimento e riscos.`)} className="h-10 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-black text-white">Sofi</button>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.045] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/30">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  )
}

function Progress({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-white/45"><span>{label}</span><span>{value}%</span></div>
      <div className="mt-1 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
    </div>
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
        <button onClick={() => onAdvance(item.id)} className="rounded-full bg-[#F8A303] px-3 py-1 text-xs font-black text-black">Avançar</button>
      </div>
    </div>
  )
}
