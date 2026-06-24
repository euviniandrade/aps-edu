export type PromoterQuestionType = 'scale' | 'single'

export interface PromoterQuestionOption {
  label: string
  score: number
}

export interface PromoterQuestion {
  id: number
  sectionId: string
  prompt: string
  type: PromoterQuestionType
  reverse?: boolean
  help?: string
  options?: PromoterQuestionOption[]
}

export interface PromoterFormAnswers {
  [questionId: number]: number | string | undefined
}

export interface PromoterFormPayload {
  answers: PromoterFormAnswers
  promoterName: string
  unit: string
  role?: string
  email?: string
  phone?: string
  photoName?: string
  photoMimeType?: string
  photoBase64?: string
  notes?: string
}

export interface PromoterFormResult {
  answeredCount: number
  totalQuestions: number
  indices: Record<string, { score: number; label: string; weight: number; summary: string }>
  temperament: {
    primary: string
    primaryPercent: number
    secondary: string
    secondaryPercent: number
    reason: string
  }
  behavioralProfile: {
    profile: string
    percent: number
    reason: string
  }
  productivity: {
    efficiency: number
    quality: number
    organization: number
    commitment: number
    autonomy: number
    index: number
    diagnosis: string
  }
  alerts: {
    centralization: { level: 'Baixo' | 'Moderado' | 'Alto'; message: string }
    procrastination: { level: 'Baixo' | 'Moderado' | 'Alto'; message: string }
    conflictRisk: { level: 'Baixo' | 'Moderado' | 'Alto'; message: string }
    changeResistance: { level: 'Adaptavel' | 'Moderadamente Adaptavel' | 'Resistente'; message: string }
    consistency: { score: number; message: string }
  }
  finalProfile: {
    title: 'Especialista' | 'Coordenador' | 'Gestor' | 'Diretor' | 'Multiplicador Institucional'
    description: string
  }
}

export interface PromoterFormSection {
  id: string
  title: string
  subtitle: string
  accent: string
  range: [number, number]
}

const SCORE_LEVELS = [
  { min: 90, label: 'Excelente' },
  { min: 80, label: 'Muito forte' },
  { min: 70, label: 'Forte' },
  { min: 60, label: 'Em desenvolvimento' },
  { min: 0, label: 'Atenção' },
]

function scaleQ(id: number, sectionId: string, prompt: string, reverse = false, help?: string): PromoterQuestion {
  return { id, sectionId, prompt, type: 'scale', reverse, help }
}

function singleQ(id: number, sectionId: string, prompt: string, options: Array<[string, number]>, help?: string): PromoterQuestion {
  return { id, sectionId, prompt, type: 'single', help, options: options.map(([label, score]) => ({ label, score })) }
}

export const PROMOTER_FORM_SECTIONS: PromoterFormSection[] = [
  {
    id: 'leadership',
    title: 'Liderança e Influência',
    subtitle: 'Capacidade de agir, orientar, influenciar e desenvolver pessoas.',
    accent: '#F8A303',
    range: [1, 12],
  },
  {
    id: 'personality',
    title: 'Perfil Comportamental e Relacionamento',
    subtitle: 'Temperamento, convivência, feedback e inteligência relacional.',
    accent: '#8B5CF6',
    range: [13, 24],
  },
  {
    id: 'productivity',
    title: 'Produtividade e Entrega',
    subtitle: 'Eficiência, organização, autonomia, qualidade e disciplina.',
    accent: '#0ABD78',
    range: [25, 36],
  },
  {
    id: 'maturity',
    title: 'Autopercepção, Maturidade e Validação',
    subtitle: 'Consciência de limites, abertura ao feedback e desenvolvimento contínuo.',
    accent: '#4A9EFF',
    range: [37, 52],
  },
  {
    id: 'scenarios',
    title: 'Cenarios Praticos e Tomada de Decisao',
    subtitle: 'Escolhas reais para leitura executiva de comportamento.',
    accent: '#FF4757',
    range: [53, 62],
  },
]

