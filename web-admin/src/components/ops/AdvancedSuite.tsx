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

type LeadStage = 'novo' | 'contato' | 'visita' | 'matricula' | 'perdido'
type Status = 'aberto' | 'andamento' | 'concluido'
type ApprovalStatus = 'pendente' | 'aprovado' | 'reprovado'

type Lead = { id: string; name: string; unit: string; source: string; stage: LeadStage; nextAction: string; value: number }
type Finance = { id: string; type: 'receita' | 'despesa'; unit: string; description: string; amount: number; dueDate: string; status: 'pendente' | 'pago' }
type Approval = { id: string; type: string; title: string; requester: string; amount: number; status: ApprovalStatus }
type InternalForm = { id: string; type: string; title: string; unit: string; owner: string; status: Status }
type Goal = { id: string; title: string; area: string; owner: string; target: number; current: number; dueDate: string }
type Doc = { id: string; title: string; category: string; owner: string; status: 'rascunho' | 'revisao' | 'aprovado' }
type Asset = { id: string; name: string; tag: string; location: string; responsible: string; status: 'ativo' | 'manutencao' | 'baixado' }

const STORAGE_KEY = 'aps_edu_advanced_suite_v1'

type SuiteState = {
  leads: Lead[]
  finances: Finance[]
  approvals: Approval[]
  forms: InternalForm[]
  goals: Goal[]
  docs: Doc[]
  assets: Asset[]
}

const defaultState: SuiteState = {
  leads: [
    { id: 'lead-1', name: 'Familia Oliveira', unit: 'CAEA', source: 'Indicacao', stage: 'visita', nextAction: 'Enviar proposta pedagogica', value: 1850 },
    { id: 'lead-2', name: 'Familia Santos', unit: 'CAIS', source: 'Campanha', stage: 'contato', nextAction: 'Agendar visita', value: 1620 },
  ],
  finances: [
    { id: 'fin-1', type: 'receita', unit: 'APS', description: 'Previsao campanha de matriculas', amount: 42000, dueDate: new Date().toISOString().slice(0, 10), status: 'pendente' },
    { id: 'fin-2', type: 'despesa', unit: 'Rede', description: 'Compra de kits pedagogicos', amount: 7800, dueDate: new Date().toISOString().slice(0, 10), status: 'pendente' },
  ],
  approvals: [
    { id: 'apr-1', type: 'Compra', title: 'Reposicao de projetores', requester: 'Tecnologia Educacional', amount: 12800, status: 'pendente' },
    { id: 'apr-2', type: 'Evento', title: 'Encontro de coordenadores', requester: 'Educacao', amount: 3500, status: 'pendente' },
  ],
  forms: [
    { id: 'form-1', type: 'Solicitacao de compra', title: 'Material de secretaria', unit: 'APS', owner: 'Secretaria', status: 'aberto' },
    { id: 'form-2', type: 'Ocorrencia escolar', title: 'Apoio pedagogico', unit: 'CAEA', owner: 'Coordenacao', status: 'andamento' },
  ],
  goals: [
    { id: 'goal-1', title: 'Regularizar 95% das tarefas no prazo', area: 'Operacao', owner: 'Gestao APS', target: 95, current: 72, dueDate: new Date().toISOString().slice(0, 10) },
    { id: 'goal-2', title: 'Converter visitas em matriculas', area: 'CRM escolar', owner: 'Promotores', target: 40, current: 18, dueDate: new Date().toISOString().slice(0, 10) },
  ],
  docs: [
    { id: 'doc-1', title: 'Checklist de abertura de evento', category: 'Evento', owner: 'Educacao', status: 'aprovado' },
    { id: 'doc-2', title: 'Contrato padrao de fornecedor', category: 'Compras', owner: 'Administrativo', status: 'revisao' },
  ],
  assets: [
    { id: 'asset-1', name: 'Projetor Epson X39', tag: 'APS-PAT-0001', location: 'Sala de Recursos', responsible: 'CAEA', status: 'ativo' },
    { id: 'asset-2', name: 'Notebook Dell 5420', tag: 'APS-PAT-0002', location: 'Tecnologia', responsible: 'APS', status: 'manutencao' },
  ],
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg ${className}`} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {children}
    </section>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 w-full rounded-lg px-3 text-sm outline-none ${props.className || ''}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'white', ...props.style }}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-9 w-full rounded-lg px-3 text-sm outline-none ${props.className || ''}`}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'white', ...props.style }}
    />
  )
}

