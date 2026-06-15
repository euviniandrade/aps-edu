const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { authenticate } = require('../../shared/middleware/auth.middleware')

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'management-state.json')

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
  people: [
    { id: 'P-1', name: 'Coordenacao pedagogica', role: 'Lideranca escolar', pulse: 86, training: 'Avaliacao formativa', nextReview: '20/06' },
    { id: 'P-2', name: 'Secretaria escolar', role: 'Atendimento e matricula', pulse: 78, training: 'Jornada da familia', nextReview: '18/06' },
    { id: 'P-3', name: 'Operacao e suporte', role: 'Processos internos', pulse: 72, training: 'SLA e rotina visual', nextReview: '21/06' }
  ],
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
    return { ...defaultState, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  } catch {
    return { ...defaultState }
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
      due: request.body.due || 'Hoje'
    }
    if (!item.title) return reply.code(400).send({ error: 'Titulo obrigatorio' })
    state.work = [item, ...state.work]
    return reply.code(201).send(writeState(state))
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
