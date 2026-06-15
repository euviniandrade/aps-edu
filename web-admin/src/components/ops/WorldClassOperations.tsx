'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import {
  AcademicCapIcon,
  ArrowPathIcon,
  BanknotesIcon,
  BoltIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PlayIcon,
  PlusIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type ModuleId = 'comando' | 'projetos' | 'escola' | 'pessoas' | 'financeiro' | 'ativos' | 'conhecimento' | 'automacoes'
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

const modules = [
  { id: 'comando', title: 'Comando executivo', eyebrow: 'Visao 360', description: 'Prioridades, riscos, metas, agenda, decisoes e IA em uma camada de comando.', color: '#F8A303', icon: ChartBarIcon, score: 92, inspiredBy: ['Linear', 'Asana', 'monday.com', 'Motion'] },
  { id: 'projetos', title: 'Projetos e tarefas', eyebrow: 'Execucao', description: 'Kanban, SLA, responsaveis, prazos, dependencias, automacoes e status executivo.', color: '#0ABD78', icon: CheckCircleIcon, score: 86, inspiredBy: ['ClickUp', 'Jira', 'Trello', 'Wrike'] },
  { id: 'escola', title: 'Gestao escolar', eyebrow: 'SIS + CRM', description: 'Matriculas, familias, ocorrencias, calendario escolar e acompanhamento pedagogico.', color: '#29ABE2', icon: AcademicCapIcon, score: 81, inspiredBy: ['PowerSchool', 'Blackbaud', 'Classter', 'Proesc'] },
  { id: 'pessoas', title: 'Pessoas e cultura', eyebrow: 'RH inteligente', description: 'Performance, clima, feedback, treinamentos, organograma e desenvolvimento.', color: '#8B5CF6', icon: UserGroupIcon, score: 78, inspiredBy: ['Workday', 'HiBob', 'Lattice', 'Culture Amp'] },
  { id: 'financeiro', title: 'Financeiro escolar', eyebrow: 'Receitas e aprovacoes', description: 'Fluxo previsto, despesas, aprovacoes, contratos, inadimplencia e orcamento.', color: '#4A9EFF', icon: BanknotesIcon, score: 83, inspiredBy: ['NetSuite', 'Odoo', 'Omie', 'FACTS'] },
  { id: 'ativos', title: 'Estoque e patrimonio', eyebrow: 'Operacao fisica', description: 'Reposicao, ativos criticos, compras, inventario e manutencao preventiva.', color: '#E07B39', icon: CubeIcon, score: 80, inspiredBy: ['Zoho Inventory', 'Sortly', 'ERPNext', 'TOTVS'] },
  { id: 'conhecimento', title: 'Notas, e-mail e documentos', eyebrow: 'Conhecimento vivo', description: 'Atas, politicas, e-mails, resumos, documentos controlados e biblioteca operacional.', color: '#F9C234', icon: DocumentTextIcon, score: 84, inspiredBy: ['Notion', 'Coda', 'Superhuman', 'Google Workspace'] },
  { id: 'automacoes', title: 'Automacoes e IA', eyebrow: 'Agentes', description: 'Regras, gatilhos, assistentes, alertas, planos e triagem automatica.', color: '#14B8A6', icon: BoltIcon, score: 88, inspiredBy: ['Reclaim AI', 'Motion', 'Zapier', 'Gemini'] },
] as const

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

