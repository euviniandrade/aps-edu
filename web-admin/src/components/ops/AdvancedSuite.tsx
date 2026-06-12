'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BanknotesIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  FlagIcon,
  IdentificationIcon,
  QrCodeIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline'

type Lead = { id: string; student: string; family: string; source: string; stage: string; value: number; owner: string; nextStep: string }
type Finance = { id: string; description: string; type: 'Receita' | 'Despesa'; amount: number; due: string; status: string; unit: string }
type Approval = { id: string; title: string; requester: string; area: string; amount: number; status: string; priority: string }
type FormItem = { id: string; title: string; category: string; responses: number; status: string; owner: string }
type Goal = { id: string; title: string; owner: string; progress: number; confidence: string; due: string }
type DocumentItem = { id: string; title: string; type: string; status: string; owner: string; updated: string }
type Asset = { id: string; name: string; tag: string; unit: string; condition: string; nextReview: string }

type SuiteState = {
  leads: Lead[]
  finance: Finance[]
  approvals: Approval[]
  forms: FormItem[]
  goals: Goal[]
  docs: DocumentItem[]
  assets: Asset[]
}

const STORAGE_KEY = 'aps_edu_advanced_suite_v1'

const initialState: SuiteState = {
  leads: [
    { id: 'MAT-1042', student: 'Família Silva', family: 'Pedro Silva - 6º ano', source: 'Indicação', stage: 'Visita agendada', value: 1850, owner: 'Secretaria', nextStep: 'Confirmar visita pedagógica' },
    { id: 'MAT-1043', student: 'Família Andrade', family: 'Lívia Andrade - 1º ano', source: 'Campanha', stage: 'Proposta enviada', value: 1620, owner: 'Coordenação', nextStep: 'Enviar bolsa e documentação' },
  ],
  finance: [
    { id: 'FIN-2201', description: 'Matrículas previstas', type: 'Receita', amount: 3470, due: 'Hoje', status: 'Previsto', unit: 'APS' },
    { id: 'FIN-2202', description: 'Compra de materiais pedagógicos', type: 'Despesa', amount: 980, due: 'Amanhã', status: 'A aprovar', unit: 'CAIS' },
  ],
  approvals: [
    { id: 'APR-331', title: 'Reposição de projetores', requester: 'Tecnologia', area: 'Estoque', amount: 4200, status: 'Em análise', priority: 'Alta' },
    { id: 'APR-332', title: 'Contrato de campanha escolar', requester: 'Marketing', area: 'Financeiro', amount: 2600, status: 'Pendente', priority: 'Média' },
  ],
  forms: [
    { id: 'FOR-18', title: 'Solicitação de compra', category: 'Operação', responses: 14, status: 'Publicado', owner: 'Administração' },
    { id: 'FOR-19', title: 'Ocorrência pedagógica', category: 'Escola', responses: 9, status: 'Rascunho', owner: 'Coordenação' },
  ],
  goals: [
    { id: 'OKR-01', title: 'Elevar retenção da rede', owner: 'Direção', progress: 68, confidence: 'Alta', due: '30/06' },
    { id: 'OKR-02', title: 'Reduzir chamados atrasados', owner: 'Operação', progress: 42, confidence: 'Média', due: '21/06' },
  ],
  docs: [
    { id: 'DOC-75', title: 'Política de matrícula 2026', type: 'Política', status: 'Revisão', owner: 'Secretaria', updated: 'Hoje' },
    { id: 'DOC-76', title: 'Checklist de eventos escolares', type: 'Procedimento', status: 'Aprovado', owner: 'Eventos', updated: 'Ontem' },
  ],
  assets: [
    { id: 'PAT-9001', name: 'Projetor Epson X49', tag: 'APS-TI-004', unit: 'CAEA', condition: 'Bom', nextReview: '25/06' },
    { id: 'PAT-9002', name: 'Notebook Secretaria', tag: 'APS-SEC-012', unit: 'APS', condition: 'Manutenção', nextReview: '18/06' },
  ],
}

const tabs = [
  { id: 'crm', label: 'CRM e Matrículas', icon: UserPlusIcon, color: '#0ABD78' },
  { id: 'financeiro', label: 'Financeiro', icon: BanknotesIcon, color: '#4A9EFF' },
  { id: 'aprovacoes', label: 'Aprovações', icon: CheckBadgeIcon, color: '#F8A303' },
  { id: 'formularios', label: 'Formulários', icon: ClipboardDocumentListIcon, color: '#8B5CF6' },
  { id: 'metas', label: 'Metas e OKRs', icon: FlagIcon, color: '#F9C234' },
  { id: 'documentos', label: 'Documentos', icon: DocumentTextIcon, color: '#29ABE2' },
  { id: 'patrimonio', label: 'Patrimônio', icon: QrCodeIcon, color: '#E07B39' },
] as const

