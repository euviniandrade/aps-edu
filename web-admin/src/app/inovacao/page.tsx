'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
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

type TabKey = 'overview' | 'market' | 'agents' | 'agentops' | 'people' | 'marketing' | 'data' | 'saas' | 'roi' | 'lab'

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

interface MarketSignal {
  title: string
  source: string
  insight: string
  apsMove: string
  urgency: 'Agora' | 'Próximo' | 'Explorar'
  color: string
}

interface AgentBlueprint {
  name: string
  mission: string
  inputs: string[]
  actions: string[]
  guardrail: string
  metric: string
  color: string
}

interface AiMeta {
  provider?: string
  providerLabel?: string
  model?: string
  attemptedProviders?: string[]
}

const LS_EXPERIMENTS = 'apsedu_innovation_experiments'

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Visão Geral', icon: '✦' },
  { key: 'market', label: 'Radar 2026', icon: '🛰️' },
  { key: 'agents', label: 'Agentes IA', icon: '🤖' },
  { key: 'agentops', label: 'AgentOps', icon: '🛡️' },
  { key: 'people', label: 'Pessoas', icon: '👥' },
  { key: 'marketing', label: 'Marketing', icon: '📣' },
  { key: 'data', label: 'Dados', icon: '📊' },
  { key: 'saas', label: 'SaaS', icon: '⚙️' },
  { key: 'roi', label: 'ROI', icon: '💎' },
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
  {
    title: 'AgentOps Board',
    area: 'Agentes IA',
    description: 'Governança operacional para agentes: dono, logs, risco, aprovação humana e ROI.',
    prompt: 'Desenhe um AgentOps Board para a APS com agentes, donos, permissões, logs, métricas, riscos, aprovação humana e plano de escala.',
    impact: 'Agentes deixam de ser experimento e viram operação confiável.',
    effort: 'Médio',
    freeStack: ['Logs locais', 'Sofi', 'Automações', 'Revisão humana'],
    color: '#A78BFA',
  },
  {
    title: 'AI Talent Marketplace',
    area: 'People Analytics',
    description: 'Mapeia habilidades, necessidades, oportunidades de mentoria e realocação de talentos.',
    prompt: 'Monte um marketplace interno de talentos da APS: habilidades, lacunas, mentores, oportunidades, trilhas e próximos movimentos.',
    impact: 'Mais mobilidade, aprendizado e melhor alocação de pessoas.',
    effort: 'Alto',
    freeStack: ['Usuários', 'Cargos', 'Tarefas', 'Feedbacks'],
    color: '#34D399',
  },
]

const marketSignals: MarketSignal[] = [
  {
    title: 'Agentes específicos por função',
    source: 'Gartner, Workday, Gloat, Fountain',
    insight: 'O mercado saiu do chatbot genérico para agentes por tarefa: RH, finanças, frontline, vendas, operações e atendimento.',
    apsMove: 'Transformar Sofi em família de agentes: Diretoria, Pessoas, Unidade, Comunicação, Dados e Rotina.',
    urgency: 'Agora',
    color: '#F8A303',
  },
  {
    title: 'AgentOps e governança viraram requisito',
    source: 'Primitive, Covasant, WitnessAI, Gartner',
    insight: 'Quanto mais autonomia, mais importam contexto, permissões, logs, aprovação humana e medição de risco.',
    apsMove: 'Toda automação da APS deve ter dono, métrica, revisão humana e trilha de auditoria.',
    urgency: 'Agora',
    color: '#A78BFA',
  },
  {
    title: 'People AI precisa amplificar pessoas',
    source: 'Deloitte, Gartner, McKinsey',
    insight: 'Projetos com maior retorno são os que redesenham trabalho e capacitam pessoas, não os que apenas cortam custo.',
    apsMove: 'Criar People OS com carga, engajamento, reconhecimento, habilidades e plano de desenvolvimento.',
    urgency: 'Agora',
    color: '#0ABD78',
  },
  {
    title: 'Dados conversacionais e ação no fluxo',
    source: 'Snowflake, Salesforce, Gong, McKinsey',
    insight: 'A camada vencedora conecta dados empresariais à execução: perguntar, decidir, criar ação e medir.',
    apsMove: 'Levar Analytics para “pergunta → diagnóstico → tarefa → acompanhamento”.',
    urgency: 'Próximo',
    color: '#4A9EFF',
  },
  {
    title: 'AI-native HR consolidado',
    source: 'Bolto, HrFlow.ai, Workday, Gloat',
    insight: 'Startups estão unificando recrutamento, folha, dados e contexto em plataformas AI-native.',
    apsMove: 'Consolidar pessoas, cargos, unidades, feedback e tarefas em um mapa de talentos APS.',
    urgency: 'Próximo',
    color: '#34D399',
  },
  {
    title: 'Marketing com agente e AEO',
    source: 'Prophet MAIA, HubSpot, Gong',
    insight: 'Marketing passa a otimizar para respostas de IA, personalização e ciclo completo de campanha.',
    apsMove: 'Growth Studio APS: campanha, público, canais, assets, AEO, métricas e aprendizado.',
    urgency: 'Explorar',
    color: '#29ABE2',
  },
]

