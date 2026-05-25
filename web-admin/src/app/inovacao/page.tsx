'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  BeakerIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  ClipboardDocumentCheckIcon,
  CpuChipIcon,
  LightBulbIcon,
  MegaphoneIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type TabKey = 'overview' | 'agents' | 'people' | 'marketing' | 'data' | 'saas' | 'lab'

interface ToolCard {
  title: string
  area: string
  description: string
  prompt: string
  impact: string
  effort: 'Baixo' | 'Médio' | 'Alto'
  freeStack: string[]
  color: string
}

interface Experiment {
  id: string
  title: string
  area: string
  owner: string
  status: 'Ideia' | 'Teste' | 'Escala'
  metric: string
  createdAt: string
}

const LS_EXPERIMENTS = 'apsedu_innovation_experiments'

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão Geral', icon: '✦' },
  { key: 'agents', label: 'Agentes IA', icon: '🤖' },
  { key: 'people', label: 'Pessoas', icon: '👥' },
  { key: 'marketing', label: 'Marketing', icon: '📣' },
  { key: 'data', label: 'Dados', icon: '📊' },
  { key: 'saas', label: 'SaaS', icon: '⚙️' },
  { key: 'lab', label: 'Laboratório', icon: '🧪' },
]

const toolCards: ToolCard[] = [
  {
    title: 'Sofi Orquestradora APS',
    area: 'Agentes IA',
    description: 'Agente central para transformar pedidos em tarefas, atas, mensagens, análises e follow-ups.',
    prompt: 'Atue como Sofi Orquestradora APS. Receba este contexto e devolva: objetivo, decisões, tarefas, responsáveis, prazos, riscos e próxima ação executável.',
    impact: 'Menos trabalho manual e mais cadência operacional.',
    effort: 'Médio',
    freeStack: ['Gemini/Groq configurados', 'Apps Script', 'Next API routes'],
    color: '#F8A303',
  },
  {
    title: 'Radar de Pessoas',
    area: 'People Analytics',
    description: 'Detecta risco de sobrecarga, baixo engajamento e necessidade de reconhecimento.',
    prompt: 'Analise dados de pessoas da APS. Gere sinais de sobrecarga, engajamento, reconhecimento e uma ação cuidadosa para cada grupo.',
    impact: 'Gestão mais humana, preventiva e baseada em sinais.',
    effort: 'Médio',
    freeStack: ['Dados de tarefas', 'Gamificação', 'Feedbacks'],
    color: '#0ABD78',
  },
  {
    title: 'Growth Studio APS',
    area: 'Marketing',
    description: 'Gera campanhas, comunicados, AEO, posts e variações por público.',
    prompt: 'Crie uma campanha educacional APS com: público, promessa, canais, calendário, mensagens, peças, métricas e otimização para respostas de IA.',
    impact: 'Comunicação mais consistente, rápida e mensurável.',
    effort: 'Baixo',
    freeStack: ['Sofi', 'Pollinations para imagens', 'Mural'],
    color: '#29ABE2',
  },
  {
    title: 'Analytics Conversacional',
    area: 'Dados',
    description: 'Perguntas em linguagem natural sobre tarefas, eventos, unidades, ranking e alertas.',
    prompt: 'Responda como analista de dados APS. Transforme a pergunta em leitura executiva com tendência, causa provável, risco e recomendação.',
    impact: 'Mais acesso aos dados para gestores não técnicos.',
    effort: 'Médio',
    freeStack: ['Reports API', 'Recharts', 'Sofi'],
    color: '#8B5CF6',
  },
  {
    title: 'Outcome OS',
    area: 'SaaS',
    description: 'Muda o foco de telas para resultados: cada módulo mostra resultado esperado, dono e próxima ação.',
    prompt: 'Converta este processo em Outcome OS: resultado esperado, indicador, responsável, automações, riscos e cerimônia semanal.',
    impact: 'Menos navegação, mais execução com responsabilidade clara.',
    effort: 'Alto',
    freeStack: ['Automações locais', 'Eventos', 'Tarefas'],
    color: '#E07B39',
  },
  {
    title: 'Agente de Anomalias',
    area: 'Dados',
    description: 'Monitora picos de atraso, queda de pontos e variações incomuns por unidade.',
    prompt: 'Procure anomalias neste conjunto de dados. Explique o que mudou, possível causa, nível de urgência e quem deve agir.',
    impact: 'Resposta rápida antes de problemas virarem crise.',
    effort: 'Médio',
    freeStack: ['Rules engine', 'LocalStorage', 'Reports'],
    color: '#FF4757',
  },
]

