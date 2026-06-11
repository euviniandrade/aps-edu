export type SuiteDomain = 'trabalho' | 'pessoas' | 'educacao' | 'operacao' | 'inteligencia'

export type SuiteModule = {
  id: SuiteDomain
  title: string
  subtitle: string
  benchmark: string
  color: string
  maturity: number
  signals: string[]
}

export type ExecutiveMetric = {
  label: string
  value: string
  trend: string
  color: string
}

export type Capability = {
  domain: SuiteDomain
  name: string
  bestFrom: string
  apsImplementation: string
  impact: 'critico' | 'alto' | 'medio'
  status: 'ativo' | 'prototipo' | 'planejado'
}

export type SmartAutomation = {
  title: string
  trigger: string
  action: string
  result: string
  domain: SuiteDomain
}

export type PriorityWorkflow = {
  title: string
  owner: string
  steps: string[]
}

export type RoadmapItem = {
  phase: string
  title: string
  items: string[]
}

export type HubLink = {
  title: string
  description: string
  href: string
  color: string
  group: 'central' | 'trabalho' | 'rede' | 'inteligencia' | 'admin'
  primary?: boolean
}

export type PersonalTool = {
  title: string
  description: string
  href: string
  metric: string
  color: string
}

export const suiteModules: SuiteModule[] = [
  {
    id: 'trabalho',
    title: 'Trabalho e Projetos',
    subtitle: 'Tarefas, metas, eventos, aprovacoes, SLA e execucao por unidade.',
    benchmark: 'Asana, Monday, ClickUp, Jira, Wrike, Smartsheet',
    color: '#0ABD78',
    maturity: 86,
    signals: ['Kanban e lista', 'Prazos e dependencias', 'Aprovacoes', 'Carga da equipe'],
  },
  {
    id: 'pessoas',
    title: 'Pessoas e Performance',
    subtitle: 'Equipe, cargos, feedback, trilhas, promotores e engajamento.',
    benchmark: 'Workday, BambooHR, Gupy, Factorial, Culture Amp, Lattice',
    color: '#4A9EFF',
    maturity: 74,
    signals: ['Perfil 360', 'Feedback continuo', 'Reconhecimento', 'Plano de desenvolvimento'],
  },
  {
    id: 'educacao',
    title: 'Gestao Escolar',
    subtitle: 'Unidades, calendario, eventos, comunicados, rotinas e indicadores pedagogicos.',
    benchmark: 'PowerSchool, Blackbaud, FACTS, Gradelink, OpenEduCat, Proesc',
    color: '#F8A303',
    maturity: 78,
    signals: ['Calendario escolar', 'Comunicados', 'Rotinas por colegio', 'Visao por rede'],
  },
  {
    id: 'operacao',
    title: 'Operacao e Estoque',
    subtitle: 'Almoxarifado, patrimonio, compras, ativos, reposicao e auditoria.',
    benchmark: 'Odoo, Zoho Inventory, NetSuite, Cin7, Omie, GestaoClick',
    color: '#E07B39',
    maturity: 68,
    signals: ['Estoque minimo', 'Compras sugeridas', 'Ativos por local', 'Auditoria'],
  },
  {
    id: 'inteligencia',
    title: 'Inteligencia APS',
    subtitle: 'Sofi IA, analytics preditivo, automacoes, riscos e recomendacoes.',
    benchmark: 'Notion AI, Salesforce Einstein, ServiceNow, Tableau, Power BI',
    color: '#A78BFA',
    maturity: 81,
    signals: ['Resumo executivo', 'Alertas preditivos', 'Automacoes', 'Busca inteligente'],
  },
]

export const executiveMetrics: ExecutiveMetric[] = [
  { label: 'Saude operacional', value: '91%', trend: '+8 pts no ciclo', color: '#0ABD78' },
  { label: 'SLA critico', value: '4', trend: '2 em risco alto', color: '#FF4757' },
  { label: 'Unidades em foco', value: '7', trend: '3 com melhora', color: '#F8A303' },
  { label: 'Reposicoes previstas', value: '18', trend: 'R$ 42 mil estimados', color: '#4A9EFF' },
]