function Header({ icon: Icon, title, subtitle, color }: { icon: any; title: string; subtitle: string; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg p-2.5" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <h2 className="text-base font-black text-white">{title}</h2>
        <p className="mt-1 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ color, background: `${color}18` }}>{children}</span>
}

export default function AdvancedSuite() {
  const [state, setState] = useState<SuiteState>(defaultState)
  const [leadForm, setLeadForm] = useState({ name: '', unit: '', source: '', value: 0 })
  const [financeForm, setFinanceForm] = useState({ description: '', unit: '', amount: 0, type: 'despesa' as Finance['type'] })
  const [approvalForm, setApprovalForm] = useState({ title: '', type: 'Compra', requester: '', amount: 0 })
  const [goalForm, setGoalForm] = useState({ title: '', area: '', owner: '', target: 100 })
  const [assetForm, setAssetForm] = useState({ name: '', location: '', responsible: '' })

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved) setState({ ...defaultState, ...saved })
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const totals = useMemo(() => {
    const pipeline = state.leads.filter(item => item.stage !== 'perdido').reduce((sum, item) => sum + Number(item.value || 0), 0)
    const pendingApprovals = state.approvals.filter(item => item.status === 'pendente').length
    const balance = state.finances.reduce((sum, item) => sum + (item.type === 'receita' ? item.amount : -item.amount), 0)
    const assetsInUse = state.assets.filter(item => item.status === 'ativo').length
    return { pipeline, pendingApprovals, balance, assetsInUse }
  }, [state])

  function update<K extends keyof SuiteState>(key: K, value: SuiteState[K]) {
    setState(prev => ({ ...prev, [key]: value }))
  }

  function addLead(e: React.FormEvent) {
    e.preventDefault()
    if (!leadForm.name.trim()) return
    update('leads', [{ id: uid('lead'), stage: 'novo', nextAction: 'Fazer primeiro contato', ...leadForm }, ...state.leads])
    setLeadForm({ name: '', unit: '', source: '', value: 0 })
  }

  function moveLead(id: string, stage: LeadStage) {
    update('leads', state.leads.map(item => item.id === id ? { ...item, stage } : item))
  }

  function addFinance(e: React.FormEvent) {
    e.preventDefault()
    if (!financeForm.description.trim()) return
    update('finances', [{ id: uid('fin'), dueDate: new Date().toISOString().slice(0, 10), status: 'pendente', ...financeForm }, ...state.finances])
    setFinanceForm({ description: '', unit: '', amount: 0, type: 'despesa' })
  }

  function markFinance(id: string) {
    update('finances', state.finances.map(item => item.id === id ? { ...item, status: item.status === 'pago' ? 'pendente' : 'pago' } : item))
  }

  function addApproval(e: React.FormEvent) {
    e.preventDefault()
    if (!approvalForm.title.trim()) return
    update('approvals', [{ id: uid('apr'), status: 'pendente', ...approvalForm }, ...state.approvals])
    setApprovalForm({ title: '', type: 'Compra', requester: '', amount: 0 })
  }

  function setApproval(id: string, status: ApprovalStatus) {
    update('approvals', state.approvals.map(item => item.id === id ? { ...item, status } : item))
  }

  function addGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!goalForm.title.trim()) return
    update('goals', [{ id: uid('goal'), current: 0, dueDate: new Date().toISOString().slice(0, 10), ...goalForm }, ...state.goals])
    setGoalForm({ title: '', area: '', owner: '', target: 100 })
  }

  function progressGoal(id: string, delta: number) {
    update('goals', state.goals.map(item => item.id === id ? { ...item, current: Math.max(0, Math.min(item.target, item.current + delta)) } : item))
  }

  function addAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!assetForm.name.trim()) return
    const next = state.assets.length + 1
    update('assets', [{ id: uid('asset'), tag: `APS-PAT-${String(next).padStart(4, '0')}`, status: 'ativo', ...assetForm }, ...state.assets])
    setAssetForm({ name: '', location: '', responsible: '' })
  }

  function cycleAsset(id: string) {
    update('assets', state.assets.map(item => {
      if (item.id !== id) return item
      const status = item.status === 'ativo' ? 'manutencao' : item.status === 'manutencao' ? 'baixado' : 'ativo'
      return { ...item, status }
    }))
  }

  function createForm(type: string) {
    const title = window.prompt(`Titulo para ${type}`)
    if (!title) return
    update('forms', [{ id: uid('form'), type, title, unit: 'APS', owner: 'Central', status: 'aberto' }, ...state.forms])
  }

  function advanceForm(id: string) {
    update('forms', state.forms.map(item => {
      if (item.id !== id) return item
      const status = item.status === 'aberto' ? 'andamento' : item.status === 'andamento' ? 'concluido' : 'aberto'
      return { ...item, status }
    }))
  }

  function createDoc(category: string) {
    const title = window.prompt(`Nome do documento de ${category}`)
    if (!title) return
    update('docs', [{ id: uid('doc'), title, category, owner: 'Central', status: 'rascunho' }, ...state.docs])
  }

  function advanceDoc(id: string) {
    update('docs', state.docs.map(item => {
      if (item.id !== id) return item
      const status = item.status === 'rascunho' ? 'revisao' : item.status === 'revisao' ? 'aprovado' : 'rascunho'
      return { ...item, status }
    }))
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs font-bold uppercase text-white/35">Pipeline matriculas</p><p className="mt-2 text-2xl font-black" style={{ color: '#0ABD78' }}>{money(totals.pipeline)}</p></Card>
        <Card className="p-4"><p className="text-xs font-bold uppercase text-white/35">Saldo previsto</p><p className="mt-2 text-2xl font-black" style={{ color: totals.balance >= 0 ? '#4A9EFF' : '#FF4757' }}>{money(totals.balance)}</p></Card>
        <Card className="p-4"><p className="text-xs font-bold uppercase text-white/35">Aprovacoes pendentes</p><p className="mt-2 text-2xl font-black" style={{ color: '#F8A303' }}>{totals.pendingApprovals}</p></Card>
        <Card className="p-4"><p className="text-xs font-bold uppercase text-white/35">Patrimonio ativo</p><p className="mt-2 text-2xl font-black" style={{ color: '#A78BFA' }}>{totals.assetsInUse}</p></Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <Header icon={UserPlusIcon} title="CRM escolar e matriculas" subtitle="Funil de interessados, origem, proxima acao e valor previsto." color="#0ABD78" />
          <form onSubmit={addLead} className="mt-4 grid gap-2 md:grid-cols-4">
            <Input placeholder="Familia / aluno" value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} />
            <Input placeholder="Unidade" value={leadForm.unit} onChange={e => setLeadForm({ ...leadForm, unit: e.target.value })} />
            <Input placeholder="Origem" value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })} />
            <Input type="number" placeholder="Valor" value={leadForm.value} onChange={e => setLeadForm({ ...leadForm, value: Number(e.target.value) })} />
            <button className="h-9 rounded-lg text-sm font-black text-black md:col-span-4" style={{ background: '#0ABD78' }}>Adicionar interessado</button>
          </form>
          <div className="mt-4 space-y-2">
            {state.leads.slice(0, 5).map(item => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg p-3 md:flex-row md:items-center md:justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div><p className="text-sm font-bold text-white">{item.name}</p><p className="text-xs text-white/40">{item.unit || 'Sem unidade'} · {item.source || 'Sem origem'} · {money(item.value)}</p></div>
                <Select value={item.stage} onChange={e => moveLead(item.id, e.target.value as LeadStage)} className="md:w-36">
                  <option value="novo">Novo</option><option value="contato">Contato</option><option value="visita">Visita</option><option value="matricula">Matricula</option><option value="perdido">Perdido</option>
                </Select>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <Header icon={BanknotesIcon} title="Financeiro escolar" subtitle="Receitas, despesas, vencimentos e baixa operacional." color="#4A9EFF" />
          <form onSubmit={addFinance} className="mt-4 grid gap-2 md:grid-cols-[1fr_110px_120px_120px]">
            <Input placeholder="Descricao" value={financeForm.description} onChange={e => setFinanceForm({ ...financeForm, description: e.target.value })} />
            <Input placeholder="Unidade" value={financeForm.unit} onChange={e => setFinanceForm({ ...financeForm, unit: e.target.value })} />
            <Input type="number" placeholder="Valor" value={financeForm.amount} onChange={e => setFinanceForm({ ...financeForm, amount: Number(e.target.value) })} />
            <Select value={financeForm.type} onChange={e => setFinanceForm({ ...financeForm, type: e.target.value as Finance['type'] })}><option value="receita">Receita</option><option value="despesa">Despesa</option></Select>
            <button className="h-9 rounded-lg text-sm font-black text-black md:col-span-4" style={{ background: '#4A9EFF' }}>Lancar financeiro</button>
          </form>
          <div className="mt-4 space-y-2">
            {state.finances.slice(0, 5).map(item => (
              <button key={item.id} onClick={() => markFinance(item.id)} className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div><p className="text-sm font-bold text-white">{item.description}</p><p className="text-xs text-white/40">{item.unit || 'Rede'} · {item.status}</p></div>
                <Pill color={item.type === 'receita' ? '#0ABD78' : '#FF4757'}>{money(item.amount)}</Pill>
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5">
          <Header icon={CheckBadgeIcon} title="Aprovacoes" subtitle="Compras, eventos, contratos e excecoes com decisao rapida." color="#F8A303" />
          <form onSubmit={addApproval} className="mt-4 grid gap-2">
            <Input placeholder="Titulo da aprovacao" value={approvalForm.title} onChange={e => setApprovalForm({ ...approvalForm, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Tipo" value={approvalForm.type} onChange={e => setApprovalForm({ ...approvalForm, type: e.target.value })} />
              <Input placeholder="Solicitante" value={approvalForm.requester} onChange={e => setApprovalForm({ ...approvalForm, requester: e.target.value })} />
              <Input type="number" placeholder="Valor" value={approvalForm.amount} onChange={e => setApprovalForm({ ...approvalForm, amount: Number(e.target.value) })} />
            </div>
            <button className="h-9 rounded-lg text-sm font-black text-black" style={{ background: '#F8A303' }}>Enviar para aprovacao</button>
          </form>
          <div className="mt-4 space-y-2">
            {state.approvals.slice(0, 4).map(item => (
              <div key={item.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex justify-between gap-2"><p className="text-sm font-bold text-white">{item.title}</p><Pill color={item.status === 'aprovado' ? '#0ABD78' : item.status === 'reprovado' ? '#FF4757' : '#F8A303'}>{item.status}</Pill></div>
                <div className="mt-3 flex gap-2"><button onClick={() => setApproval(item.id, 'aprovado')} className="rounded-lg px-2 py-1 text-xs font-bold text-white bg-white/10">Aprovar</button><button onClick={() => setApproval(item.id, 'reprovado')} className="rounded-lg px-2 py-1 text-xs font-bold text-white bg-white/10">Reprovar</button></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <Header icon={ClipboardDocumentListIcon} title="Formularios internos" subtitle="Solicitacoes, ocorrencias, compras, pesquisas e checklists." color="#29ABE2" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['Compra', 'Ocorrencia', 'Pesquisa', 'Checklist'].map(type => <button key={type} onClick={() => createForm(type)} className="h-9 rounded-lg text-xs font-black text-white bg-white/10">{type}</button>)}
          </div>
          <div className="mt-4 space-y-2">
            {state.forms.slice(0, 5).map(item => (
              <button key={item.id} onClick={() => advanceForm(item.id)} className="flex w-full justify-between gap-3 rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div><p className="text-sm font-bold text-white">{item.title}</p><p className="text-xs text-white/40">{item.type} · {item.unit}</p></div><Pill color={item.status === 'concluido' ? '#0ABD78' : '#29ABE2'}>{item.status}</Pill>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <Header icon={DocumentTextIcon} title="Documentos" subtitle="Contratos, atas, politicas, modelos e revisoes." color="#A78BFA" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {['Contrato', 'Ata', 'Politica', 'Modelo'].map(type => <button key={type} onClick={() => createDoc(type)} className="h-9 rounded-lg text-xs font-black text-white bg-white/10">{type}</button>)}
          </div>
          <div className="mt-4 space-y-2">
            {state.docs.slice(0, 5).map(item => (
              <button key={item.id} onClick={() => advanceDoc(item.id)} className="flex w-full justify-between gap-3 rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div><p className="text-sm font-bold text-white">{item.title}</p><p className="text-xs text-white/40">{item.category} · {item.owner}</p></div><Pill color={item.status === 'aprovado' ? '#0ABD78' : '#A78BFA'}>{item.status}</Pill>
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <Header icon={FlagIcon} title="Metas e OKRs" subtitle="Objetivos por area, responsavel, alvo e progresso." color="#FF4757" />
          <form onSubmit={addGoal} className="mt-4 grid gap-2 md:grid-cols-4">
            <Input placeholder="Meta" value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })} />
            <Input placeholder="Area" value={goalForm.area} onChange={e => setGoalForm({ ...goalForm, area: e.target.value })} />
            <Input placeholder="Dono" value={goalForm.owner} onChange={e => setGoalForm({ ...goalForm, owner: e.target.value })} />
            <Input type="number" placeholder="Alvo" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: Number(e.target.value) })} />
            <button className="h-9 rounded-lg text-sm font-black text-white md:col-span-4" style={{ background: '#FF4757' }}>Criar meta</button>
          </form>
          <div className="mt-4 space-y-3">
            {state.goals.slice(0, 4).map(item => {
              const pct = Math.round((item.current / Math.max(item.target, 1)) * 100)
              return (
                <div key={item.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex justify-between gap-3"><p className="text-sm font-bold text-white">{item.title}</p><Pill color="#FF4757">{pct}%</Pill></div>
                  <div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: '#FF4757' }} /></div>
                  <div className="mt-3 flex gap-2"><button onClick={() => progressGoal(item.id, 5)} className="rounded-lg px-2 py-1 text-xs font-bold text-white bg-white/10">+5</button><button onClick={() => progressGoal(item.id, -5)} className="rounded-lg px-2 py-1 text-xs font-bold text-white bg-white/10">-5</button></div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-5">
          <Header icon={QrCodeIcon} title="Patrimonio com QR" subtitle="Ativos, etiqueta, local, responsavel, manutencao e baixa." color="#E07B39" />
          <form onSubmit={addAsset} className="mt-4 grid gap-2 md:grid-cols-3">
            <Input placeholder="Ativo" value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} />
            <Input placeholder="Local" value={assetForm.location} onChange={e => setAssetForm({ ...assetForm, location: e.target.value })} />
            <Input placeholder="Responsavel" value={assetForm.responsible} onChange={e => setAssetForm({ ...assetForm, responsible: e.target.value })} />
            <button className="h-9 rounded-lg text-sm font-black text-black md:col-span-3" style={{ background: '#E07B39' }}>Cadastrar ativo</button>
          </form>
          <div className="mt-4 space-y-2">
            {state.assets.slice(0, 5).map(item => (
              <button key={item.id} onClick={() => cycleAsset(item.id)} className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3"><IdentificationIcon className="h-5 w-5 text-white/35" /><div><p className="text-sm font-bold text-white">{item.name}</p><p className="text-xs text-white/40">{item.tag} · {item.location} · {item.responsible}</p></div></div><Pill color={item.status === 'ativo' ? '#0ABD78' : item.status === 'manutencao' ? '#F8A303' : '#FF4757'}>{item.status}</Pill>
              </button>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}
