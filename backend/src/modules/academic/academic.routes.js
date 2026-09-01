const fs = require('fs')
const path = require('path')
const { authenticate } = require('../../shared/middleware/auth.middleware')

const DATA_DIR = process.env.DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data'))
const DATA_FILE = path.join(DATA_DIR, 'academic-state.json')

const defaultState = {
  updatedAt: new Date().toISOString(),
  semesters: [
    { id: 'sem-2026-1', name: '1º semestre', period: '2026.1', active: true },
    { id: 'sem-2026-2', name: '2º semestre', period: '2026.2', active: false },
  ],
  modules: [
    { id: 'mod-base', semesterId: 'sem-2026-1', name: 'Módulo base', focus: 'Fundamentos, leituras e rotina semanal.' },
    { id: 'mod-provas', semesterId: 'sem-2026-1', name: 'Avaliações', focus: 'Provas, trabalhos e entregas valendo nota.' },
    { id: 'mod-extensao', semesterId: 'sem-2026-2', name: 'Projetos e extensão', focus: 'Pesquisa, estágios e atividades complementares.' },
  ],
  subjects: [
    { id: 'sub-metodologia', semesterId: 'sem-2026-1', moduleId: 'mod-base', name: 'Metodologia Científica', professor: 'A definir', room: 'Online', schedule: 'Terça, 19:00', color: '#005DAA', credits: 4 },
    { id: 'sub-gestao', semesterId: 'sem-2026-1', moduleId: 'mod-base', name: 'Gestão Educacional', professor: 'A definir', room: 'Sala virtual', schedule: 'Quinta, 19:00', color: '#0ABD78', credits: 4 },
    { id: 'sub-pesquisa', semesterId: 'sem-2026-1', moduleId: 'mod-provas', name: 'Pesquisa Aplicada', professor: 'A definir', room: 'Campus', schedule: 'Sábado, 09:00', color: '#F8A303', credits: 3 },
  ],
  activities: [
    { id: 'act-leitura', subjectId: 'sub-metodologia', title: 'Ler plano de ensino e separar bibliografia', type: 'leitura', dueDate: '2026-08-03', time: '20:00', status: 'pendente', priority: 'media', notes: 'Registrar dúvidas para a primeira aula.' },
    { id: 'act-fichamento', subjectId: 'sub-metodologia', title: 'Fichamento do artigo base', type: 'atividade', dueDate: '2026-08-10', time: '21:00', status: 'pendente', priority: 'alta', notes: 'Entregar resumo, citações e reflexão pessoal.', weight: 2 },
    { id: 'act-prova', subjectId: 'sub-gestao', title: 'Prova do módulo de gestão', type: 'prova', dueDate: '2026-08-18', time: '19:30', status: 'pendente', priority: 'alta', notes: 'Revisar conceitos, modelos de gestão e estudo de caso.', weight: 4 },
  ],
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2))
  }
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    updatedAt: source.updatedAt || new Date().toISOString(),
    semesters: Array.isArray(source.semesters) ? source.semesters : defaultState.semesters,
    modules: Array.isArray(source.modules) ? source.modules : defaultState.modules,
    subjects: Array.isArray(source.subjects) ? source.subjects : defaultState.subjects,
    activities: Array.isArray(source.activities) ? source.activities : defaultState.activities,
  }
}

function readState() {
  ensureDataFile()
  try {
    return normalizeState(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')))
  } catch {
    return normalizeState(defaultState)
  }
}

function writeState(payload) {
  const next = normalizeState({ ...payload, updatedAt: new Date().toISOString() })
  ensureDataFile()
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2))
  return next
}

module.exports = async function (fastify) {
  fastify.get('/', { preHandler: [authenticate] }, async () => readState())

  fastify.put('/', { preHandler: [authenticate] }, async (request, reply) => {
    const next = writeState(request.body || {})
    return reply.send(next)
  })
}