export const capabilityMatrix: Capability[] = [
  {
    domain: 'trabalho',
    name: 'Central unica de trabalho',
    bestFrom: 'ClickUp + Asana',
    apsImplementation: 'Lista, kanban, eventos e mural integrados por responsavel, unidade e prazo.',
    impact: 'critico',
    status: 'ativo',
  },
  {
    domain: 'trabalho',
    name: 'Dependencias, SLA e aprovacao',
    bestFrom: 'Jira + Monday + Wrike',
    apsImplementation: 'Fluxo de aprovacao com gargalos, vencimentos, prioridade e trilha de auditoria.',
    impact: 'alto',
    status: 'prototipo',
  },
  {
    domain: 'pessoas',
    name: 'Perfil 360 da equipe',
    bestFrom: 'Workday + BambooHR',
    apsImplementation: 'Usuario, cargo, unidade, promotor, entregas, feedback e engajamento em uma ficha.',
    impact: 'alto',
    status: 'prototipo',
  },
  {
    domain: 'pessoas',
    name: 'Performance e reconhecimento',
    bestFrom: 'Lattice + Culture Amp',
    apsImplementation: 'Feedback continuo, gamificacao, trilhas e sinais de risco de desengajamento.',
    impact: 'medio',
    status: 'ativo',
  },
  {
    domain: 'educacao',
    name: 'Rede escolar em tempo real',
    bestFrom: 'PowerSchool + Blackbaud + Proesc',
    apsImplementation: 'Visao executiva por unidade, eventos, comunicados, calendario e rotina escolar.',
    impact: 'critico',
    status: 'ativo',
  },
  {
    domain: 'educacao',
    name: 'Jornada da unidade',
    bestFrom: 'FACTS + Gradelink',
    apsImplementation: 'Checklist de operacao escolar, pendencias, campanhas, documentos e responsaveis.',
    impact: 'alto',
    status: 'planejado',
  },
  {
    domain: 'operacao',
    name: 'Estoque e ativos inteligentes',
    bestFrom: 'Zoho Inventory + Odoo + Cin7',
    apsImplementation: 'Itens, locais, minimo, reposicao sugerida, compras e patrimonio por QR Code.',
    impact: 'critico',
    status: 'ativo',
  },
  {
    domain: 'operacao',
    name: 'Compras e contratos',
    bestFrom: 'NetSuite + Omie',
    apsImplementation: 'Solicitacao, cotacao, aprovacao, recebimento, baixa e historico financeiro.',
    impact: 'alto',
    status: 'planejado',
  },
  {
    domain: 'inteligencia',
    name: 'Copiloto executivo Sofi',
    bestFrom: 'Notion AI + Salesforce Einstein',
    apsImplementation: 'Resumo diario, recomendacoes, busca natural e analise de risco por area.',
    impact: 'critico',
    status: 'ativo',
  },
  {
    domain: 'inteligencia',
    name: 'Automacoes sem codigo',
    bestFrom: 'ServiceNow + Zapier + Monday',
    apsImplementation: 'Regras por evento: atrasou, faltou estoque, mudou responsavel, abriu risco.',
    impact: 'alto',
    status: 'prototipo',
  },
]

export const smartAutomations: SmartAutomation[] = [
  {
    title: 'Atraso com impacto em unidade',
    trigger: 'Tarefa critica passa do prazo ou fica 48h sem movimento.',
    action: 'Notifica responsavel, lider e cria plano de recuperacao com Sofi.',
    result: 'Menos gargalos invisiveis e melhor previsao de entrega.',
    domain: 'trabalho',
  },
  {
    title: 'Estoque abaixo do minimo',
    trigger: 'Quantidade atual fica abaixo do ponto de reposicao.',
    action: 'Gera sugestao de compra, prioridade, centro de custo e aprovador.',
    result: 'Compras mais rapidas e menos ruptura operacional.',
    domain: 'operacao',
  },
  {
    title: 'Unidade com queda de engajamento',
    trigger: 'Pontuacao, feedback ou entregas caem por duas semanas.',
    action: 'Abre alerta no cockpit e recomenda acompanhamento do lider.',
    result: 'Gestao de pessoas mais preventiva e menos reativa.',
    domain: 'pessoas',
  },
  {
    title: 'Calendario escolar em conflito',
    trigger: 'Evento ou campanha cruza datas de avaliacao, feriado ou reuniao.',
    action: 'Sinaliza conflito, sugere nova data e atualiza envolvidos.',
    result: 'Menos retrabalho e melhor coordenacao entre colegios.',
    domain: 'educacao',
  },
]