const aiProviders = [
  { name: 'Gemini', type: 'Texto e raciocínio', status: 'Ativo com GEMINI_API_KEY', cost: 'Free tier disponível', use: 'Briefings, análises, planos e conversa da Sofi' },
  { name: 'Groq', type: 'Texto rápido, visão e áudio', status: 'Ativo com GROQ_API_KEY', cost: 'Free tier disponível', use: 'Chat rápido, transcrição e leitura de imagem' },
  { name: 'Pollinations', type: 'Imagem', status: 'Sem chave', cost: 'Gratuito', use: 'Geração de imagens e peças visuais simples' },
  { name: 'Hugging Face', type: 'Imagem fallback', status: 'Opcional com HF_TOKEN', cost: 'Free tier/limites', use: 'Fallback para geração visual' },
  { name: 'DuckDuckGo Instant Answer', type: 'Busca', status: 'Sem chave', cost: 'Gratuito', use: 'Pesquisa rápida para contexto da Sofi' },
  { name: 'OpenAI/Anthropic', type: 'Premium opcional', status: 'Somente se chave existir', cost: 'Pago', use: 'Fallback avançado sem travar o produto' },
]

const defaultExperiments: Experiment[] = [
  {
    id: 'radar-unidades',
    title: 'Radar semanal de unidades em risco',
    area: 'Dados',
    owner: 'Educação APS',
    status: 'Teste',
    metric: 'Reduzir tarefas atrasadas em 20%',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'briefing-diretoria',
    title: 'Briefing executivo automático',
    area: 'Gestão',
    owner: 'Sofi',
    status: 'Escala',
    metric: '1 resumo acionável por semana',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'campanhas-aeo',
    title: 'Campanhas com Answer Engine Optimization',
    area: 'Marketing',
    owner: 'Comunicação',
    status: 'Ideia',
    metric: 'Aumentar clareza e reutilização de comunicados',
    createdAt: new Date().toISOString(),
  },
]

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full"
      style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
      {children}
    </span>
  )
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
      {children}
    </div>
  )
}

