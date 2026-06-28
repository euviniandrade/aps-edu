const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const { uploadDriveFile } = require('../integrations/integrations.service')

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'management-state.json')
const PEOPLE_BACKUP_DIR = path.join(DATA_DIR, 'people-backups')

const defaultState = {
  work: [
    { id: 'T-1024', title: 'Fechar roteiro de matriculas 2026', owner: 'Secretaria', area: 'Escola', stage: 'Em andamento', priority: 'Alta', due: 'Hoje' },
    { id: 'T-1025', title: 'Revisar compras de tecnologia', owner: 'Operacao', area: 'Ativos', stage: 'Aguardando aprovacao', priority: 'Alta', due: 'Amanha' },
    { id: 'T-1026', title: 'Preparar treinamento de coordenadores', owner: 'Pessoas', area: 'Treinamento', stage: 'Planejado', priority: 'Media', due: '17/06' },
    { id: 'T-1027', title: 'Consolidar indicadores por unidade', owner: 'Direcao', area: 'Comando', stage: 'Hoje', priority: 'Alta', due: 'Hoje' }
  ],
  admissions: [
    { id: 'MAT-2041', family: 'Familia Silva', student: 'Pedro Silva - 6 ano', stage: 'Visita pedagogica', value: 1850, next: 'Confirmar presenca da familia' },
    { id: 'MAT-2042', family: 'Familia Andrade', student: 'Livia Andrade - 1 ano', stage: 'Proposta enviada', value: 1620, next: 'Enviar documentacao' },
    { id: 'MAT-2043', family: 'Familia Costa', student: 'Rafael Costa - 9 ano', stage: 'Bolsa em analise', value: 2100, next: 'Aprovar condicao comercial' }
  ],
  people: [],
  finance: [
    { id: 'F-1', label: 'Matriculas previstas', type: 'Receita', amount: 3470, status: 'Previsto', due: 'Hoje' },
    { id: 'F-2', label: 'Compra de materiais pedagogicos', type: 'Despesa', amount: 980, status: 'A aprovar', due: 'Amanha' },
    { id: 'F-3', label: 'Campanha escolar', type: 'Despesa', amount: 2600, status: 'Contrato em revisao', due: '19/06' }
  ],
  assets: [
    { id: 'A-1', name: 'Kits de matricula', location: 'Secretaria APS', qty: 42, min: 60, status: 'Repor' },
    { id: 'A-2', name: 'Projetores multimidia', location: 'Sala de recursos', qty: 4, min: 5, status: 'Critico' },
    { id: 'A-3', name: 'Materiais de limpeza', location: 'Almoxarifado', qty: 22, min: 25, status: 'Monitorar' }
  ],
  knowledge: [
    { id: 'D-1', title: 'Politica de matricula 2026', type: 'Documento', owner: 'Secretaria', status: 'Revisao' },
    { id: 'D-2', title: 'Ata do comite executivo', type: 'Nota', owner: 'Direcao', status: 'Publicada' },
    { id: 'D-3', title: 'E-mail de follow-up para familias', type: 'E-mail', owner: 'Sofi IA', status: 'Rascunho' }
  ],
  automations: [
    { id: 'AU-1', trigger: 'Tarefa vence hoje', action: 'Notificar responsavel e resumir risco para a direcao', status: 'Ativa' },
    { id: 'AU-2', trigger: 'Estoque abaixo do minimo', action: 'Criar solicitacao de compra e pedir aprovacao', status: 'Ativa' },
    { id: 'AU-3', trigger: 'Nova familia no funil', action: 'Gerar checklist de matricula e proximo contato', status: 'Rascunho' }
  ],
  updatedAt: new Date().toISOString()
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2))
  }
}

function readState() {
  ensureDataFile()
  try {
    const state = { ...defaultState, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
    state.people = Array.isArray(state.people) ? state.people.map(normalizePerson) : defaultState.people.map(normalizePerson)
    return state
  } catch {
    return { ...defaultState, people: defaultState.people.map(normalizePerson) }
  }
}

function writeState(state) {
  const next = { ...state, updatedAt: new Date().toISOString() }
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2))
  return next
}

function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(Boolean)
  }
  return undefined
}

function parseChecklist(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => ({
      id: String(item?.id || `C-${Date.now()}-${index}`),
      title: String(item?.title || '').trim(),
      done: Boolean(item?.done),
    }))
    .filter(item => item.title)
}