const agentBlueprints: AgentBlueprint[] = [
  {
    name: 'Agente Diretoria APS',
    mission: 'Gerar briefing executivo, riscos, decisões e follow-ups semanais.',
    inputs: ['Dashboard', 'Tarefas', 'Eventos', 'Unidades', 'Feedbacks'],
    actions: ['Criar resumo', 'Sugerir decisões', 'Abrir follow-ups', 'Priorizar riscos'],
    guardrail: 'Nunca envia comunicação externa sem aprovação humana.',
    metric: 'Decisões com responsável e prazo em 100% das reuniões.',
    color: '#F8A303',
  },
  {
    name: 'Agente People OS',
    mission: 'Detectar sobrecarga, lacunas de habilidade, reconhecimento e oportunidades de mentoria.',
    inputs: ['Usuários', 'Cargos', 'Gamificação', 'Feedbacks', 'Tarefas'],
    actions: ['Sinalizar risco', 'Sugerir reconhecimento', 'Criar trilha de desenvolvimento'],
    guardrail: 'Não classifica desempenho individual sem contexto e revisão humana.',
    metric: 'Reduzir atrasos recorrentes e aumentar reconhecimento útil.',
    color: '#0ABD78',
  },
  {
    name: 'Agente Unidade',
    mission: 'Acompanhar saúde operacional por unidade e recomendar intervenção.',
    inputs: ['Ranking por unidade', 'Tarefas atrasadas', 'Eventos', 'Engajamento'],
    actions: ['Radar de risco', 'Plano de 7 dias', 'Mensagem ao responsável'],
    guardrail: 'Toda recomendação sensível deve ser revisada pela liderança.',
    metric: 'Reduzir unidades em risco mês a mês.',
    color: '#4A9EFF',
  },
  {
    name: 'Agente Growth APS',
    mission: 'Criar campanhas, comunicados e peças com AEO e métricas.',
    inputs: ['Mural', 'Eventos', 'Públicos', 'Calendário'],
    actions: ['Gerar campanha', 'Criar variações', 'Sugerir imagem', 'Medir resposta'],
    guardrail: 'Respeitar identidade institucional e aprovação de comunicação.',
    metric: 'Comunicações mais claras, reutilizáveis e mensuráveis.',
    color: '#29ABE2',
  },
  {
    name: 'Agente Dados',
    mission: 'Responder perguntas executivas e converter insight em ação.',
    inputs: ['Reports', 'Analytics', 'Tarefas', 'Eventos'],
    actions: ['Explicar tendência', 'Encontrar causa provável', 'Criar tarefa'],
    guardrail: 'Exibir incerteza quando os dados forem insuficientes.',
    metric: 'Tempo de diagnóstico reduzido em 50%.',
    color: '#8B5CF6',
  },
]