export const priorityWorkflows: PriorityWorkflow[] = [
  {
    title: 'Rotina escolar 360',
    owner: 'Departamento de Educacao',
    steps: ['Definir ciclo', 'Distribuir tarefas', 'Acompanhar unidades', 'Resolver riscos', 'Fechar evidencias'],
  },
  {
    title: 'Compra e reposicao',
    owner: 'Operacao',
    steps: ['Detectar falta', 'Sugerir compra', 'Aprovar', 'Receber', 'Baixar ou transferir'],
  },
  {
    title: 'Desenvolvimento da equipe',
    owner: 'Lideranca',
    steps: ['Coletar sinais', 'Gerar feedback', 'Definir trilha', 'Acompanhar meta', 'Reconhecer entrega'],
  },
]

export const operatingRoadmap: RoadmapItem[] = [
  {
    phase: 'Agora',
    title: 'Fundacao unificada',
    items: ['Centro de Gestao', 'Estoque e ativos', 'Busca por modulos', 'Matriz de capacidades'],
  },
  {
    phase: 'Proximo',
    title: 'Dados reais e workflows',
    items: ['Banco por modulo', 'Permissoes por cargo', 'Aprovacoes', 'Historico e auditoria'],
  },
  {
    phase: 'Enterprise',
    title: 'Rede inteligente',
    items: ['Automacoes no-code', 'Previsao de riscos', 'QR Code de patrimonio', 'Indicadores por colegio'],
  },
]

export const hubLinks: HubLink[] = [
  {
    title: 'Meu Dia',
    description: 'Agenda, foco, tarefas do dia e proximos compromissos.',
    href: '/meu-dia',
    color: '#4A9EFF',
    group: 'central',
    primary: true,
  },
  {
    title: 'Tarefas',
    description: 'Demandas, evidencias, responsaveis, prazos e status.',
    href: '/tasks',
    color: '#0ABD78',
    group: 'trabalho',
    primary: true,
  },
  {
    title: 'Eventos',
    description: 'Calendario operacional, eventos escolares e encontros da rede.',
    href: '/events',
    color: '#8B5CF6',
    group: 'trabalho',
  },
  {
    title: 'Mural',
    description: 'Comunicados internos, campanhas e avisos oficiais.',
    href: '/announcements',
    color: '#29ABE2',
    group: 'trabalho',
  },
  {
    title: 'Estoque e Ativos',
    description: 'Materiais, patrimonio, locais, minimos e reposicao.',
    href: '/estoque',
    color: '#E07B39',
    group: 'trabalho',
    primary: true,
  },
  {
    title: 'Pessoas',
    description: 'Usuarios, cargos, promotores, feedback e reconhecimento.',
    href: '/users',
    color: '#4A9EFF',
    group: 'rede',
    primary: true,
  },
  {
    title: 'Unidades',
    description: 'Colegio, responsaveis, liderancas e estrutura da rede.',
    href: '/units',
    color: '#34D399',
    group: 'rede',
    primary: true,
  },
  {
    title: 'Relatorios',
    description: 'Indicadores por usuario, unidade, periodo e desempenho.',
    href: '/reports',
    color: '#F8A303',
    group: 'rede',
  },
  {
    title: 'Analytics IA',
    description: 'Tendencias, riscos, previsoes e analise executiva.',
    href: '/analytics',
    color: '#F9C234',
    group: 'inteligencia',
    primary: true,
  },
  {
    title: 'Automacoes',
    description: 'Regras inteligentes para atrasos, riscos e rotinas repetitivas.',
    href: '/automacoes',
    color: '#4A9EFF',
    group: 'inteligencia',
  },
  {
    title: 'Inovacao IA',
    description: 'Agentes, experimentos e novas frentes digitais.',
    href: '/inovacao',
    color: '#0ABD78',
    group: 'inteligencia',
  },
]

export const personalTools: PersonalTool[] = [
  {
    title: 'Foco pessoal',
    description: 'Tarefas particulares, rotina do dia, tempo estimado e progresso.',
    href: '/minha-area',
    metric: 'Hoje',
    color: '#F8A303',
  },
  {
    title: 'Caderno inteligente',
    description: 'Ideias, reunioes, planos, frases e anotacoes com apoio da Sofi.',
    href: '/minha-area',
    metric: 'Notas',
    color: '#A78BFA',
  },
  {
    title: 'Cofre seguro',
    description: 'Senhas e credenciais locais protegidas por PIN.',
    href: '/minha-area',
    metric: 'Local',
    color: '#FF4757',
  },
  {
    title: 'Sofi pessoal',
    description: 'Chat, criacao de tarefas e organizacao da rotina pessoal.',
    href: '/minha-area',
    metric: 'IA',
    color: '#4A9EFF',
  },
]
