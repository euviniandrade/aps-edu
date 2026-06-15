'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowPathIcon,
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CloudIcon,
  CpuChipIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type ProviderStatus = {
  id: string
  name: string
  role: string
  configured: boolean
}

type AgentId = 'orquestradora' | 'scanner' | 'agenda' | 'documentos' | 'matriculas' | 'financeiro' | 'pessoas' | 'estoque' | 'qualidade' | 'automacao'

type Agent = {
  id: AgentId
  name: string
  area: string
  mission: string
  bestAi: string
  preferredProvider: string
  tools: string[]
  actions: string[]
  color: string
}

type Workflow = {
  id: string
  title: string
  trigger: string
  result: string
  owner: string
  agentId: AgentId
}

type Playbook = {
  id: string
  title: string
  agent: string
  createdAt: string
  content: string
}

type ArtifactType = 'Tarefa' | 'E-mail' | 'Evento' | 'Documento' | 'Automacao' | 'Relatorio' | 'Treinamento' | 'Compra' | 'Avaliacao'

type Artifact = {
  id: string
  type: ArtifactType
  title: string
  owner: string
  status: 'Rascunho' | 'Pronto' | 'Aprovacao'
  createdAt: string
  content: string
}

type AgentLog = {
  id: string
  at: string
  agent: string
  provider: string
  action: string
  status: 'OK' | 'Erro'
}