const aiProviders = [
  { name: 'Gemini', type: 'Texto e raciocínio', status: 'Ativo com GEMINI_API_KEY', cost: 'Free tier disponível', use: 'Briefings, análises, planos e conversa da Sofi' },
  { name: 'Groq', type: 'Texto rápido, visão e áudio', status: 'Ativo com GROQ_API_KEY', cost: 'Free tier disponível', use: 'Chat rápido, transcrição e leitura de imagem' },
  { name: 'OpenAI', type: 'Raciocínio e agentes', status: 'Opcional com OPENAI_API_KEY', cost: 'Pago/free credits', use: 'Planos executivos, agentes e respostas de alta qualidade' },
  { name: 'Anthropic Claude', type: 'Análise e escrita', status: 'Opcional com ANTHROPIC_API_KEY', cost: 'Pago', use: 'Relatórios longos, revisão, estratégia e comunicação cuidadosa' },
  { name: 'Mistral AI', type: 'Modelo europeu', status: 'Opcional com MISTRAL_API_KEY', cost: 'Free tier/pago', use: 'Fallback rápido para texto e automações' },
  { name: 'DeepSeek', type: 'Raciocínio técnico', status: 'Opcional com DEEPSEEK_API_KEY', cost: 'Baixo custo', use: 'Análise, lógica e apoio técnico' },
  { name: 'OpenRouter', type: 'Hub multi-modelo', status: 'Opcional com OPENROUTER_API_KEY', cost: 'Conforme modelo', use: 'Acesso unificado a modelos de vários provedores' },
  { name: 'xAI Grok', type: 'Texto e raciocínio', status: 'Opcional com XAI_API_KEY', cost: 'Pago', use: 'Fallback alternativo para planos e diagnósticos' },
  { name: 'Perplexity', type: 'Busca com IA', status: 'Opcional com PERPLEXITY_API_KEY', cost: 'Pago', use: 'Respostas com contexto externo quando ativado' },
  { name: 'Pollinations', type: 'Imagem', status: 'Sem chave', cost: 'Gratuito', use: 'Geração de imagens e peças visuais simples' },
  { name: 'Hugging Face', type: 'Imagem fallback', status: 'Opcional com HF_TOKEN', cost: 'Free tier/limites', use: 'Fallback para geração visual' },
  { name: 'DuckDuckGo Instant Answer', type: 'Busca', status: 'Sem chave', cost: 'Gratuito', use: 'Pesquisa rápida para contexto da Sofi' },
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

function formatAiLine(line: string) {
  return line
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s*/, '')
    .trim()
}

function renderAiReport(content: string) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean)
  if (!lines.length) return null

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const isHeading = /^#{1,3}\s+/.test(line) || /^\*\*[^*]+:\*\*$/.test(line) || /^\*\*[^*]+\*\*$/.test(line)
        const isNumbered = /^\d+\.\s+/.test(line)
        const isBullet = /^[-*]\s+/.test(line)
        const cleaned = formatAiLine(line.replace(/^\d+\.\s+/, ''))

        if (isHeading) {
          return (
            <div key={`${line}-${index}`} className="pt-2">
              <p className="text-sm font-extrabold text-white">{cleaned.replace(/:$/, '')}</p>
              <div className="mt-2 h-px" style={{ background: 'linear-gradient(90deg, rgba(248,163,3,0.55), rgba(248,163,3,0))' }} />
            </div>
          )
        }

        if (isNumbered || isBullet) {
          return (
            <div key={`${line}-${index}`} className="flex gap-3 rounded-2xl p-3"
              style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                style={{ background: 'rgba(248,163,3,0.16)', color: '#FDC347' }}>
                {isNumbered ? line.match(/^\d+/)?.[0] : '•'}
              </span>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.74)' }}>{cleaned}</p>
            </div>
          )
        }

        return (
          <p key={`${line}-${index}`} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {cleaned}
          </p>
        )
      })}
    </div>
  )
}