function parseComments(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => ({
      id: String(item?.id || `CM-${Date.now()}-${index}`),
      author: String(item?.author || 'Equipe APS').trim(),
      content: String(item?.content || '').trim(),
      createdAt: item?.createdAt || new Date().toISOString(),
    }))
    .filter(item => item.content)
}

function parseMaybeJsonObject(value) {
  if (!value) return undefined
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

const leadershipProfiles = ['Executor', 'Entusiasta', 'Relacional', 'Organizador', 'Desenvolvedor', 'Estrategico', 'Influenciador']
const leadershipPotentials = ['Baixo', 'Moderado', 'Alto', 'Muito Alto', 'Excepcional']
const leadershipReadinessOptions = [
  'Ainda nao demonstra perfil de lideranca',
  'Potencial em desenvolvimento',
  'Pronto para liderar pequenas equipes',
  'Pronto para liderar setores/departamentos',
  'Pronto para liderar unidades ou grandes projetos'
]
const leaderDevelopmentOptions = [
  'Nao desenvolve',
  'Desenvolve ocasionalmente',
  'Desenvolve regularmente',
  'Forma novos lideres de maneira consistente',
  'Multiplica lideres e fortalece a cultura institucional'
]
const temperamentTypes = ['Sanguineo', 'Colerico', 'Fleumatico', 'Melancolico']
const behavioralProfiles = ['Executor', 'Influenciador', 'Analitico', 'Estavel']
const decisionStyles = [
  'Decide rapidamente mesmo com poucas informacoes',
  'Busca equilibrio entre velocidade e analise',
  'Analisa profundamente antes de decidir',
  'Prefere consultar outras pessoas antes de decidir'
]
const interpersonalLevels = ['Muito reservado', 'Reservado', 'Equilibrado', 'Comunicativo', 'Extremamente comunicativo']
const pressureResponses = ['Mantem a calma', 'Assume o controle', 'Busca apoio da equipe', 'Torna-se mais analitico', 'Demonstra dificuldade sob pressao']
const collaborationLevels = [
  'Atua como agregador da equipe',
  'Colabora ativamente com os demais',
  'Colabora quando solicitado',
  'Prefere trabalhar de forma individual',
  'Demonstra resistencia ao trabalho em equipe'
]
const convivenceLevels = [
  'Muito facil de lidar',
  'Facil de lidar',
  'Moderadamente facil de lidar',
  'Dificil de lidar em algumas situacoes',
  'Frequentemente dificil de lidar'
]
const relationalIntelligenceOptions = [
  'Recebe feedbacks com maturidade e busca crescimento',
  'Geralmente aceita feedbacks e faz ajustes',
  'Aceita feedbacks com alguma resistencia inicial',
  'Tem dificuldade em aceitar feedbacks ou opinioes diferentes',
  'Frequentemente reage de forma defensiva ou conflituosa'
]
const relationalClassificationOptions = [
  'Referencia positiva de relacionamento e trabalho em equipe',
  'Relacionamento acima da media',
  'Relacionamento adequado',
  'Necessita desenvolver competencias relacionais',
  'Necessita acompanhamento prioritario em relacionamento interpessoal'
]

function clampNumber(value, min, max) {
  const number = Number(value)
  if (Number.isNaN(number)) return min
  return Math.min(max, Math.max(min, Math.round(number)))
}

function levelFromScore(score) {
  const value = Number(score || 0)
  if (value >= 4.6) return 5
  if (value >= 4.1) return 4
  if (value >= 3.2) return 3
  if (value >= 2.2) return 2
  return 1
}

function inferLeadershipProfile(person) {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''}`.toLowerCase()
  if (text.includes('coorden') || text.includes('direcao') || text.includes('gestao')) return 'Estrategico'
  if (text.includes('secretaria') || text.includes('atendimento') || text.includes('matricula')) return 'Organizador'
  if (text.includes('operacao') || text.includes('suporte') || text.includes('processo')) return 'Executor'
  if (text.includes('pedagog') || text.includes('formacao') || text.includes('trein')) return 'Desenvolvedor'
  if (text.includes('famil') || text.includes('relacion') || text.includes('comunic')) return 'Relacional'
  return 'Entusiasta'
}

function inferLeadershipPotential(level) {
  if (level >= 5) return 'Excepcional'
  if (level === 4) return 'Muito Alto'
  if (level === 3) return 'Alto'
  if (level === 2) return 'Moderado'
  return 'Baixo'
}

function inferLeadershipReadiness(level) {
  if (level >= 5) return 'Pronto para liderar unidades ou grandes projetos'
  if (level === 4) return 'Pronto para liderar setores/departamentos'
  if (level === 3) return 'Pronto para liderar pequenas equipes'
  if (level === 2) return 'Potencial em desenvolvimento'
  return 'Ainda nao demonstra perfil de lideranca'
}

function inferLeaderDevelopment(level) {
  if (level >= 5) return 'Multiplica lideres e fortalece a cultura institucional'
  if (level === 4) return 'Forma novos lideres de maneira consistente'
  if (level === 3) return 'Desenvolve regularmente'
  if (level === 2) return 'Desenvolve ocasionalmente'
  return 'Nao desenvolve'
}

function inferTemperament(person) {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''} ${person.bio || ''}`.toLowerCase()
  if (text.includes('pedagog') || text.includes('trein') || text.includes('desenvolv')) {
    return { primary: 'Melancolico', primaryPercent: 72, secondary: 'Fleumatico', secondaryPercent: 28, reason: 'Tendencia analitica, organizada e orientada ao desenvolvimento.' }
  }
  if (text.includes('secretaria') || text.includes('organiz') || text.includes('processo')) {
    return { primary: 'Fleumatico', primaryPercent: 68, secondary: 'Melancolico', secondaryPercent: 32, reason: 'Perfil estavel, mediador e consistente em processos.' }
  }
  if (text.includes('operacao') || text.includes('suporte') || text.includes('exec')) {
    return { primary: 'Colerico', primaryPercent: 70, secondary: 'Sanguineo', secondaryPercent: 30, reason: 'Foco em resultado, decisao rapida e acao pratica.' }
  }
  if (text.includes('famil') || text.includes('comunic') || text.includes('atendimento')) {
    return { primary: 'Sanguineo', primaryPercent: 70, secondary: 'Colerico', secondaryPercent: 30, reason: 'Boa conexao com pessoas, energia social e influencia.' }
  }
  return { primary: 'Fleumatico', primaryPercent: 70, secondary: 'Sanguineo', secondaryPercent: 30, reason: 'Equilibrio, constancia e capacidade de mediacao.' }
}

