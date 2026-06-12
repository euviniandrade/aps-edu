'use client'

import { useMemo, useState } from 'react'
import {
  AcademicCapIcon,
  ArrowPathIcon,
  BanknotesIcon,
  BoltIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  EnvelopeIcon,
  ServerStackIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type WorkCenter = {
  id: string
  title: string
  description: string
  color: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  tools: string[]
  maturity: number
}

const centers: WorkCenter[] = [
  {
    id: 'executivo',
    title: 'Centro executivo',
    description: 'Prioridades, riscos, indicadores e decisões da rede em uma visão única.',
    color: '#F8A303',
    icon: ChartBarIcon,
    tools: ['Resumo por IA', 'Riscos', 'OKRs', 'Status executivo'],
    maturity: 82,
  },
  {
    id: 'operacao',
    title: 'Operação',
    description: 'Tarefas, aprovações, formulários, eventos, documentos e rotinas recorrentes.',
    color: '#0ABD78',
    icon: ClipboardDocumentListIcon,
    tools: ['Kanban', 'SLA', 'Aprovações', 'Automação'],
    maturity: 78,
  },
  {
    id: 'escolar',
    title: 'Gestão escolar',
    description: 'Matrículas, famílias, agenda pedagógica, comunicados e acompanhamento escolar.',
    color: '#29ABE2',
    icon: AcademicCapIcon,
    tools: ['CRM escolar', 'Calendário', 'Ocorrências', 'Mural'],
    maturity: 70,
  },
  {
    id: 'pessoas',
    title: 'Pessoas',
    description: 'Equipe, avaliação, feedback, treinamento, clima e desenvolvimento.',
    color: '#8B5CF6',
    icon: UserGroupIcon,
    tools: ['Performance', 'Treinamentos', 'Feedback', 'Clima'],
    maturity: 64,
  },
  {
    id: 'financeiro',
    title: 'Financeiro e ativos',
    description: 'Receitas, despesas, compras, contratos, estoque e patrimônio.',
    color: '#4A9EFF',
    icon: BanknotesIcon,
    tools: ['Fluxo previsto', 'Compras', 'Estoque', 'Patrimônio'],
    maturity: 68,
  },
]

const integrations = [
  { title: 'Calendário', detail: 'Eventos, prazos e agenda executiva', icon: CalendarDaysIcon, color: '#29ABE2', status: 'Ativo' },
  { title: 'E-mail', detail: 'Triagem, rascunhos e follow-ups', icon: EnvelopeIcon, color: '#F8A303', status: 'Preparado' },
  { title: 'Documentos', detail: 'Atas, políticas, checklists e contratos', icon: ClipboardDocumentListIcon, color: '#8B5CF6', status: 'Ativo' },
  { title: 'Dados operacionais', detail: 'Tarefas, pessoas, unidades e relatórios', icon: ServerStackIcon, color: '#0ABD78', status: 'Ativo' },
]

const defaultActions = [
  { id: 'act-1', title: 'Revisar prioridades da semana', owner: 'Sofi IA', area: 'Executivo', done: false },
  { id: 'act-2', title: 'Consolidar pendências por unidade', owner: 'Operação', area: 'Rede', done: false },
  { id: 'act-3', title: 'Preparar roteiro de treinamento de gestores', owner: 'Pessoas', area: 'Treinamento', done: false },
]

function MiniCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg ${className}`} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {children}
    </section>
  )
}

export default function OperatingSystemCockpit() {
  const [activeCenter, setActiveCenter] = useState(centers[0].id)
  const [prompt, setPrompt] = useState('Organize minha semana com foco em tarefas atrasadas, matrículas, equipe e eventos críticos.')
  const [aiPlan, setAiPlan] = useState('')
  const [loading, setLoading] = useState(false)
  const [actions, setActions] = useState(defaultActions)

  const selected = useMemo(() => centers.find(center => center.id === activeCenter) || centers[0], [activeCenter])
  const SelectedIcon = selected.icon

  async function generatePlan() {
    setLoading(true)
    setAiPlan('')
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Você é a Sofi, IA gestora da APS EDU. Gere um plano executivo curto, com prioridades, riscos, responsáveis e próximos passos. Contexto: ${prompt}`,
        }),
      })
      const data = await res.json()
      setAiPlan(data.content || 'Plano gerado, mas sem retorno textual do provedor.')
    } catch {
      setAiPlan('Não consegui acionar a IA agora. Priorize: 1. pendências críticas; 2. responsáveis; 3. prazos; 4. comunicado de alinhamento.')
    } finally {
      setLoading(false)
    }
  }

  function toggleAction(id: string) {
    setActions(prev => prev.map(action => action.id === id ? { ...action, done: !action.done } : action))
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <MiniCard className="p-5 lg:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: '#F8A303' }}>Sistema operacional APS EDU</p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-white lg:text-3xl">Comando integrado de gestão, escola, pessoas, finanças e IA</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.52)' }}>
                Uma camada central para coordenar calendários, notas, e-mails, tarefas, documentos, treinamentos, avaliações e indicadores antes de entrar em cada ferramenta específica.
              </p>
            </div>
            <div className="flex min-h-20 w-full items-center gap-4 rounded-lg px-4 py-3 xl:w-72" style={{ background: `${selected.color}12`, border: `1px solid ${selected.color}30` }}>
              <SelectedIcon className="h-7 w-7 flex-shrink-0" style={{ color: selected.color }} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.42)' }}>Centro ativo</p>
                <p className="mt-1 text-lg font-black leading-tight text-white">{selected.title}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {centers.map(center => {
              const Icon = center.icon
              const selectedCenter = activeCenter === center.id
              return (
                <button
                  key={center.id}
                  onClick={() => setActiveCenter(center.id)}
                  className="min-h-40 rounded-lg p-4 text-left transition-all"
                  style={{ background: selectedCenter ? `${center.color}14` : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedCenter ? `${center.color}55` : 'rgba(255,255,255,0.06)'}` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="h-6 w-6" style={{ color: selectedCenter ? center.color : 'rgba(255,255,255,0.38)' }} />
                    <span className="text-xs font-black" style={{ color: center.color }}>{center.maturity}%</span>
                  </div>
                  <h3 className="mt-4 text-sm font-black leading-tight text-white">{center.title}</h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.48)' }}>{center.description}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${center.maturity}%`, background: center.color }} />
                  </div>
                </button>
              )
            })}
          </div>
        </MiniCard>

        <MiniCard className="p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2.5" style={{ background: 'rgba(248,163,3,0.14)', border: '1px solid rgba(248,163,3,0.30)' }}>
              <SparklesIcon className="h-5 w-5" style={{ color: '#F8A303' }} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Sofi IA gestora</h3>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Planejamento, risco e próximos passos.</p>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="mt-4 min-h-28 w-full rounded-lg px-3 py-3 text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.10)' }}
          />
          <button
            onClick={generatePlan}
            disabled={loading}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black text-black disabled:opacity-60"
            style={{ background: '#F8A303' }}
          >
            {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <BoltIcon className="h-4 w-4" />}
            {loading ? 'Analisando...' : 'Gerar plano executivo'}
          </button>
          {aiPlan && (
            <div className="mt-4 max-h-56 overflow-y-auto rounded-lg p-4 text-sm leading-6" style={{ background: 'rgba(248,163,3,0.08)', border: '1px solid rgba(248,163,3,0.18)', color: 'rgba(255,255,255,0.78)' }}>
              {aiPlan}
            </div>
          )}
        </MiniCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <MiniCard>
          <div className="border-b p-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h3 className="text-lg font-black text-white">Integrações essenciais</h3>
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>A base para calendário, notas, e-mails, documentos e operação trabalharem no mesmo contexto.</p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {integrations.map(item => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Icon className="h-5 w-5" style={{ color: item.color }} />
                  <p className="mt-3 text-sm font-black text-white">{item.title}</p>
                  <p className="mt-1 min-h-10 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.detail}</p>
                  <span className="mt-3 inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black" style={{ color: item.color, background: `${item.color}16` }}>{item.status}</span>
                </div>
              )
            })}
          </div>
        </MiniCard>

        <MiniCard>
          <div className="border-b p-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h3 className="text-lg font-black text-white">Fila executiva</h3>
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Ações que a IA acompanha até virarem entrega.</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {actions.map(action => (
              <button key={action.id} onClick={() => toggleAction(action.id)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]">
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" style={{ color: action.done ? '#0ABD78' : 'rgba(255,255,255,0.28)' }} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${action.done ? 'line-through' : ''}`} style={{ color: action.done ? 'rgba(255,255,255,0.38)' : 'white' }}>{action.title}</p>
                  <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{action.area} · {action.owner}</p>
                </div>
              </button>
            ))}
          </div>
        </MiniCard>
      </div>
    </section>
  )
}