export default function InovacaoPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [selectedTool, setSelectedTool] = useState<ToolCard>(toolCards[0])
  const [context, setContext] = useState('Prioridades da semana, dados das unidades, tarefas em atraso, campanhas e decisões pendentes.')
  const [aiOutput, setAiOutput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [experiments, setExperiments] = useState<Experiment[]>(defaultExperiments)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_EXPERIMENTS)
      if (saved) setExperiments(JSON.parse(saved))
    } catch {}
  }, [])

  const saveExperiments = (next: Experiment[]) => {
    setExperiments(next)
    localStorage.setItem(LS_EXPERIMENTS, JSON.stringify(next))
  }

  const maturityScore = useMemo(() => {
    const scale = experiments.filter(e => e.status === 'Escala').length * 22
    const test = experiments.filter(e => e.status === 'Teste').length * 13
    const ideas = experiments.filter(e => e.status === 'Ideia').length * 6
    return Math.min(100, 38 + scale + test + ideas)
  }, [experiments])

  const generateWithSofi = async (tool = selectedTool) => {
    setSelectedTool(tool)
    setAiLoading(true)
    setAiOutput('')
    try {
      const prompt = `${tool.prompt}

Contexto APS-EDU:
${context}

Responda em português, com:
1. Diagnóstico executivo
2. Plano de 7 dias
3. Automações sugeridas
4. Métricas
5. Riscos e guardrails
6. Próxima ação imediata`

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      setAiOutput(data.content || data.error || 'A Sofi não retornou conteúdo agora.')
    } catch {
      setAiOutput('Não consegui chamar a Sofi agora. Verifique as chaves dos provedores ou tente novamente.')
    } finally {
      setAiLoading(false)
    }
  }

  const addExperiment = (tool: ToolCard) => {
    const next: Experiment = {
      id: `${tool.title}-${Date.now()}`.toLowerCase().replace(/\s+/g, '-'),
      title: tool.title,
      area: tool.area,
      owner: 'APS-EDU',
      status: 'Ideia',
      metric: tool.impact,
      createdAt: new Date().toISOString(),
    }
    saveExperiments([next, ...experiments])
    setActiveTab('lab')
  }

  const updateExperiment = (id: string, status: Experiment['status']) => {
    saveExperiments(experiments.map(exp => exp.id === id ? { ...exp, status } : exp))
  }

  const removeExperiment = (id: string) => {
    saveExperiments(experiments.filter(exp => exp.id !== id))
  }

  const renderTools = (area?: string) => {
    const cards = area ? toolCards.filter(tool => tool.area === area || tool.area.includes(area)) : toolCards
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map(tool => (
          <SectionCard key={tool.title}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-extrabold text-white">{tool.title}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>{tool.description}</p>
              </div>
              <Badge color={tool.color}>{tool.effort}</Badge>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.48)' }}>
              Impacto: {tool.impact}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tool.freeStack.map(item => <Badge key={item} color={tool.color}>{item}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => generateWithSofi(tool)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-black"
                style={{ background: `linear-gradient(135deg, ${tool.color}, #FDC347)` }}>
                Gerar plano com Sofi
              </button>
              <button onClick={() => addExperiment(tool)}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.68)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Levar ao laboratório
              </button>
              <button onClick={() => navigator.clipboard?.writeText(tool.prompt)}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.42)', border: '1px solid rgba(255,255,255,0.06)' }}>
                Copiar prompt
              </button>
            </div>
          </SectionCard>
        ))}
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)', color: '#000', boxShadow: '0 0 24px rgba(248,163,3,0.25)' }}>
                <RocketLaunchIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white">Central de Inovação IA</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  Agentes, automações, people analytics, growth, dados e SaaS orientado a resultados.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-full xl:min-w-[460px]">
            {[
              { label: 'Maturidade IA', value: `${maturityScore}%`, color: '#F8A303' },
              { label: 'Ferramentas', value: toolCards.length, color: '#4A9EFF' },
              { label: 'Experimentos', value: experiments.length, color: '#0ABD78' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-2xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-lg font-extrabold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.32)' }}>{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
              style={{
                background: activeTab === tab.key ? 'rgba(248,163,3,0.16)' : 'rgba(255,255,255,0.04)',
                border: activeTab === tab.key ? '1px solid rgba(248,163,3,0.32)' : '1px solid rgba(255,255,255,0.07)',
                color: activeTab === tab.key ? '#FDC347' : 'rgba(255,255,255,0.5)',
              }}>
              <span className="mr-1.5">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {[
                { icon: CpuChipIcon, title: 'Agentes por tarefa', text: 'Sofi passa de chat para operador de fluxos com responsabilidade e guardrails.', color: '#F8A303' },
                { icon: UserGroupIcon, title: 'Gestão de pessoas', text: 'Sinais de sobrecarga, engajamento e reconhecimento conectados às rotinas.', color: '#0ABD78' },
                { icon: MegaphoneIcon, title: 'Marketing com AEO', text: 'Campanhas prontas para mecanismos de resposta como ChatGPT, Gemini e Perplexity.', color: '#29ABE2' },
                { icon: ChartBarIcon, title: 'Dados conversacionais', text: 'Perguntas naturais viram diagnóstico, causa provável e próxima ação.', color: '#8B5CF6' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <SectionCard key={item.title}>
                    <Icon className="w-6 h-6 mb-3" style={{ color: item.color }} />
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="text-xs leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.42)' }}>{item.text}</p>
                  </SectionCard>
                )
              })}
            </div>
            <SectionCard>
              <div className="flex items-start gap-3 mb-4">
                <SparklesIcon className="w-6 h-6 flex-shrink-0" style={{ color: '#F8A303' }} />
                <div>
                  <p className="text-base font-extrabold text-white">Contexto estratégico para a Sofi</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>
                    Atualize o contexto e use qualquer ferramenta abaixo para gerar planos, automações e rituais.
                  </p>
                </div>
              </div>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                className="w-full min-h-[110px] rounded-2xl p-4 text-sm outline-none text-white"
                style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </SectionCard>
            {renderTools()}
          </>
        )}

        {activeTab === 'agents' && (
          <>
            <SectionCard>
              <div className="flex items-center gap-3 mb-4">
                <CpuChipIcon className="w-6 h-6" style={{ color: '#F8A303' }} />
                <div>
                  <p className="text-base font-extrabold text-white">Matriz de IAs gratuitas e automatizadas</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.36)' }}>O sistema usa provedores gratuitos quando possível e ativa fallbacks quando houver chaves.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {aiProviders.map(provider => (
                  <div key={provider.name} className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-white">{provider.name}</p>
                      <Badge color={provider.cost.includes('Gratuito') ? '#0ABD78' : '#F8A303'}>{provider.cost}</Badge>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{provider.type}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>{provider.status}</p>
                    <p className="text-[11px] leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.42)' }}>{provider.use}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
            {renderTools('Agentes')}
          </>
        )}

        {activeTab === 'people' && renderTools('People')}
        {activeTab === 'marketing' && renderTools('Marketing')}
        {activeTab === 'data' && renderTools('Dados')}
        {activeTab === 'saas' && renderTools('SaaS')}

        {activeTab === 'lab' && (
          <SectionCard>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <BeakerIcon className="w-6 h-6" style={{ color: '#F8A303' }} />
                <div>
                  <p className="text-base font-extrabold text-white">Laboratório de Experimentos</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.36)' }}>Ideias viram testes, testes viram escala.</p>
                </div>
              </div>
              <button onClick={() => addExperiment(selectedTool)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-black"
                style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
                Adicionar experimento
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {experiments.map(exp => (
                <div key={exp.id} className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-bold text-white">{exp.title}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>{exp.area} · {exp.owner}</p>
                    </div>
                    <Badge color={exp.status === 'Escala' ? '#0ABD78' : exp.status === 'Teste' ? '#4A9EFF' : '#F8A303'}>{exp.status}</Badge>
                  </div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{exp.metric}</p>
                  <div className="flex flex-wrap gap-2">
                    {(['Ideia', 'Teste', 'Escala'] as const).map(status => (
                      <button key={status} onClick={() => updateExperiment(exp.id, status)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                        style={{
                          background: exp.status === status ? 'rgba(248,163,3,0.16)' : 'rgba(255,255,255,0.04)',
                          color: exp.status === status ? '#FDC347' : 'rgba(255,255,255,0.38)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}>
                        {status}
                      </button>
                    ))}
                    <button onClick={() => removeExperiment(exp.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{ background: 'rgba(255,71,87,0.1)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.2)' }}>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {(aiOutput || aiLoading) && (
          <SectionCard className="border-gold">
            <div className="flex items-center gap-3 mb-3">
              <ChatBubbleBottomCenterTextIcon className="w-6 h-6" style={{ color: '#F8A303' }} />
              <div>
                <p className="text-base font-extrabold text-white">Resposta da Sofi</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.36)' }}>{selectedTool.title}</p>
              </div>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 py-6">
                {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#F8A303', animationDelay: `${i * 0.2}s` }} />)}
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Sofi está montando o plano...</span>
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.74)' }}>
                {aiOutput}
              </div>
            )}
          </SectionCard>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: ClipboardDocumentCheckIcon, title: 'Guardrails', text: 'Toda automação deve ter responsável, métrica, reversão e revisão humana quando afetar pessoas.' },
            { icon: BoltIcon, title: 'Execução', text: 'Priorize agentes que fecham ciclos: detectar, recomendar, criar tarefa, acompanhar e medir.' },
            { icon: LightBulbIcon, title: 'Próximo salto', text: 'Conectar esta central ao backend para salvar experimentos por usuário e gerar relatórios executivos recorrentes.' },
          ].map(item => {
            const Icon = item.icon
            return (
              <SectionCard key={item.title}>
                <Icon className="w-5 h-5 mb-2" style={{ color: '#F8A303' }} />
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.text}</p>
              </SectionCard>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