function inferBehavioralProfile(person) {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''}`.toLowerCase()
  if (text.includes('coorden') || text.includes('direcao') || text.includes('gestao')) return { profile: 'Estrategico', percent: 86 }
  if (text.includes('secretaria') || text.includes('processo') || text.includes('organiz')) return { profile: 'Analitico', percent: 82 }
  if (text.includes('operacao') || text.includes('suporte')) return { profile: 'Executor', percent: 84 }
  if (text.includes('famil') || text.includes('comunic') || text.includes('relacion')) return { profile: 'Influenciador', percent: 79 }
  return { profile: 'Estavel', percent: 75 }
}

function inferProductivityMetrics(person, leadershipLevel) {
  const base = clampNumber((Number(person.score || 4) * 18) + (leadershipLevel * 4), 55, 96)
  const variance = textHash(`${person.id || ''}${person.name || ''}${person.role || ''}`)
  const efficiency = clampNumber(base + (variance % 7) - 3, 0, 100)
  const quality = clampNumber(base - 2 + (variance % 5), 0, 100)
  const organization = clampNumber(base - 4 + (variance % 6), 0, 100)
  const commitment = clampNumber(base + 3 + (variance % 4), 0, 100)
  const autonomy = clampNumber(base - 1 + (variance % 5), 0, 100)
  const index = clampNumber(Math.round((efficiency + quality + organization + commitment + autonomy) / 5), 0, 100)
  return { efficiency, quality, organization, commitment, autonomy, index }
}

function textHash(text) {
  let value = 0
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) % 9973
  }
  return Math.abs(value)
}

function inferProductivityDiagnosis(value) {
  if (value >= 90) return 'Alta Performance'
  if (value >= 80) return 'Muito Bom'
  if (value >= 70) return 'Adequado'
  if (value >= 60) return 'Atencao'
  return 'Necessita Desenvolvimento'
}

function parseSmartForm(value) {
  const parsed = parseMaybeJsonObject(value)
  if (!parsed) return undefined
  return parsed
}

function inferLeadershipPercent(person, level) {
  if (typeof person.leadershipPercent === 'number') return clampNumber(person.leadershipPercent, 0, 100)
  if (typeof person.score === 'number' && person.score > 0) return clampNumber(person.score * 20, 0, 100)
  if (level) return clampNumber(level * 20, 0, 100)
  return 60
}

function normalizePerson(person) {
  const level = person.leadershipLevel ? clampNumber(person.leadershipLevel, 1, 5) : levelFromScore(person.score)
  const profile = leadershipProfiles.includes(person.leadershipProfile) ? person.leadershipProfile : inferLeadershipProfile(person)
  const potential = leadershipPotentials.includes(person.leadershipPotential) ? person.leadershipPotential : inferLeadershipPotential(level)
  const readiness = leadershipReadinessOptions.includes(person.leadershipReadiness) ? person.leadershipReadiness : inferLeadershipReadiness(level)
  const development = leaderDevelopmentOptions.includes(person.leaderDevelopment) ? person.leaderDevelopment : inferLeaderDevelopment(level)
  const temperament = inferTemperament(person)
  const behavioral = inferBehavioralProfile(person)
  const metrics = inferProductivityMetrics(person, level)

  return {
    ...person,
    score: Number(person.score || 0),
    leadershipPercent: inferLeadershipPercent(person, level),
    leadershipLevel: level,
    leadershipProfile: profile,
    leadershipPotential: potential,
    leadershipReadiness: readiness,
    leaderDevelopment: development,
    temperamentPrimary: temperamentTypes.includes(person.temperamentPrimary) ? person.temperamentPrimary : temperament.primary,
    temperamentPrimaryPercent: clampNumber(person.temperamentPrimaryPercent ?? temperament.primaryPercent, 0, 100),
    temperamentSecondary: temperamentTypes.includes(person.temperamentSecondary) ? person.temperamentSecondary : temperament.secondary,
    temperamentSecondaryPercent: clampNumber(person.temperamentSecondaryPercent ?? temperament.secondaryPercent, 0, 100),
    temperamentReason: typeof person.temperamentReason === 'string' && person.temperamentReason.trim() ? person.temperamentReason.trim() : temperament.reason,
    behavioralProfile: behavioralProfiles.includes(person.behavioralProfile) ? person.behavioralProfile : behavioral.profile,
    behavioralProfilePercent: clampNumber(person.behavioralProfilePercent ?? behavioral.percent, 0, 100),
    decisionStyle: decisionStyles.includes(person.decisionStyle) ? person.decisionStyle : 'Busca equilibrio entre velocidade e analise',
    interpersonalLevel: interpersonalLevels.includes(person.interpersonalLevel) ? person.interpersonalLevel : 'Equilibrado',
    convivenceLevel: convivenceLevels.includes(person.convivenceLevel) ? person.convivenceLevel : 'Facil de lidar',
    collaborationLevel: collaborationLevels.includes(person.collaborationLevel) ? person.collaborationLevel : 'Colabora ativamente com os demais',
    relationalIntelligence: relationalIntelligenceOptions.includes(person.relationalIntelligence) ? person.relationalIntelligence : 'Geralmente aceita feedbacks e faz ajustes',
    relationalClassification: relationalClassificationOptions.includes(person.relationalClassification) ? person.relationalClassification : 'Relacionamento adequado',
    pressureResponse: pressureResponses.includes(person.pressureResponse) ? person.pressureResponse : 'Mantem a calma',
    productivityEfficiency: Number.isFinite(Number(person.productivityEfficiency)) ? clampNumber(person.productivityEfficiency, 0, 100) : metrics.efficiency,
    productivityQuality: Number.isFinite(Number(person.productivityQuality)) ? clampNumber(person.productivityQuality, 0, 100) : metrics.quality,
    productivityOrganization: Number.isFinite(Number(person.productivityOrganization)) ? clampNumber(person.productivityOrganization, 0, 100) : metrics.organization,
    productivityCommitment: Number.isFinite(Number(person.productivityCommitment)) ? clampNumber(person.productivityCommitment, 0, 100) : metrics.commitment,
    productivityAutonomy: Number.isFinite(Number(person.productivityAutonomy)) ? clampNumber(person.productivityAutonomy, 0, 100) : metrics.autonomy,
    productivityIndex: Number.isFinite(Number(person.productivityIndex)) ? clampNumber(person.productivityIndex, 0, 100) : metrics.index,
    productivityDiagnosis: inferProductivityDiagnosis(Number.isFinite(Number(person.productivityIndex)) ? clampNumber(person.productivityIndex, 0, 100) : metrics.index),
    pulse: Number(person.pulse || 0),
    attendance: Number(person.attendance || 0),
    workload: Number(person.workload || 0),
    strengths: Array.isArray(person.strengths) ? person.strengths : [],
    risks: Array.isArray(person.risks) ? person.risks : [],
    files: Array.isArray(person.files) ? person.files : [],
    assessmentForm: parseSmartForm(person.assessmentForm) || person.assessmentForm || undefined,
    driveSyncAt: typeof person.driveSyncAt === 'string' ? person.driveSyncAt : undefined,
    driveSyncProvider: typeof person.driveSyncProvider === 'string' ? person.driveSyncProvider : undefined,
    driveSyncFile: typeof person.driveSyncFile === 'string' ? person.driveSyncFile : undefined,
  }
}

function nextStage(stage) {
  const map = {
    Novo: 'Planejado',
    Planejado: 'Em andamento',
    'Em andamento': 'Em revisao',
    'Aguardando aprovacao': 'Em andamento',
    Hoje: 'Em andamento',
    'Em revisao': 'Concluido',
    Concluido: 'Concluido'
  }
  return map[stage] || 'Em andamento'
}

function backupPeopleState(state, reason = 'update') {
  fs.mkdirSync(PEOPLE_BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${stamp}-${reason}.json`
  const filePath = path.join(PEOPLE_BACKUP_DIR, fileName)
  fs.writeFileSync(filePath, JSON.stringify({ updatedAt: new Date().toISOString(), people: state.people || [] }, null, 2))
  return { fileName, filePath }
}

