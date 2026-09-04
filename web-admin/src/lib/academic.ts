export type AcademicActivityStatus = 'pendente' | 'em-andamento' | 'concluida'
export type AcademicActivityType = 'aula' | 'atividade' | 'prova' | 'trabalho' | 'leitura' | 'estudo'

export type AcademicActivity = {
  id: string
  subjectId: string
  title: string
  type: AcademicActivityType
  dueDate: string
  time: string
  status: AcademicActivityStatus
  priority: 'baixa' | 'media' | 'alta'
  notes: string
  weight?: number
}

export type AcademicSubject = {
  id: string
  semesterId: string
  moduleId: string
  name: string
  professor: string
  room: string
  schedule: string
  color: string
  credits: number
}

export type AcademicModule = {
  id: string
  semesterId: string
  name: string
  focus: string
}

export type AcademicSemester = {
  id: string
  name: string
  period: string
  active: boolean
}

export type AcademicState = {
  semesters: AcademicSemester[]
  modules: AcademicModule[]
  subjects: AcademicSubject[]
  activities: AcademicActivity[]
  updatedAt: string
}

export const ACADEMIC_STORAGE_KEY = 'aps30_academic_workspace_v1'
export const ACADEMIC_UPDATED_EVENT = 'aps30:academic-updated'

export const academicSeed: AcademicState = {
  updatedAt: '2026-08-01T12:00:00.000Z',
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

export function readAcademicState(): AcademicState {
  if (typeof window === 'undefined') return academicSeed
  try {
    const raw = window.localStorage.getItem(ACADEMIC_STORAGE_KEY)
    if (!raw) return academicSeed
    const parsed = JSON.parse(raw) as Partial<AcademicState>
    return {
      semesters: Array.isArray(parsed.semesters) ? parsed.semesters : academicSeed.semesters,
      modules: Array.isArray(parsed.modules) ? parsed.modules : academicSeed.modules,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : academicSeed.subjects,
      activities: Array.isArray(parsed.activities) ? parsed.activities : academicSeed.activities,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return academicSeed
  }
}

export function writeAcademicState(state: AcademicState) {
  if (typeof window === 'undefined') return
  const next = { ...state, updatedAt: new Date().toISOString() }
  window.localStorage.setItem(ACADEMIC_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(ACADEMIC_UPDATED_EVENT, { detail: next }))
}

export async function fetchAcademicState(): Promise<AcademicState> {
  const response = await fetch('/api/academic', {
    method: 'GET',
    headers: { 'accept': 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Não foi possível carregar o ambiente acadêmico.')
  const data = await response.json()
  return {
    semesters: Array.isArray(data.semesters) ? data.semesters : academicSeed.semesters,
    modules: Array.isArray(data.modules) ? data.modules : academicSeed.modules,
    subjects: Array.isArray(data.subjects) ? data.subjects : academicSeed.subjects,
    activities: Array.isArray(data.activities) ? data.activities : academicSeed.activities,
    updatedAt: data.updatedAt || new Date().toISOString(),
  }
}

export async function saveAcademicState(state: AcademicState): Promise<AcademicState> {
  const next = { ...state, updatedAt: new Date().toISOString() }
  writeAcademicState(next)
  const response = await fetch('/api/academic', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(next),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Não foi possível salvar o ambiente acadêmico.')
  return response.json()
}

export function academicEventsFromState(state: AcademicState) {
  return state.activities
    .filter(activity => activity.dueDate && activity.status !== 'concluida')
    .map((activity, index) => {
      const subject = state.subjects.find(item => item.id === activity.subjectId)
      const date = activity.dueDate
      const time = activity.time || '08:00'
      return {
        id: `academic-${activity.id || index}`,
        title: `${activity.type === 'prova' ? 'Prova' : activity.type === 'trabalho' ? 'Trabalho' : 'Faculdade'}: ${activity.title}`,
        time,
        source: 'Acadêmico',
        location: subject ? subject.name : 'Faculdade',
        start: `${date}T${time}:00`,
        end: `${date}T${time}:00`,
        date,
        description: activity.notes || '',
        provider: 'academic',
        calendarId: 'academic-workspace',
        htmlLink: '/academico',
      }
    })
}