export const PROMOTER_QUESTIONS: PromoterQuestion[] = [
  // Bloco 1
  scaleQ(1, 'leadership', 'Quando identifico um problema, costumo agir antes que alguém me solicite.'),
  scaleQ(2, 'leadership', 'Pessoas da equipe costumam me procurar para pedir orientação ou conselho.'),
  scaleQ(3, 'leadership', 'Tenho facilidade para tomar decisões mesmo quando não possuo todas as informações.'),
  scaleQ(4, 'leadership', 'Frequentemente proponho melhorias para processos já existentes.'),
  scaleQ(5, 'leadership', 'Quando algo dá errado, procuro assumir minha parcela de responsabilidade.'),
  scaleQ(6, 'leadership', 'Sinto-me confortável em conduzir grupos ou equipes.'),
  scaleQ(7, 'leadership', 'Tenho facilidade para delegar atividades quando necessário.'),
  scaleQ(8, 'leadership', 'Procuro desenvolver ou ensinar colegas quando percebo dificuldades.'),
  scaleQ(9, 'leadership', 'Consigo manter a calma e direcionar pessoas em situações de pressão.'),
  scaleQ(10, 'leadership', 'Gosto de assumir responsabilidades além das minhas atribuições formais.'),
  scaleQ(11, 'leadership', 'Costumo pensar nas consequências de longo prazo das decisões tomadas.'),
  scaleQ(12, 'leadership', 'Tenho facilidade para influenciar positivamente as pessoas ao meu redor.'),

  // Bloco 2
  scaleQ(13, 'personality', 'Tenho facilidade para iniciar conversas com pessoas que não conheço.'),
  scaleQ(14, 'personality', 'Procuro ouvir opiniões diferentes antes de tomar decisões importantes.'),
  scaleQ(15, 'personality', 'Recebo críticas ou feedbacks sem me sentir pessoalmente atacado.'),
  scaleQ(16, 'personality', 'Consigo trabalhar bem com pessoas que possuem perfis diferentes do meu.'),
  scaleQ(17, 'personality', 'Quando surge um conflito, procuro compreender todos os envolvidos antes de agir.'),
  scaleQ(18, 'personality', 'Sou visto como uma pessoa acessível pelos colegas.'),
  scaleQ(19, 'personality', 'Consigo separar emoções pessoais das decisões profissionais.'),
  scaleQ(20, 'personality', 'Mantenho o equilíbrio emocional mesmo em períodos de alta pressão.'),
  scaleQ(21, 'personality', 'Tenho facilidade para me adaptar a mudanças de processos ou rotinas.'),
  scaleQ(22, 'personality', 'Consigo expressar minhas opiniões sem gerar conflitos desnecessários.'),
  scaleQ(23, 'personality', 'Costumo colaborar espontaneamente com colegas quando percebo necessidade.'),
  scaleQ(24, 'personality', 'Tenho facilidade para construir relacionamentos de confiança.'),

  // Bloco 3
  scaleQ(25, 'productivity', 'Entrego minhas atividades dentro dos prazos estabelecidos.'),
  scaleQ(26, 'productivity', 'Organizo minhas prioridades antes de iniciar minhas atividades.'),
  scaleQ(27, 'productivity', 'Consigo manter a produtividade mesmo quando possuo diversas demandas simultâneas.'),
  scaleQ(28, 'productivity', 'Raramente preciso ser lembrado sobre compromissos assumidos.'),
  scaleQ(29, 'productivity', 'Tenho facilidade para concluir tarefas iniciadas.'),
  scaleQ(30, 'productivity', 'Costumo revisar meu trabalho antes de entregá-lo.'),
  scaleQ(31, 'productivity', 'Busco soluções antes de solicitar ajuda.'),
  scaleQ(32, 'productivity', 'Mantenho consistência na qualidade das minhas entregas.'),
  scaleQ(33, 'productivity', 'Aprendo rapidamente novos processos, ferramentas ou sistemas.'),
  scaleQ(34, 'productivity', 'Procuro constantemente formas de melhorar minha maneira de trabalhar.'),
  scaleQ(35, 'productivity', 'Tenho disciplina para executar tarefas mesmo quando não estou motivado.'),
  scaleQ(36, 'productivity', 'Consigo administrar meu tempo de forma eficiente.'),

  // Bloco 4
  scaleQ(37, 'maturity', 'Já deixei de cumprir um prazo por falha de organização pessoal.', true),
  scaleQ(38, 'maturity', 'Tenho dificuldade em dizer "não" quando recebo novas demandas.', true),
  scaleQ(39, 'maturity', 'Algumas vezes assumo mais responsabilidades do que consigo executar.', true),
  scaleQ(40, 'maturity', 'Já tive conflitos profissionais que poderiam ter sido evitados.', true),
  scaleQ(41, 'maturity', 'Costumo adiar atividades que considero desagradáveis ou difíceis.', true),
  scaleQ(42, 'maturity', 'Nem sempre peço ajuda quando realmente preciso.', true),
  scaleQ(43, 'maturity', 'Em algumas situações tenho dificuldade em aceitar opiniões diferentes das minhas.', true),
  scaleQ(44, 'maturity', 'Já deixei de fornecer um feedback necessário para evitar desconforto.', true),
  scaleQ(45, 'maturity', 'Em determinados momentos permito que emoções influenciem minhas decisões profissionais.', true),
  scaleQ(46, 'maturity', 'Algumas vezes me sinto sobrecarregado pelas responsabilidades que assumo.', true),
  scaleQ(47, 'maturity', 'Já percebi que minhas prioridades estavam desalinhadas com as prioridades da equipe.', true),
  scaleQ(48, 'maturity', 'Reconheço com facilidade meus erros quando eles acontecem.'),
  scaleQ(49, 'maturity', 'Procuro aprender com críticas e feedbacks recebidos.'),
  scaleQ(50, 'maturity', 'Estou aberto a mudar comportamentos quando percebo que eles prejudicam meus resultados.'),
  scaleQ(51, 'maturity', 'Busco constantemente meu desenvolvimento pessoal e profissional.'),
  scaleQ(52, 'maturity', 'Consigo identificar com clareza meus principais pontos de melhoria.'),

  // Bloco 5
  singleQ(53, 'scenarios', 'Você percebe que um colega está cometendo repetidamente um erro que pode prejudicar os resultados da equipe. Qual seria sua reação mais provável?', [
    ['Conversaria diretamente com ele para ajudá-lo a corrigir o problema.', 5],
    ['Corrigiria o problema por conta própria.', 4],
    ['Informaria imediatamente o gestor.', 3],
    ['Aguardaria para verificar se ele percebe sozinho.', 1],
  ]),
  singleQ(54, 'scenarios', 'Você recebe três demandas urgentes para o mesmo prazo. Qual sua atitude mais comum?', [
    ['Priorizo as atividades e comunico possíveis impactos.', 5],
    ['Tento realizar tudo sozinho.', 3],
    ['Solicito apoio imediatamente.', 4],
    ['Executo conforme as demandas surgem.', 1],
  ]),
  singleQ(55, 'scenarios', 'Um projeto importante falha por um erro coletivo da equipe.', [
    ['Procuro entender as causas e corrigir o processo.', 5],
    ['Identifico os responsáveis.', 2],
    ['Aguardo orientações superiores.', 3],
    ['Evito me envolver diretamente.', 1],
  ]),
  singleQ(56, 'scenarios', 'Um colega recebe reconhecimento por uma ideia semelhante à sua.', [
    ['Fico satisfeito pelo resultado alcançado pela equipe.', 5],
    ['Converso posteriormente sobre minha contribuição.', 4],
    ['Sinto-me injustiçado.', 2],
    ['Perco parte da motivação.', 1],
  ]),
  singleQ(57, 'scenarios', 'Você recebe um feedback que considera injusto.', [
    ['Escuto, reflito e avalio o que pode ser aproveitado.', 5],
    ['Defendo imediatamente meu ponto de vista.', 2],
    ['Aceito externamente, mas ignoro o feedback.', 3],
    ['Fico incomodado por um longo período.', 1],
  ]),
  singleQ(58, 'scenarios', 'Um colaborador da equipe apresenta desempenho abaixo do esperado.', [
    ['Procuro compreender as causas e ajudá-lo a evoluir.', 5],
    ['Assumo as atividades para garantir o resultado.', 3],
    ['Reporto imediatamente ao superior.', 2],
    ['Evito me envolver.', 1],
  ]),
  singleQ(59, 'scenarios', 'Uma mudança importante é implementada na instituição.', [
    ['Procuro entender rapidamente e me adaptar.', 5],
    ['Espero para ver como funcionará.', 3],
    ['Demonstro resistência até entender completamente.', 2],
    ['Continuo trabalhando da forma anterior.', 1],
  ]),
  singleQ(60, 'scenarios', 'Durante uma reunião existe forte discordância sobre uma decisão.', [
    ['Procuro construir consenso entre os envolvidos.', 5],
    ['Defendo minha posição até o final.', 4],
    ['Acompanho a decisão da maioria.', 3],
    ['Evito participar da discussão.', 1],
  ]),
  singleQ(61, 'scenarios', 'Você identifica uma oportunidade de melhoria fora da sua área de atuação.', [
    ['Apresento a sugestão de forma construtiva.', 5],
    ['Aguardo ser consultado.', 2],
    ['Faço apenas se for minha responsabilidade.', 3],
    ['Ignoro a situação.', 1],
  ]),
  singleQ(62, 'scenarios', 'Você precisa liderar uma equipe para um projeto importante.', [
    ['Defino objetivos claros e acompanho o progresso.', 5],
    ['Concentro as decisões em mim para garantir qualidade.', 3],
    ['Deixo cada um trabalhar da sua maneira.', 2],
    ['Aguardo orientações antes de agir.', 1],
  ]),
]