async function syncPeopleSnapshotToDrive(userId, state, reason = 'update') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const payload = {
    name: `APS EDU - Pessoas - ${stamp}.json`,
    mimeType: 'application/json',
    content: JSON.stringify({
      updatedAt: state.updatedAt || new Date().toISOString(),
      reason,
      people: state.people || [],
    }, null, 2),
  }

  try {
    const result = await uploadDriveFile(userId, payload)
    return {
      provider: result.provider,
      fileId: result.file?.id || null,
      fileName: result.file?.name || payload.name,
      webViewLink: result.file?.webViewLink || null,
      syncedAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      provider: null,
      error: error?.message || 'Falha ao sincronizar com Drive',
      syncedAt: null,
    }
  }
}

module.exports = async function (fastify) {
  fastify.get('/', { preHandler: [authenticate] }, async () => readState())

  fastify.post('/work', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const item = {
      id: createId('T'),
      title: request.body.title,
      owner: request.body.owner || 'Sofi IA',
      area: request.body.area || 'Comando executivo',
      stage: request.body.stage || 'Novo',
      priority: request.body.priority || 'Alta',
      due: request.body.due || 'Hoje',
      project: request.body.project || '',
      description: request.body.description || '',
      attachments: Array.isArray(request.body.attachments) ? request.body.attachments : [],
      tags: Array.isArray(request.body.tags) ? request.body.tags : [],
      participants: Array.isArray(request.body.participants) ? request.body.participants : [],
      color: typeof request.body.color === 'string' ? request.body.color.trim() : '',
      checklist: parseChecklist(request.body.checklist),
      comments: parseComments(request.body.comments),
    }
    if (!item.title) return reply.code(400).send({ error: 'Titulo obrigatorio' })
    state.work = [item, ...state.work]
    return reply.code(201).send(writeState(state))
  })

  fastify.patch('/work/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    let found = false
    state.work = state.work.map(item => {
      if (item.id !== request.params.id) return item
      found = true
      const next = { ...item, ...request.body }
      return {
        ...next,
        attachments: Array.isArray(next.attachments) ? next.attachments : [],
        tags: Array.isArray(next.tags) ? next.tags : [],
        participants: Array.isArray(next.participants) ? next.participants : [],
        color: typeof next.color === 'string' ? next.color.trim() : '',
        checklist: parseChecklist(next.checklist),
        comments: parseComments(next.comments),
      }
    })
    if (!found) return reply.code(404).send({ error: 'Item nao encontrado' })
    return reply.send(writeState(state))
  })

  fastify.patch('/work/:id/advance', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    let found = false
    state.work = state.work.map(item => {
      if (item.id !== request.params.id) return item
      found = true
      return { ...item, stage: nextStage(item.stage) }
    })
    if (!found) return reply.code(404).send({ error: 'Item nao encontrado' })
    return reply.send(writeState(state))
  })

  fastify.post('/admissions', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    state.admissions = [{
      id: createId('MAT'),
      family: request.body.family || 'Nova familia',
      student: request.body.student || 'Aluno em qualificacao',
      stage: request.body.stage || 'Contato inicial',
      value: Number(request.body.value || 1500),
      next: request.body.next || 'Agendar visita pedagogica'
    }, ...state.admissions]
    return reply.code(201).send(writeState(state))
  })

  fastify.post('/finance', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const type = request.body.type === 'Despesa' ? 'Despesa' : 'Receita'
    state.finance = [{
      id: createId('F'),
      label: request.body.label || (type === 'Receita' ? 'Nova receita escolar' : 'Nova despesa operacional'),
      type,
      amount: Number(request.body.amount || (type === 'Receita' ? 1200 : 450)),
      status: request.body.status || 'Previsto',
      due: request.body.due || 'Esta semana'
    }, ...state.finance]
    return reply.code(201).send(writeState(state))
  })

  fastify.patch('/assets/:id/adjust', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const delta = Number(request.body.delta || 0)
    let found = false
    state.assets = state.assets.map(item => {
      if (item.id !== request.params.id) return item
      found = true
      const qty = Math.max(0, Number(item.qty || 0) + delta)
      return { ...item, qty, status: qty <= item.min ? 'Repor' : 'Ok' }
    })
    if (!found) return reply.code(404).send({ error: 'Ativo nao encontrado' })
    return reply.send(writeState(state))
  })

  fastify.post('/knowledge', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const type = request.body.type || 'Nota'
    state.knowledge = [{
      id: createId('K'),
      title: request.body.title || (type === 'E-mail' ? 'Novo rascunho de e-mail executivo' : 'Nova nota operacional'),
      type,
      owner: request.body.owner || 'Sofi IA',
      status: request.body.status || 'Rascunho'
    }, ...state.knowledge]
    return reply.code(201).send(writeState(state))
  })

  fastify.patch('/people/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const body = request.body || {}
    let found = false

    state.people = state.people.map(item => {
      if (item.id !== request.params.id) return item
      found = true

      const strengths = parseList(body.strengths)
      const risks = parseList(body.risks)
      const files = parseList(body.files)

      return normalizePerson({
        ...item,
        ...body,
        name: typeof body.name === 'string' ? body.name.trim() || item.name : item.name,
        role: typeof body.role === 'string' ? body.role.trim() || item.role : item.role,
        unit: typeof body.unit === 'string' ? body.unit.trim() || item.unit : item.unit,
        avatar: typeof body.avatar === 'string' ? body.avatar.trim() || item.avatar : item.avatar,
        training: typeof body.training === 'string' ? body.training.trim() || item.training : item.training,
        nextReview: typeof body.nextReview === 'string' ? body.nextReview.trim() || item.nextReview : item.nextReview,
        nextAction: typeof body.nextAction === 'string' ? body.nextAction.trim() || item.nextAction : item.nextAction,
        bio: typeof body.bio === 'string' ? body.bio.trim() || item.bio : item.bio,
        email: typeof body.email === 'string' ? body.email.trim() || item.email : item.email,
        phone: typeof body.phone === 'string' ? body.phone.trim() || item.phone : item.phone,
        pulse: body.pulse !== undefined ? Number(body.pulse) : item.pulse,
        score: body.score !== undefined ? Number(body.score) : item.score,
        attendance: body.attendance !== undefined ? Number(body.attendance) : item.attendance,
        workload: body.workload !== undefined ? Number(body.workload) : item.workload,
        leadershipPercent: body.leadershipPercent !== undefined ? Number(body.leadershipPercent) : item.leadershipPercent,
        leadershipLevel: body.leadershipLevel !== undefined ? Number(body.leadershipLevel) : item.leadershipLevel,
        leadershipProfile: typeof body.leadershipProfile === 'string' ? body.leadershipProfile : item.leadershipProfile,
        leadershipPotential: typeof body.leadershipPotential === 'string' ? body.leadershipPotential : item.leadershipPotential,
        leadershipReadiness: typeof body.leadershipReadiness === 'string' ? body.leadershipReadiness : item.leadershipReadiness,
      leaderDevelopment: typeof body.leaderDevelopment === 'string' ? body.leaderDevelopment : item.leaderDevelopment,
        temperamentPrimary: typeof body.temperamentPrimary === 'string' ? body.temperamentPrimary : item.temperamentPrimary,
        temperamentPrimaryPercent: body.temperamentPrimaryPercent !== undefined ? Number(body.temperamentPrimaryPercent) : item.temperamentPrimaryPercent,
        temperamentSecondary: typeof body.temperamentSecondary === 'string' ? body.temperamentSecondary : item.temperamentSecondary,
        temperamentSecondaryPercent: body.temperamentSecondaryPercent !== undefined ? Number(body.temperamentSecondaryPercent) : item.temperamentSecondaryPercent,
        temperamentReason: typeof body.temperamentReason === 'string' ? body.temperamentReason : item.temperamentReason,
        behavioralProfile: typeof body.behavioralProfile === 'string' ? body.behavioralProfile : item.behavioralProfile,
        behavioralProfilePercent: body.behavioralProfilePercent !== undefined ? Number(body.behavioralProfilePercent) : item.behavioralProfilePercent,
        decisionStyle: typeof body.decisionStyle === 'string' ? body.decisionStyle : item.decisionStyle,
        interpersonalLevel: typeof body.interpersonalLevel === 'string' ? body.interpersonalLevel : item.interpersonalLevel,
        convivenceLevel: typeof body.convivenceLevel === 'string' ? body.convivenceLevel : item.convivenceLevel,
        collaborationLevel: typeof body.collaborationLevel === 'string' ? body.collaborationLevel : item.collaborationLevel,
        relationalIntelligence: typeof body.relationalIntelligence === 'string' ? body.relationalIntelligence : item.relationalIntelligence,
        relationalClassification: typeof body.relationalClassification === 'string' ? body.relationalClassification : item.relationalClassification,
        pressureResponse: typeof body.pressureResponse === 'string' ? body.pressureResponse : item.pressureResponse,
        productivityEfficiency: body.productivityEfficiency !== undefined ? Number(body.productivityEfficiency) : item.productivityEfficiency,
        productivityQuality: body.productivityQuality !== undefined ? Number(body.productivityQuality) : item.productivityQuality,
        productivityOrganization: body.productivityOrganization !== undefined ? Number(body.productivityOrganization) : item.productivityOrganization,
        productivityCommitment: body.productivityCommitment !== undefined ? Number(body.productivityCommitment) : item.productivityCommitment,
        productivityAutonomy: body.productivityAutonomy !== undefined ? Number(body.productivityAutonomy) : item.productivityAutonomy,
        productivityIndex: body.productivityIndex !== undefined ? Number(body.productivityIndex) : item.productivityIndex,
        productivityDiagnosis: typeof body.productivityDiagnosis === 'string' ? body.productivityDiagnosis : item.productivityDiagnosis,
        strengths: strengths || item.strengths,
        risks: risks || item.risks,
        files: files || item.files,
        assessmentForm: parseMaybeJsonObject(body.assessmentForm) || item.assessmentForm,
        driveSyncAt: item.driveSyncAt,
        driveSyncProvider: item.driveSyncProvider,
        driveSyncFile: item.driveSyncFile,
      })
    })

    if (!found) return reply.code(404).send({ error: 'Pessoa nao encontrada' })
    const saved = writeState(state)
    backupPeopleState(saved, 'people-update')
    const sync = await syncPeopleSnapshotToDrive(request.currentUser.id, saved, 'people-update')
    if (sync?.syncedAt) {
      const next = writeState({
        ...saved,
        peopleDriveSync: sync,
        peopleDriveSyncAt: sync.syncedAt,
        peopleDriveSyncFile: sync.fileName,
      })
      return reply.send(next)
    }
    return reply.send(saved)
  })

  fastify.post('/people', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const body = request.body || {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return reply.code(400).send({ error: 'Nome obrigatorio' })

    state.people = [normalizePerson({
      id: createId('P'),
      name,
      role: typeof body.role === 'string' ? body.role.trim() : 'Novo cargo',
      unit: typeof body.unit === 'string' ? body.unit.trim() : 'Equipe',
      pulse: Number(body.pulse || 75),
      score: Number(body.score || 4.2),
      attendance: Number(body.attendance || 95),
      workload: Number(body.workload || 65),
      leadershipPercent: Number(body.leadershipPercent || 80),
      leadershipLevel: body.leadershipLevel ? Number(body.leadershipLevel) : 3,
      leadershipProfile: typeof body.leadershipProfile === 'string' ? body.leadershipProfile : 'Executor',
      leadershipPotential: typeof body.leadershipPotential === 'string' ? body.leadershipPotential : 'Alto',
      leadershipReadiness: typeof body.leadershipReadiness === 'string' ? body.leadershipReadiness : 'Potencial em desenvolvimento',
      leaderDevelopment: typeof body.leaderDevelopment === 'string' ? body.leaderDevelopment : 'Desenvolve regularmente',
      temperamentPrimary: typeof body.temperamentPrimary === 'string' ? body.temperamentPrimary : undefined,
      temperamentPrimaryPercent: body.temperamentPrimaryPercent !== undefined ? Number(body.temperamentPrimaryPercent) : undefined,
      temperamentSecondary: typeof body.temperamentSecondary === 'string' ? body.temperamentSecondary : undefined,
      temperamentSecondaryPercent: body.temperamentSecondaryPercent !== undefined ? Number(body.temperamentSecondaryPercent) : undefined,
      temperamentReason: typeof body.temperamentReason === 'string' ? body.temperamentReason : undefined,
      behavioralProfile: typeof body.behavioralProfile === 'string' ? body.behavioralProfile : undefined,
      behavioralProfilePercent: body.behavioralProfilePercent !== undefined ? Number(body.behavioralProfilePercent) : undefined,
      decisionStyle: typeof body.decisionStyle === 'string' ? body.decisionStyle : undefined,
      interpersonalLevel: typeof body.interpersonalLevel === 'string' ? body.interpersonalLevel : undefined,
      convivenceLevel: typeof body.convivenceLevel === 'string' ? body.convivenceLevel : undefined,
      collaborationLevel: typeof body.collaborationLevel === 'string' ? body.collaborationLevel : undefined,
      relationalIntelligence: typeof body.relationalIntelligence === 'string' ? body.relationalIntelligence : undefined,
      relationalClassification: typeof body.relationalClassification === 'string' ? body.relationalClassification : undefined,
      pressureResponse: typeof body.pressureResponse === 'string' ? body.pressureResponse : undefined,
      productivityEfficiency: body.productivityEfficiency !== undefined ? Number(body.productivityEfficiency) : undefined,
      productivityQuality: body.productivityQuality !== undefined ? Number(body.productivityQuality) : undefined,
      productivityOrganization: body.productivityOrganization !== undefined ? Number(body.productivityOrganization) : undefined,
      productivityCommitment: body.productivityCommitment !== undefined ? Number(body.productivityCommitment) : undefined,
      productivityAutonomy: body.productivityAutonomy !== undefined ? Number(body.productivityAutonomy) : undefined,
      productivityIndex: body.productivityIndex !== undefined ? Number(body.productivityIndex) : undefined,
      productivityDiagnosis: typeof body.productivityDiagnosis === 'string' ? body.productivityDiagnosis : undefined,
      training: typeof body.training === 'string' ? body.training.trim() : 'Trilha de integracao',
      nextReview: typeof body.nextReview === 'string' ? body.nextReview.trim() : 'Em breve',
      avatar: typeof body.avatar === 'string' ? body.avatar.trim() : null,
      strengths: parseList(body.strengths) || [],
      risks: parseList(body.risks) || [],
      files: parseList(body.files) || [],
      nextAction: typeof body.nextAction === 'string' ? body.nextAction.trim() : 'Acompanhar onboarding',
      bio: typeof body.bio === 'string' ? body.bio.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      assessmentForm: parseMaybeJsonObject(body.assessmentForm) || undefined,
    }), ...state.people]

    const saved = writeState(state)
    backupPeopleState(saved, 'people-create')
    const sync = await syncPeopleSnapshotToDrive(request.currentUser.id, saved, 'people-create')
    if (sync?.syncedAt) {
      const next = writeState({
        ...saved,
        peopleDriveSync: sync,
        peopleDriveSyncAt: sync.syncedAt,
        peopleDriveSyncFile: sync.fileName,
      })
      return reply.code(201).send(next)
    }

    return reply.code(201).send(saved)
  })

  fastify.delete('/people', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    backupPeopleState(state, 'people-reset-before-clear')
    const cleared = writeState({
      ...state,
      people: [],
      peopleDriveSync: null,
      peopleDriveSyncAt: null,
      peopleDriveSyncFile: null,
    })
    const sync = await syncPeopleSnapshotToDrive(request.currentUser.id, cleared, 'people-reset')
    if (sync?.syncedAt) {
      const next = writeState({
        ...cleared,
        peopleDriveSync: sync,
        peopleDriveSyncAt: sync.syncedAt,
        peopleDriveSyncFile: sync.fileName,
      })
      return reply.send(next)
    }
    return reply.send(cleared)
  })

  fastify.patch('/automations/:id/toggle', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    let found = false
    state.automations = state.automations.map(item => {
      if (item.id !== request.params.id) return item
      found = true
      return { ...item, status: item.status === 'Ativa' ? 'Rascunho' : 'Ativa' }
    })
    if (!found) return reply.code(404).send({ error: 'Automacao nao encontrada' })
    return reply.send(writeState(state))
  })
}