type TabId = typeof tabs[number]['id']

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-5)}`
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg ${className}`} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</span>
      {children}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-10 w-full rounded-lg px-3 text-sm text-white outline-none ${props.className || ''}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', ...props.style }} />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 w-full rounded-lg px-3 text-sm text-white outline-none ${props.className || ''}`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', ...props.style }} />
}

function PrimaryButton({ children, color = '#F8A303' }: { children: React.ReactNode; color?: string }) {
  return <button className="h-10 w-full rounded-lg px-4 text-sm font-black text-black sm:w-auto" style={{ background: color }}>{children}</button>
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg p-4 text-sm" style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.03)' }}>{children}</p>
}

export default function AdvancedSuite() {
  const [activeTab, setActiveTab] = useState<TabId>('crm')
  const [data, setData] = useState<SuiteState>(initialState)
  const [leadForm, setLeadForm] = useState({ family: '', student: '', stage: 'Novo contato', value: 0, owner: '', nextStep: '' })
  const [financeForm, setFinanceForm] = useState({ description: '', type: 'Receita' as Finance['type'], amount: 0, due: '', unit: '', status: 'Previsto' })
  const [approvalForm, setApprovalForm] = useState({ title: '', requester: '', area: '', amount: 0, priority: 'Média' })
  const [formForm, setFormForm] = useState({ title: '', category: '', owner: '' })
  const [goalForm, setGoalForm] = useState({ title: '', owner: '', due: '', progress: 0 })
  const [docForm, setDocForm] = useState({ title: '', type: '', owner: '' })
  const [assetForm, setAssetForm] = useState({ name: '', tag: '', unit: '', condition: 'Bom', nextReview: '' })

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved) setData({ ...initialState, ...saved })
    } catch {
      setData(initialState)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const summary = useMemo(() => {
    const pipeline = data.leads.reduce((sum, item) => sum + Number(item.value || 0), 0)
    const balance = data.finance.reduce((sum, item) => sum + (item.type === 'Receita' ? item.amount : -item.amount), 0)
    const pendingApprovals = data.approvals.filter(item => item.status !== 'Aprovado').length
    const assetsInReview = data.assets.filter(item => item.condition !== 'Bom').length
    return [
      { label: 'Pipeline de matrículas', value: money.format(pipeline), color: '#0ABD78' },
      { label: 'Saldo previsto', value: money.format(balance), color: '#4A9EFF' },
      { label: 'Aprovações pendentes', value: pendingApprovals, color: '#F8A303' },
      { label: 'Patrimônio em atenção', value: assetsInReview, color: '#E07B39' },
    ]
  }, [data])

  function addLead(e: React.FormEvent) {
    e.preventDefault()
    if (!leadForm.family.trim()) return
    setData(prev => ({
      ...prev,
      leads: [{ id: uid('MAT'), family: leadForm.family, student: leadForm.student, source: 'Manual', stage: leadForm.stage, value: Number(leadForm.value), owner: leadForm.owner || 'Secretaria', nextStep: leadForm.nextStep || 'Definir próximo passo' }, ...prev.leads],
    }))
    setLeadForm({ family: '', student: '', stage: 'Novo contato', value: 0, owner: '', nextStep: '' })
  }

  function addFinance(e: React.FormEvent) {
    e.preventDefault()
    if (!financeForm.description.trim()) return
    setData(prev => ({ ...prev, finance: [{ id: uid('FIN'), ...financeForm, amount: Number(financeForm.amount) }, ...prev.finance] }))
    setFinanceForm({ description: '', type: 'Receita', amount: 0, due: '', unit: '', status: 'Previsto' })
  }

  function addApproval(e: React.FormEvent) {
    e.preventDefault()
    if (!approvalForm.title.trim()) return
    setData(prev => ({ ...prev, approvals: [{ id: uid('APR'), ...approvalForm, amount: Number(approvalForm.amount), status: 'Pendente' }, ...prev.approvals] }))
    setApprovalForm({ title: '', requester: '', area: '', amount: 0, priority: 'Média' })
  }

  function addForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formForm.title.trim()) return
    setData(prev => ({ ...prev, forms: [{ id: uid('FOR'), ...formForm, responses: 0, status: 'Rascunho' }, ...prev.forms] }))
    setFormForm({ title: '', category: '', owner: '' })
  }

  function addGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!goalForm.title.trim()) return
    setData(prev => ({ ...prev, goals: [{ id: uid('OKR'), ...goalForm, progress: Number(goalForm.progress), confidence: 'Média' }, ...prev.goals] }))
    setGoalForm({ title: '', owner: '', due: '', progress: 0 })
  }

  function addDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docForm.title.trim()) return
    setData(prev => ({ ...prev, docs: [{ id: uid('DOC'), ...docForm, status: 'Rascunho', updated: 'Agora' }, ...prev.docs] }))
    setDocForm({ title: '', type: '', owner: '' })
  }

  function addAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!assetForm.name.trim()) return
    setData(prev => ({ ...prev, assets: [{ id: uid('PAT'), ...assetForm }, ...prev.assets] }))
    setAssetForm({ name: '', tag: '', unit: '', condition: 'Bom', nextReview: '' })
  }

  const active = tabs.find(tab => tab.id === activeTab) || tabs[0]
  const ActiveIcon = active.icon

  return (
    <section className="space-y-5">
      <Card className="p-5 lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide" style={{ color: active.color }}>Suíte operacional integrada</p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-white lg:text-3xl">Ferramentas estratégicas da APS EDU</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.52)' }}>
              Áreas separadas para trabalhar com profundidade: matrículas, financeiro, aprovações, formulários, metas, documentos e patrimônio.
            </p>
          </div>
          <div className="flex min-h-24 items-center gap-4 rounded-lg px-5 py-4" style={{ background: `${active.color}12`, border: `1px solid ${active.color}30` }}>
            <ActiveIcon className="h-7 w-7 flex-shrink-0" style={{ color: active.color }} />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>Módulo ativo</p>
              <p className="mt-1 text-lg font-black leading-tight text-white">{active.label}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {tabs.map(tab => {
            const Icon = tab.icon
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex min-h-20 items-center justify-center gap-2 rounded-lg px-3 py-3 text-center transition-all"
                style={{ background: selected ? `${tab.color}18` : 'rgba(255,255,255,0.035)', border: `1px solid ${selected ? `${tab.color}55` : 'rgba(255,255,255,0.06)'}` }}
              >
                <Icon className="h-5 w-5 flex-shrink-0" style={{ color: selected ? tab.color : 'rgba(255,255,255,0.42)' }} />
                <span className="max-w-[8rem] text-sm font-black leading-tight" style={{ color: selected ? 'white' : 'rgba(255,255,255,0.62)' }}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map(item => (
          <Card key={item.label} className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
            <p className="mt-2 text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
          </Card>
        ))}
      </section>

      {activeTab === 'crm' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-xl font-black leading-tight text-white">Novo interesse de matrícula</h3>
            <form onSubmit={addLead} className="mt-4 space-y-3">
              <Field label="Família"><Input value={leadForm.family} onChange={e => setLeadForm({ ...leadForm, family: e.target.value })} placeholder="Ex: Família Oliveira" /></Field>
              <Field label="Aluno e série"><Input value={leadForm.student} onChange={e => setLeadForm({ ...leadForm, student: e.target.value })} placeholder="Ex: Ana Oliveira - 3º ano" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Etapa"><Input value={leadForm.stage} onChange={e => setLeadForm({ ...leadForm, stage: e.target.value })} /></Field>
                <Field label="Valor previsto"><Input type="number" value={leadForm.value} onChange={e => setLeadForm({ ...leadForm, value: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Próximo passo"><Input value={leadForm.nextStep} onChange={e => setLeadForm({ ...leadForm, nextStep: e.target.value })} placeholder="Ação objetiva para avançar" /></Field>
              <PrimaryButton color="#0ABD78">Adicionar ao funil</PrimaryButton>
            </form>
          </Card>
          <Card className="min-w-0">
            <PanelHeader title="Pipeline de matrículas" subtitle="Acompanhamento de origem, etapa, valor e próxima ação." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}><th className="px-5 py-3">Família</th><th className="px-5 py-3">Etapa</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Próxima ação</th></tr></thead>
                <tbody>{data.leads.map(item => <tr key={item.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}><td className="px-5 py-3"><p className="font-bold text-white">{item.family}</p><p className="text-xs text-white/40">{item.student} · {item.source}</p></td><td className="px-5 py-3 text-white/70">{item.stage}</td><td className="px-5 py-3 font-black text-white">{money.format(item.value)}</td><td className="px-5 py-3 text-white/60">{item.nextStep}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {activeTab === 'financeiro' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-lg font-black text-white">Lançamento financeiro</h3>
            <form onSubmit={addFinance} className="mt-4 space-y-3">
              <Field label="Descrição"><Input value={financeForm.description} onChange={e => setFinanceForm({ ...financeForm, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Tipo"><Select value={financeForm.type} onChange={e => setFinanceForm({ ...financeForm, type: e.target.value as Finance['type'] })}><option>Receita</option><option>Despesa</option></Select></Field><Field label="Valor"><Input type="number" value={financeForm.amount} onChange={e => setFinanceForm({ ...financeForm, amount: Number(e.target.value) })} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Vencimento"><Input value={financeForm.due} onChange={e => setFinanceForm({ ...financeForm, due: e.target.value })} placeholder="Hoje, 20/06..." /></Field><Field label="Unidade"><Input value={financeForm.unit} onChange={e => setFinanceForm({ ...financeForm, unit: e.target.value })} /></Field></div>
              <PrimaryButton color="#4A9EFF">Salvar lançamento</PrimaryButton>
            </form>
          </Card>
          <ListPanel title="Fluxo previsto" subtitle="Receitas, despesas e baixa operacional.">
            {data.finance.map(item => <Row key={item.id} title={item.description} meta={`${item.unit || 'Rede'} · ${item.due || 'Sem vencimento'} · ${item.status}`} value={money.format(item.amount)} color={item.type === 'Receita' ? '#0ABD78' : '#FF4757'} />)}
          </ListPanel>
        </section>
      )}

      {activeTab === 'aprovacoes' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-lg font-black text-white">Nova aprovação</h3>
            <form onSubmit={addApproval} className="mt-4 space-y-3">
              <Field label="Solicitação"><Input value={approvalForm.title} onChange={e => setApprovalForm({ ...approvalForm, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Área"><Input value={approvalForm.area} onChange={e => setApprovalForm({ ...approvalForm, area: e.target.value })} /></Field><Field label="Valor"><Input type="number" value={approvalForm.amount} onChange={e => setApprovalForm({ ...approvalForm, amount: Number(e.target.value) })} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Solicitante"><Input value={approvalForm.requester} onChange={e => setApprovalForm({ ...approvalForm, requester: e.target.value })} /></Field><Field label="Prioridade"><Select value={approvalForm.priority} onChange={e => setApprovalForm({ ...approvalForm, priority: e.target.value })}><option>Baixa</option><option>Média</option><option>Alta</option></Select></Field></div>
              <PrimaryButton>Enviar para aprovação</PrimaryButton>
            </form>
          </Card>
          <ListPanel title="Esteira de aprovações" subtitle="Controle de prioridade, área, valor e decisão.">
            {data.approvals.map(item => <Row key={item.id} title={item.title} meta={`${item.area} · ${item.requester} · ${item.priority}`} value={item.status} color={item.priority === 'Alta' ? '#FF4757' : '#F8A303'} />)}
          </ListPanel>
        </section>
      )}

      {activeTab === 'formularios' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-lg font-black text-white">Criar formulário operacional</h3>
            <form onSubmit={addForm} className="mt-4 space-y-3">
              <Field label="Título"><Input value={formForm.title} onChange={e => setFormForm({ ...formForm, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Categoria"><Input value={formForm.category} onChange={e => setFormForm({ ...formForm, category: e.target.value })} /></Field><Field label="Responsável"><Input value={formForm.owner} onChange={e => setFormForm({ ...formForm, owner: e.target.value })} /></Field></div>
              <PrimaryButton color="#8B5CF6">Criar rascunho</PrimaryButton>
            </form>
          </Card>
          <ListPanel title="Biblioteca de formulários" subtitle="Modelos para compra, ocorrência, RH, matrícula e operação escolar.">
            {data.forms.length ? data.forms.map(item => <Row key={item.id} title={item.title} meta={`${item.category} · ${item.owner || 'Sem responsável'}`} value={`${item.responses} respostas`} color="#8B5CF6" />) : <EmptyHint>Nenhum formulário criado.</EmptyHint>}
          </ListPanel>
        </section>
      )}

      {activeTab === 'metas' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-lg font-black text-white">Nova meta ou OKR</h3>
            <form onSubmit={addGoal} className="mt-4 space-y-3">
              <Field label="Objetivo"><Input value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-3"><Field label="Responsável"><Input value={goalForm.owner} onChange={e => setGoalForm({ ...goalForm, owner: e.target.value })} /></Field><Field label="Prazo"><Input value={goalForm.due} onChange={e => setGoalForm({ ...goalForm, due: e.target.value })} /></Field><Field label="Progresso"><Input type="number" max={100} value={goalForm.progress} onChange={e => setGoalForm({ ...goalForm, progress: Number(e.target.value) })} /></Field></div>
              <PrimaryButton color="#F9C234">Adicionar meta</PrimaryButton>
            </form>
          </Card>
          <Card className="p-5">
            <PanelHeader title="Mapa de metas" subtitle="Acompanhe progresso, confiança e responsáveis." compact />
            <div className="mt-4 space-y-4">
              {data.goals.map(item => <div key={item.id}><div className="flex justify-between gap-3"><div><p className="font-bold text-white">{item.title}</p><p className="text-xs text-white/40">{item.owner} · vence {item.due}</p></div><span className="text-sm font-black" style={{ color: '#F9C234' }}>{item.progress}%</span></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, item.progress)}%`, background: '#F9C234' }} /></div></div>)}
            </div>
          </Card>
        </section>
      )}

      {activeTab === 'documentos' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-lg font-black text-white">Novo documento controlado</h3>
            <form onSubmit={addDoc} className="mt-4 space-y-3">
              <Field label="Título"><Input value={docForm.title} onChange={e => setDocForm({ ...docForm, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Tipo"><Input value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })} /></Field><Field label="Responsável"><Input value={docForm.owner} onChange={e => setDocForm({ ...docForm, owner: e.target.value })} /></Field></div>
              <PrimaryButton color="#29ABE2">Cadastrar documento</PrimaryButton>
            </form>
          </Card>
          <ListPanel title="Repositório operacional" subtitle="Políticas, checklists, contratos e procedimentos com status.">
            {data.docs.map(item => <Row key={item.id} title={item.title} meta={`${item.type} · ${item.owner || 'Sem responsável'} · ${item.updated}`} value={item.status} color="#29ABE2" />)}
          </ListPanel>
        </section>
      )}

      {activeTab === 'patrimonio' && (
        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
          <Card className="p-5 lg:p-6">
            <h3 className="text-lg font-black text-white">Cadastrar patrimônio</h3>
            <form onSubmit={addAsset} className="mt-4 space-y-3">
              <Field label="Ativo"><Input value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Etiqueta"><Input value={assetForm.tag} onChange={e => setAssetForm({ ...assetForm, tag: e.target.value })} /></Field><Field label="Unidade"><Input value={assetForm.unit} onChange={e => setAssetForm({ ...assetForm, unit: e.target.value })} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Condição"><Select value={assetForm.condition} onChange={e => setAssetForm({ ...assetForm, condition: e.target.value })}><option>Bom</option><option>Manutenção</option><option>Troca</option></Select></Field><Field label="Revisão"><Input value={assetForm.nextReview} onChange={e => setAssetForm({ ...assetForm, nextReview: e.target.value })} /></Field></div>
              <PrimaryButton color="#E07B39">Gerar registro</PrimaryButton>
            </form>
          </Card>
          <ListPanel title="Mapa de patrimônio" subtitle="Ativos, etiquetas, unidade e próxima revisão.">
            {data.assets.map(item => <Row key={item.id} title={item.name} meta={`${item.tag} · ${item.unit} · revisão ${item.nextReview}`} value={item.condition} color={item.condition === 'Bom' ? '#0ABD78' : '#E07B39'} />)}
          </ListPanel>
        </section>
      )}
    </section>
  )
}

function PanelHeader({ title, subtitle, compact = false }: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'border-b p-5'} style={compact ? undefined : { borderColor: 'rgba(255,255,255,0.07)' }}>
      <h3 className="text-lg font-black text-white">{title}</h3>
      <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</p>
    </div>
  )
}

function ListPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card>
      <PanelHeader title={title} subtitle={subtitle} />
      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>{children}</div>
    </Card>
  )
}

function Row({ title, meta, value, color }: { title: string; meta: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="font-bold text-white">{title}</p>
        <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{meta}</p>
      </div>
      <span className="w-fit rounded-lg px-2.5 py-1 text-xs font-black" style={{ color, background: `${color}18` }}>{value}</span>
    </div>
  )
}