const QUESTION_BY_ID = new Map(PROMOTER_QUESTIONS.map(question => [question.id, question]))

const INDEX_DEFINITIONS = [
  {
    key: 'leadershipPotential',
    label: 'Potencial de Liderança',
    weight: 20,
    questions: [1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 58, 62],
    summary: 'Leitura da capacidade de assumir, direcionar e influenciar a equipe.',
  },
  {
    key: 'promotionPotential',
    label: 'Potencial para Promoção',
    weight: 15,
    questions: [5, 10, 25, 26, 27, 29, 32, 34, 49, 50, 51, 52],
    summary: 'Indica prontidão para desafios maiores e responsabilidades ampliadas.',
  },
  {
    key: 'emotionalIntelligence',
    label: 'Inteligência Emocional',
    weight: 15,
    questions: [15, 17, 19, 20, 22, 40, 43, 45, 48, 49, 50, 57],
    summary: 'Mostra maturidade relacional, escuta, autocontrole e resposta ao feedback.',
  },
  {
    key: 'professionalMaturity',
    label: 'Maturidade Profissional',
    weight: 15,
    questions: [5, 15, 25, 30, 31, 35, 48, 49, 50, 51, 52, 55],
    summary: 'Avalia consistência, responsabilidade, postura e abertura ao crescimento.',
  },
  {
    key: 'productivity',
    label: 'Produtividade',
    weight: 15,
    questions: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    summary: 'Reflete eficiência, organização, disciplina e constância de entrega.',
  },
  {
    key: 'interpersonalRelationship',
    label: 'Relacionamento Interpessoal',
    weight: 10,
    questions: [13, 14, 16, 17, 18, 21, 22, 23, 24, 53, 58, 60],
    summary: 'Mede convivência, colaboração, confiança e gestão de divergências.',
  },
] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function normalizeQuestionScore(question: PromoterQuestion, answer: number | string | undefined) {
  if (answer === undefined || answer === null || answer === '') return null

  if (question.type === 'scale') {
    const numeric = clamp(Number(answer) || 1, 1, 5)
    const effective = question.reverse ? 6 - numeric : numeric
    return Math.round(((effective - 1) / 4) * 100)
  }

  const index = clamp(Number(answer) || 0, 0, (question.options?.length || 1) - 1)
  const option = question.options?.[index]
  if (!option) return null
  return Math.round(((option.score - 1) / 4) * 100)
}