function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.35rem] ${className}`} style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.028))', border: '1px solid rgba(255,255,255,0.095)', boxShadow: '0 22px 70px rgba(0,0,0,0.24)' }}>
      {children}
    </section>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 w-full rounded-2xl px-3 text-sm text-white outline-none transition focus:border-white/25 ${props.className || ''}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', ...props.style }} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-28 w-full rounded-2xl px-3 py-3 text-sm text-white outline-none ${props.className || ''}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', ...props.style }} />
}

function PriorityBadge({ value }: { value: Priority }) {
  const color = value === 'Alta' ? '#FF4757' : value === 'Media' ? '#F8A303' : '#0ABD78'
  return <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ color, background: `${color}18`, border: `1px solid ${color}22` }}>{value === 'Media' ? 'Media' : value}</span>
}

export default function WorldClassOperations() {
  const [activeModule, setActiveModule] = useState<ModuleId>('comando')
  const [state, setState] = useState<ManagementState>(fallbackState)
  const [source, setSource] = useState<'api' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [command, setCommand] = useState('Analise a semana da APS EDU, priorize matriculas, atrasos, estoque critico, treinamento de pessoas e financeiro.')
  const [aiPlan, setAiPlan] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickOwner, setQuickOwner] = useState('Sofi IA')

  const active = useMemo(() => modules.find(item => item.id === activeModule) || modules[0], [activeModule])
  const ActiveIcon = active.icon

  function readLocalState() {
    try {
      const raw = localStorage.getItem(MANAGEMENT_CACHE_KEY)
      if (!raw) return fallbackState
      return { ...fallbackState, ...JSON.parse(raw) }
    } catch {
      return fallbackState
    }
  }

  function saveLocalState(next: ManagementState) {
    try {
      localStorage.setItem(MANAGEMENT_CACHE_KEY, JSON.stringify(next))
    } catch {}
  }

  function updateLocal(updater: (current: ManagementState) => ManagementState) {
    setState(current => {
      const next = updater(current)
      saveLocalState(next)
      return next
    })
    setSource('local')
  }

  async function loadManagement() {
    setLoading(true)
    try {
      const res = await api.get('/management')
      setState({ ...fallbackState, ...res.data })
      saveLocalState({ ...fallbackState, ...res.data })
      setSource('api')
    } catch {
      setState(readLocalState())
      setSource('local')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadManagement()
  }, [])

  function applyState(next: ManagementState) {
    const hydrated = { ...fallbackState, ...next }
    setState(hydrated)
    saveLocalState(hydrated)
    setSource('api')
  }

  const metrics = useMemo(() => {
    const revenue = state.finance.filter(item => item.type === 'Receita').reduce((sum, item) => sum + item.amount, 0)
    const expense = state.finance.filter(item => item.type === 'Despesa').reduce((sum, item) => sum + item.amount, 0)
    const criticalAssets = state.assets.filter(item => item.qty <= item.min).length
    const highPriority = state.work.filter(item => item.priority === 'Alta').length
    return [
      { label: 'Saude operacional', value: '87%', detail: source === 'api' ? 'dados persistidos' : 'modo local', color: '#0ABD78' },
      { label: 'Prioridades criticas', value: highPriority.toString(), detail: 'na fila executiva', color: '#FF4757' },
      { label: 'Pipeline escolar', value: money.format(state.admissions.reduce((sum, item) => sum + item.value, 0)), detail: `${state.admissions.length} familias`, color: '#29ABE2' },
      { label: 'Saldo previsto', value: money.format(revenue - expense), detail: 'receita menos despesas', color: '#4A9EFF' },
      { label: 'Ativos em atencao', value: criticalAssets.toString(), detail: 'abaixo do minimo', color: '#E07B39' },
    ]
  }, [source, state])

  async function addQuickWork(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim()) return
    const payload = { title: quickTitle, owner: quickOwner || 'Sofi IA', area: active.title, priority: 'Alta', due: 'Hoje' }
    setQuickTitle('')
    try {
      const res = await api.post('/management/work', payload)
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, work: [{ id: `T-${Date.now()}`, ...payload, stage: 'Novo', priority: 'Alta' }, ...prev.work] as WorkItem[] }))
    }
  }

  async function advanceWork(id: string) {
    try {
      const res = await api.patch(`/management/work/${id}/advance`)
      applyState(res.data)
    } catch {
      const map: Record<string, string> = { Novo: 'Planejado', Planejado: 'Em andamento', 'Em andamento': 'Em revisao', 'Aguardando aprovacao': 'Em andamento', Hoje: 'Em andamento', 'Em revisao': 'Concluido' }
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

  async function addKnowledge(type: string) {
    try {
      const res = await api.post('/management/knowledge', { type })
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, knowledge: [{ id: `K-${Date.now()}`, title: type === 'E-mail' ? 'Novo rascunho de e-mail executivo' : 'Nova nota operacional', type, owner: 'Sofi IA', status: 'Rascunho' }, ...prev.knowledge] }))
    }
  }

  async function toggleAutomation(id: string) {
    try {
      const res = await api.patch(`/management/automations/${id}/toggle`)
      applyState(res.data)
    } catch {
      updateLocal(prev => ({ ...prev, automations: prev.automations.map(item => item.id === id ? { ...item, status: item.status === 'Ativa' ? 'Rascunho' : 'Ativa' } : item) }))
    }
  }

  async function generatePlan() {
    setLoadingAi(true)
    setAiPlan('')
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Voce e a Sofi IA, gestora operacional da APS EDU. Responda em portugues do Brasil com plano executivo, riscos, responsaveis, calendario, e-mails sugeridos e automacoes. Contexto: ${command}. Dados: tarefas=${state.work.length}, admissoes=${state.admissions.length}, ativos criticos=${state.assets.filter(item => item.qty <= item.min).length}.` }),
      })
      const data = await res.json()
      setAiPlan(data.content || 'Plano gerado, mas o provedor nao retornou texto.')
    } catch {
      setAiPlan('Plano executivo: 1. resolver prioridades criticas hoje; 2. confirmar visitas de matricula; 3. pedir aprovacao dos ativos abaixo do minimo; 4. preparar e-mail de alinhamento para responsaveis; 5. bloquear agenda para treinamento de coordenadores.')
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080A12] p-5 shadow-2xl lg:p-7">
        <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 20% 10%, rgba(248,163,3,0.18), transparent 32%), radial-gradient(circle at 80% 0%, rgba(41,171,226,0.16), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.06), transparent 55%)' }} />
        <div className="relative grid gap-6 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#F8A303]/30 bg-[#F8A303]/12 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#F8A303]">APS EDU OS 2026</span>
              <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-bold text-white/52">{source === 'api' ? 'API de gestao conectada' : 'Modo local ate autenticar'}</span>
            </div>
            <h1 className="mt-5 max-w-5xl text-4xl font-black leading-[0.95] text-white lg:text-6xl">Um centro de comando escolar com IA, fluxo e profundidade real.</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/58">Estrutura inspirada nos melhores padroes atuais: execucao rapida da Linear, bases flexiveis do Notion, automacoes do monday.com, agenda inteligente do Motion, gestao escolar de PowerSchool e controle operacional de Odoo/NetSuite.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {metrics.map(metric => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">{metric.label}</p>
                  <p className="mt-2 text-2xl font-black leading-tight" style={{ color: metric.color }}>{metric.value}</p>
                  <p className="mt-1 text-xs font-semibold text-white/40">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <Surface className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl p-3" style={{ background: `${active.color}18`, border: `1px solid ${active.color}35` }}><ActiveIcon className="h-7 w-7" style={{ color: active.color }} /></div>
              <div><p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: active.color }}>{active.eyebrow}</p><h2 className="text-xl font-black text-white">{active.title}</h2></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/54">{active.description}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {['Dados', 'Fluxo', 'IA'].map(item => (
                <span key={item} className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-center text-xs font-black text-white/58">{item}</span>
              ))}
            </div>
            {loading && <p className="mt-4 text-xs font-bold text-white/40">Carregando dados operacionais...</p>}
          </Surface>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {modules.map(item => {
          const Icon = item.icon
          const selected = item.id === activeModule
          return (
            <button key={item.id} onClick={() => setActiveModule(item.id as ModuleId)} className="group min-h-32 rounded-3xl border p-4 text-left transition duration-200 hover:-translate-y-0.5" style={{ background: selected ? `${item.color}16` : 'rgba(255,255,255,0.035)', borderColor: selected ? `${item.color}66` : 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-3"><Icon className="h-6 w-6" style={{ color: selected ? item.color : 'rgba(255,255,255,0.42)' }} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: selected ? item.color : 'rgba(255,255,255,0.20)' }} /></div>
              <p className="mt-4 text-sm font-black leading-tight text-white">{item.title}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/42">{item.description}</p>
            </button>
          )
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Surface className="overflow-hidden">
          <div className="border-b border-white/10 p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#29ABE2]">Workbench ativo</p><h2 className="mt-1 text-2xl font-black text-white">{active.title}</h2><p className="mt-1 text-sm text-white/45">{active.description}</p></div>
              <form onSubmit={addQuickWork} className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_150px_44px]">
                <Input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} placeholder="Criar acao rapida..." />
                <Input value={quickOwner} onChange={e => setQuickOwner(e.target.value)} placeholder="Responsavel" />
                <button className="flex h-11 items-center justify-center rounded-2xl bg-[#F8A303] text-black"><PlusIcon className="h-5 w-5" /></button>
              </form>
            </div>
          </div>
          <div className="p-5 lg:p-6">
            {activeModule === 'comando' && <CommandView state={state} onAdvance={advanceWork} />}
            {activeModule === 'projetos' && <ProjectsView work={state.work} onAdvance={advanceWork} />}
            {activeModule === 'escola' && <SchoolView admissions={state.admissions} onAdd={addAdmission} />}
            {activeModule === 'pessoas' && <PeopleView people={state.people} />}
            {activeModule === 'financeiro' && <FinanceView finance={state.finance} onAdd={addFinance} />}
            {activeModule === 'ativos' && <AssetsView assets={state.assets} onAdjust={adjustAsset} />}
            {activeModule === 'conhecimento' && <KnowledgeView items={state.knowledge} onAdd={addKnowledge} />}
            {activeModule === 'automacoes' && <AutomationView automations={state.automations} onToggle={toggleAutomation} />}
          </div>
        </Surface>

        <div className="space-y-5">
          <Surface className="p-5 lg:p-6">
            <div className="flex items-center gap-3"><div className="rounded-2xl border border-[#F8A303]/30 bg-[#F8A303]/14 p-3"><SparklesIcon className="h-6 w-6 text-[#F8A303]" /></div><div><h2 className="text-lg font-black text-white">Sofi IA gestora</h2><p className="text-sm text-white/45">Planeja, prioriza, escreve e automatiza.</p></div></div>
            <TextArea value={command} onChange={e => setCommand(e.target.value)} className="mt-4" />
            <button onClick={generatePlan} disabled={loadingAi} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#F8A303] text-sm font-black text-black disabled:opacity-60">{loadingAi ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <RocketLaunchIcon className="h-4 w-4" />}{loadingAi ? 'Analisando...' : 'Gerar plano com IA'}</button>
            {aiPlan && <div className="mt-4 max-h-72 overflow-y-auto rounded-3xl border border-[#F8A303]/20 bg-[#F8A303]/10 p-4 text-sm leading-6 text-white/78">{aiPlan}</div>}
          </Surface>
        </div>
      </section>
    </div>
  )
}

function CommandView({ state, onAdvance }: { state: ManagementState; onAdvance: (id: string) => void }) {
  const agenda = [{ time: '09:00', title: 'Revisao das prioridades criticas', area: 'Comando' }, { time: '10:30', title: 'Follow-up de familias em visita', area: 'Matriculas' }, { time: '14:00', title: 'Aprovacoes financeiras e estoque', area: 'Operacao' }, { time: '16:30', title: 'Resumo executivo para lideres', area: 'IA' }]
  return <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><InsightCard icon={AcademicCapIcon} label="Matriculas" value={state.admissions.length.toString()} detail="familias no funil" color="#29ABE2" /><InsightCard icon={CubeIcon} label="Estoque critico" value={state.assets.filter(item => item.qty <= item.min).length.toString()} detail="itens em atencao" color="#E07B39" /><InsightCard icon={BanknotesIcon} label="Financeiro" value={money.format(state.finance.reduce((sum, item) => sum + (item.type === 'Receita' ? item.amount : -item.amount), 0))} detail="saldo previsto" color="#4A9EFF" /></div><WorkList work={state.work} onAdvance={onAdvance} /></div><div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"><h3 className="text-lg font-black text-white">Agenda inteligente</h3><p className="mt-1 text-sm text-white/42">Blocos sugeridos pelo centro de comando.</p><div className="mt-4 space-y-3">{agenda.map(item => <div key={item.time} className="grid grid-cols-[54px_1fr] gap-3 rounded-2xl bg-white/[0.035] p-3"><span className="text-xs font-black text-[#F8A303]">{item.time}</span><div><p className="text-sm font-bold text-white">{item.title}</p><p className="text-xs text-white/35">{item.area}</p></div></div>)}</div></div></div>
}

function ProjectsView({ work, onAdvance }: { work: WorkItem[]; onAdvance: (id: string) => void }) {
  const lanes = ['Novo', 'Planejado', 'Em andamento', 'Aguardando aprovacao', 'Em revisao', 'Concluido']
  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-2">
      <div className="grid min-w-[1120px] grid-cols-6 gap-3">
        {lanes.map(lane => {
          const laneItems = work.filter(item => item.stage === lane)
          return (
            <section key={lane} className="min-h-[420px] rounded-3xl border border-white/10 bg-black/15 p-3">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <h3 className="text-sm font-black leading-tight text-white">{lane}</h3>
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/[0.065] px-2 text-xs font-black text-white/58">{laneItems.length}</span>
              </div>
              <div className="mt-3 space-y-3">
                {laneItems.map(item => <TaskCard key={item.id} item={item} onAdvance={onAdvance} />)}
                {laneItems.length === 0 && (
                  <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs font-bold text-white/28">
                    Sem itens
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function SchoolView({ admissions, onAdd }: { admissions: Admission[]; onAdd: () => void }) {
  return <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-white">CRM escolar e jornada da familia</h3><p className="text-sm text-white/42">Funil com valor, etapa e proxima acao.</p></div><button onClick={onAdd} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#29ABE2] px-4 text-sm font-black text-black"><PlusIcon className="h-4 w-4" /> Nova familia</button></div><div className="overflow-x-auto rounded-3xl border border-white/10"><table className="w-full min-w-[760px]"><thead className="bg-white/[0.035] text-left text-xs uppercase tracking-[0.12em] text-white/34"><tr><th className="px-5 py-3">Familia</th><th className="px-5 py-3">Etapa</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Proxima acao</th></tr></thead><tbody>{admissions.map(item => <tr key={item.id} className="border-t border-white/10"><td className="px-5 py-4"><p className="font-black text-white">{item.family}</p><p className="text-xs text-white/38">{item.student}</p></td><td className="px-5 py-4 text-sm text-white/65">{item.stage}</td><td className="px-5 py-4 text-sm font-black text-[#0ABD78]">{money.format(item.value)}</td><td className="px-5 py-4 text-sm text-white/55">{item.next}</td></tr>)}</tbody></table></div></div>
}

function PeopleView({ people }: { people: Person[] }) {
  return <div className="grid gap-4 xl:grid-cols-3">{people.map(item => <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black text-white">{item.name}</h3><p className="mt-1 text-sm text-white/42">{item.role}</p></div><span className="rounded-full bg-[#8B5CF6]/15 px-3 py-1 text-xs font-black text-[#A78BFA]">{item.pulse}%</span></div><div className="mt-5 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-[#8B5CF6]" style={{ width: `${item.pulse}%` }} /></div><div className="mt-5 rounded-2xl bg-white/[0.04] p-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Trilha sugerida</p><p className="mt-1 text-sm font-bold text-white">{item.training}</p><p className="mt-1 text-xs text-white/40">Proxima avaliacao: {item.nextReview}</p></div></div>)}</div>
}

function FinanceView({ finance, onAdd }: { finance: FinanceLine[]; onAdd: (type: FinanceLine['type']) => void }) {
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><button onClick={() => onAdd('Receita')} className="rounded-2xl bg-[#0ABD78] px-4 py-2 text-sm font-black text-black">Nova receita</button><button onClick={() => onAdd('Despesa')} className="rounded-2xl bg-[#FF4757] px-4 py-2 text-sm font-black text-white">Nova despesa</button></div><div className="grid gap-3">{finance.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-black text-white">{item.label}</p><p className="mt-1 text-sm text-white/42">{item.status} - {item.due}</p></div><span className="text-xl font-black" style={{ color: item.type === 'Receita' ? '#0ABD78' : '#FF4757' }}>{money.format(item.amount)}</span></div>)}</div></div>
}

function AssetsView({ assets, onAdjust }: { assets: Asset[]; onAdjust: (id: string, delta: number) => void }) {
  return <div className="grid gap-4 xl:grid-cols-3">{assets.map(item => { const critical = item.qty <= item.min; return <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black text-white">{item.name}</h3><p className="mt-1 text-sm text-white/42">{item.location}</p></div><span className="rounded-full px-3 py-1 text-xs font-black" style={{ color: critical ? '#FF4757' : '#0ABD78', background: critical ? 'rgba(255,71,87,0.14)' : 'rgba(10,189,120,0.14)' }}>{item.status}</span></div><p className="mt-5 text-4xl font-black text-white">{item.qty}</p><p className="text-sm text-white/40">minimo operacional: {item.min}</p><div className="mt-5 flex gap-2"><button onClick={() => onAdjust(item.id, -1)} className="h-10 flex-1 rounded-2xl bg-white/[0.06] font-black text-white">-1</button><button onClick={() => onAdjust(item.id, 1)} className="h-10 flex-1 rounded-2xl bg-[#E07B39] font-black text-black">+1</button></div></div> })}</div>
}

function KnowledgeView({ items, onAdd }: { items: KnowledgeItem[]; onAdd: (type: string) => void }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><button onClick={() => onAdd('Nota')} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"><ClipboardDocumentListIcon className="h-6 w-6 text-[#F9C234]" /><p className="mt-3 font-black text-white">Nova nota</p></button><button onClick={() => onAdd('E-mail')} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"><EnvelopeIcon className="h-6 w-6 text-[#29ABE2]" /><p className="mt-3 font-black text-white">Rascunho de e-mail</p></button><button onClick={() => onAdd('Documento')} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"><DocumentTextIcon className="h-6 w-6 text-[#8B5CF6]" /><p className="mt-3 font-black text-white">Documento controlado</p></button></div><div className="grid gap-3">{items.map(item => <div key={item.id} className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-black text-white">{item.title}</p><p className="mt-1 text-sm text-white/42">{item.type} - {item.owner}</p></div><span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/58">{item.status}</span></div>)}</div></div>
}

function AutomationView({ automations, onToggle }: { automations: Automation[]; onToggle: (id: string) => void }) {
  return <div className="space-y-3">{automations.map(item => <button key={item.id} onClick={() => onToggle(item.id)} className="grid w-full gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-left md:grid-cols-[1fr_44px_1fr_90px] md:items-center"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Gatilho</p><p className="mt-1 font-bold text-white">{item.trigger}</p></div><PlayIcon className="hidden h-5 w-5 text-[#14B8A6] md:block" /><div><p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Acao</p><p className="mt-1 font-bold text-white">{item.action}</p></div><span className="w-fit rounded-full px-3 py-1 text-xs font-black" style={{ color: item.status === 'Ativa' ? '#0ABD78' : '#F8A303', background: item.status === 'Ativa' ? 'rgba(10,189,120,0.14)' : 'rgba(248,163,3,0.14)' }}>{item.status}</span></button>)}</div>
}

function InsightCard({ icon: Icon, label, value, detail, color }: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string; value: string; detail: string; color: string }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"><Icon className="h-6 w-6" style={{ color }} /><p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-white/35">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-white/40">{detail}</p></div>
}

function WorkList({ work, onAdvance }: { work: WorkItem[]; onAdvance: (id: string) => void }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.025]"><div className="border-b border-white/10 p-4"><h3 className="text-lg font-black text-white">Fila executiva</h3></div><div className="divide-y divide-white/10">{work.map(item => <div key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="font-black text-white">{item.title}</p><p className="mt-1 text-sm text-white/42">{item.owner} - {item.area} - {item.due}</p></div><div className="flex flex-wrap items-center gap-2"><PriorityBadge value={item.priority} /><span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">{item.stage}</span><button onClick={() => onAdvance(item.id)} className="rounded-full bg-[#F8A303] px-3 py-1 text-xs font-black text-black">Avancar</button></div></div>)}</div></div>
}

function TaskCard({ item, onAdvance }: { item: WorkItem; onAdvance: (id: string) => void }) {
  const priorityColor = item.priority === 'Alta' ? '#FF4757' : item.priority === 'Media' ? '#F8A303' : '#0ABD78'
  return (
    <button onClick={() => onAdvance(item.id)} className="group w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
      <div className="h-1" style={{ background: priorityColor }} />
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-3 text-sm font-black leading-5 text-white">{item.title}</p>
          <PriorityBadge value={item.priority} />
        </div>
        <div className="mt-3 rounded-xl bg-black/15 px-3 py-2">
          <p className="truncate text-xs font-bold text-white/58">{item.owner}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-white/32">{item.area}</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-white/42">
          <span className="inline-flex min-w-0 items-center gap-2"><CalendarDaysIcon className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{item.due}</span></span>
          <span className="text-[11px] text-white/28 group-hover:text-white/52">Avancar</span>
        </div>
      </div>
    </button>
  )
}