export default function InovacaoPage() {
  const responseRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [selectedTool, setSelectedTool] = useState<ToolCard>(toolCards[0])
  const [context, setContext] = useState('Prioridades da semana, dados das unidades, tarefas em atraso, campanhas e decisões pendentes.')
  const [aiOutput, setAiOutput] = useState('')
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [actionNotice, setActionNotice] = useState('')
  const [experiments, setExperiments] = useState<Experiment[]>(defaultExperiments)
  const [roiInputs, setRoiInputs] = useState({
    people: 18,
    hoursPerWeek: 4,
    hourlyCost: 65,
    automationPct: 35,
  })

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

  const roi = useMemo(() => {
    const savedHours = roiInputs.people * roiInputs.hoursPerWeek * (roiInputs.automationPct / 100)
    const weeklySavings = savedHours * roiInputs.hourlyCost
    const monthlySavings = weeklySavings * 4.33
    const annualSavings = monthlySavings * 12
    return { savedHours, weeklySavings, monthlySavings, annualSavings }
  }, [roiInputs])

  const generateWithSofi = async (tool = selectedTool) => {
    setSelectedTool(tool)
    setAiLoading(true)
    setAiOutput('')
    setAiMeta(null)
    setActionNotice(`Sofi está gerando o plano: ${tool.title}`)
    window.setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
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
      setAiMeta({
        provider: data.provider,
        providerLabel: data.providerLabel,
        model: data.model,
        attemptedProviders: data.attemptedProviders,
      })
      setActionNotice(data.content ? `Plano pronto: ${tool.title}` : `A Sofi retornou um aviso para ${tool.title}`)
    } catch {
      setAiOutput('Não consegui chamar a Sofi agora. Verifique as chaves dos provedores ou tente novamente.')
      setActionNotice('Não foi possível conectar com a Sofi agora.')
    } finally {
      setAiLoading(false)
      window.setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }

  const addExperiment = (tool: ToolCard) => {
    setSelectedTool(tool)
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
    setActionNotice(`${tool.title} foi levado para o laboratório.`)
    window.setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }

  const updateExperiment = (id: string, status: Experiment['status']) => {
    saveExperiments(experiments.map(exp => exp.id === id ? { ...exp, status } : exp))
    setActionNotice(`Experimento atualizado para ${status}.`)
  }

  const removeExperiment = (id: string) => {
    saveExperiments(experiments.filter(exp => exp.id !== id))
    setActionNotice('Experimento removido.')
  }

  const copyPrompt = async (tool: ToolCard) => {
    setSelectedTool(tool)
    try {
      const textarea = document.createElement('textarea')
      textarea.value = tool.prompt
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)

      setActionNotice(copied ? `Prompt copiado: ${tool.title}` : 'Não consegui copiar automaticamente neste navegador.')
    } catch {
      setActionNotice('Não consegui copiar automaticamente neste navegador.')
    }
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
                disabled={aiLoading}
                className="px-3 py-2 rounded-xl text-xs font-bold text-black"
                style={{
                  background: `linear-gradient(135deg, ${tool.color}, #FDC347)`,
                  opacity: aiLoading ? 0.68 : 1,
                  cursor: aiLoading ? 'wait' : 'pointer',
                }}>
                {aiLoading && selectedTool.title === tool.title ? 'Gerando...' : 'Gerar plano com Sofi'}
              </button>
              <button onClick={() => addExperiment(tool)}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.68)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Levar ao laboratório
              </button>
              <button onClick={() => copyPrompt(tool)}
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

  const updateRoiInput = (key: keyof typeof roiInputs, value: number) => {
    setRoiInputs(prev => ({ ...prev, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 }))
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

        {actionNotice && (
          <div className="rounded-2xl px-4 py-3 text-xs font-bold"
            style={{ background: 'rgba(248,163,3,0.11)', border: '1px solid rgba(248,163,3,0.24)', color: '#FDC347' }}>
            {actionNotice}
          </div>
        )}

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

        {activeTab === 'market' && (
          <>
            <SectionCard>
              <div className="flex items-start gap-3 mb-4">
                <LightBulbIcon className="w-6 h-6 flex-shrink-0" style={{ color: '#F8A303' }} />
                <div>
                  <p className="text-base font-extrabold text-white">Radar profundo de mercado aplicado à APS-EDU</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Tendências atuais de IA, startups, SaaS, gestão de pessoas, marketing e analytics convertidas em movimentos práticos para a plataforma.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {marketSignals.map(signal => (
                  <div key={signal.title} className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-extrabold text-white">{signal.title}</p>
                        <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>{signal.source}</p>
                      </div>
                      <Badge color={signal.color}>{signal.urgency}</Badge>
                    </div>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.48)' }}>{signal.insight}</p>
                    <div className="rounded-xl p-3" style={{ background: `${signal.color}10`, border: `1px solid ${signal.color}22` }}>
                      <p className="text-[10px] uppercase font-black tracking-wider mb-1" style={{ color: signal.color }}>Movimento APS</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>{signal.apsMove}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard>
              <p className="text-base font-extrabold text-white mb-3">Agenda de implantação de alto nível</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: '0-30 dias', text: 'Sofi com áudio, transcrição, prompts operacionais, radar de inovação e laboratório de experimentos.', color: '#0ABD78' },
                  { title: '31-60 dias', text: 'Agentes por função, AgentOps Board, métricas de adoção e analytics conversacional com ações.', color: '#F8A303' },
                  { title: '61-90 dias', text: 'People OS, marketplace de talentos, campanhas AEO, anomalias automáticas e relatórios recorrentes.', color: '#4A9EFF' },
                ].map(item => (
                  <div key={item.title} className="rounded-2xl p-4" style={{ background: `${item.color}10`, border: `1px solid ${item.color}22` }}>
                    <p className="text-sm font-extrabold" style={{ color: item.color }}>{item.title}</p>
                    <p className="text-xs leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.56)' }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
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

        {activeTab === 'agentops' && (
          <>
            <SectionCard>
              <div className="flex items-start gap-3 mb-4">
                <ClipboardDocumentCheckIcon className="w-6 h-6 flex-shrink-0" style={{ color: '#A78BFA' }} />
                <div>
                  <p className="text-base font-extrabold text-white">AgentOps Board</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>
                    Estrutura para colocar agentes em produção com controle, dono, métricas, logs e revisão humana.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {agentBlueprints.map(agent => (
                  <div key={agent.name} className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-white">{agent.name}</p>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,0.48)' }}>{agent.mission}</p>
                      </div>
                      <Badge color={agent.color}>Ativo</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-wider mb-2" style={{ color: agent.color }}>Entradas</p>
                        <div className="flex flex-wrap gap-1.5">{agent.inputs.map(input => <Badge key={input} color={agent.color}>{input}</Badge>)}</div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-wider mb-2" style={{ color: agent.color }}>Ações</p>
                        <div className="flex flex-wrap gap-1.5">{agent.actions.map(action => <Badge key={action} color={agent.color}>{action}</Badge>)}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl p-3" style={{ background: `${agent.color}0F`, border: `1px solid ${agent.color}22` }}>
                        <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: agent.color }}>Guardrail</p>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,0.58)' }}>{agent.guardrail}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: `${agent.color}0F`, border: `1px solid ${agent.color}22` }}>
                        <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: agent.color }}>Métrica</p>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,0.58)' }}>{agent.metric}</p>
                      </div>
                    </div>
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

        {activeTab === 'roi' && (
          <SectionCard>
            <div className="flex items-start gap-3 mb-4">
              <ChartBarIcon className="w-6 h-6 flex-shrink-0" style={{ color: '#F8A303' }} />
              <div>
                <p className="text-base font-extrabold text-white">ROI Studio de IA</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>
                  Simule ganho financeiro e horas recuperadas antes de escalar agentes e automações.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'people' as const, label: 'Pessoas impactadas', suffix: '' },
                  { key: 'hoursPerWeek' as const, label: 'Horas semanais por pessoa', suffix: 'h' },
                  { key: 'hourlyCost' as const, label: 'Custo/hora médio', suffix: 'R$' },
                  { key: 'automationPct' as const, label: 'Automatização estimada', suffix: '%' },
                ].map(input => (
                  <label key={input.key} className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.075)' }}>
                    <span className="block text-[10px] uppercase font-black tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.36)' }}>{input.label}</span>
                    <div className="flex items-center gap-2">
                      {input.suffix === 'R$' && <span className="text-xs font-bold" style={{ color: '#F8A303' }}>R$</span>}
                      <input
                        type="number"
                        min="0"
                        value={roiInputs[input.key]}
                        onChange={e => updateRoiInput(input.key, Number(e.target.value))}
                        className="w-full rounded-xl px-3 py-2 text-sm font-bold text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
                      />
                      {input.suffix !== 'R$' && input.suffix && <span className="text-xs font-bold" style={{ color: '#F8A303' }}>{input.suffix}</span>}
                    </div>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Horas recuperadas/semana', value: `${roi.savedHours.toFixed(1)}h`, color: '#0ABD78' },
                  { label: 'Economia semanal', value: roi.weeklySavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#F8A303' },
                  { label: 'Economia mensal', value: roi.monthlySavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#4A9EFF' },
                  { label: 'Economia anual', value: roi.annualSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: '#A78BFA' },
                ].map(result => (
                  <div key={result.label} className="rounded-2xl p-4" style={{ background: `${result.color}10`, border: `1px solid ${result.color}22` }}>
                    <p className="text-xl font-extrabold" style={{ color: result.color }}>{result.value}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.36)' }}>{result.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

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
          <div ref={responseRef}>
            <div className="rounded-3xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(248,163,3,0.14), rgba(10,189,120,0.08) 45%, rgba(74,158,255,0.10))', border: '1px solid rgba(248,163,3,0.24)', boxShadow: '0 22px 70px rgba(0,0,0,0.22)' }}>
              <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)', color: '#000', boxShadow: '0 0 32px rgba(248,163,3,0.24)' }}>
                      <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-white">Plano executivo da Sofi</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.48)' }}>{selectedTool.title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge color="#F8A303">{aiLoading ? 'Gerando agora' : 'Plano pronto'}</Badge>
                    {aiMeta?.providerLabel && <Badge color="#4A9EFF">{aiMeta.providerLabel}</Badge>}
                    {aiMeta?.model && <Badge color="#0ABD78">{aiMeta.model}</Badge>}
                  </div>
                </div>
              </div>
              {aiMeta?.attemptedProviders?.length ? (
                <div className="px-5 pt-4 flex flex-wrap gap-1.5">
                  {aiMeta.attemptedProviders.map(provider => <Badge key={provider} color="#8B5CF6">{provider}</Badge>)}
                </div>
              ) : null}
              {aiLoading ? (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => <span key={i} className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#F8A303', animationDelay: `${i * 0.2}s` }} />)}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.68)' }}>Sofi está escolhendo o melhor provedor e montando o plano...</span>
                  </div>
                  {[72, 94, 64, 88].map((width, index) => (
                    <div key={width} className="h-4 rounded-full animate-pulse"
                      style={{ width: `${width}%`, background: 'rgba(255,255,255,0.08)', animationDelay: `${index * 0.12}s` }} />
                  ))}
                </div>
              ) : (
                <div className="p-5">
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(3,7,18,0.42)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {renderAiReport(aiOutput)}
                  </div>
                </div>
              )}
            </div>
          </div>
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