function bandLabel(score: number) {
  if (score >= 90) return SCORE_LEVELS[0].label
  if (score >= 80) return SCORE_LEVELS[1].label
  if (score >= 70) return SCORE_LEVELS[2].label
  if (score >= 60) return SCORE_LEVELS[3].label
  return SCORE_LEVELS[4].label
}

function scoreIndex(answers: PromoterFormAnswers, questionIds: number[]) {
  const values = questionIds
    .map(id => {
      const question = QUESTION_BY_ID.get(id)
      return question ? normalizeQuestionScore(question, answers[id]) : null
    })
    .filter((value): value is number => typeof value === 'number')

  const score = Math.round(average(values))
  return clamp(score, 0, 100)
}

function extractQuestionRawScore(answers: PromoterFormAnswers, questionId: number) {
  const question = QUESTION_BY_ID.get(questionId)
  const raw = answers[questionId]
  if (!question || raw === undefined || raw === null || raw === '') return null
  if (question.type === 'scale') {
    return question.reverse ? 6 - clamp(Number(raw) || 1, 1, 5) : clamp(Number(raw) || 1, 1, 5)
  }
  const index = clamp(Number(raw) || 0, 0, (question.options?.length || 1) - 1)
  return question.options?.[index]?.score ?? null
}

function getTopAxis(scores: Record<string, number>) {
  const entries = Object.entries(scores)
  return entries.sort((a, b) => b[1] - a[1])[0]
}