type ToolTemplate = {
  id: string
  agentId: AgentId
  type: ArtifactType
  title: string
  description: string
  prompt: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const AGENTS: Agent[] = [
  {
    id: 'orquestradora',
    name: 'Sofi Orquestradora',
    area: 'Comando',
    mission: 'Receber qualquer pedido, escolher o agente certo, quebrar em passos e acompanhar ate a entrega.',
    bestAi: 'GPT + Gemini',
    preferredProvider: 'openai',
    tools: ['Tarefas', 'Agenda', 'Documentos', 'Relatorios', 'Automacoes'],
    actions: ['Criar plano executivo', 'Priorizar semana', 'Distribuir tarefas', 'Preparar briefing'],
    color: '#F8A303',
  },
  {
    id: 'scanner',
    name: 'Sofi Scanner',
    area: 'Pesquisa',
    mission: 'Pesquisar mercado, comparar plataformas, sintetizar fontes e transformar achados em decisao.',
    bestAi: 'Perplexity + GPT',
    preferredProvider: 'perplexity',
    tools: ['Web', 'Benchmark', 'Relatorios', 'Fontes'],
    actions: ['Rodar pesquisa profunda', 'Comparar fornecedores', 'Gerar relatorio', 'Extrair tendencias'],
    color: '#29ABE2',
  },
  {
    id: 'agenda',
    name: 'Sofi Agenda',
    area: 'Calendario',
    mission: 'Organizar compromissos, detectar conflitos, sugerir blocos de foco e proteger prioridades.',
    bestAi: 'Gemini + Copilot',
    preferredProvider: 'gemini',
    tools: ['Google Agenda', 'Outlook', 'Tarefas', 'Lembretes'],
    actions: ['Criar agenda semanal', 'Remarcar prioridades', 'Preparar reunioes', 'Gerar follow-up'],
    color: '#4A9EFF',
  },
  {
    id: 'documentos',
    name: 'Sofi Documentos',
    area: 'Conhecimento',
    mission: 'Criar atas, comunicados, politicas, e-mails, checklists e resumos com padrao institucional.',
    bestAi: 'Claude + GPT',
    preferredProvider: 'anthropic',
    tools: ['Docs', 'PDFs', 'E-mail', 'Notas'],
    actions: ['Gerar ata', 'Revisar portugues', 'Criar comunicado', 'Resumir documento'],
    color: '#A78BFA',
  },
  {
    id: 'matriculas',
    name: 'Sofi Matriculas',
    area: 'Escola',
    mission: 'Acompanhar familias, funil de matricula, visitas, pendencias e proximas acoes.',
    bestAi: 'Gemini + GPT',
    preferredProvider: 'gemini',
    tools: ['CRM escolar', 'E-mail', 'Agenda', 'Pipeline'],
    actions: ['Priorizar familias', 'Criar follow-up', 'Gerar roteiro de visita', 'Sinalizar risco'],
    color: '#0ABD78',
  },
  {
    id: 'financeiro',
    name: 'Sofi Financeiro',
    area: 'Financeiro',
    mission: 'Analisar receitas, despesas, aprovacoes, contratos, vencimentos e riscos de caixa.',
    bestAi: 'GPT + Claude',
    preferredProvider: 'openai',
    tools: ['Fluxo previsto', 'Aprovacoes', 'Contratos', 'Relatorios'],
    actions: ['Gerar previsao', 'Priorizar pagamentos', 'Preparar aprovacao', 'Alertar risco'],
    color: '#34D399',
  },
  {
    id: 'pessoas',
    name: 'Sofi Pessoas',
    area: 'RH',
    mission: 'Apoiar desempenho, clima, feedback, treinamento, trilhas e desenvolvimento de liderancas.',
    bestAi: 'Claude + GPT',
    preferredProvider: 'anthropic',
    tools: ['Feedbacks', 'Treinamentos', 'Avaliacoes', 'Organograma'],
    actions: ['Sugerir trilha', 'Preparar feedback', 'Detectar sobrecarga', 'Criar check-in'],
    color: '#8B5CF6',
  },
  {
    id: 'estoque',
    name: 'Sofi Estoque',
    area: 'Operacao',
    mission: 'Controlar reposicao, inventario, compras, patrimonio e manutencao preventiva.',
    bestAi: 'Gemini + automacoes',
    preferredProvider: 'gemini',
    tools: ['Estoque', 'Compras', 'Ativos', 'Alertas'],
    actions: ['Criar compra', 'Avisar minimo', 'Gerar inventario', 'Priorizar manutencao'],
    color: '#E07B39',
  },
  {
    id: 'qualidade',
    name: 'Sofi Qualidade',
    area: 'Revisao',
    mission: 'Revisar clareza, portugues, tom institucional, acessibilidade e consistencia visual.',
    bestAi: 'Claude + GPT',
    preferredProvider: 'anthropic',
    tools: ['Textos', 'Design', 'Checklist', 'Padroes'],
    actions: ['Revisar texto', 'Padronizar tom', 'Avaliar tela', 'Criar checklist'],
    color: '#F9C234',
  },
  {
    id: 'automacao',
    name: 'Sofi Automacao',
    area: 'AgentOps',
    mission: 'Criar regras, gatilhos, logs, aprovacoes humanas e rotinas recorrentes com seguranca.',
    bestAi: 'Copilot + n8n',
    preferredProvider: 'openrouter',
    tools: ['Regras', 'Gatilhos', 'Logs', 'Conectores'],
    actions: ['Criar regra', 'Simular fluxo', 'Auditar risco', 'Publicar playbook'],
    color: '#14B8A6',
  },
]

const WORKFLOWS: Workflow[] = [
  { id: 'w1', title: 'Briefing executivo diario', trigger: 'Todo dia as 08:00', result: 'Resumo de riscos, prioridades, agenda e decisoes esperadas.', owner: 'Diretoria', agentId: 'orquestradora' },
  { id: 'w2', title: 'Matricula parada ha 3 dias', trigger: 'Familia sem proxima acao', result: 'Criar follow-up, sugerir mensagem e avisar Secretaria.', owner: 'Secretaria', agentId: 'matriculas' },
  { id: 'w3', title: 'Estoque abaixo do minimo', trigger: 'Quantidade menor que minimo operacional', result: 'Abrir solicitacao de compra e pedir aprovacao.', owner: 'Operacao', agentId: 'estoque' },
  { id: 'w4', title: 'Reuniao concluida', trigger: 'Ata ou anotacao enviada', result: 'Gerar ata, decisoes, responsaveis e tarefas.', owner: 'Sofi Documentos', agentId: 'documentos' },
  { id: 'w5', title: 'Treinamento de lideranca', trigger: 'Pulso de equipe abaixo da meta', result: 'Sugerir trilha, agenda de check-in e plano de acompanhamento.', owner: 'Pessoas', agentId: 'pessoas' },
  { id: 'w6', title: 'Pesquisa profunda de mercado', trigger: 'Solicitacao de scanner', result: 'Comparar referencias, extrair padroes e propor implementacao.', owner: 'Sofi Scanner', agentId: 'scanner' },
]

const INTEGRATIONS = [
  { name: 'Google Workspace', detail: 'Gmail, Agenda, Drive, Docs, Sheets e Meet.', status: 'Pronto para conectar', icon: CloudIcon, color: '#29ABE2' },
  { name: 'Microsoft 365', detail: 'Outlook, Teams, SharePoint, Planner e Power Automate.', status: 'Pronto para conectar', icon: CloudIcon, color: '#4A9EFF' },
  { name: 'Banco operacional APS', detail: 'Tarefas, pessoas, estoque, financeiro e unidades.', status: 'Ativo na plataforma', icon: CpuChipIcon, color: '#0ABD78' },
  { name: 'Documentos e conhecimento', detail: 'Atas, PDFs, politicas, checklists e contratos.', status: 'Base local pronta', icon: DocumentTextIcon, color: '#A78BFA' },
  { name: 'E-mail inteligente', detail: 'Triagem, rascunhos, follow-ups e comunicados.', status: 'Aguardando conector', icon: EnvelopeIcon, color: '#F8A303' },
  { name: 'AgentOps', detail: 'Permissoes, logs, dono, risco e aprovacao humana.', status: 'Governanca local', icon: ShieldCheckIcon, color: '#14B8A6' },
]

const TOOL_TEMPLATES: ToolTemplate[] = [
  { id: 'task-priority', agentId: 'orquestradora', type: 'Tarefa', title: 'Criar pacote de tarefas', description: 'Transforma objetivo em tarefas com dono, prazo, risco e prioridade.', icon: BoltIcon, prompt: 'Crie um pacote de tarefas para a APS EDU com titulo, dono, prazo, prioridade, dependencia, risco e criterio de conclusao.' },
  { id: 'scanner-report', agentId: 'scanner', type: 'Relatorio', title: 'Relatorio de scanner', description: 'Pesquisa, compara referencias e devolve decisao executiva.', icon: MagnifyingGlassIcon, prompt: 'Gere um relatorio de scanner profundo com ranking, fontes a verificar, padroes, riscos, recomendacoes e plano de implementacao.' },
  { id: 'calendar-week', agentId: 'agenda', type: 'Evento', title: 'Planejar semana', description: 'Cria blocos de agenda, preparacao e follow-ups.', icon: CalendarDaysIcon, prompt: 'Monte uma agenda semanal APS EDU com blocos de foco, reunioes, preparacao, follow-ups e protecao de prioridades.' },
  { id: 'doc-policy', agentId: 'documentos', type: 'Documento', title: 'Criar documento controlado', description: 'Gera politica, ata, checklist ou comunicado no padrao APS.', icon: DocumentTextIcon, prompt: 'Crie um documento controlado APS EDU com objetivo, escopo, responsaveis, procedimento, checklist, riscos e revisao.' },
  { id: 'email-family', agentId: 'matriculas', type: 'E-mail', title: 'Follow-up de matricula', description: 'Rascunha e-mail profissional para familia no funil.', icon: EnvelopeIcon, prompt: 'Escreva um e-mail de follow-up de matricula para uma familia, com tom acolhedor, proxima acao clara e chamada para visita pedagogica.' },
  { id: 'finance-approval', agentId: 'financeiro', type: 'Relatorio', title: 'Aprovacao financeira', description: 'Monta justificativa, impacto e decisao recomendada.', icon: ClipboardDocumentCheckIcon, prompt: 'Monte uma aprovacao financeira com justificativa, centro de custo, impacto, riscos, alternativas e decisao recomendada.' },
  { id: 'people-review', agentId: 'pessoas', type: 'Avaliacao', title: 'Avaliacao e trilha', description: 'Cria check-in, feedback e plano de desenvolvimento.', icon: UserGroupIcon, prompt: 'Crie uma avaliacao de pessoa/equipe com sinais de desempenho, feedback, reconhecimento, trilha de desenvolvimento e proximo check-in.' },
  { id: 'stock-purchase', agentId: 'estoque', type: 'Compra', title: 'Solicitacao de compra', description: 'Gera pedido de reposicao e aprovacao.', icon: CloudIcon, prompt: 'Gere uma solicitacao de compra/recomposicao de estoque com item, minimo, quantidade sugerida, justificativa, prioridade e aprovador.' },
  { id: 'quality-review', agentId: 'qualidade', type: 'Documento', title: 'Revisao de qualidade', description: 'Revisa texto, clareza, tom, acessibilidade e padrao visual.', icon: ShieldCheckIcon, prompt: 'Revise este material como controle de qualidade APS: portugues, clareza, tom institucional, acessibilidade, consistencia visual e versao final sugerida.' },
  { id: 'automation-rule', agentId: 'automacao', type: 'Automacao', title: 'Criar regra AgentOps', description: 'Define gatilho, acao, logs, aprovacao e reversao.', icon: CpuChipIcon, prompt: 'Crie uma automacao AgentOps com gatilho, condicoes, acao, dono, log, aprovacao humana, rollback, risco e metrica.' },
]

const STORAGE_KEY = 'aps_edu_ai_center_playbooks'
const AGENT_STATE_KEY = 'aps_edu_ai_center_agents'
const ARTIFACT_STORAGE_KEY = 'aps_edu_ai_center_artifacts'
const LOG_STORAGE_KEY = 'aps_edu_ai_center_logs'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.35rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20 ${className}`}>
      {children}
    </section>
  )
}

function openSofi(prompt: string) {
  window.dispatchEvent(new CustomEvent('aps:open-sofi', { detail: { prompt } }))
}

export default function AiIntelligenceCenter() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('orquestradora')
  const [selectedWorkflow, setSelectedWorkflow] = useState(WORKFLOWS[0].id)
  const [activeAgents, setActiveAgents] = useState<Record<string, boolean>>({})
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState('auto')
  const [activeToolId, setActiveToolId] = useState(TOOL_TEMPLATES[0].id)
  const [scannerGoal, setScannerGoal] = useState('Pesquisar as melhores IAs e agentes para gestao escolar, tarefas, pessoas, financeiro, agenda e documentos.')
  const [toolContext, setToolContext] = useState('Contexto: APS EDU, rede escolar, area administrativa, foco em execucao profissional e governanca.')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const selectedAgent = useMemo(() => AGENTS.find(agent => agent.id === selectedAgentId) || AGENTS[0], [selectedAgentId])
  const workflow = useMemo(() => WORKFLOWS.find(item => item.id === selectedWorkflow) || WORKFLOWS[0], [selectedWorkflow])
  const activeTool = useMemo(() => TOOL_TEMPLATES.find(tool => tool.id === activeToolId) || TOOL_TEMPLATES[0], [activeToolId])
  const visibleTools = useMemo(() => TOOL_TEMPLATES.filter(tool => tool.agentId === selectedAgentId || selectedAgentId === 'orquestradora'), [selectedAgentId])
  const configuredCount = providers.filter(item => item.configured).length
  const effectiveProvider = selectedProviderId === 'auto' ? selectedAgent.preferredProvider : selectedProviderId

  useEffect(() => {
    fetch('/api/ai/status')
      .then(res => res.json())
      .then(data => setProviders(data.providers || []))
      .catch(() => setProviders([]))

    try {
      setPlaybooks(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
      setActiveAgents(JSON.parse(localStorage.getItem(AGENT_STATE_KEY) || '{}'))
      setArtifacts(JSON.parse(localStorage.getItem(ARTIFACT_STORAGE_KEY) || '[]'))
      setLogs(JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'))
    } catch {
      setPlaybooks([])
      setActiveAgents({})
      setArtifacts([])
      setLogs([])
    }
  }, [])

  useEffect(() => {
    const firstTool = TOOL_TEMPLATES.find(tool => tool.agentId === selectedAgentId) || TOOL_TEMPLATES[0]
    setActiveToolId(firstTool.id)
  }, [selectedAgentId])

  function persistAgents(next: Record<string, boolean>) {
    setActiveAgents(next)
    localStorage.setItem(AGENT_STATE_KEY, JSON.stringify(next))
  }

  function toggleAgent(agentId: string) {
    const next = { ...activeAgents, [agentId]: !activeAgents[agentId] }
    persistAgents(next)
    setNotice(next[agentId] ? 'Agente ativado no painel local.' : 'Agente pausado no painel local.')
  }

  function persistArtifacts(next: Artifact[]) {
    setArtifacts(next)
    localStorage.setItem(ARTIFACT_STORAGE_KEY, JSON.stringify(next))
  }

  function persistLogs(next: AgentLog[]) {
    setLogs(next)
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(next))
  }

  function addLog(entry: Omit<AgentLog, 'id' | 'at'>) {
    const next = [{ id: `log-${Date.now()}`, at: new Date().toLocaleString('pt-BR'), ...entry }, ...logs].slice(0, 20)
    persistLogs(next)
  }

  function addArtifact(type: ArtifactType, title: string, content: string, status: Artifact['status'] = 'Pronto') {
    const next = [{
      id: `art-${Date.now()}`,
      type,
      title,
      owner: selectedAgent.name,
      status,
      createdAt: new Date().toLocaleString('pt-BR'),
      content,
    }, ...artifacts].slice(0, 16)
    persistArtifacts(next)
  }

  async function runAi(kind: 'agent' | 'workflow' | 'scanner') {
    setBusy(true)
    setOutput('')
    setNotice('Sofi esta processando com o melhor provedor disponivel...')

    const prompt = kind === 'scanner'
      ? `Voce e a Sofi Scanner da APS EDU. Faca uma pesquisa profunda e estruturada sobre: ${scannerGoal}. Entregue: ranking, padroes em comum, ferramentas essenciais, riscos, integracoes, plano de implementacao em fases e proximas acoes praticas para a plataforma APS EDU.`
      : kind === 'workflow'
        ? `Voce e a ${selectedAgent.name}. Transforme este workflow em playbook funcional para APS EDU: titulo=${workflow.title}; gatilho=${workflow.trigger}; resultado=${workflow.result}; dono=${workflow.owner}. Entregue passos, dados necessarios, automacoes, aprovacao humana, riscos e checklist de execucao.`
        : `Voce e a ${selectedAgent.name}. Missao: ${selectedAgent.mission}. Area: ${selectedAgent.area}. Melhores IAs: ${selectedAgent.bestAi}. Ferramentas: ${selectedAgent.tools.join(', ')}. Gere um plano funcional para implementar este agente na plataforma APS EDU com telas, dados, acoes, automacoes, guardrails e metricas.`

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, preferredProvider: effectiveProvider }),
      })
      const data = await res.json()
      const content = data.content || data.error || 'A Sofi nao retornou conteudo agora.'
      setOutput(content)
      setNotice(data.providerLabel ? `Resposta gerada por ${data.providerLabel} / ${data.model}.` : 'Resposta gerada pela Sofi.')
      addLog({ agent: selectedAgent.name, provider: data.providerLabel || effectiveProvider, action: kind, status: data.content ? 'OK' : 'Erro' })
      if (data.content) addArtifact(kind === 'scanner' ? 'Relatorio' : kind === 'workflow' ? 'Automacao' : 'Documento', kind === 'scanner' ? 'Scanner profundo' : kind === 'workflow' ? workflow.title : `Implementacao ${selectedAgent.name}`, content)
    } catch {
      setOutput('Nao consegui conectar aos provedores agora. Verifique as chaves configuradas e tente novamente.')
      setNotice('Falha ao chamar a IA.')
      addLog({ agent: selectedAgent.name, provider: effectiveProvider, action: kind, status: 'Erro' })
    } finally {
      setBusy(false)
    }
  }

  async function runTool() {
    setBusy(true)
    setOutput('')
    setNotice(`Executando ${activeTool.title} com ${effectiveProvider === 'auto' ? 'roteamento automatico' : effectiveProvider}...`)
    const prompt = `Voce e a ${selectedAgent.name}, trabalhando na ferramenta "${activeTool.title}".
Missao do agente: ${selectedAgent.mission}
Ferramenta: ${activeTool.description}
Pedido: ${activeTool.prompt}
Contexto informado pelo usuario: ${toolContext}

Entregue um artefato operacional pronto para uso, em portugues do Brasil, com:
1. titulo
2. objetivo
3. conteudo principal
4. responsavel sugerido
5. prazo ou agenda
6. riscos e aprovacoes
7. proximas acoes.`
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, preferredProvider: effectiveProvider }),
      })
      const data = await res.json()
      const content = data.content || data.error || 'A Sofi nao retornou conteudo agora.'
      setOutput(content)
      setNotice(data.providerLabel ? `${activeTool.title} gerado por ${data.providerLabel} / ${data.model}.` : `${activeTool.title} gerado.`)
      addLog({ agent: selectedAgent.name, provider: data.providerLabel || effectiveProvider, action: activeTool.title, status: data.content ? 'OK' : 'Erro' })
      if (data.content) addArtifact(activeTool.type, activeTool.title, content, activeTool.type === 'E-mail' || activeTool.type === 'Documento' ? 'Rascunho' : 'Pronto')
    } catch {
      setOutput('Nao consegui executar esta ferramenta agora. Verifique o provedor selecionado e tente novamente.')
      setNotice('Falha ao executar ferramenta.')
      addLog({ agent: selectedAgent.name, provider: effectiveProvider, action: activeTool.title, status: 'Erro' })
    } finally {
      setBusy(false)
    }
  }

  function savePlaybook() {
    const content = output || `Playbook inicial: ${workflow.title}\nGatilho: ${workflow.trigger}\nResultado: ${workflow.result}\nDono: ${workflow.owner}`
    const next = [
      {
        id: `pb-${Date.now()}`,
        title: output ? `Plano ${selectedAgent.name}` : workflow.title,
        agent: selectedAgent.name,
        createdAt: new Date().toLocaleString('pt-BR'),
        content,
      },
      ...playbooks,
    ].slice(0, 8)
    setPlaybooks(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setNotice('Playbook salvo na central local.')
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080A12] p-5 shadow-2xl lg:p-7">
        <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 14% 0%, rgba(248,163,3,0.20), transparent 34%), radial-gradient(circle at 82% 4%, rgba(41,171,226,0.18), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.06), transparent 55%)' }} />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F8A303]">Centro de Inteligencia IA</p>
            <h1 className="mt-4 max-w-5xl text-4xl font-black leading-[0.95] text-white lg:text-6xl">Sofi como orquestradora multi-IA da APS EDU.</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/58">Agentes especializados, provedores conectaveis, automacoes, scanner profundo, documentos, agenda, pessoas, financeiro, escola e governanca em uma unica arquitetura.</p>
          </div>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#0ABD78]/30 bg-[#0ABD78]/12 p-3">
                <CheckCircleIcon className="h-7 w-7 text-[#0ABD78]" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Status dos provedores</p>
                <p className="text-xs font-semibold text-white/42">{configuredCount} de {providers.length || 9} conectados por chave segura</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/[0.045] p-3"><p className="text-2xl font-black text-[#F8A303]">{AGENTS.length}</p><p className="text-[11px] font-bold text-white/42">agentes</p></div>
              <div className="rounded-2xl bg-white/[0.045] p-3"><p className="text-2xl font-black text-[#29ABE2]">{WORKFLOWS.length}</p><p className="text-[11px] font-bold text-white/42">playbooks</p></div>
              <div className="rounded-2xl bg-white/[0.045] p-3"><p className="text-2xl font-black text-[#0ABD78]">{Object.values(activeAgents).filter(Boolean).length}</p><p className="text-[11px] font-bold text-white/42">ativos</p></div>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map(provider => (
          <Card key={provider.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-white">{provider.name}</p>
                <p className="mt-1 text-sm leading-5 text-white/45">{provider.role}</p>
              </div>
              <span className="rounded-full px-3 py-1 text-[11px] font-black" style={{ color: provider.configured ? '#0ABD78' : '#F8A303', background: provider.configured ? 'rgba(10,189,120,0.14)' : 'rgba(248,163,3,0.14)' }}>
                {provider.configured ? 'Conectado' : 'Configurar'}
              </span>
            </div>
          </Card>
        ))}
      </section>

      <Card className="p-5 lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A78BFA]">Roteador multi-IA</p>
            <h2 className="mt-1 text-2xl font-black text-white">Escolha quem trabalha ou deixe a Sofi decidir</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">Cada agente tem uma IA recomendada, mas voce pode forcar GPT, Gemini, Claude, Grok, Groq, Mistral, DeepSeek, OpenRouter ou Perplexity quando a chave estiver configurada.</p>
          </div>
          <select value={selectedProviderId} onChange={event => setSelectedProviderId(event.target.value)} className="h-12 rounded-2xl border border-white/10 bg-[#151722] px-4 text-sm font-black text-white outline-none">
            <option value="auto">Automatico por agente</option>
            {providers.filter(provider => provider.configured).map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#29ABE2]">Familia de agentes</p>
            <h2 className="mt-1 text-2xl font-black text-white">Escolha a IA operacional</h2>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-3">
            {AGENTS.map(agent => (
              <button key={agent.id} onClick={() => setSelectedAgentId(agent.id)} className="mb-2 grid w-full grid-cols-[1fr_auto] gap-3 rounded-2xl border p-3 text-left transition hover:bg-white/[0.055]" style={{ borderColor: selectedAgent.id === agent.id ? `${agent.color}66` : 'rgba(255,255,255,0.08)', background: selectedAgent.id === agent.id ? `${agent.color}14` : 'transparent' }}>
                <div className="min-w-0">
                  <p className="font-black text-white">{agent.name}</p>
                  <p className="mt-1 text-xs leading-5 text-white/42">{agent.area} - {agent.bestAi}</p>
                </div>
                <span className="h-3 w-3 rounded-full" style={{ background: activeAgents[agent.id] ? '#0ABD78' : 'rgba(255,255,255,0.20)' }} />
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5 lg:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: selectedAgent.color }}>{selectedAgent.area}</p>
                <h2 className="mt-1 text-3xl font-black text-white">{selectedAgent.name}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">{selectedAgent.mission}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => toggleAgent(selectedAgent.id)} className="h-11 rounded-2xl px-4 text-sm font-black text-black" style={{ background: activeAgents[selectedAgent.id] ? '#0ABD78' : '#F8A303' }}>{activeAgents[selectedAgent.id] ? 'Ativo' : 'Ativar agente'}</button>
                <button onClick={() => openSofi(`Atue como ${selectedAgent.name}. ${selectedAgent.mission} Ajude-me agora com um plano pratico para a APS EDU.`)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white">Abrir no chat</button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Ferramentas</p>
                <div className="mt-3 flex flex-wrap gap-2">{selectedAgent.tools.map(tool => <span key={tool} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/62">{tool}</span>)}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">Acoes funcionais</p>
                <div className="mt-3 flex flex-wrap gap-2">{selectedAgent.actions.map(action => <span key={action} className="rounded-full px-3 py-1 text-xs font-bold" style={{ color: selectedAgent.color, background: `${selectedAgent.color}18` }}>{action}</span>)}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => runAi('agent')} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#F8A303] px-4 text-sm font-black text-black disabled:opacity-60">{busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />} Gerar implementacao</button>
              <button onClick={savePlaybook} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white"><ClipboardDocumentCheckIcon className="h-4 w-4" /> Salvar playbook</button>
            </div>
          </Card>

          <Card className="p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F8A303]">Ferramentas funcionais</p>
                <h2 className="mt-1 text-2xl font-black text-white">Crie entregaveis reais com os agentes</h2>
              </div>
              <button onClick={runTool} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0ABD78] px-4 text-sm font-black text-black disabled:opacity-60">
                {busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                Executar ferramenta
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleTools.map(tool => {
                const Icon = tool.icon
                const selected = activeTool.id === tool.id
                return (
                  <button key={tool.id} onClick={() => setActiveToolId(tool.id)} className="rounded-3xl border p-4 text-left transition hover:bg-white/[0.055]" style={{ borderColor: selected ? `${selectedAgent.color}66` : 'rgba(255,255,255,0.08)', background: selected ? `${selectedAgent.color}14` : 'rgba(255,255,255,0.025)' }}>
                    <Icon className="h-6 w-6" style={{ color: selected ? selectedAgent.color : 'rgba(255,255,255,0.42)' }} />
                    <p className="mt-3 text-sm font-black text-white">{tool.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{tool.description}</p>
                    <span className="mt-3 inline-flex rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/48">{tool.type}</span>
                  </button>
                )
              })}
            </div>
            <textarea value={toolContext} onChange={event => setToolContext(event.target.value)} className="mt-4 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-white outline-none" />
          </Card>

          <Card className="p-5 lg:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0ABD78]">Scanner profundo</p>
                <h2 className="mt-1 text-2xl font-black text-white">Pesquisa com IA para evoluir a plataforma</h2>
                <textarea value={scannerGoal} onChange={event => setScannerGoal(event.target.value)} className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-white outline-none" />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <button onClick={() => runAi('scanner')} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#29ABE2] px-4 text-sm font-black text-black disabled:opacity-60"><MagnifyingGlassIcon className="h-4 w-4" /> Rodar scanner</button>
                <button onClick={() => openSofi(`Como Sofi Scanner, pesquise e organize: ${scannerGoal}`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white">Abrir no chat</button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5 lg:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F8A303]">Playbooks e automacoes</p>
              <h2 className="mt-1 text-2xl font-black text-white">Fluxos prontos para operacionalizar</h2>
            </div>
            <select value={selectedWorkflow} onChange={event => setSelectedWorkflow(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-[#151722] px-3 text-sm font-bold text-white outline-none">
              {WORKFLOWS.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div><p className="text-xs font-black uppercase text-white/35">Gatilho</p><p className="mt-2 text-sm font-bold text-white">{workflow.trigger}</p></div>
              <div><p className="text-xs font-black uppercase text-white/35">Resultado</p><p className="mt-2 text-sm font-bold text-white">{workflow.result}</p></div>
              <div><p className="text-xs font-black uppercase text-white/35">Dono</p><p className="mt-2 text-sm font-bold text-white">{workflow.owner}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => runAi('workflow')} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#F8A303] px-4 text-sm font-black text-black disabled:opacity-60"><PlayIcon className="h-4 w-4" /> Gerar playbook</button>
              <button onClick={() => openSofi(`Transforme este workflow em acao agora: ${workflow.title}. Gatilho: ${workflow.trigger}. Resultado: ${workflow.result}.`)} className="h-10 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white">Abrir no chat</button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A78BFA]">Playbooks salvos</p>
          <div className="mt-4 space-y-3">
            {playbooks.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/38">Nenhum playbook salvo ainda.</p>}
            {playbooks.map(item => (
              <button key={item.id} onClick={() => setOutput(item.content)} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left">
                <p className="text-sm font-black text-white">{item.title}</p>
                <p className="mt-1 text-xs text-white/38">{item.agent} - {item.createdAt}</p>
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map(item => {
          const Icon = item.icon
          return (
            <Card key={item.name} className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-3" style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}><Icon className="h-6 w-6" style={{ color: item.color }} /></div>
                <div>
                  <p className="font-black text-white">{item.name}</p>
                  <p className="mt-1 text-sm leading-5 text-white/45">{item.detail}</p>
                  <p className="mt-3 text-xs font-black" style={{ color: item.color }}>{item.status}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0ABD78]">Artefatos criados</p>
              <h2 className="mt-1 text-2xl font-black text-white">Trabalho gerado pelos agentes</h2>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/50">{artifacts.length} itens</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {artifacts.length === 0 && <p className="rounded-3xl border border-dashed border-white/10 p-5 text-sm text-white/38">Execute uma ferramenta para criar tarefas, e-mails, eventos, documentos, compras, avaliacoes, relatorios e automacoes.</p>}
            {artifacts.map(item => (
              <button key={item.id} onClick={() => setOutput(item.content)} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.055]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-white/38">{item.type} - {item.owner}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/52">{item.status}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/42">{item.content}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#14B8A6]">AgentOps logs</p>
          <h2 className="mt-1 text-xl font-black text-white">Execucoes e auditoria</h2>
          <div className="mt-4 space-y-3">
            {logs.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/38">Sem execucoes registradas ainda.</p>}
            {logs.map(log => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-white">{log.action}</p>
                  <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: log.status === 'OK' ? '#0ABD78' : '#FF4757', background: log.status === 'OK' ? 'rgba(10,189,120,0.14)' : 'rgba(255,71,87,0.14)' }}>{log.status}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-white/38">{log.agent} - {log.provider}</p>
                <p className="text-[11px] text-white/28">{log.at}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5 lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F8A303]">Saida da Sofi</p>
            <h2 className="mt-1 text-2xl font-black text-white">Plano, scanner ou playbook gerado</h2>
            {notice && <p className="mt-2 text-sm font-semibold text-white/42">{notice}</p>}
          </div>
          <button onClick={() => output && navigator.clipboard?.writeText(output)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white">Copiar resposta</button>
        </div>
        <div className="mt-5 min-h-48 whitespace-pre-wrap rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/72">
          {busy ? 'Sofi esta trabalhando...' : output || 'Escolha um agente, rode um scanner ou gere um playbook para ver o resultado aqui.'}
        </div>
      </Card>
    </div>
  )
}