function buildTemperament(scores: Record<string, number>) {
  const axes = {
    Sanguineo: average([13, 18, 22, 23, 24, 56, 61].map(id => scores[`q${id}`] || 0)),
    Colerico: average([1, 3, 5, 6, 9, 10, 12, 53, 54, 58, 62].map(id => scores[`q${id}`] || 0)),
    Fleumatico: average([14, 16, 17, 20, 21, 40, 59, 60].map(id => scores[`q${id}`] || 0)),
    Melancolico: average([11, 15, 19, 25, 26, 30, 31, 32, 33, 34, 35, 36, 48, 49, 50, 51, 52].map(id => scores[`q${id}`] || 0)),
  }

  const sorted = Object.entries(axes).sort((a, b) => b[1] - a[1])
  const total = sorted[0][1] + sorted[1][1] || 1
  const primary = sorted[0][0]
  const secondary = sorted[1][0]
  const primaryPercent = Math.round((sorted[0][1] / total) * 100)
  const secondaryPercent = 100 - primaryPercent

  const reasonMap: Record<string, string> = {
    Sanguineo: 'Força social, comunicacao, energia para pessoas e influencia.',
    Colerico: 'Decisao, iniciativa, foco em resultados e acao executiva.',
    Fleumatico: 'Equilibrio, estabilidade, mediacao e constancia.',
    Melancolico: 'Analise, organizacao, detalhamento e busca por excelencia.',
  }

  return {
    primary,
    secondary,
    primaryPercent,
    secondaryPercent,
    reason: `${reasonMap[primary] || ''} Segunda tendencia: ${reasonMap[secondary] || ''}`,
  }
}

function buildBehavioralProfile(scores: Record<string, number>) {
  const axes = {
    Executor: average([1, 3, 5, 6, 25, 29, 35, 54, 58, 62].map(id => scores[`q${id}`] || 0)),
    Influenciador: average([2, 12, 13, 18, 22, 23, 24, 53, 56, 61].map(id => scores[`q${id}`] || 0)),
    Analitico: average([11, 15, 19, 26, 30, 31, 32, 48, 49, 52, 55].map(id => scores[`q${id}`] || 0)),
    Estavel: average([14, 16, 17, 20, 21, 40, 57, 59, 60].map(id => scores[`q${id}`] || 0)),
  }
  const [profile, percent] = getTopAxis(axes)
  const reasonMap: Record<string, string> = {
    Executor: 'Tende a agir com prontidao, foco e busca de resolucao imediata.',
    Influenciador: 'Apresenta energia relacional, engajamento e capacidade de mobilizacao.',
    Analitico: 'Privilegia dados, precisao, planejamento e consistencia de processo.',
    Estavel: 'Busca equilibrio, previsibilidade e convivencia harmoniosa.',
  }
  return {
    profile,
    percent: Math.round(percent),
    reason: reasonMap[profile] || '',
  }
}

function buildProductivity(scores: Record<string, number>) {
  const efficiency = Math.round(average([25, 27, 29, 31, 33, 35, 36].map(id => scores[`q${id}`] || 0)))
  const quality = Math.round(average([26, 30, 32, 48, 49, 50, 52].map(id => scores[`q${id}`] || 0)))
  const organization = Math.round(average([25, 26, 28, 30, 34, 35, 36].map(id => scores[`q${id}`] || 0)))
  const commitment = Math.round(average([25, 27, 29, 32, 35, 50, 51].map(id => scores[`q${id}`] || 0)))
  const autonomy = Math.round(average([31, 33, 34, 35, 36, 42, 50].map(id => scores[`q${id}`] || 0)))
  const index = Math.round((efficiency + quality + organization + commitment + autonomy) / 5)

  return {
    efficiency,
    quality,
    organization,
    commitment,
    autonomy,
    index,
    diagnosis: productivityDiagnosis(index),
  }
}

function productivityDiagnosis(value: number) {
  if (value >= 90) return 'Alta Performance'
  if (value >= 80) return 'Muito Bom'
  if (value >= 70) return 'Adequado'
  if (value >= 60) return 'Atencao'
  return 'Necessita Desenvolvimento'
}

function buildAlerts(answers: PromoterFormAnswers, questionScores: Record<string, number>) {
  const centralizationRaw = average([7, 8, 58, 62].map(id => extractQuestionRawScore(answers, id) || 0))
  const centralizationLeadership = average([1, 3, 6, 10, 12].map(id => questionScores[`q${id}`] || 0))
  const centralizationDelegation = extractQuestionRawScore(answers, 7) || 0
  const centralizationControl = average([
    Number(extractQuestionRawScore(answers, 58) || 0),
    Number(extractQuestionRawScore(answers, 62) || 0),
  ])
  let centralizationLevel: 'Baixo' | 'Moderado' | 'Alto' = 'Baixo'
  if (centralizationLeadership >= 4 && centralizationDelegation <= 2 && centralizationControl >= 4) centralizationLevel = 'Alto'
  else if (centralizationLeadership >= 3 && centralizationDelegation <= 3) centralizationLevel = 'Moderado'

  const procrastinationRaw = average([29, 35, 37, 41].map(id => extractQuestionRawScore(answers, id) || 0))
  const procrastinationLevel: 'Baixo' | 'Moderado' | 'Alto' =
    procrastinationRaw >= 4 ? 'Alto' : procrastinationRaw >= 3 ? 'Moderado' : 'Baixo'

  const conflictRaw = average([15, 16, 17, 22, 40, 43, 57, 60].map(id => extractQuestionRawScore(answers, id) || 0))
  const conflictLevel: 'Baixo' | 'Moderado' | 'Alto' = conflictRaw >= 4 ? 'Alto' : conflictRaw >= 3 ? 'Moderado' : 'Baixo'

  const changeRaw = average([21, 33, 50, 59].map(id => extractQuestionRawScore(answers, id) || 0))
  let changeLevel: 'Adaptavel' | 'Moderadamente Adaptavel' | 'Resistente' = 'Adaptavel'
  if (changeRaw < 2.5) changeLevel = 'Resistente'
  else if (changeRaw < 4) changeLevel = 'Moderadamente Adaptavel'

  const consistencyPairs = [
    [25, 37],
    [15, 57],
    [8, 58],
    [7, 62],
  ] as const

  let consistency = 100
  consistencyPairs.forEach(([a, b]) => {
    const left = extractQuestionRawScore(answers, a)
    const right = extractQuestionRawScore(answers, b)
    if (left === null || right === null) return
    if (a === 25 && b === 37 && left >= 4 && right >= 4) consistency -= 14
    if (a === 15 && b === 57 && left >= 4 && right <= 2) consistency -= 14
    if (a === 8 && b === 58 && left >= 4 && right >= 3) consistency -= 12
    if (a === 7 && b === 62 && left >= 4 && right <= 3) consistency -= 10
  })

  consistency = clamp(consistency, 0, 100)

  return {
    centralization: {
      level: centralizationLevel,
      message:
        centralizationLevel === 'Alto'
          ? 'Tende a assumir responsabilidades excessivas e concentrar decisoes, podendo limitar o desenvolvimento da equipe.'
          : centralizationLevel === 'Moderado'
            ? 'Apresenta indicios de concentracao de responsabilidades em alguns contextos.'
            : 'Bom equilibrio entre direcao, delegacao e desenvolvimento da equipe.',
    },
    procrastination: {
      level: procrastinationLevel,
      message:
        procrastinationLevel === 'Alto'
          ? 'Apresenta tendencia a adiar atividades complexas ou desagradaveis, impactando consistencia de resultados.'
          : procrastinationLevel === 'Moderado'
            ? 'Pode postergar algumas atividades quando ha sobrecarga ou pouca clareza.'
            : 'Boa disciplina e baixa tendencia a postergação.',
    },
    conflictRisk: {
      level: conflictLevel,
      message:
        conflictLevel === 'Alto'
          ? 'Pode apresentar dificuldades em lidar com divergencias, feedbacks ou opinioes contrarias.'
          : conflictLevel === 'Moderado'
            ? 'Tem alguns pontos de atenção na condução de conflitos e feedbacks.'
            : 'Boa maturidade para lidar com divergencias e feedbacks.',
    },
    changeResistance: {
      level: changeLevel,
      message:
        changeLevel === 'Resistente'
          ? 'Mostra dificuldade para se adaptar a mudancas de rotinas e processos.'
          : changeLevel === 'Moderadamente Adaptavel'
            ? 'Se adapta, mas pode precisar de mais tempo e contexto.'
            : 'Boa adaptabilidade a mudancas e ajustes de processo.',
    },
    consistency: {
      score: consistency,
      message:
        consistency >= 95
          ? 'Respostas altamente consistentes.'
          : consistency >= 85
            ? 'Boa consistencia entre resposta direta e cenarios praticos.'
            : consistency >= 70
              ? 'Algumas inconsistencias merecem revisao.'
              : 'Possivel viés de autopromocao ou falta de autoconhecimento.',
    },
  }
}

function getFinalProfile(leadership: number, emotional: number, maturity: number, productivity: number, relationship: number, consistency: number) {
  if (leadership >= 90 && productivity >= 80 && relationship >= 80 && maturity >= 80 && consistency >= 85) {
    return {
      title: 'Multiplicador Institucional' as const,
      description: 'Top 5% dos avaliados, com capacidade comprovada de formar lideres e influenciar positivamente equipes e cultura organizacional.',
    }
  }

  if (leadership >= 80 && maturity >= 80 && productivity >= 75) {
    return {
      title: 'Diretor' as const,
      description: 'Lideranca estrategica, visao de longo prazo e forte capacidade de desenvolver pessoas.',
    }
  }

  if (leadership >= 70 && emotional >= 70 && maturity >= 70) {
    return {
      title: 'Gestor' as const,
      description: 'Alta capacidade de conduzir pessoas, apoiar decisões e sustentar resultados com maturidade.',
    }
  }

  if (leadership >= 60 && relationship >= 60) {
    return {
      title: 'Coordenador' as const,
      description: 'Boa lideranca operacional, relacionamento equilibrado e entrega consistente.',
    }
  }

  return {
    title: 'Especialista' as const,
    description: 'Alta produtividade ou conhecimento técnico, com liderança ainda em desenvolvimento.',
  }
}

export function computePromoterFormResult(answers: PromoterFormAnswers): PromoterFormResult {
  const normalizedAnswers: Record<string, number> = {}
  let answeredCount = 0

  PROMOTER_QUESTIONS.forEach(question => {
    const value = normalizeQuestionScore(question, answers[question.id])
    if (value !== null) {
      answeredCount += 1
      normalizedAnswers[`q${question.id}`] = value
    }
  })

  const indices = Object.fromEntries(
    INDEX_DEFINITIONS.map(def => {
      const score = scoreIndex(answers, [...def.questions])
      return [def.key, { score, label: def.label, weight: def.weight, summary: def.summary }]
    })
  )

  const temperament = buildTemperament(normalizedAnswers)
  const behavioralProfile = buildBehavioralProfile(normalizedAnswers)
  const productivity = buildProductivity(normalizedAnswers)
  const alerts = buildAlerts(answers, normalizedAnswers)
  const finalProfile = getFinalProfile(
    indices.leadershipPotential.score,
    indices.emotionalIntelligence.score,
    indices.professionalMaturity.score,
    indices.productivity.score,
    indices.interpersonalRelationship.score,
    alerts.consistency.score
  )

  return {
    answeredCount,
    totalQuestions: PROMOTER_QUESTIONS.length,
    indices,
    temperament,
    behavioralProfile,
    productivity,
    alerts,
    finalProfile,
  }
}

export function getPromoterFormQuestionSections() {
  return PROMOTER_FORM_SECTIONS.map(section => ({
    ...section,
    questions: PROMOTER_QUESTIONS.filter(question => question.sectionId === section.id),
  }))
}

export function getPromoterFormQuestionById(id: number) {
  return QUESTION_BY_ID.get(id) || null
}

export function createEmptyPromoterFormAnswers() {
  return PROMOTER_QUESTIONS.reduce<PromoterFormAnswers>((acc, question) => {
    if (question.type === 'scale') acc[question.id] = 3
    else acc[question.id] = 0
    return acc
  }, {})
}
