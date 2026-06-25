'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '@/lib/api'
import {
  AcademicCapIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  CloudIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  PaperClipIcon,
  PlusIcon,
  PencilSquareIcon,
  PhotoIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type Priority = 'Alta' | 'Media' | 'Baixa'

type WorkItem = {
  id: string
  title: string
  owner: string
  area: string
  stage: string
  priority: Priority
  due: string
  project?: string
  description?: string
  attachments?: string[]
  tags?: string[]
  participants?: string[]
}

type Admission = {
  id: string
  family: string
  student: string
  stage: string
  value: number
  next: string
}

type LeadershipLevel = 1 | 2 | 3 | 4 | 5
type LeadershipProfile = 'Executor' | 'Entusiasta' | 'Relacional' | 'Organizador' | 'Desenvolvedor' | 'Estrategico' | 'Influenciador'
type LeadershipPotential = 'Baixo' | 'Moderado' | 'Alto' | 'Muito Alto' | 'Excepcional'
type LeadershipReadiness =
  | 'Ainda nao demonstra perfil de lideranca'
  | 'Potencial em desenvolvimento'
  | 'Pronto para liderar pequenas equipes'
  | 'Pronto para liderar setores/departamentos'
  | 'Pronto para liderar unidades ou grandes projetos'
type LeaderDevelopment =
  | 'Nao desenvolve'
  | 'Desenvolve ocasionalmente'
  | 'Desenvolve regularmente'
  | 'Forma novos lideres de maneira consistente'
  | 'Multiplica lideres e fortalece a cultura institucional'
type TemperamentType = 'Sanguineo' | 'Colerico' | 'Fleumatico' | 'Melancolico'
type BehavioralProfile = 'Executor' | 'Influenciador' | 'Analitico' | 'Estavel'
type DecisionStyle =
  | 'Decide rapidamente mesmo com poucas informacoes'
  | 'Busca equilibrio entre velocidade e analise'
  | 'Analisa profundamente antes de decidir'
  | 'Prefere consultar outras pessoas antes de decidir'
type InterpersonalLevel = 'Muito reservado' | 'Reservado' | 'Equilibrado' | 'Comunicativo' | 'Extremamente comunicativo'
type PressureResponse = 'Mantem a calma' | 'Assume o controle' | 'Busca apoio da equipe' | 'Torna-se mais analitico' | 'Demonstra dificuldade sob pressao'
type CollaborationLevel = 'Atua como agregador da equipe' | 'Colabora ativamente com os demais' | 'Colabora quando solicitado' | 'Prefere trabalhar de forma individual' | 'Demonstra resistencia ao trabalho em equipe'
type ConvivenceLevel =
  | 'Muito facil de lidar'
  | 'Facil de lidar'
  | 'Moderadamente facil de lidar'
  | 'Dificil de lidar em algumas situacoes'
  | 'Frequentemente dificil de lidar'
type RelationalIntelligence =
  | 'Recebe feedbacks com maturidade e busca crescimento'
  | 'Geralmente aceita feedbacks e faz ajustes'
  | 'Aceita feedbacks com alguma resistencia inicial'
  | 'Tem dificuldade em aceitar feedbacks ou opinioes diferentes'
  | 'Frequentemente reage de forma defensiva ou conflituosa'
type RelationalClassification =
  | 'Referencia positiva de relacionamento e trabalho em equipe'
  | 'Relacionamento acima da media'
  | 'Relacionamento adequado'
  | 'Necessita desenvolver competencias relacionais'
  | 'Necessita acompanhamento prioritario em relacionamento interpessoal'

type Person = {
  id: string
  name: string
  role: string
  training: string
  nextReview: string
  avatar?: string
  unit?: string
  score?: number
  leadershipPercent?: number
  leadershipLevel?: LeadershipLevel
  leadershipProfile?: LeadershipProfile
  leadershipPotential?: LeadershipPotential
  leadershipReadiness?: LeadershipReadiness
  leaderDevelopment?: LeaderDevelopment
  temperamentPrimary?: TemperamentType
  temperamentPrimaryPercent?: number
  temperamentSecondary?: TemperamentType
  temperamentSecondaryPercent?: number
  temperamentReason?: string
  behavioralProfile?: BehavioralProfile
  behavioralProfilePercent?: number
  decisionStyle?: DecisionStyle
  interpersonalLevel?: InterpersonalLevel
  convivenceLevel?: ConvivenceLevel
  collaborationLevel?: CollaborationLevel
  relationalIntelligence?: RelationalIntelligence
  relationalClassification?: RelationalClassification
  pressureResponse?: PressureResponse
  productivityEfficiency?: number
  productivityQuality?: number
  productivityOrganization?: number
  productivityCommitment?: number
  productivityAutonomy?: number
  productivityIndex?: number
  productivityDiagnosis?: string
  pulse?: number
  attendance?: number
  workload?: number
  strengths?: string[]
  risks?: string[]
  nextAction?: string
  bio?: string
  email?: string
  phone?: string
  files?: string[]
  assessmentForm?: Record<string, unknown>
  driveSyncAt?: string
  driveSyncProvider?: string
  driveSyncFile?: string
}

type FinanceLine = {
  id: string
  label: string
  type: 'Receita' | 'Despesa'
  amount: number
  status: string
  due: string
}

type Asset = {
  id: string
  name: string
  location: string
  qty: number
  min: number
  status: string
  category?: string
  supplier?: string
  unitCost?: number
  lastMove?: string
  owner?: string
  nextAction?: string
}

type KnowledgeItem = {
  id: string
  title: string
  type: string
  owner: string
  status: string
}

type Automation = {
  id: string
  trigger: string
  action: string
  status: 'Ativa' | 'Rascunho'
}

type ManagementState = {
  work: WorkItem[]
  admissions: Admission[]
  people: Person[]
  finance: FinanceLine[]
  assets: Asset[]
  knowledge: KnowledgeItem[]
  automations: Automation[]
  updatedAt?: string
}

type WorkflowColumn = {
  id: string
  title: string
  color: string
}

type CalendarConnection = {
  id: string
  name: string
  source: string
  status: string
  sync: string
  color: string
}

type AgendaEvent = {
  id: string
  time: string
  title: string
  area: string
  source: string
  color: string
}

type WeeklyDay = {
  id: string
  label: string
  weekday: string
  load: number
  count: number
  focus: string
}

type SofiThread = {
  id: string
  title: string
  scope: string
  lastAction: string
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MANAGEMENT_CACHE_KEY = 'aps_edu_management_state_v2'
const WORKFLOW_COLUMNS_KEY = 'aps_edu_workflow_columns_v1'

const leadershipMaturityOptions: Array<{ value: LeadershipLevel; label: string; detail: string }> = [
  { value: 1, label: 'Executor', detail: 'Cumpre tarefas e depende de direcionamento.' },
  { value: 2, label: 'Colaborador', detail: 'Sugere melhorias e assume pequenas frentes.' },
  { value: 3, label: 'Lider Operacional', detail: 'Coordena pessoas e garante a execucao.' },
  { value: 4, label: 'Lider Estrategico', detail: 'Planeja, desenvolve pessoas e influencia a equipe.' },
  { value: 5, label: 'Lider Multiplicador', detail: 'Forma novos lideres e fortalece a cultura.' },
]

const leadershipProfileOptions: Array<{ value: LeadershipProfile; label: string; detail: string }> = [
  { value: 'Executor', label: 'Executor', detail: 'Foco em acao e entrega.' },
  { value: 'Entusiasta', label: 'Entusiasta', detail: 'Motiva pessoas e gera energia.' },
  { value: 'Relacional', label: 'Relacional', detail: 'Cria conexao e confianca.' },
  { value: 'Organizador', label: 'Organizador', detail: 'Processos, planejamento e controle.' },
  { value: 'Desenvolvedor', label: 'Desenvolvedor', detail: 'Forma pessoas e acompanha de perto.' },
  { value: 'Estrategico', label: 'Estrategico', detail: 'Visao de futuro e crescimento.' },
  { value: 'Influenciador', label: 'Influenciador', detail: 'Mobiliza equipes e inspira.' },
]

const leadershipPotentialOptions: Array<{ value: LeadershipPotential; label: string; detail: string }> = [
  { value: 'Baixo', label: 'Baixo', detail: 'Ainda precisa consolidar base.' },
  { value: 'Moderado', label: 'Moderado', detail: 'Sinaliza evolucao com suporte.' },
  { value: 'Alto', label: 'Alto', detail: 'Pronto para ganhar mais responsabilidades.' },
  { value: 'Muito Alto', label: 'Muito Alto', detail: 'Forte candidato a cargos maiores.' },
  { value: 'Excepcional', label: 'Excepcional', detail: 'Perfil raro de lideranca.' },
]

const leadershipReadinessOptions: Array<{ value: LeadershipReadiness; label: string; detail: string }> = [
  { value: 'Ainda nao demonstra perfil de lideranca', label: 'Ainda nao demonstra', detail: 'Precisa de base e direcionamento.' },
  { value: 'Potencial em desenvolvimento', label: 'Potencial em desenvolvimento', detail: 'Evolui com acompanhamento.' },
  { value: 'Pronto para liderar pequenas equipes', label: 'Pequenas equipes', detail: 'Ja pode coordenar rotinas simples.' },
  { value: 'Pronto para liderar setores/departamentos', label: 'Setores / departamentos', detail: 'Pronto para uma lideranca maior.' },
  { value: 'Pronto para liderar unidades ou grandes projetos', label: 'Unidades / grandes projetos', detail: 'Tem maturidade para amplitude institucional.' },
]

const leaderDevelopmentOptions: Array<{ value: LeaderDevelopment; label: string; detail: string }> = [
  { value: 'Nao desenvolve', label: 'Nao desenvolve', detail: 'Ainda nao forma outros lideres.' },
  { value: 'Desenvolve ocasionalmente', label: 'Ocasionalmente', detail: 'Ajuda pontualmente outros profissionais.' },
  { value: 'Desenvolve regularmente', label: 'Regularmente', detail: 'Acompanha e orienta com frequencia.' },
  { value: 'Forma novos lideres de maneira consistente', label: 'Forma lideres', detail: 'Prepara novos lideres de forma constante.' },
  { value: 'Multiplica lideres e fortalece a cultura institucional', label: 'Multiplica lideres', detail: 'Cria legado e cultura de sucessao.' },
]

const temperamentOptions: Array<{ value: TemperamentType; label: string; detail: string }> = [
  { value: 'Sanguineo', label: 'Sanguineo', detail: 'Comunicativo, entusiasmado e sociavel.' },
  { value: 'Colerico', label: 'Colerico', detail: 'Decisivo, competitivo e orientado a resultados.' },
  { value: 'Fleumatico', label: 'Fleumatico', detail: 'Calmo, estavel e bom mediador.' },
  { value: 'Melancolico', label: 'Melancolico', detail: 'Analitico, organizado e detalhista.' },
]

const behavioralProfileOptions: Array<{ value: BehavioralProfile; label: string; detail: string }> = [
  { value: 'Executor', label: 'Executor', detail: 'Faz acontecer e resolve rapido.' },
  { value: 'Influenciador', label: 'Influenciador', detail: 'Convence pessoas e comunica bem.' },
  { value: 'Analitico', label: 'Analitico', detail: 'Gosta de dados, processos e precisao.' },
  { value: 'Estavel', label: 'Estavel', detail: 'Mantem equilibrio e confianca.' },
]

const decisionStyleOptions: Array<{ value: DecisionStyle; label: string; detail: string }> = [
  { value: 'Decide rapidamente mesmo com poucas informacoes', label: 'Rapida', detail: 'Age com velocidade e firmeza.' },
  { value: 'Busca equilibrio entre velocidade e analise', label: 'Equilibrada', detail: 'Concilia rapidez e criterio.' },
  { value: 'Analisa profundamente antes de decidir', label: 'Profunda', detail: 'Pensa bastante antes de agir.' },
  { value: 'Prefere consultar outras pessoas antes de decidir', label: 'Consultiva', detail: 'Ouve outras vozes antes de fechar.' },
]

const interpersonalLevelOptions: Array<{ value: InterpersonalLevel; label: string; detail: string }> = [
  { value: 'Muito reservado', label: 'Muito reservado', detail: 'Baixa exposição e fala seletiva.' },
  { value: 'Reservado', label: 'Reservado', detail: 'Comunica com objetividade.' },
  { value: 'Equilibrado', label: 'Equilibrado', detail: 'Trânsito social saudável.' },
  { value: 'Comunicativo', label: 'Comunicativo', detail: 'Boa abertura e troca constante.' },
  { value: 'Extremamente comunicativo', label: 'Extremamente comunicativo', detail: 'Alta presença e expansividade.' },
]

const pressureResponseOptions: Array<{ value: PressureResponse; label: string; detail: string }> = [
  { value: 'Mantem a calma', label: 'Mantem a calma', detail: 'Sustenta estabilidade sob pressao.' },
  { value: 'Assume o controle', label: 'Assume o controle', detail: 'Centraliza e organiza a resposta.' },
  { value: 'Busca apoio da equipe', label: 'Busca apoio', detail: 'Ativa o coletivo rapidamente.' },
  { value: 'Torna-se mais analitico', label: 'Mais analitico', detail: 'Redobra a leitura tecnica.' },
  { value: 'Demonstra dificuldade sob pressao', label: 'Dificuldade', detail: 'Perde fluidez em cenarios tensos.' },
]

const collaborationOptions: Array<{ value: CollaborationLevel; label: string; detail: string }> = [
  { value: 'Atua como agregador da equipe', label: 'Agregador', detail: 'Cria conexao e unidade.' },
  { value: 'Colabora ativamente com os demais', label: 'Colabora ativamente', detail: 'Participa e contribui sempre.' },
  { value: 'Colabora quando solicitado', label: 'Quando solicitado', detail: 'Ajuda sob demanda.' },
  { value: 'Prefere trabalhar de forma individual', label: 'Individual', detail: 'Entrega sozinho com autonomia.' },
  { value: 'Demonstra resistencia ao trabalho em equipe', label: 'Resistencia', detail: 'Precisa de mediação e apoio.' },
]

const convivenceOptions: Array<{ value: ConvivenceLevel; label: string; detail: string }> = [
  { value: 'Muito facil de lidar', label: 'Muito facil', detail: 'Flexivel, receptivo e colaborativo.' },
  { value: 'Facil de lidar', label: 'Facil', detail: 'Boa convivencia e comunicacao adequada.' },
  { value: 'Moderadamente facil de lidar', label: 'Moderada', detail: 'Algumas particularidades sem comprometer.' },
  { value: 'Dificil de lidar em algumas situacoes', label: 'Dificil em alguns casos', detail: 'Pode reagir ou resistir em certos cenarios.' },
  { value: 'Frequentemente dificil de lidar', label: 'Frequentemente dificil', detail: 'Exige acompanhamento constante.' },
]

const relationalIntelligenceOptions: Array<{ value: RelationalIntelligence; label: string; detail: string }> = [
  { value: 'Recebe feedbacks com maturidade e busca crescimento', label: 'Maturidade alta', detail: 'Escuta e evolui com feedbacks.' },
  { value: 'Geralmente aceita feedbacks e faz ajustes', label: 'Aceita bem', detail: 'Faz ajustes quando orientado.' },
  { value: 'Aceita feedbacks com alguma resistencia inicial', label: 'Resistencia inicial', detail: 'Precisa de tempo para processar.' },
  { value: 'Tem dificuldade em aceitar feedbacks ou opinioes diferentes', label: 'Dificuldade', detail: 'Tem atrito com visoes distintas.' },
  { value: 'Frequentemente reage de forma defensiva ou conflituosa', label: 'Defensiva', detail: 'Reage sob tensão relacional.' },
]

const relationalClassificationOptions: Array<{ value: RelationalClassification; label: string; detail: string }> = [
  { value: 'Referencia positiva de relacionamento e trabalho em equipe', label: 'Referencia positiva', detail: 'Modelo de convivio e equipe.' },
  { value: 'Relacionamento acima da media', label: 'Acima da media', detail: 'Boa convivencia consistente.' },
  { value: 'Relacionamento adequado', label: 'Adequado', detail: 'Atende ao esperado.' },
  { value: 'Necessita desenvolver competencias relacionais', label: 'Desenvolver', detail: 'Precisa fortalecer relacoes.' },
  { value: 'Necessita acompanhamento prioritario em relacionamento interpessoal', label: 'Acompanhamento', detail: 'Prioridade em relacoes.' },
]

const productivityDiagnosisOptions = [
  { min: 90, label: 'Alta Performance', color: '#0ABD78' },
  { min: 80, label: 'Muito Bom', color: '#4A9EFF' },
  { min: 70, label: 'Adequado', color: '#F8A303' },
  { min: 60, label: 'Atenção', color: '#F97316' },
  { min: 0, label: 'Necessita Desenvolvimento', color: '#FF4757' },
]

const defaultWorkflowColumns: WorkflowColumn[] = [
  { id: 'novo', title: 'Novo', color: '#64748B' },
  { id: 'planejado', title: 'Planejado', color: '#4A9EFF' },
  { id: 'em-andamento', title: 'Em andamento', color: '#0ABD78' },
  { id: 'aprovacao', title: 'Aguardando aprovacao', color: '#F8A303' },
  { id: 'revisao', title: 'Em revisao', color: '#8B5CF6' },
  { id: 'concluido', title: 'Concluido', color: '#34D399' },
]

const fallbackState: ManagementState = {
  work: [
    {
      id: 'T-1024',
      title: 'Fechar roteiro de matriculas 2026',
      owner: 'Secretaria escolar',
      area: 'Matriculas',
      stage: 'Em andamento',
      priority: 'Alta',
      due: 'Hoje',
      project: 'Campanha 2026',
      description: 'Fechar argumentos, checklist de documentos e fluxo de retorno com familias.',
      attachments: ['roteiro-matriculas.docx', 'campanha-2026.pdf'],
      tags: ['familias', 'comercial'],
      participants: ['Marina Costa', 'Rafael Almeida'],
    },
    {
      id: 'T-1025',
      title: 'Revisar compras de tecnologia',
      owner: 'Operacao',
      area: 'Suprimentos',
      stage: 'Aguardando aprovacao',
      priority: 'Alta',
      due: 'Amanha',
      project: 'Infraestrutura escolar',
      description: 'Consolidar cotacoes, verba e justificativa para direcao.',
      attachments: ['cotacao-ti.xlsx'],
      tags: ['aprovacao', 'compras'],
      participants: ['Juliana Martins', 'Vinicius Evangelista'],
    },
    {
      id: 'T-1026',
      title: 'Preparar treinamento de coordenadores',
      owner: 'Pessoas',
      area: 'Treinamento',
      stage: 'Planejado',
      priority: 'Media',
      due: '17/06',
      project: 'Trilha de lideranca',
      description: 'Montar pauta, materiais e criterios de avaliacao.',
      attachments: ['trilha-coordenadores.pdf'],
      tags: ['lideranca'],
      participants: ['Marina Costa', 'Pessoas'],
    },
    {
      id: 'T-1027',
      title: 'Atualizar politica de atendimento familiar',
      owner: 'Direcao',
      area: 'Governanca',
      stage: 'Novo',
      priority: 'Media',
      due: 'Esta semana',
      project: 'Experiencia da familia',
      description: 'Ajustar tom institucional, tempos de retorno e canais oficiais.',
      attachments: ['politica-atendimento.docx'],
      tags: ['comunicacao'],
      participants: ['Direcao', 'Secretaria escolar'],
    },
    {
      id: 'T-1028',
      title: 'Concluir relatorio mensal de desempenho',
      owner: 'Gestao',
      area: 'Relatorios',
      stage: 'Em revisao',
      priority: 'Alta',
      due: '18/06',
      project: 'Fechamento mensal',
      description: 'Revisar notas, indicadores de unidades e versao executiva.',
      attachments: ['desempenho-maio.pptx'],
      tags: ['executivo'],
      participants: ['Gestao', 'Sofi IA'],
    },
  ],
  admissions: [
    { id: 'MAT-2041', family: 'Familia Silva', student: 'Pedro Silva - 6o ano', stage: 'Visita pedagogica', value: 1850, next: 'Confirmar presenca da familia' },
    { id: 'MAT-2042', family: 'Familia Andrade', student: 'Livia Andrade - 1o ano', stage: 'Proposta enviada', value: 1620, next: 'Enviar documentacao' },
    { id: 'MAT-2043', family: 'Familia Rocha', student: 'Emanuel Rocha - 4o ano', stage: 'Contato inicial', value: 1740, next: 'Agendar visita escolar' },
  ],
  people: [],
  finance: [
    { id: 'F-1', label: 'Matriculas previstas', type: 'Receita', amount: 3470, status: 'Previsto', due: 'Hoje' },
    { id: 'F-2', label: 'Compra de materiais pedagogicos', type: 'Despesa', amount: 980, status: 'A aprovar', due: 'Amanha' },
    { id: 'F-3', label: 'Repasse de eventos escolares', type: 'Receita', amount: 2200, status: 'Confirmado', due: '20/06' },
  ],
  assets: [
    { id: 'A-1', name: 'Kits de matricula', category: 'Material de secretaria', location: 'Secretaria APS', qty: 42, min: 60, status: 'Repor', supplier: 'Grafica parceira', unitCost: 18.9, lastMove: '11/06', owner: 'Secretaria', nextAction: 'Comprar 30 unidades para campanha 2026' },
    { id: 'A-2', name: 'Projetores multimidia', category: 'Tecnologia educacional', location: 'Sala de recursos', qty: 4, min: 5, status: 'Critico', supplier: 'TI regional', unitCost: 2490, lastMove: '08/06', owner: 'Operacao', nextAction: 'Abrir aprovacao de compra de 2 unidades' },
    { id: 'A-3', name: 'Chromebooks pedagogicos', category: 'Tecnologia educacional', location: 'Laboratorio movel', qty: 18, min: 16, status: 'Ok', supplier: 'Fornecedor homologado', unitCost: 1480, lastMove: '10/06', owner: 'Pedagogico', nextAction: 'Agendar conferencia patrimonial' },
  ],
  knowledge: [
    { id: 'D-1', title: 'Politica de matricula 2026', type: 'Documento', owner: 'Secretaria', status: 'Revisao' },
    { id: 'D-2', title: 'Ata do comite executivo', type: 'Nota', owner: 'Direcao', status: 'Publicada' },
    { id: 'D-3', title: 'Checklist de abertura semanal', type: 'Checklist', owner: 'Operacao', status: 'Ativo' },
  ],
  automations: [
    { id: 'AU-1', trigger: 'Tarefa vence hoje', action: 'Notificar responsavel e resumir risco para a direcao', status: 'Ativa' },
    { id: 'AU-2', trigger: 'Estoque abaixo do minimo', action: 'Criar solicitacao de compra e pedir aprovacao', status: 'Ativa' },
    { id: 'AU-3', trigger: 'Evento novo no Google', action: 'Sincronizar na agenda mestra da Central Operacional', status: 'Ativa' },
  ],
}

const calendarConnections: CalendarConnection[] = [
  { id: 'google', name: 'Google Calendar', source: 'Base principal', status: 'Conectado', sync: 'Agora', color: '#29ABE2' },
  { id: 'microsoft', name: 'Outlook / Microsoft 365', source: 'Calendario externo', status: 'Pendente', sync: 'Aguardando OAuth', color: '#4A9EFF' },
  { id: 'icloud', name: 'iCloud Calendar', source: 'Calendario externo', status: 'Pendente', sync: 'Aguardando app password', color: '#A78BFA' },
]

const baseAgenda: AgendaEvent[] = [
  { id: 'EV-1', time: '08:30', title: 'Abertura operacional e prioridades do dia', area: 'Central', source: 'Google', color: '#F8A303' },
  { id: 'EV-2', time: '09:30', title: 'Visitas de familias e pipeline de matriculas', area: 'Escola', source: 'Google', color: '#29ABE2' },
  { id: 'EV-3', time: '11:00', title: 'Despachos financeiros pendentes', area: 'Financeiro', source: 'Outlook', color: '#4A9EFF' },
  { id: 'EV-4', time: '14:00', title: 'Compras, estoque e patrimonio', area: 'Operacao', source: 'Google', color: '#E07B39' },
  { id: 'EV-5', time: '16:00', title: 'Pessoas, treinamento e acompanhamento', area: 'Pessoas', source: 'iCloud', color: '#8B5CF6' },
]

const weeklyPanoramaBase: WeeklyDay[] = [
  { id: 'seg', weekday: 'Seg', label: 'Hoje', load: 92, count: 8, focus: 'Governanca e agenda' },
  { id: 'ter', weekday: 'Ter', label: 'Amanha', load: 76, count: 6, focus: 'Matriculas e financeiro' },
  { id: 'qua', weekday: 'Qua', label: '18/06', load: 64, count: 5, focus: 'Pessoas e reunioes' },
  { id: 'qui', weekday: 'Qui', label: '19/06', load: 52, count: 4, focus: 'Backoffice escolar' },
  { id: 'sex', weekday: 'Sex', label: '20/06', load: 83, count: 7, focus: 'Fechamento semanal' },
]

const sofiThreadsBase: SofiThread[] = [
  { id: 'S-1', title: 'Comando do dia', scope: 'Agenda + prioridades', lastAction: 'Atualizado ha 5 min' },
  { id: 'S-2', title: 'Projeto Matriculas 2026', scope: 'Projeto / pasta', lastAction: '2 arquivos gerados' },
  { id: 'S-3', title: 'Financeiro executivo', scope: 'Despesas + aprovacoes', lastAction: '1 rascunho de e-mail' },
]

function openSofi(prompt: string) {
  window.dispatchEvent(new CustomEvent('aps:open-sofi', { detail: { prompt } }))
}

function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[1.35rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20 ${className}`}>{children}</section>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/25 ${props.className || ''}`} />
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function levelFromScore(score?: number): LeadershipLevel {
  if (!score || Number.isNaN(score)) return 3
  if (score >= 4.6) return 5
  if (score >= 4.1) return 4
  if (score >= 3.2) return 3
  if (score >= 2.2) return 2
  return 1
}

function inferLeadershipProfile(person: Partial<Person>): LeadershipProfile {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''}`.toLowerCase()
  if (text.includes('coorden') || text.includes('direcao') || text.includes('gestao')) return 'Estrategico'
  if (text.includes('secretaria') || text.includes('atendimento') || text.includes('matricula')) return 'Organizador'
  if (text.includes('operacao') || text.includes('suporte') || text.includes('processo')) return 'Executor'
  if (text.includes('pedagog') || text.includes('formacao') || text.includes('trein')) return 'Desenvolvedor'
  if (text.includes('famil') || text.includes('relacion') || text.includes('comunic')) return 'Relacional'
  return 'Entusiasta'
}

function inferLeadershipPotential(level: LeadershipLevel): LeadershipPotential {
  if (level >= 5) return 'Excepcional'
  if (level === 4) return 'Muito Alto'
  if (level === 3) return 'Alto'
  if (level === 2) return 'Moderado'
  return 'Baixo'
}

function inferLeadershipReadiness(level: LeadershipLevel): LeadershipReadiness {
  if (level >= 5) return 'Pronto para liderar unidades ou grandes projetos'
  if (level === 4) return 'Pronto para liderar setores/departamentos'
  if (level === 3) return 'Pronto para liderar pequenas equipes'
  if (level === 2) return 'Potencial em desenvolvimento'
  return 'Ainda nao demonstra perfil de lideranca'
}

function inferLeaderDevelopment(level: LeadershipLevel): LeaderDevelopment {
  if (level >= 5) return 'Multiplica lideres e fortalece a cultura institucional'
  if (level === 4) return 'Forma novos lideres de maneira consistente'
  if (level === 3) return 'Desenvolve regularmente'
  if (level === 2) return 'Desenvolve ocasionalmente'
  return 'Nao desenvolve'
}

function inferLeadershipPercent(person: Partial<Person>, level?: LeadershipLevel) {
  if (typeof person.leadershipPercent === 'number') return clampNumber(person.leadershipPercent, 0, 100)
  if (typeof person.score === 'number' && person.score > 0) return clampNumber(person.score * 20, 0, 100)
  if (level) return clampNumber(level * 20, 0, 100)
  return 60
}

function inferTemperament(person: Partial<Person>) {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''}`.toLowerCase()
  if (text.includes('comunic') || text.includes('famil') || text.includes('atendimento')) {
    return { primary: 'Sanguineo' as TemperamentType, secondary: 'Fleumatico' as TemperamentType, rationale: 'perfil comunicativo e relacional' }
  }
  if (text.includes('coord') || text.includes('gestao') || text.includes('direcao') || text.includes('lider')) {
    return { primary: 'Colerico' as TemperamentType, secondary: 'Melancolico' as TemperamentType, rationale: 'decisao, foco em resultado e estrutura' }
  }
  if (text.includes('anal') || text.includes('finance') || text.includes('planej') || text.includes('processo')) {
    return { primary: 'Melancolico' as TemperamentType, secondary: 'Colerico' as TemperamentType, rationale: 'analise, detalhe e controle' }
  }
  return { primary: 'Fleumatico' as TemperamentType, secondary: 'Sanguineo' as TemperamentType, rationale: 'estabilidade e equilibrio' }
}

function inferBehavioralProfile(person: Partial<Person>): BehavioralProfile {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''}`.toLowerCase()
  if (text.includes('anal') || text.includes('finance') || text.includes('contabil') || text.includes('auditoria')) return 'Analitico'
  if (text.includes('atendimento') || text.includes('famil') || text.includes('relacion') || text.includes('comunic')) return 'Influenciador'
  if (text.includes('rotina') || text.includes('operacao') || text.includes('secretaria') || text.includes('suporte')) return 'Executor'
  return 'Estavel'
}

function inferProductivityMetric(base: number, offset = 0) {
  return clampNumber(base + offset, 0, 100)
}

function inferProductivityIndex(metrics: Array<number | undefined>) {
  const values = metrics.filter((item): item is number => typeof item === 'number' && !Number.isNaN(item))
  if (!values.length) return 0
  return clampNumber(values.reduce((sum, value) => sum + value, 0) / values.length, 0, 100)
}

function inferProductivityDiagnosis(value: number) {
  return productivityDiagnosisOptions.find(item => value >= item.min) || productivityDiagnosisOptions[productivityDiagnosisOptions.length - 1]
}

function normalizePerson(person: Partial<Person>): Person {
  const baseLevel = person.leadershipLevel ? clampNumber(person.leadershipLevel, 1, 5) as LeadershipLevel : levelFromScore(person.score)
  const profile = (person.leadershipProfile && leadershipProfileOptions.some(option => option.value === person.leadershipProfile))
    ? person.leadershipProfile
    : inferLeadershipProfile(person)
  const potential = (person.leadershipPotential && leadershipPotentialOptions.some(option => option.value === person.leadershipPotential))
    ? person.leadershipPotential
    : inferLeadershipPotential(baseLevel)
  const readiness = (person.leadershipReadiness && leadershipReadinessOptions.some(option => option.value === person.leadershipReadiness))
    ? person.leadershipReadiness
    : inferLeadershipReadiness(baseLevel)
  const development = (person.leaderDevelopment && leaderDevelopmentOptions.some(option => option.value === person.leaderDevelopment))
    ? person.leaderDevelopment
    : inferLeaderDevelopment(baseLevel)
  const temperament = inferTemperament(person)
  const temperamentPrimary = (person.temperamentPrimary && temperamentOptions.some(option => option.value === person.temperamentPrimary))
    ? person.temperamentPrimary
    : temperament.primary
  const temperamentSecondary = (person.temperamentSecondary && temperamentOptions.some(option => option.value === person.temperamentSecondary))
    ? person.temperamentSecondary
    : temperament.secondary
  const behavioralProfile = (person.behavioralProfile && behavioralProfileOptions.some(option => option.value === person.behavioralProfile))
    ? person.behavioralProfile
    : inferBehavioralProfile(person)
  const productivityEfficiency = clampNumber(typeof person.productivityEfficiency === 'number' ? person.productivityEfficiency : inferProductivityMetric((person.score || 4) * 20, 3), 0, 100)
  const productivityQuality = clampNumber(typeof person.productivityQuality === 'number' ? person.productivityQuality : inferProductivityMetric((person.score || 4) * 20, -1), 0, 100)
  const productivityOrganization = clampNumber(typeof person.productivityOrganization === 'number' ? person.productivityOrganization : inferProductivityMetric((person.score || 4) * 20, -2), 0, 100)
  const productivityCommitment = clampNumber(typeof person.productivityCommitment === 'number' ? person.productivityCommitment : inferProductivityMetric(person.attendance || 90, 0), 0, 100)
  const productivityAutonomy = clampNumber(typeof person.productivityAutonomy === 'number' ? person.productivityAutonomy : inferProductivityMetric(person.workload || 70, -4), 0, 100)
  const productivityIndex = typeof person.productivityIndex === 'number'
    ? clampNumber(person.productivityIndex, 0, 100)
    : inferProductivityIndex([productivityEfficiency, productivityQuality, productivityOrganization, productivityCommitment, productivityAutonomy])
  const productivityDiagnosis = person.productivityDiagnosis || inferProductivityDiagnosis(productivityIndex).label

  return {
    id: person.id || `P-${Math.random().toString(36).slice(2, 8)}`,
    name: person.name || 'Sem nome',
    role: person.role || 'Sem cargo',
    training: person.training || 'Trilha de integracao',
    nextReview: person.nextReview || 'Em breve',
    avatar: person.avatar,
    unit: person.unit,
    score: typeof person.score === 'number' ? person.score : 0,
    leadershipPercent: inferLeadershipPercent(person, baseLevel),
    leadershipLevel: baseLevel,
    leadershipProfile: profile,
    leadershipPotential: potential,
    leadershipReadiness: readiness,
    leaderDevelopment: development,
    temperamentPrimary,
    temperamentPrimaryPercent: typeof person.temperamentPrimaryPercent === 'number' ? clampNumber(person.temperamentPrimaryPercent, 0, 100) : 70,
    temperamentSecondary,
    temperamentSecondaryPercent: typeof person.temperamentSecondaryPercent === 'number' ? clampNumber(person.temperamentSecondaryPercent, 0, 100) : 30,
    temperamentReason: person.temperamentReason || temperament.rationale,
    behavioralProfile,
    behavioralProfilePercent: typeof person.behavioralProfilePercent === 'number' ? clampNumber(person.behavioralProfilePercent, 0, 100) : 75,
    decisionStyle: person.decisionStyle || 'Busca equilibrio entre velocidade e analise',
    interpersonalLevel: person.interpersonalLevel || 'Equilibrado',
    convivenceLevel: person.convivenceLevel || 'Facil de lidar',
    collaborationLevel: person.collaborationLevel || 'Colabora ativamente com os demais',
    relationalIntelligence: person.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes',
    relationalClassification: person.relationalClassification || 'Relacionamento adequado',
    pressureResponse: person.pressureResponse || 'Mantem a calma',
    productivityEfficiency,
    productivityQuality,
    productivityOrganization,
    productivityCommitment,
    productivityAutonomy,
    productivityIndex,
    productivityDiagnosis,
    pulse: typeof person.pulse === 'number' ? person.pulse : undefined,
    attendance: typeof person.attendance === 'number' ? person.attendance : undefined,
    workload: typeof person.workload === 'number' ? person.workload : undefined,
    strengths: person.strengths || [],
    risks: person.risks || [],
    nextAction: person.nextAction || 'Acompanhar evolucao da lideranca',
    bio: person.bio || '',
    email: person.email || '',
    phone: person.phone || '',
    files: person.files || [],
  }
}

function priorityColor(value: Priority) {
  if (value === 'Alta') return '#FF4757'
  if (value === 'Media') return '#F8A303'
  return '#0ABD78'
}

function readWorkflowColumns() {
  try {
    const raw = localStorage.getItem(WORKFLOW_COLUMNS_KEY)
    if (!raw) return defaultWorkflowColumns
    const parsed = JSON.parse(raw) as WorkflowColumn[]
    return parsed.length ? parsed : defaultWorkflowColumns
  } catch {
    return defaultWorkflowColumns
  }
}

function saveWorkflowColumns(columns: WorkflowColumn[]) {
  try {
    localStorage.setItem(WORKFLOW_COLUMNS_KEY, JSON.stringify(columns))
  } catch {}
}

function normalizeStageId(value: string, columns: WorkflowColumn[]) {
  const existing = columns.find(column => column.title.toLowerCase() === value.toLowerCase() || column.id === value)
  if (existing) return existing.title
  return value
}

function hydratedState(raw: Partial<ManagementState>, columns: WorkflowColumn[]) {
  const work = (raw.work?.length ? raw.work : fallbackState.work).map((item, index) => ({
    ...fallbackState.work[index % fallbackState.work.length],
    ...item,
    stage: normalizeStageId(item.stage || fallbackState.work[index % fallbackState.work.length].stage, columns),
    attachments: item.attachments?.length ? item.attachments : fallbackState.work[index % fallbackState.work.length].attachments || [],
    tags: item.tags?.length ? item.tags : fallbackState.work[index % fallbackState.work.length].tags || [],
    participants: item.participants?.length ? item.participants : fallbackState.work[index % fallbackState.work.length].participants || [],
  }))

  return {
    ...fallbackState,
    ...raw,
    work,
    admissions: raw.admissions?.length ? raw.admissions : fallbackState.admissions,
    people: Array.isArray(raw.people)
      ? raw.people.map((item, index) => normalizePerson({ ...(fallbackState.people[index % Math.max(1, fallbackState.people.length)] || {}), ...item }))
      : fallbackState.people.map(person => normalizePerson(person)),
    finance: raw.finance?.length ? raw.finance : fallbackState.finance,
    assets: raw.assets?.length ? raw.assets.map((item, index) => ({ ...fallbackState.assets[index % fallbackState.assets.length], ...item })) : fallbackState.assets,
    knowledge: raw.knowledge?.length ? raw.knowledge : fallbackState.knowledge,
    automations: raw.automations?.length ? raw.automations : fallbackState.automations,
  }
}

export default function WorldClassOperations({
  forcedView,
}: {
  forcedView?: 'agenda' | 'kanban' | 'escolar' | 'pessoas' | 'sofi'
} = {}) {
  const activeView = forcedView || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') || 'agenda' : 'agenda')
  const [state, setState] = useState<ManagementState>(fallbackState)
  const [workflowColumns, setWorkflowColumns] = useState<WorkflowColumn[]>(defaultWorkflowColumns)
  const [source, setSource] = useState<'api' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickOwner, setQuickOwner] = useState('Vinicius')
  const [quickProject, setQuickProject] = useState('Operacao do dia')
  const [quickAttachment, setQuickAttachment] = useState('')

  const totals = useMemo(() => {
    const revenue = state.finance.filter(item => item.type === 'Receita').reduce((sum, item) => sum + item.amount, 0)
    const expense = state.finance.filter(item => item.type === 'Despesa').reduce((sum, item) => sum + item.amount, 0)
    const criticalAssets = state.assets.filter(item => item.qty <= item.min).length
    const todayTasks = state.work.filter(item => item.due === 'Hoje').length
    const peoplePulse = Math.round(state.people.reduce((sum, item) => sum + (item.pulse || 0), 0) / Math.max(1, state.people.length))
    return { revenue, expense, balance: revenue - expense, criticalAssets, todayTasks, peoplePulse }
  }, [state])

  const agendaEvents = useMemo(() => {
    const derived = state.work
      .filter(item => item.due === 'Hoje')
      .slice(0, 4)
      .map((item, index) => ({
        id: `${item.id}-agenda`,
        time: `${17 + index}:00`,
        title: item.title,
        area: item.area,
        source: 'APS',
        color: priorityColor(item.priority),
      }))
    return [...baseAgenda, ...derived]
  }, [state.work])

  const weeklyPanorama = useMemo(() => {
    return weeklyPanoramaBase.map((day, index) => ({
      ...day,
      count: day.count + (index === 0 ? state.work.filter(item => item.due === 'Hoje').length : 0),
    }))
  }, [state.work])

  const sofiContext = useMemo(() => {
    return `Sofi, atue como chefe da Central Operacional. Contexto completo: ${JSON.stringify({
      tarefas: state.work,
      agenda: agendaEvents,
      matriculas: state.admissions,
      financeiro: state.finance,
      pessoas: state.people,
      estoque: state.assets,
      documentos: state.knowledge,
      automacoes: state.automations,
    })}`
  }, [agendaEvents, state])

  function readLocalState() {
    try {
      const raw = localStorage.getItem(MANAGEMENT_CACHE_KEY)
      return raw ? hydratedState(JSON.parse(raw), workflowColumns) : hydratedState(fallbackState, workflowColumns)
    } catch {
      return hydratedState(fallbackState, workflowColumns)
    }
  }

  function saveLocalState(next: ManagementState) {
    try {
      localStorage.setItem(MANAGEMENT_CACHE_KEY, JSON.stringify(next))
    } catch {}
  }

  function updateLocal(updater: (current: ManagementState) => ManagementState) {
    setState(current => {
      const next = updater(current)
      saveLocalState(next)
      return next
    })
    setSource('local')
  }

  function applyState(next: ManagementState, columns: WorkflowColumn[]) {
    const hydrated = hydratedState(next, columns)
    setState(hydrated)
    saveLocalState(hydrated)
    setSource('api')
  }

  async function loadManagement(columns: WorkflowColumn[]) {
    setLoading(true)
    try {
      const res = await api.get('/management')
      applyState(res.data, columns)
    } catch {
      setState(readLocalState())
      setSource('local')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const columns = readWorkflowColumns()
    setWorkflowColumns(columns)
    loadManagement(columns)
  }, [])

  useEffect(() => {
    const handleManagementUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ManagementState>).detail
      if (detail) setState(hydratedState(detail, workflowColumns))
    }
    window.addEventListener('management_state_updated', handleManagementUpdate as EventListener)
    return () => window.removeEventListener('management_state_updated', handleManagementUpdate as EventListener)
  }, [workflowColumns])

  function persistColumns(next: WorkflowColumn[]) {
    setWorkflowColumns(next)
    saveWorkflowColumns(next)
  }

  async function addQuickWork(e: React.FormEvent) {
    e.preventDefault()
    if (!quickTitle.trim()) return

    const payload: WorkItem = {
      id: `T-${Date.now()}`,
      title: quickTitle.trim(),
      owner: quickOwner.trim() || 'Sofi',
      area: activeView === 'escolar' ? 'Escola' : activeView === 'pessoas' ? 'Pessoas' : 'Central',
      stage: workflowColumns[0]?.title || 'Novo',
      priority: 'Alta',
      due: 'Hoje',
      project: quickProject.trim() || 'Operacao do dia',
      description: 'Item criado rapidamente pela Central Operacional.',
      attachments: quickAttachment.trim() ? [quickAttachment.trim()] : [],
      tags: ['rapido'],
      participants: [quickOwner.trim() || 'Sofi IA'],
    }

    setQuickTitle('')
    setQuickAttachment('')

    try {
      const res = await api.post('/management/work', {
        title: payload.title,
        owner: payload.owner,
        area: payload.area,
        priority: payload.priority,
        due: payload.due,
      })
      applyState(res.data, workflowColumns)
    } catch {
      updateLocal(prev => ({ ...prev, work: [payload, ...prev.work] }))
    }
  }

  async function updateWorkItem(itemId: string, patch: Partial<WorkItem>) {
    try {
      const res = await api.patch(`/management/work/${itemId}`, patch)
      applyState(res.data, workflowColumns)
    } catch {
      updateLocal(prev => ({
        ...prev,
        work: prev.work.map(item => (item.id === itemId ? { ...item, ...patch } : item)),
      }))
    }
  }

  function moveWork(itemId: string, stage: string) {
    void updateWorkItem(itemId, { stage })
  }

  function moveColumn(columnId: string, targetColumnId: string) {
    if (columnId === targetColumnId) return
    const currentIndex = workflowColumns.findIndex(column => column.id === columnId)
    const targetIndex = workflowColumns.findIndex(column => column.id === targetColumnId)
    if (currentIndex < 0 || targetIndex < 0) return

    const nextColumns = [...workflowColumns]
    const [moving] = nextColumns.splice(currentIndex, 1)
    nextColumns.splice(targetIndex, 0, moving)
    persistColumns(nextColumns)
  }

  function renameColumn(columnId: string, title: string) {
    if (!title.trim()) return
    const current = workflowColumns.find(column => column.id === columnId)
    if (!current) return

    const nextColumns = workflowColumns.map(column => column.id === columnId ? { ...column, title: title.trim() } : column)
    persistColumns(nextColumns)
    updateLocal(prev => ({
      ...prev,
      work: prev.work.map(item => item.stage === current.title ? { ...item, stage: title.trim() } : item),
    }))
  }

  function recolorColumn(columnId: string, color: string) {
    persistColumns(workflowColumns.map(column => column.id === columnId ? { ...column, color } : column))
  }

  function addWorkflowColumn() {
    const index = workflowColumns.length + 1
    persistColumns([
      ...workflowColumns,
      { id: `custom-${Date.now()}`, title: `Nova etapa ${index}`, color: '#38BDF8' },
    ])
  }

  function addAdmission() {
    updateLocal(prev => ({
      ...prev,
      admissions: [
        {
          id: `MAT-${Date.now()}`,
          family: 'Nova familia',
          student: 'Aluno em qualificacao',
          stage: 'Contato inicial',
          value: 1500,
          next: 'Agendar visita pedagogica',
        },
        ...prev.admissions,
      ],
    }))
  }

  function addFinance(type: FinanceLine['type']) {
    updateLocal(prev => ({
      ...prev,
      finance: [
        {
          id: `F-${Date.now()}`,
          label: type === 'Receita' ? 'Nova receita escolar' : 'Nova despesa operacional',
          type,
          amount: type === 'Receita' ? 1200 : 450,
          status: type === 'Receita' ? 'Previsto' : 'A aprovar',
          due: 'Esta semana',
        },
        ...prev.finance,
      ],
    }))
  }

  function adjustAsset(id: string, delta: number) {
    updateLocal(prev => ({
      ...prev,
      assets: prev.assets.map(item => {
        if (item.id !== id) return item
        const qty = Math.max(0, item.qty + delta)
        return {
          ...item,
          qty,
          status: qty <= item.min ? 'Repor' : 'Ok',
          lastMove: 'Agora',
        }
      }),
    }))
  }

  function addKnowledge(type: string) {
    updateLocal(prev => ({
      ...prev,
      knowledge: [
        {
          id: `D-${Date.now()}`,
          title: type === 'E-mail' ? 'Rascunho criado pela Sofi' : 'Documento operacional em revisao',
          type,
          owner: 'Sofi IA',
          status: 'Rascunho',
        },
        ...prev.knowledge,
      ],
    }))
  }

  function createPeopleAction(person: Person, title: string) {
    updateLocal(prev => ({
      ...prev,
      work: [
        {
          id: `T-${Date.now()}`,
          title,
          owner: person.name,
          area: 'Pessoas',
          stage: workflowColumns[0]?.title || 'Novo',
          priority: (person.workload || 0) > 84 ? 'Alta' : 'Media',
          due: person.nextReview,
          project: 'Desenvolvimento',
          description: person.nextAction,
          attachments: [],
          tags: ['pessoas'],
        },
        ...prev.work,
      ],
    }))
  }

  async function createPeopleProfile(person: Partial<Person>) {
    try {
      const res = await api.post('/management/people', person)
      applyState(res.data, workflowColumns)
      return res.data?.people?.[0] || null
    } catch {
      const localPerson: Person = {
        id: person.id || `P-${Date.now()}`,
        name: person.name || 'Novo colaborador',
        role: person.role || 'Cargo em definicao',
        unit: person.unit || '',
        training: person.training || '',
        nextReview: person.nextReview || '',
        avatar: person.avatar || '',
        score: Number(person.score || 0),
        leadershipPercent: Number(person.leadershipPercent || 0),
        leadershipLevel: (person.leadershipLevel || 3) as LeadershipLevel,
        leadershipProfile: person.leadershipProfile || 'Executor',
        leadershipPotential: person.leadershipPotential || 'Alto',
        leadershipReadiness: person.leadershipReadiness || 'Potencial em desenvolvimento',
        leaderDevelopment: person.leaderDevelopment || 'Desenvolve regularmente',
        temperamentPrimary: person.temperamentPrimary || 'Fleumatico',
        temperamentPrimaryPercent: Number(person.temperamentPrimaryPercent || 70),
        temperamentSecondary: person.temperamentSecondary || 'Sanguineo',
        temperamentSecondaryPercent: Number(person.temperamentSecondaryPercent || 30),
        temperamentReason: person.temperamentReason || '',
        behavioralProfile: person.behavioralProfile || 'Estavel',
        behavioralProfilePercent: Number(person.behavioralProfilePercent || 75),
        decisionStyle: person.decisionStyle || 'Busca equilibrio entre velocidade e analise',
        interpersonalLevel: person.interpersonalLevel || 'Equilibrado',
        convivenceLevel: person.convivenceLevel || 'Facil de lidar',
        collaborationLevel: person.collaborationLevel || 'Colabora ativamente com os demais',
        relationalIntelligence: person.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes',
        relationalClassification: person.relationalClassification || 'Relacionamento adequado',
        pressureResponse: person.pressureResponse || 'Mantem a calma',
        productivityEfficiency: Number(person.productivityEfficiency || 0),
        productivityQuality: Number(person.productivityQuality || 0),
        productivityOrganization: Number(person.productivityOrganization || 0),
        productivityCommitment: Number(person.productivityCommitment || 0),
        productivityAutonomy: Number(person.productivityAutonomy || 0),
        productivityIndex: Number(person.productivityIndex || 0),
        productivityDiagnosis: person.productivityDiagnosis || '',
        pulse: Number(person.pulse || 0),
        attendance: Number(person.attendance || 0),
        workload: Number(person.workload || 0),
        strengths: person.strengths || [],
        risks: person.risks || [],
        nextAction: person.nextAction || '',
        bio: person.bio || '',
        email: person.email || '',
        phone: person.phone || '',
        files: person.files || [],
        assessmentForm: person.assessmentForm || {},
      }
      updateLocal(prev => ({ ...prev, people: [localPerson, ...prev.people] }))
      return localPerson
    }
  }

  async function updatePeopleProfile(personId: string, patch: Partial<Person>) {
    try {
      const res = await api.patch(`/management/people/${personId}`, patch)
      applyState(res.data, workflowColumns)
    } catch {
      updateLocal(prev => ({
        ...prev,
        people: prev.people.map(person => (person.id === personId ? { ...person, ...patch } : person)),
      }))
    }
  }

  return (
    <div className="space-y-5">
      {activeView === 'agenda' && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Agenda" value={agendaEvents.length.toString()} detail="blocos no dia" color="#F8A303" />
          <MetricCard label="Hoje" value={totals.todayTasks.toString()} detail="tarefas do dia" color="#FF4757" />
          <MetricCard label="Matriculas" value={money.format(state.admissions.reduce((sum, item) => sum + item.value, 0))} detail={`${state.admissions.length} familias`} color="#29ABE2" />
          <MetricCard label="Saldo" value={money.format(totals.balance)} detail="projecao da semana" color="#4A9EFF" />
          <MetricCard label="Pessoas" value={`${totals.peoplePulse}%`} detail="pulso medio" color="#8B5CF6" />
        </section>
      )}

      <form onSubmit={addQuickWork} className="grid gap-2 rounded-[1.2rem] border border-white/10 bg-[#080A12] p-3 xl:grid-cols-[minmax(260px,1.2fr)_180px_180px_180px_48px]">
        <Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Criar tarefa rapida..." />
        <Input value={quickOwner} onChange={event => setQuickOwner(event.target.value)} placeholder="Responsavel" />
        <Input value={quickProject} onChange={event => setQuickProject(event.target.value)} placeholder="Projeto / pasta" />
        <Input value={quickAttachment} onChange={event => setQuickAttachment(event.target.value)} placeholder="Arquivo ou link" />
        <button className="flex h-11 items-center justify-center rounded-2xl bg-[#F8A303] text-black">
          <PlusIcon className="h-5 w-5" />
        </button>
      </form>

      {(activeView === 'agenda' || activeView === 'kanban' || activeView === 'sofi') && (
        <CentralOperationalWorkspace
          state={state}
          source={source}
          loading={loading}
          workflowColumns={workflowColumns}
          agendaEvents={agendaEvents}
          weeklyPanorama={weeklyPanorama}
          activeView={activeView}
          onMoveWork={moveWork}
          onMoveColumn={moveColumn}
          onRenameColumn={renameColumn}
          onRecolorColumn={recolorColumn}
          onAddWorkflowColumn={addWorkflowColumn}
          onAddKnowledge={addKnowledge}
          onUpdateWork={updateWorkItem}
        />
      )}

      {activeView === 'escolar' && (
        <SchoolFinanceWorkspace
          state={state}
          onAddAdmission={addAdmission}
          onAddFinance={addFinance}
          onAdjustAsset={adjustAsset}
          onAddKnowledge={addKnowledge}
        />
      )}

      {activeView === 'pessoas' && (
        <PeopleWorkspaceExecutive
          people={state.people}
          work={state.work.filter(item => item.area === 'Pessoas' || item.area === 'Treinamento')}
          onCreateAction={createPeopleAction}
          onCreatePerson={createPeopleProfile}
          onUpdatePerson={updatePeopleProfile}
        />
      )}
    </div>
  )
}

function MetricCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-2 truncate text-2xl font-black leading-tight" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-white/38">{detail}</p>
    </div>
  )
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">{eyebrow}</p>}
        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function CentralOperationalWorkspace({
  state,
  source,
  loading,
  workflowColumns,
  agendaEvents,
  weeklyPanorama,
  activeView,
  onMoveWork,
  onMoveColumn,
  onRenameColumn,
  onRecolorColumn,
  onAddWorkflowColumn,
  onAddKnowledge,
  onUpdateWork,
}: {
  state: ManagementState
  source: string
  loading: boolean
  workflowColumns: WorkflowColumn[]
  agendaEvents: AgendaEvent[]
  weeklyPanorama: WeeklyDay[]
  activeView: string
  onMoveWork: (id: string, stage: string) => void
  onMoveColumn: (columnId: string, targetColumnId: string) => void
  onRenameColumn: (columnId: string, title: string) => void
  onRecolorColumn: (columnId: string, color: string) => void
  onAddWorkflowColumn: () => void
  onAddKnowledge: (type: string) => void
  onUpdateWork: (itemId: string, patch: Partial<WorkItem>) => Promise<void> | void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)
  const [boardView, setBoardView] = useState<'kanban' | 'lista'>('kanban')
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [workDraft, setWorkDraft] = useState<WorkItem | null>(null)

  const selectedWork = useMemo(
    () => state.work.find(item => item.id === selectedWorkId) || null,
    [state.work, selectedWorkId],
  )

  useEffect(() => {
    if (!selectedWork) {
      setWorkDraft(null)
      return
    }

    setWorkDraft({
      ...selectedWork,
      attachments: selectedWork.attachments || [],
      tags: selectedWork.tags || [],
      participants: selectedWork.participants || [],
    })
  }, [selectedWork])

  function openWorkDetails(item: WorkItem) {
    setSelectedWorkId(item.id)
  }

  function closeWorkDetails() {
    setSelectedWorkId(null)
  }

  function setDraftField<K extends keyof WorkItem>(field: K, value: WorkItem[K]) {
    setWorkDraft(current => (current ? { ...current, [field]: value } : current))
  }

  function parseList(value: string) {
    return value
      .split(/[,;\n]/g)
      .map(item => item.trim())
      .filter(Boolean)
  }

  function listText(value?: string[]) {
    return (value || []).join(', ')
  }

  async function saveWorkDraft() {
    if (!workDraft) return
    await onUpdateWork(workDraft.id, {
      title: workDraft.title.trim(),
      owner: workDraft.owner.trim(),
      area: workDraft.area.trim(),
      stage: workDraft.stage.trim(),
      priority: workDraft.priority,
      due: workDraft.due.trim(),
      project: workDraft.project?.trim() || '',
      description: workDraft.description?.trim() || '',
      attachments: parseList(listText(workDraft.attachments)),
      tags: parseList(listText(workDraft.tags)),
      participants: parseList(listText(workDraft.participants)),
    })
    closeWorkDetails()
  }

  return (
    <section className="space-y-5">
      {activeView === 'agenda' && (
        <>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_420px]">
            <Surface className="overflow-hidden">
              <div className="p-5 xl:p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Central executiva</p>
                <h2 className="mt-2 text-2xl font-black text-white">Agenda, tarefas e decis?es em uma leitura ?nica</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/55">
                  {agendaEvents.length} compromissos carregados ? {weeklyPanorama.length} blocos do panorama semanal ? {workflowColumns.length} etapas ativas.
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Agenda</p>
                    <p className="mt-3 text-3xl font-black text-[#F8A303]">{agendaEvents.length}</p>
                    <p className="mt-1 text-sm font-semibold text-white/55">compromissos sincronizados</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Panorama</p>
                    <p className="mt-3 text-3xl font-black text-[#8B5CF6]">{weeklyPanorama.length}</p>
                    <p className="mt-1 text-sm font-semibold text-white/55">dias monitorados na semana</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Fluxo</p>
                    <p className="mt-3 text-3xl font-black text-[#0ABD78]">{workflowColumns.length}</p>
                    <p className="mt-1 text-sm font-semibold text-white/55">etapas de execu??o</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.55rem] border border-white/10 bg-gradient-to-r from-[#F8A303]/14 via-white/[0.03] to-white/[0.02] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Relat?rio central</p>
                      <p className="mt-2 text-sm font-black text-white">Leitura executiva consolidada</p>
                      <p className="mt-2 text-sm text-white/55">
                        Abra a vis?o de agenda para detalhar compromissos, decis?es, respons?veis e pr?ximos passos em uma leitura ?nica.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onAddKnowledge('agenda')}
                        className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
                      >
                        Abrir relat?rio
                      </button>
                      <button
                        onClick={() => onAddKnowledge('agenda-sofi')}
                        className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white"
                      >
                        Gerar com Sofi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Surface>

            <div className="hidden 2xl:block" />
          </div>

          <Surface className="overflow-hidden">
            <SectionHeader eyebrow="Panorama semanal" title="Carga, foco e distribuicao da semana" />
            <div className="grid gap-3 p-5 md:grid-cols-5">
              {weeklyPanorama.map(day => (
                <div key={day.id} className="rounded-3xl border border-white/10 bg-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{day.weekday}</p>
                      <p className="mt-1 text-lg font-black text-white">{day.label}</p>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-black text-white/60">{day.count} itens</span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-[#4A9EFF]" style={{ width: `${day.load}%` }} />
                  </div>
                  <p className="mt-3 text-sm font-black text-white">{day.load}%</p>
                  <p className="mt-1 text-xs text-white/38">{day.focus}</p>
                </div>
              ))}
            </div>
          </Surface>
        </>
      )}

      {activeView === 'sofi' && <SofiOperationsPanel onAddKnowledge={onAddKnowledge} />}

      {activeView === 'kanban' && (
        <Surface className="overflow-hidden">
          <SectionHeader
            eyebrow="Execucao"
            title="Kanban profissional de tarefas e projetos"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                  {([
                    { id: 'kanban', label: 'Kanban' },
                    { id: 'lista', label: 'Lista' },
                  ] as const).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setBoardView(item.id)}
                      className="h-9 rounded-xl px-3 text-xs font-black transition"
                      style={{ background: boardView === item.id ? '#F8A303' : 'transparent', color: boardView === item.id ? '#05070D' : 'rgba(255,255,255,0.55)' }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button onClick={onAddWorkflowColumn} className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">Nova etapa</button>
              </div>
            }
          />

      {boardView === 'kanban' ? (
            <div className="overflow-x-auto p-5">
              <div className="flex min-w-max gap-4 pb-2">
                {workflowColumns.map(column => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    items={state.work.filter(item => item.stage === column.title)}
                    draggingId={draggingId}
                    draggingColumnId={draggingColumnId}
                    onDragStart={setDraggingId}
                    onDragEnd={() => setDraggingId(null)}
                    onDropItem={onMoveWork}
                    onDragColumnStart={setDraggingColumnId}
                    onDragColumnEnd={() => setDraggingColumnId(null)}
                    onDropColumn={onMoveColumn}
                    onRename={onRenameColumn}
                    onRecolor={onRecolorColumn}
                    onOpenItem={openWorkDetails}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/10 p-5">
              {state.work.map(item => (
                <div
                  key={item.id}
                  onClick={() => openWorkDetails(item)}
                  className="grid w-full gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.045] lg:grid-cols-[minmax(0,1fr)_160px_120px_140px] lg:items-center"
                >
                  <div>
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-white/42">{item.owner} • {item.project || item.area}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-black text-white/60">{item.stage}</span>
                  <span className="text-sm font-black" style={{ color: priorityColor(item.priority) }}>{item.priority}</span>
                  <div className="flex items-center justify-start">
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        openSofi(`Sofi, assuma esta tarefa e execute o proximo passo: ${item.title}`)
                      }}
                      className="h-10 rounded-2xl bg-[#0ABD78] px-4 text-xs font-black text-black"
                    >
                      Executar com Sofi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      )}

      {selectedWorkId && workDraft && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-sm" onClick={closeWorkDetails}>
              <div
                className="max-h-[92vh] w-full max-w-[1160px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0A0D14] shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
                onClick={event => event.stopPropagation()}
              >
                <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/35">Ficha da atividade</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Input
                        value={workDraft.title}
                        onChange={event => setDraftField('title', event.target.value)}
                        className="h-12 min-w-[320px] flex-1 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-base font-black text-white"
                      />
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/60">{workDraft.stage}</span>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm text-white/52">
                      Clique para editar responsavel, prazo, participantes, selos, arquivos e o contexto operacional da demanda.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSofi(`Sofi, assuma esta demanda: ${workDraft.title}. Responsavel ${workDraft.owner}. Etapa ${workDraft.stage}. Prioridade ${workDraft.priority}.`)}
                      className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:border-white/20"
                    >
                      Abrir com Sofi
                    </button>
                    <button
                      type="button"
                      onClick={closeWorkDetails}
                      className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:border-white/20"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      onClick={saveWorkDraft}
                      className="h-11 rounded-2xl bg-[#F8A303] px-5 text-xs font-black text-black transition hover:brightness-110"
                    >
                      Salvar alteracoes
                    </button>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_380px]">
                  <div className="border-r border-white/10 p-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={workDraft.owner} onChange={event => setDraftField('owner', event.target.value)} placeholder="Responsavel" className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white" />
                      <Input value={workDraft.area} onChange={event => setDraftField('area', event.target.value)} placeholder="Area" className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white" />
                      <Input value={workDraft.project || ''} onChange={event => setDraftField('project', event.target.value)} placeholder="Projeto / pasta" className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white" />
                      <Input value={workDraft.due} onChange={event => setDraftField('due', event.target.value)} placeholder="Prazo" className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white" />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <select
                        value={workDraft.priority}
                        onChange={event => setDraftField('priority', event.target.value as Priority)}
                        className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white outline-none"
                      >
                        <option value="Baixa">Baixa</option>
                        <option value="Media">Media</option>
                        <option value="Alta">Alta</option>
                      </select>
                      <Input value={workDraft.stage} onChange={event => setDraftField('stage', event.target.value)} placeholder="Etapa" className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white" />
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <Input
                        value={listText(workDraft.participants)}
                        onChange={event => setDraftField('participants', parseList(event.target.value))}
                        placeholder="Participantes"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white"
                      />
                      <Input
                        value={listText(workDraft.tags)}
                        onChange={event => setDraftField('tags', parseList(event.target.value))}
                        placeholder="Selos / tags"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white"
                      />
                      <Input
                        value={listText(workDraft.attachments)}
                        onChange={event => setDraftField('attachments', parseList(event.target.value))}
                        placeholder="Arquivos ou links"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white"
                      />
                    </div>

                    <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Compartilhar demanda</p>
                        <span className="rounded-full bg-[#0ABD78]/15 px-2.5 py-1 text-[11px] font-black text-[#0ABD78]">Salvo em tempo real</span>
                      </div>
                      <textarea
                        value={workDraft.description || ''}
                        onChange={event => setDraftField('description', event.target.value)}
                        className="mt-3 min-h-[170px] w-full rounded-[1.35rem] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white outline-none placeholder:text-white/28"
                        placeholder="Descreva a atividade, o contexto, os participantes e o resultado esperado."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Resumo executivo</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Prioridade</p>
                          <p className="mt-2 text-sm font-black text-white" style={{ color: priorityColor(workDraft.priority) }}>{workDraft.priority}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Prazo</p>
                          <p className="mt-2 text-sm font-black text-white">{workDraft.due}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Participantes</p>
                          <p className="mt-2 text-sm font-black text-white">{workDraft.participants?.length || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Arquivos</p>
                          <p className="mt-2 text-sm font-black text-white">{workDraft.attachments?.length || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Acoes rapidas</p>
                      <div className="mt-3 grid gap-2">
                        <button
                          type="button"
                          onClick={() => openSofi(`Sofi, avance esta atividade dentro do fluxo: ${workDraft.title}. Contexto completo: ${workDraft.description || ''}`)}
                          className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-sm font-semibold text-white transition hover:border-white/20"
                        >
                          Avancar com Sofi
                        </button>
                        <button
                          type="button"
                          onClick={() => openSofi(`Sofi, gere um resumo executivo desta demanda: ${workDraft.title}. Inclua responsavel, prazo, selos, participantes e proximos passos.`)}
                          className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-sm font-semibold text-white transition hover:border-white/20"
                        >
                          Gerar resumo
                        </button>
                        <button
                          type="button"
                          onClick={() => openSofi(`Sofi, compartilhe esta tarefa com os participantes: ${(workDraft.participants || []).join(', ')}.`)}
                          className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-sm font-semibold text-white transition hover:border-white/20"
                        >
                          Compartilhar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}

function KanbanColumn({
  column,
  items,
  draggingId,
  draggingColumnId,
  onDragStart,
  onDragEnd,
  onDropItem,
  onDragColumnStart,
  onDragColumnEnd,
  onDropColumn,
  onRename,
  onRecolor,
  onOpenItem,
}: {
  column: WorkflowColumn
  items: WorkItem[]
  draggingId: string | null
  draggingColumnId: string | null
  onDragStart: (value: string) => void
  onDragEnd: () => void
  onDropItem: (id: string, stage: string) => void
  onDragColumnStart: (value: string) => void
  onDragColumnEnd: () => void
  onDropColumn: (columnId: string, targetColumnId: string) => void
  onRename: (columnId: string, title: string) => void
  onRecolor: (columnId: string, color: string) => void
  onOpenItem: (item: WorkItem) => void
}) {
  const [title, setTitle] = useState(column.title)

  useEffect(() => {
    setTitle(column.title)
  }, [column.title])

  const isColumnDragging = draggingColumnId === column.id

  return (
    <div
      className="w-[300px] shrink-0 rounded-[1.45rem] border border-white/10 bg-white/[0.025] p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.16)]"
      onDragOver={event => event.preventDefault()}
      onDrop={() => {
        if (draggingColumnId) onDropColumn(draggingColumnId, column.id)
        else if (draggingId) onDropItem(draggingId, column.title)
      }}
      style={{ opacity: isColumnDragging ? 0.72 : 1 }}
    >
      <div
        className="rounded-[1.1rem] border border-white/10 bg-white/[0.035] p-3 backdrop-blur-sm"
        style={{ boxShadow: `inset 0 2px 0 ${column.color}, 0 0 0 1px ${column.color}10` }}
      >
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            draggable
            onDragStart={() => onDragColumnStart(column.id)}
            onDragEnd={onDragColumnEnd}
            className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/48 transition hover:border-white/20 hover:text-white"
            aria-label={`Mover etapa ${column.title}`}
          >
            <Bars3Icon className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              onBlur={() => onRename(column.id, title)}
              className="h-10 rounded-2xl border-white/10 bg-white/[0.04] px-3 text-sm font-black tracking-wide"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-black text-white" style={{ background: `${column.color}18`, color: column.color }}>
                Selo
              </span>
              <span className="h-2 w-2 rounded-full" style={{ background: column.color }} />
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/28">Arraste a etapa ou os cards</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => {
                const next = prompt('Cor da etapa em hexadecimal', column.color)
                if (next) onRecolor(column.id, next)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20"
              aria-label={`Alterar cor de ${column.title}`}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: column.color }} />
            </button>
            <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs font-black text-white/60">{items.length}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {items.length === 0 && <p className="rounded-[1.15rem] border border-dashed border-white/10 bg-black/10 p-4 text-center text-xs font-bold text-white/28">Solte um card aqui</p>}
        {items.map(item => {
          const accent = priorityColor(item.priority)
          return (
            <button
              key={item.id}
              draggable
              onDragStart={() => onDragStart(item.id)}
              onDragEnd={onDragEnd}
              onClick={() => onOpenItem(item)}
              className="group w-full rounded-[1.2rem] border border-white/10 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
              style={{ boxShadow: `0 0 0 1px ${accent}12 inset` }}
            >
              <div className="mb-3 h-1.5 rounded-full" style={{ background: accent }} />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-black leading-snug text-white">{item.title}</p>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: accent, background: `${accent}18` }}>
                  {item.priority}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-white/42">
                <span>{item.owner}</span>
                <span>•</span>
                <span>{item.project || item.area}</span>
              </div>

              {item.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/58">{item.description}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-white/38">
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/70">{item.due}</span>
                {item.attachments?.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/70">
                    <PaperClipIcon className="h-3.5 w-3.5" />
                    {item.attachments.length} arquivos
                  </span>
                ) : null}
                {item.participants?.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/70">
                    <UserGroupIcon className="h-3.5 w-3.5" />
                    {item.participants.length} pessoas
                  </span>
                ) : null}
                {item.tags?.slice(0, 3).map(tag => (
                  <span key={tag} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/60">{tag}</span>
                ))}
              </div>

              {item.participants?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.participants.slice(0, 3).map(name => (
                    <span key={name} className="inline-flex h-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 text-[10px] font-black text-white/70">
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SofiOperationsPanel({ onAddKnowledge }: { onAddKnowledge: (type: string) => void }) {
  const [prompt, setPrompt] = useState('Analise meu calendario unificado, reorganize tarefas, destaque riscos e prepare os proximos passos do dia.')

  return (
    <Surface className="p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-[#F8A303]/30 bg-[#F8A303]/12 p-3">
          <SparklesIcon className="h-6 w-6 text-[#F8A303]" />
        </div>
        <div>
          <h3 className="font-black text-white">Sofi IA operadora</h3>
          <p className="text-xs font-semibold text-white/38">Chat persistente, projetos, pastas e execucao sobre o sistema inteiro.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sofiThreadsBase.map(thread => (
          <button key={thread.id} onClick={() => openSofi(`Abra a conversa "${thread.title}" e continue o trabalho com contexto operacional completo.`)} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-white/20">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-white">{thread.title}</p>
              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white/55">{thread.scope}</span>
            </div>
            <p className="mt-1 text-xs text-white/38">{thread.lastAction}</p>
          </button>
        ))}
      </div>

      <textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="mt-4 min-h-36 w-full rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none" />

      <div className="mt-3 grid gap-2">
        <button onClick={() => openSofi(prompt)} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F8A303] text-sm font-black text-black">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          Conversar com a Sofi
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => openSofi('Envie e-mails de follow-up para familias com propostas em aberto e traga um rascunho profissional.')} className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] text-xs font-black text-white">
            <EnvelopeIcon className="h-4 w-4" />
            E-mails
          </button>
          <button onClick={() => onAddKnowledge('Documento')} className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] text-xs font-black text-white">
            <FolderOpenIcon className="h-4 w-4" />
            Novo documento
          </button>
          <button onClick={() => openSofi('Crie ou ajuste compromissos na agenda principal conforme a fila do dia.')} className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] text-xs font-black text-white">
            <CalendarDaysIcon className="h-4 w-4" />
            Agenda
          </button>
          <button onClick={() => openSofi('Abra o Drive, organize arquivos do projeto atual e proponha a melhor estrutura de pastas.')} className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] text-xs font-black text-white">
            <Squares2X2Icon className="h-4 w-4" />
            Drive e pastas
          </button>
        </div>
      </div>
    </Surface>
  )
}

function CompactInsight({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color }}>{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-white/38">{detail}</p>
    </div>
  )
}

function SchoolFinanceWorkspace({
  state,
  onAddAdmission,
  onAddFinance,
  onAdjustAsset,
  onAddKnowledge,
}: {
  state: ManagementState
  onAddAdmission: () => void
  onAddFinance: (type: FinanceLine['type']) => void
  onAdjustAsset: (id: string, delta: number) => void
  onAddKnowledge: (type: string) => void
}) {
  const revenue = state.finance.filter(item => item.type === 'Receita').reduce((sum, item) => sum + item.amount, 0)
  const expense = state.finance.filter(item => item.type === 'Despesa').reduce((sum, item) => sum + item.amount, 0)
  const approvals = state.knowledge.filter(item => item.status.toLowerCase().includes('revis')).length
  const openAdmissions = state.admissions.filter(item => !item.stage.toLowerCase().includes('matr')).length
  const pipelineValue = state.admissions.reduce((sum, item) => sum + item.value, 0)

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CompactInsight label="Pipeline ativo" value={money.format(pipelineValue)} detail={`${openAdmissions} familias em avanço`} color="#0ABD78" />
        <CompactInsight label="Saldo previsto" value={money.format(revenue - expense)} detail={`${state.finance.length} lançamentos monitorados`} color="#4F8CFF" />
        <CompactInsight label="Aprovações" value={approvals.toString()} detail="documentos aguardando decisão" color="#F8A303" />
        <CompactInsight label="Patrimônio crítico" value={state.assets.filter(item => item.qty <= item.min).length.toString()} detail="itens abaixo do mínimo operacional" color="#FF8A47" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Gestao escolar" title="CRM de matriculas e jornada da familia" action={<button onClick={onAddAdmission} className="h-10 rounded-2xl bg-[#29ABE2] px-4 text-sm font-black text-black">Nova familia</button>} />
          <div className="divide-y divide-white/10">
            {state.admissions.map(item => (
              <div key={item.id} className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_200px_160px_180px] lg:items-center">
                <div>
                  <p className="font-black text-white">{item.family}</p>
                  <p className="mt-1 text-sm text-white/42">{item.student}</p>
                </div>
                <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-black text-white/60">{item.stage}</span>
                <span className="text-sm font-black text-[#0ABD78]">{money.format(item.value)}</span>
                <button onClick={() => openSofi(`Sofi, conduza o follow-up da familia ${item.family}. Etapa: ${item.stage}. Proxima acao: ${item.next}.`)} className="h-10 rounded-2xl bg-[#29ABE2]/15 px-4 text-xs font-black text-[#29ABE2]">Assumir com Sofi</button>
              </div>
            ))}
          </div>
        </Surface>

        <div className="space-y-5">
          <Surface className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-white">Financeiro escolar</h3>
              <div className="flex gap-2">
                <button onClick={() => onAddFinance('Receita')} className="h-9 rounded-xl bg-[#0ABD78] px-3 text-xs font-black text-black">Receita</button>
                <button onClick={() => onAddFinance('Despesa')} className="h-9 rounded-xl bg-[#FF4757] px-3 text-xs font-black text-white">Despesa</button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {state.finance.map(item => <FinanceRow key={item.id} item={item} />)}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniStat label="Receitas" value={money.format(revenue)} />
              <MiniStat label="Despesas" value={money.format(expense)} />
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-white">Documentos e aprovacoes</h3>
              <button onClick={() => onAddKnowledge('Documento')} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-white">Novo</button>
            </div>
            <div className="mt-4 space-y-3">
              {state.knowledge.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.title}</p>
                    <p className="text-xs text-white/35">{item.type} • {item.owner}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">{item.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#F8A303]/14 bg-[#F8A303]/8 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#FDC347]">Sofi executiva</p>
              <p className="mt-2 text-sm font-semibold text-white">Pode revisar contratos, gerar comunicados, montar régua de cobrança e preparar a pauta financeira da semana.</p>
              <button
                onClick={() => openSofi('Sofi, faça um parecer executivo da gestão escolar e financeira com prioridade em matrícula, caixa, aprovações e patrimônio crítico.')}
                className="mt-4 h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
              >
                Pedir parecer completo
              </button>
            </div>
          </Surface>
        </div>
      </div>

      <Surface className="overflow-hidden">
        <SectionHeader eyebrow="Estoque e patrimonio" title="Controle operacional de itens criticos" />
        <div className="grid gap-4 p-5 xl:grid-cols-3">
          {state.assets.map(item => <AssetCard key={item.id} item={item} onAdjustAsset={onAdjustAsset} />)}
        </div>
      </Surface>
    </section>
  )
}

function PeopleWorkspace({
  people,
  work,
  onCreateAction,
}: {
  people: Person[]
  work: WorkItem[]
  onCreateAction: (person: Person, title: string) => void
}) {
  const avgPulse = Math.round(people.reduce((sum, item) => sum + (item.pulse || 0), 0) / Math.max(1, people.length))
  const avgAttendance = Math.round(people.reduce((sum, item) => sum + (item.attendance || 0), 0) / Math.max(1, people.length))
  const overloadCount = people.filter(item => (item.workload || 0) >= 85).length
  const topScore = [...people].sort((a, b) => (b.score || 0) - (a.score || 0))[0]

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CompactInsight label="Pulso médio" value={`${avgPulse}%`} detail="clima e energia do time" color="#A78BFA" />
        <CompactInsight label="Presença média" value={`${avgAttendance}%`} detail="frequência consolidada" color="#38BDF8" />
        <CompactInsight label="Sobrecarga" value={overloadCount.toString()} detail="profissionais com carga alta" color="#FF6B6B" />
        <CompactInsight label="Destaque" value={topScore?.name || 'Equipe'} detail={topScore ? `${topScore.role} · nota ${topScore.score?.toFixed(1)}` : 'sem avaliação'} color="#F8A303" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Equipe" title="Profissionais com foto, indicadores e proximas acoes" />
          <div className="grid gap-4 p-5 xl:grid-cols-3">
            {people.map(item => <PersonCard key={item.id} person={item} onCreateAction={onCreateAction} />)}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Fila de pessoas" title="Acoes abertas" />
          <div className="divide-y divide-white/10">
            {work.length === 0 && <p className="p-5 text-sm text-white/38">Nenhuma acao de pessoas em aberto.</p>}
            {work.map(item => (
              <div key={item.id} className="p-4">
                <p className="font-black text-white">{item.title}</p>
                <p className="mt-1 text-xs text-white/38">{item.owner} • {item.due}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function PeopleWorkspacePremium({
  people,
  work,
  onCreateAction,
  onUpdatePerson,
}: {
  people: Person[]
  work: WorkItem[]
  onCreateAction: (person: Person, title: string) => void
  onUpdatePerson: (personId: string, patch: Partial<Person>) => void | Promise<void>
}) {
  const [roleFilter, setRoleFilter] = useState('Todos')
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || '')
  const [draft, setDraft] = useState<Person | null>(people[0] || null)
  const [fileInput, setFileInput] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'resumo' | 'editar' | 'arquivos' | 'relatorios'>('resumo')
  const [draftDirty, setDraftDirty] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  useEffect(() => {
    if (!people.length) return
    if (!selectedPersonId || !people.some(person => person.id === selectedPersonId)) {
      setSelectedPersonId(people[0].id)
    }
  }, [people, selectedPersonId])

  useEffect(() => {
    const next = people.find(person => person.id === selectedPersonId) || people[0] || null
    setDraft(next ? { ...next, files: [...(next.files || [])] } : null)
    setDraftDirty(false)
  }, [people, selectedPersonId])

  useEffect(() => {
    if (!drawerOpen || !draft || !draftDirty) return
    const timer = window.setTimeout(() => {
      void saveDraft(true)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [draft, drawerOpen, draftDirty])

  const roleTabs = useMemo(() => {
    const items = people.map(person => person.unit || person.role).filter(Boolean)
    return ['Todos', ...Array.from(new Set(items))]
  }, [people])

  const filteredPeople = useMemo(() => {
    if (roleFilter === 'Todos') return people
    return people.filter(person => {
      const bucket = person.unit || person.role
      return bucket?.toLowerCase().includes(roleFilter.toLowerCase()) || person.role.toLowerCase().includes(roleFilter.toLowerCase())
    })
  }, [people, roleFilter])

  const lineupPeople = useMemo(
    () => [...filteredPeople].sort((a, b) => (b.leadershipPercent ?? 0) - (a.leadershipPercent ?? 0) || (b.score || 0) - (a.score || 0)),
    [filteredPeople]
  )

  const avgLeadership = Math.round(
    people.reduce((sum, item) => sum + (item.leadershipPercent ?? Math.round((item.score || 0) * 20)), 0) / Math.max(1, people.length)
  )
  const readyLeaders = people.filter(item => (item.leadershipLevel || 0) >= 4).length
  const leaderMultipliers = people.filter(item => {
    const rank = leaderDevelopmentOptions.findIndex(option => option.value === item.leaderDevelopment)
    return rank >= 3
  }).length
  const topLeader = [...people].sort((a, b) => (b.leadershipPercent ?? 0) - (a.leadershipPercent ?? 0) || (b.score || 0) - (a.score || 0))[0]
  const selectedPerson = draft || lineupPeople[0] || people[0] || null
  const recentWork = useMemo(
    () => work.filter((item, index, arr) => arr.findIndex(entry => entry.title === item.title && entry.owner === item.owner) === index).slice(0, 5),
    [work]
  )

  function syncDraftField<K extends keyof Person>(key: K, value: Person[K]) {
    setDraft(current => (current ? { ...current, [key]: value } : current))
    setDraftDirty(true)
  }

  function addDraftFile() {
    if (!fileInput.trim()) return
    setDraft(current => {
      if (!current) return current
      return { ...current, files: Array.from(new Set([...(current.files || []), fileInput.trim()])) }
    })
    setDraftDirty(true)
    setFileInput('')
  }

  function handleAvatarFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      setDraft(current => (current ? { ...current, avatar: result } : current))
      setDraftDirty(true)
    }
    reader.readAsDataURL(file)
  }

  function removeDraftFile(name: string) {
    setDraft(current => {
      if (!current) return current
      return { ...current, files: (current.files || []).filter(file => file !== name) }
    })
    setDraftDirty(true)
  }

  async function closeDrawer() {
    if (draftDirty) {
      await saveDraft(true)
    }
    setDrawerOpen(false)
  }

  async function saveDraft(silent = false) {
    if (!draft) return
    if (!silent) setSavingDraft(true)
    try {
      await onUpdatePerson(draft.id, {
        ...draft,
        score: Number(draft.score || 0),
        leadershipPercent: Number(draft.leadershipPercent || 0),
        leadershipLevel: (draft.leadershipLevel || 3) as LeadershipLevel,
        leadershipProfile: draft.leadershipProfile || 'Executor',
        leadershipPotential: draft.leadershipPotential || 'Alto',
        leadershipReadiness: draft.leadershipReadiness || 'Potencial em desenvolvimento',
        leaderDevelopment: draft.leaderDevelopment || 'Desenvolve regularmente',
        temperamentPrimary: draft.temperamentPrimary || 'Fleumatico',
        temperamentPrimaryPercent: Number(draft.temperamentPrimaryPercent || 0),
        temperamentSecondary: draft.temperamentSecondary || 'Sanguineo',
        temperamentSecondaryPercent: Number(draft.temperamentSecondaryPercent || 0),
        temperamentReason: draft.temperamentReason || '',
        behavioralProfile: draft.behavioralProfile || 'Estavel',
        behavioralProfilePercent: Number(draft.behavioralProfilePercent || 0),
        decisionStyle: draft.decisionStyle || 'Busca equilibrio entre velocidade e analise',
        interpersonalLevel: draft.interpersonalLevel || 'Equilibrado',
        convivenceLevel: draft.convivenceLevel || 'Facil de lidar',
        collaborationLevel: draft.collaborationLevel || 'Colabora ativamente com os demais',
        relationalIntelligence: draft.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes',
        relationalClassification: draft.relationalClassification || 'Relacionamento adequado',
        pressureResponse: draft.pressureResponse || 'Mantem a calma',
        productivityEfficiency: Number(draft.productivityEfficiency || 0),
        productivityQuality: Number(draft.productivityQuality || 0),
        productivityOrganization: Number(draft.productivityOrganization || 0),
        productivityCommitment: Number(draft.productivityCommitment || 0),
        productivityAutonomy: Number(draft.productivityAutonomy || 0),
        productivityIndex: Number(draft.productivityIndex || 0),
        productivityDiagnosis: draft.productivityDiagnosis || '',
        strengths: draft.strengths || [],
        risks: draft.risks || [],
        files: draft.files || [],
      })
      setDraftDirty(false)
    } finally {
      if (!silent) setSavingDraft(false)
    }
  }

  const selectedLeadershipPercent = selectedPerson?.leadershipPercent ?? Math.round((selectedPerson?.score || 0) * 20)
  const leadershipSummary = selectedPerson
    ? `${selectedPerson.name} atua como ${selectedPerson.role}. Nivel ${selectedPerson.leadershipLevel || 3}, perfil ${selectedPerson.leadershipProfile || 'Executor'}, potencial ${selectedPerson.leadershipPotential || 'Alto'} e prontidao ${selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}.`
    : 'Selecione um profissional para ler a lideranca, editar campos e abrir os relat?rios.'

  const leadershipSnapshot = [
    { label: 'Nivel', value: `N${selectedPerson?.leadershipLevel || 3}`, detail: 'maturidade atual' },
    { label: 'Perfil', value: selectedPerson?.leadershipProfile || 'Executor', detail: 'estilo predominante' },
    { label: 'Potencial', value: selectedPerson?.leadershipPotential || 'Alto', detail: 'escala de responsabilidade' },
    { label: 'Desenvolve', value: selectedPerson?.leaderDevelopment || 'Desenvolve regularmente', detail: 'efeito multiplicador' },
  ]

  const temperamentPrimaryPercent = selectedPerson?.temperamentPrimaryPercent ?? 70
  const temperamentSecondaryPercent = selectedPerson?.temperamentSecondaryPercent ?? 30
  const productivityIndex = selectedPerson?.productivityIndex ?? inferProductivityIndex([
    selectedPerson?.productivityEfficiency,
    selectedPerson?.productivityQuality,
    selectedPerson?.productivityOrganization,
    selectedPerson?.productivityCommitment,
    selectedPerson?.productivityAutonomy,
  ])
  const productivityDiagnosis = inferProductivityDiagnosis(productivityIndex)
  const temperamentSnapshot = selectedPerson ? [
    { label: 'Dominante', value: `${temperamentPrimaryPercent}% ${selectedPerson.temperamentPrimary || 'Fleumatico'}`, detail: selectedPerson.temperamentReason || 'perfil dominante' },
    { label: 'Secundario', value: `${temperamentSecondaryPercent}% ${selectedPerson.temperamentSecondary || 'Sanguineo'}`, detail: 'traços complementares' },
    { label: 'Perfil', value: selectedPerson.behavioralProfile || 'Estavel', detail: `${selectedPerson.behavioralProfilePercent || 75}% de aderencia comportamental` },
    { label: 'Leitura', value: selectedPerson.relationalClassification || 'Relacionamento adequado', detail: 'sintese relacional' },
  ] : []
  const productivitySnapshot = selectedPerson ? [
    { label: 'Eficiência', value: `${selectedPerson.productivityEfficiency ?? 0}%`, detail: 'capacidade de concluir tarefas' },
    { label: 'Qualidade', value: `${selectedPerson.productivityQuality ?? 0}%`, detail: 'confiabilidade das entregas' },
    { label: 'Organização', value: `${selectedPerson.productivityOrganization ?? 0}%`, detail: 'gestão de prioridades' },
    { label: 'Índice geral', value: `${productivityIndex}%`, detail: productivityDiagnosis.label },
  ] : []
  const executivePerson = selectedPerson || topLeader || people[0] || null
  const executiveLeadershipPercent = executivePerson?.leadershipPercent ?? 0
  const executiveTemperamentLabel = executivePerson ? `${executivePerson.temperamentPrimaryPercent ?? 70}% ${executivePerson.temperamentPrimary || 'Fleumatico'} / ${executivePerson.temperamentSecondaryPercent ?? 30}% ${executivePerson.temperamentSecondary || 'Sanguineo'}` : 'Sem leitura de temperamento'
  const executiveProductivityLabel = executivePerson ? `${executivePerson.productivityIndex ?? productivityIndex}% · ${inferProductivityDiagnosis(executivePerson.productivityIndex ?? productivityIndex).label}` : 'Sem índice de produtividade'

  return (
    <section className="space-y-5">
      <Surface className="overflow-hidden">
        <div className="p-5 xl:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Central executiva</p>
          <h2 className="mt-2 text-2xl font-black text-white">Lideran?a, temperamento e produtividade em uma ?nica leitura</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            {executivePerson
              ? `${executivePerson.name} ? ${executivePerson.role} ? ${executivePerson.unit || 'Equipe'}`
              : 'Selecione uma pessoa para abrir a leitura executiva consolidada.'}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Lideran?a</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black text-[#C4B5FD]">{executiveLeadershipPercent}%</p>
                  <p className="mt-1 text-sm font-semibold text-white/55">{executivePerson?.leadershipProfile || 'Executor'} ? N{executivePerson?.leadershipLevel || 3}</p>
                </div>
                <span className="rounded-full bg-[#8B5CF6]/16 px-3 py-1 text-xs font-black text-[#C4B5FD]">{executivePerson?.leadershipPotential || 'Alto'}</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/5">
                <div className="h-2 rounded-full bg-[#8B5CF6]" style={{ width: `${executiveLeadershipPercent}%` }} />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Temperamento</p>
              <div className="mt-3 space-y-2">
                <p className="text-xl font-black text-white">{executiveTemperamentLabel}</p>
                <p className="text-sm font-semibold text-white/55">{executivePerson?.temperamentReason || 'Leitura dominante e complementar'}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{executivePerson?.behavioralProfile || 'Est?vel'}</span>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{executivePerson?.decisionStyle || 'Busca equil?brio entre velocidade e an?lise'}</span>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Produtividade</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black text-[#4A9EFF]">{executivePerson?.productivityIndex ?? productivityIndex}%</p>
                  <p className="mt-1 text-sm font-semibold text-white/55">{executiveProductivityLabel}</p>
                </div>
                <span className="rounded-full bg-[#4A9EFF]/16 px-3 py-1 text-xs font-black text-[#93C5FD]">{productivityDiagnosis.label}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/60">
                <span className="rounded-full bg-white/[0.05] px-3 py-2">Efici?ncia {executivePerson?.productivityEfficiency ?? 0}%</span>
                <span className="rounded-full bg-white/[0.05] px-3 py-2">Comprometimento {executivePerson?.productivityCommitment ?? 0}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.55rem] border border-white/10 bg-gradient-to-r from-[#F8A303]/14 via-white/[0.03] to-white/[0.02] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Relat?rio central</p>
                <p className="mt-2 text-sm font-black text-white">Leitura executiva consolidada</p>
                <p className="mt-2 text-sm text-white/55">
                  Abra a ficha centralizada para detalhar lideran?a, temperamento, personalidade e produtividade em um relat?rio ?nico.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => executivePerson && onCreateAction(executivePerson, `Relatorio geral - ${executivePerson.name}`)}
                  className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
                >
                  Abrir relat?rio
                </button>
                <button
                  onClick={() => executivePerson && openSofi(`Sofi, gere uma leitura executiva central de ${executivePerson.name} com lideran?a, temperamento, personalidade e produtividade.`)}
                  className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white"
                >
                  Gerar com Sofi
                </button>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Equipe</p>
            <h2 className="text-xl font-black text-white">Central executiva de pessoas</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => selectedPerson && onCreateAction(selectedPerson, `Relatorio geral de lideranca - ${selectedPerson.name}`)}
              className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white"
            >
              Relatorio geral
            </button>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-white/10 p-4 xl:border-b-0 xl:border-r xl:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Cargos</p>
            <div className="mt-3 space-y-2">
              {roleTabs.map(tab => {
                const count = tab === 'Todos' ? people.length : people.filter(person => (person.unit || person.role).toLowerCase().includes(tab.toLowerCase())).length
                const active = roleFilter === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setRoleFilter(tab)}
                    className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition"
                    style={{
                      borderColor: active ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.08)',
                      background: active ? 'rgba(248,163,3,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <span className="text-sm font-black text-white">{tab}</span>
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-black text-white/55">{count}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <main className="border-b border-white/10 p-4 xl:border-b-0 xl:border-r xl:border-white/10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{roleFilter}</p>
                <p className="mt-1 text-sm font-semibold text-white/50">Selecione uma pessoa para editar, salvar e organizar em tempo real.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lineupPeople.map(person => {
                const active = person.id === selectedPerson?.id
                const leadershipPercent = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
                return (
                  <button
                    key={person.id}
                    onClick={() => {
                      setSelectedPersonId(person.id)
                      setDrawerOpen(true)
                      setPanelTab('resumo')
                    }}
                    className="group rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5"
                    style={{
                      borderColor: active ? 'rgba(248,163,3,0.4)' : 'rgba(255,255,255,0.08)',
                      background: active ? 'rgba(248,163,3,0.06)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        {person.avatar ? (
                          <img src={person.avatar} alt={person.name} className="h-16 w-16 rounded-2xl object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06]">
                            <UserCircleIcon className="h-10 w-10 text-white/40" />
                          </div>
                        )}
                        <span className="absolute -right-2 -top-2 rounded-full bg-[#8B5CF6] px-2 py-1 text-[10px] font-black text-white">
                          {leadershipPercent}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xl font-black text-white">{person.name}</p>
                        <p className="mt-1 text-sm font-semibold text-white/60">{person.role}</p>
                        <p className="mt-1 text-sm font-black text-[#A78BFA]">{person.unit}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">N{person.leadershipLevel || 3}</span>
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{person.leadershipProfile || 'Executor'}</span>
                    </div>

                    <div className="mt-4">
                      <ProgressRow label="Lideranca" value={leadershipPercent} color="#8B5CF6" />
                    </div>
                  </button>
                )
              })}
            </div>
          </main>

        </div>
      </Surface>

      {drawerOpen && selectedPerson && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fechar ficha"
            onClick={() => void closeDrawer()}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <aside className="absolute left-1/2 top-1/2 h-[calc(100vh-24px)] w-[min(1200px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2rem] border border-white/10 bg-[#090B12] shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:h-[calc(100vh-48px)] md:w-[min(1200px,calc(100vw-48px))]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Ficha profissional</p>
                  <div className="mt-2 flex items-center gap-3">
                    {draft?.avatar ? (
                      <img src={draft.avatar} alt={draft.name} className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
                        <UserCircleIcon className="h-9 w-9 text-white/40" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-black text-white">{selectedPerson.name}</p>
                      <p className="mt-1 text-sm font-semibold text-white/55">{selectedPerson.role}</p>
                      <p className="mt-1 text-sm font-black text-[#A78BFA]">{selectedPerson.unit || 'Equipe'}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void closeDrawer()}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white/65"
                >
                  Fechar
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-4">
                {([
                  { id: 'resumo', label: 'Resumo' },
                  { id: 'editar', label: 'Editar' },
                  { id: 'arquivos', label: 'Arquivos' },
                  { id: 'relatorios', label: 'Relatorios' },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPanelTab(tab.id)}
                    className="h-10 rounded-2xl px-4 text-xs font-black transition"
                    style={{
                      background: panelTab === tab.id ? '#F8A303' : 'rgba(255,255,255,0.04)',
                      color: panelTab === tab.id ? '#05070D' : 'rgba(255,255,255,0.68)',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="rounded-full bg-[#8B5CF6]/16 px-3 py-1 text-xs font-black text-[#C4B5FD]">N{selectedPerson.leadershipLevel || 3}</span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{selectedLeadershipPercent}%</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 pb-28 md:pr-10">
                {panelTab === 'resumo' && (
                  <div className="mx-auto grid max-w-5xl gap-4">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Liderança</p>
                      <p className="mt-2 text-sm text-white/55">{leadershipSummary}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {leadershipSnapshot.map(item => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                            <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                            <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-3">
                        <ProgressRow label="Liderança" value={selectedLeadershipPercent} color="#8B5CF6" />
                        <ProgressRow label="Desenvolvimento" value={Math.max(40, selectedLeadershipPercent - 6)} color="#0ABD78" />
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Temperamento e personalidade</p>
                      <div className="mt-2 text-sm text-white/55">
                        {temperamentPrimaryPercent}% {selectedPerson?.temperamentPrimary || 'Fleumatico'} e {temperamentSecondaryPercent}% {selectedPerson?.temperamentSecondary || 'Sanguineo'}.
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white/45">{selectedPerson?.temperamentReason || 'Leitura calculada a partir do cargo, area e contexto de trabalho.'}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {temperamentSnapshot.map(item => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                            <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                            <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">Perfil comportamental</p>
                          <p className="mt-1 text-sm font-black text-white">{selectedPerson?.behavioralProfile || 'Estavel'}</p>
                          <p className="mt-1 text-xs text-white/38">{selectedPerson?.behavioralProfilePercent || 75}% de aderência</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">Tomada de decisão</p>
                          <p className="mt-1 text-sm font-black text-white">{selectedPerson?.decisionStyle || 'Busca equilibrio entre velocidade e analise'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Produtividade</p>
                      <div className="mt-2 text-sm text-white/55">
                        Índice geral de produtividade: {productivityIndex}% - {productivityDiagnosis.label}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {productivitySnapshot.map(item => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                            <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                            <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <ProgressRow label="Comprometimento" value={selectedPerson?.productivityCommitment ?? 0} color="#0ABD78" />
                        <ProgressRow label="Autonomia" value={selectedPerson?.productivityAutonomy ?? 0} color="#F8A303" />
                      </div>
                    </div>
                  </div>
                )}

                {panelTab === 'editar' && (
                  <div className="mx-auto grid max-w-5xl gap-4">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Editar profissional</p>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">Salvar no footer</span>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Input value={draft?.name || ''} onChange={event => syncDraftField('name', event.target.value)} placeholder="Nome" />
                        <Input value={draft?.role || ''} onChange={event => syncDraftField('role', event.target.value)} placeholder="Cargo" />
                        <Input value={draft?.unit || ''} onChange={event => syncDraftField('unit', event.target.value)} placeholder="Area / setor" />
                        <Input value={draft?.avatar || ''} onChange={event => syncDraftField('avatar', event.target.value)} placeholder="URL da foto" />
                        <label className="flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-xs font-black text-white/60 md:col-span-2">
                          Trocar foto
                          <input type="file" accept="image/*" className="hidden" onChange={event => handleAvatarFile(event.target.files?.[0] || null)} />
                        </label>
                        <Input value={draft?.training || ''} onChange={event => syncDraftField('training', event.target.value)} placeholder="Treinamento" />
                        <Input value={draft?.nextReview || ''} onChange={event => syncDraftField('nextReview', event.target.value)} placeholder="Proxima revisao" />
                        <Input value={draft?.email || ''} onChange={event => syncDraftField('email', event.target.value)} placeholder="E-mail" />
                        <Input value={draft?.phone || ''} onChange={event => syncDraftField('phone', event.target.value)} placeholder="Telefone" />
                        <textarea
                          value={draft?.bio || ''}
                          onChange={event => syncDraftField('bio', event.target.value)}
                          className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none md:col-span-2"
                          placeholder="Resumo executivo"
                        />
                      </div>
                    </div>

                    <ChoiceGroup label="Eixo 1 - Nivel de maturidade" value={draft?.leadershipLevel || 3} options={leadershipMaturityOptions} onChange={value => syncDraftField('leadershipLevel', value as LeadershipLevel)} />
                    <ChoiceGroup label="Eixo 2 - Perfil de lideranca" value={draft?.leadershipProfile || 'Executor'} options={leadershipProfileOptions} onChange={value => syncDraftField('leadershipProfile', value as LeadershipProfile)} />
                    <ChoiceGroup label="Potencial para cargos maiores" value={draft?.leadershipPotential || 'Alto'} options={leadershipPotentialOptions} onChange={value => syncDraftField('leadershipPotential', value as LeadershipPotential)} />
                    <ChoiceGroup label="Prontidao para lideranca" value={draft?.leadershipReadiness || 'Potencial em desenvolvimento'} options={leadershipReadinessOptions} onChange={value => syncDraftField('leadershipReadiness', value as LeadershipReadiness)} />
                    <ChoiceGroup label="Capacidade de desenvolver outros lideres" value={draft?.leaderDevelopment || 'Desenvolve regularmente'} options={leaderDevelopmentOptions} onChange={value => syncDraftField('leaderDevelopment', value as LeaderDevelopment)} />

                    <ChoiceGroup label="Temperamento predominante" value={draft?.temperamentPrimary || 'Fleumatico'} options={temperamentOptions} onChange={value => syncDraftField('temperamentPrimary', value as TemperamentType)} />
                    <ChoiceGroup label="Temperamento secundario" value={draft?.temperamentSecondary || 'Sanguineo'} options={temperamentOptions} onChange={value => syncDraftField('temperamentSecondary', value as TemperamentType)} />
                    <ChoiceGroup label="Perfil comportamental" value={draft?.behavioralProfile || 'Estavel'} options={behavioralProfileOptions} onChange={value => syncDraftField('behavioralProfile', value as BehavioralProfile)} />
                    <ChoiceGroup label="Tomada de decisao" value={draft?.decisionStyle || 'Busca equilibrio entre velocidade e analise'} options={decisionStyleOptions} onChange={value => syncDraftField('decisionStyle', value as DecisionStyle)} />
                    <ChoiceGroup label="Relacionamento interpessoal" value={draft?.interpersonalLevel || 'Equilibrado'} options={interpersonalLevelOptions} onChange={value => syncDraftField('interpersonalLevel', value as InterpersonalLevel)} />
                    <ChoiceGroup label="Resposta a pressao" value={draft?.pressureResponse || 'Mantem a calma'} options={pressureResponseOptions} onChange={value => syncDraftField('pressureResponse', value as PressureResponse)} />
                    <ChoiceGroup label="Facilidade de convivencia" value={draft?.convivenceLevel || 'Facil de lidar'} options={convivenceOptions} onChange={value => syncDraftField('convivenceLevel', value as ConvivenceLevel)} />
                    <ChoiceGroup label="Trabalho em equipe" value={draft?.collaborationLevel || 'Colabora ativamente com os demais'} options={collaborationOptions} onChange={value => syncDraftField('collaborationLevel', value as CollaborationLevel)} />
                    <ChoiceGroup label="Inteligencia relacional" value={draft?.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes'} options={relationalIntelligenceOptions} onChange={value => syncDraftField('relationalIntelligence', value as RelationalIntelligence)} />
                    <ChoiceGroup label="Classificacao geral de relacionamento" value={draft?.relationalClassification || 'Relacionamento adequado'} options={relationalClassificationOptions} onChange={value => syncDraftField('relationalClassification', value as RelationalClassification)} />

                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Produtividade</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Input value={String(draft?.productivityEfficiency ?? '')} onChange={event => syncDraftField('productivityEfficiency', Number(event.target.value || 0))} placeholder="Eficiência %" />
                        <Input value={String(draft?.productivityQuality ?? '')} onChange={event => syncDraftField('productivityQuality', Number(event.target.value || 0))} placeholder="Qualidade %" />
                        <Input value={String(draft?.productivityOrganization ?? '')} onChange={event => syncDraftField('productivityOrganization', Number(event.target.value || 0))} placeholder="Organização %" />
                        <Input value={String(draft?.productivityCommitment ?? '')} onChange={event => syncDraftField('productivityCommitment', Number(event.target.value || 0))} placeholder="Comprometimento %" />
                        <Input value={String(draft?.productivityAutonomy ?? '')} onChange={event => syncDraftField('productivityAutonomy', Number(event.target.value || 0))} placeholder="Autonomia %" />
                        <Input value={String(draft?.productivityIndex ?? '')} onChange={event => syncDraftField('productivityIndex', Number(event.target.value || 0))} placeholder="Índice geral %" />
                      </div>
                      <Input value={draft?.productivityDiagnosis || ''} onChange={event => syncDraftField('productivityDiagnosis', event.target.value)} placeholder="Diagnóstico automático" className="mt-3" />
                    </div>
                  </div>
                )}

                {panelTab === 'arquivos' && (
                  <div className="space-y-4">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Arquivos da pessoa</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Input value={fileInput} onChange={event => setFileInput(event.target.value)} placeholder="Adicionar arquivo ou link" />
                        <button onClick={addDraftFile} className="h-11 rounded-2xl bg-white/[0.06] px-4 text-xs font-black text-white">+</button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(draft?.files || []).map(file => (
                          <button key={file} onClick={() => removeDraftFile(file)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/65">
                            <PaperClipIcon className="h-3.5 w-3.5" />
                            {file}
                            <TrashIcon className="h-3.5 w-3.5 text-white/35" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {panelTab === 'relatorios' && (
                  <div className="mx-auto grid max-w-5xl gap-4">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Relatorio executivo</p>
                      <div className="mt-2 text-sm text-white/55">
                        Aqui reunimos liderança, temperamento e produtividade em uma única leitura central.
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-3">
                        <button onClick={() => selectedPerson && onCreateAction(selectedPerson, `Relatorio completo - ${selectedPerson.name}`)} className="h-11 rounded-2xl bg-[#0ABD78] px-4 text-xs font-black text-black">Relatório completo</button>
                        <button onClick={() => selectedPerson && onCreateAction(selectedPerson, `Relatorio segmentado - ${selectedPerson.name}`)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">Relatório segmentado</button>
                        <button onClick={() => selectedPerson && openSofi(`Sofi, gere um relatório executivo completo de ${selectedPerson.name}. Liderança: Nível ${selectedPerson.leadershipLevel || 3}, perfil ${selectedPerson.leadershipProfile || 'Executor'}, potencial ${selectedPerson.leadershipPotential || 'Alto'}, prontidão ${selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}, desenvolve líderes ${selectedPerson.leaderDevelopment || 'Desenvolve regularmente'}. Temperamento: ${selectedPerson.temperamentPrimaryPercent || 70}% ${selectedPerson.temperamentPrimary || 'Fleumatico'} e ${selectedPerson.temperamentSecondaryPercent || 30}% ${selectedPerson.temperamentSecondary || 'Sanguineo'}. Produtividade: índice ${productivityIndex}%, diagnóstico ${productivityDiagnosis.label}. Inclua arquivos ${(selectedPerson.files || []).join(', ')} e um plano de desenvolvimento.`)} className="h-11 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black">Gerar com Sofi</button>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Liderança</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {leadershipSnapshot.map(item => (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                              <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                              <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Temperamento</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {temperamentSnapshot.map(item => (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                              <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                              <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Produtividade</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {productivitySnapshot.map(item => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                            <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                            <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-3">
                        <ProgressRow label="Eficiência" value={selectedPerson?.productivityEfficiency || 0} color="#0ABD78" />
                        <ProgressRow label="Autonomia" value={selectedPerson?.productivityAutonomy || 0} color="#F8A303" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[#090B12]/98 px-5 py-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
                    {savingDraft ? 'Salvando...' : draftDirty ? 'Alterações pendentes' : 'Atualização em tempo real'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void saveDraft()}
                      className="h-11 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => void closeDrawer()}
                      className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Acoes" title="Fluxo aberto do time" />
          <div className="divide-y divide-white/10">
            {recentWork.length === 0 && <p className="p-5 text-sm text-white/38">Nenhuma acao de pessoas em aberto.</p>}
            {recentWork.map(item => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_110px_140px] md:items-center">
                <div>
                  <p className="font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-white/38">{item.owner} • {item.due}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/55">{item.priority}</span>
                <button onClick={() => openSofi(`Sofi, assuma a acao de pessoas "${item.title}" com contexto de ${item.owner}.`)} className="h-10 rounded-2xl bg-white/[0.07] px-4 text-xs font-black text-white">Abrir</button>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-5">
          <h3 className="font-black text-white">Leitura executiva</h3>
          <div className="mt-4 space-y-3">
            {people.slice(0, 3).map(person => (
              <div key={person.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{person.name}</p>
                    <p className="mt-1 text-xs text-white/38">{person.unit}</p>
                  </div>
                  <span className="rounded-full bg-[#8B5CF6]/14 px-2.5 py-1 text-[11px] font-black text-[#C4B5FD]">{person.leadershipPercent ?? Math.round((person.score || 0) * 20)}%</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/65">N{person.leadershipLevel || 3}</span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/65">{person.leadershipProfile || 'Executor'}</span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/65">{person.leadershipPotential || 'Alto'}</span>
                </div>
                <button
                  onClick={() => openSofi(`Sofi, monte um plano de desenvolvimento para ${person.name}, considerando nivel ${person.leadershipLevel || 3}, perfil ${person.leadershipProfile || 'Executor'}, potencial ${person.leadershipPotential || 'Alto'} e prontidao ${person.leadershipReadiness || 'Potencial em desenvolvimento'}.`)}
                  className="mt-4 h-10 rounded-2xl bg-white/[0.07] px-4 text-xs font-black text-white"
                >
                  Pedir plano a Sofi
                </button>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function PeopleWorkspaceExecutive({
  people,
  work,
  onCreateAction,
  onCreatePerson,
  onUpdatePerson,
}: {
  people: Person[]
  work: WorkItem[]
  onCreateAction: (person: Person, title: string) => void
  onCreatePerson: (person: Partial<Person>) => Promise<Person | null>
  onUpdatePerson: (personId: string, patch: Partial<Person>) => void | Promise<void>
}) {
  const [roleFilter, setRoleFilter] = useState('Todos')
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || '')
  const [draft, setDraft] = useState<Person | null>(people[0] ? { ...people[0], files: [...(people[0].files || [])] } : null)
  const [fileInput, setFileInput] = useState('')
  const [panelTab, setPanelTab] = useState<'resumo' | 'editar' | 'arquivos' | 'relatorios'>('resumo')
  const [workspaceMode, setWorkspaceMode] = useState<'simplificado' | 'completo'>('simplificado')
  const [draftDirty, setDraftDirty] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [creatingPerson, setCreatingPerson] = useState(false)

  function createEmptyDraft(): Person {
    return {
      id: `P-${Date.now()}`,
      name: '',
      role: '',
      unit: '',
      training: '',
      nextReview: '',
      avatar: '',
      score: 0,
      leadershipPercent: 0,
      leadershipLevel: 3,
      leadershipProfile: 'Executor',
      leadershipPotential: 'Alto',
      leadershipReadiness: 'Potencial em desenvolvimento',
      leaderDevelopment: 'Desenvolve regularmente',
      temperamentPrimary: 'Fleumatico',
      temperamentPrimaryPercent: 70,
      temperamentSecondary: 'Sanguineo',
      temperamentSecondaryPercent: 30,
      temperamentReason: '',
      behavioralProfile: 'Estavel',
      behavioralProfilePercent: 75,
      decisionStyle: 'Busca equilibrio entre velocidade e analise',
      interpersonalLevel: 'Equilibrado',
      convivenceLevel: 'Facil de lidar',
      collaborationLevel: 'Colabora ativamente com os demais',
      relationalIntelligence: 'Geralmente aceita feedbacks e faz ajustes',
      relationalClassification: 'Relacionamento adequado',
      pressureResponse: 'Mantem a calma',
      productivityEfficiency: 0,
      productivityQuality: 0,
      productivityOrganization: 0,
      productivityCommitment: 0,
      productivityAutonomy: 0,
      productivityIndex: 0,
      productivityDiagnosis: '',
      pulse: 0,
      attendance: 0,
      workload: 0,
      strengths: [],
      risks: [],
      nextAction: '',
      bio: '',
      email: '',
      phone: '',
      files: [],
      assessmentForm: {},
    }
  }

  useEffect(() => {
    if (!people.length) return
    if (!selectedPersonId || !people.some(person => person.id === selectedPersonId)) {
      setSelectedPersonId(people[0].id)
    }
  }, [people, selectedPersonId])

  useEffect(() => {
    const next = people.find(person => person.id === selectedPersonId) || people[0] || null
    setDraft(next ? { ...next, files: [...(next.files || [])] } : null)
    setDraftDirty(false)
  }, [people, selectedPersonId])

  useEffect(() => {
    if (!draft || !draftDirty) return
    const timer = window.setTimeout(() => {
      void saveDraft(true)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [draft, draftDirty])

  const roleTabs = useMemo(() => {
    const items = people.map(person => person.unit || person.role).filter(Boolean)
    return ['Todos', ...Array.from(new Set(items))]
  }, [people])

  const filteredPeople = useMemo(() => {
    if (roleFilter === 'Todos') return people
    return people.filter(person => {
      const bucket = person.unit || person.role
      return bucket?.toLowerCase().includes(roleFilter.toLowerCase()) || person.role.toLowerCase().includes(roleFilter.toLowerCase())
    })
  }, [people, roleFilter])

  const lineupPeople = useMemo(
    () => [...filteredPeople].sort((a, b) => (b.leadershipPercent ?? 0) - (a.leadershipPercent ?? 0) || (b.score || 0) - (a.score || 0)),
    [filteredPeople],
  )

  const selectedPerson = draft || lineupPeople[0] || people[0] || null
  const selectedLeadershipPercent = selectedPerson?.leadershipPercent ?? Math.round((selectedPerson?.score || 0) * 20)
  const productivityIndex = selectedPerson?.productivityIndex ?? inferProductivityIndex([
    selectedPerson?.productivityEfficiency,
    selectedPerson?.productivityQuality,
    selectedPerson?.productivityOrganization,
    selectedPerson?.productivityCommitment,
    selectedPerson?.productivityAutonomy,
  ])
  const productivityDiagnosis = inferProductivityDiagnosis(productivityIndex)
  const averageLeadership = Math.round(people.reduce((sum, item) => sum + (item.leadershipPercent ?? Math.round((item.score || 0) * 20)), 0) / Math.max(1, people.length))
  const averageTemperament = Math.round(people.reduce((sum, item) => sum + (item.temperamentPrimaryPercent || 70), 0) / Math.max(1, people.length))
  const averageProductivity = Math.round(people.reduce((sum, item) => sum + (item.productivityIndex || productivityIndex), 0) / Math.max(1, people.length))
  const readyLeaders = people.filter(item => (item.leadershipLevel || 0) >= 4).length
  const executivePerson = selectedPerson || people[0] || null
  const relationshipIndex = selectedPerson
    ? selectedPerson.relationalClassification === 'Referencia positiva de relacionamento e trabalho em equipe'
      ? 96
      : selectedPerson.relationalClassification === 'Relacionamento acima da media'
        ? 88
        : selectedPerson.relationalClassification === 'Relacionamento adequado'
          ? 76
          : selectedPerson.relationalClassification === 'Necessita desenvolver competencias relacionais'
            ? 64
            : 52
    : 0
  const friendlinessIndex = selectedPerson
    ? selectedPerson.convivenceLevel === 'Muito facil de lidar'
      ? 96
      : selectedPerson.convivenceLevel === 'Facil de lidar'
        ? 88
        : selectedPerson.convivenceLevel === 'Moderadamente facil de lidar'
          ? 74
          : selectedPerson.convivenceLevel === 'Dificil de lidar em algumas situacoes'
            ? 60
            : 48
    : 0

  const leadershipSnapshot = selectedPerson ? [
    { label: 'Nivel', value: `N${selectedPerson.leadershipLevel || 3}`, detail: 'maturidade atual' },
    { label: 'Perfil', value: selectedPerson.leadershipProfile || 'Executor', detail: 'estilo predominante' },
    { label: 'Potencial', value: selectedPerson.leadershipPotential || 'Alto', detail: 'escala de responsabilidade' },
    { label: 'Desenvolve', value: selectedPerson.leaderDevelopment || 'Desenvolve regularmente', detail: 'efeito multiplicador' },
  ] : []

  const temperamentSnapshot = selectedPerson ? [
    { label: 'Dominante', value: `${selectedPerson.temperamentPrimaryPercent || 70}% ${selectedPerson.temperamentPrimary || 'Fleumatico'}`, detail: selectedPerson.temperamentReason || 'perfil dominante' },
    { label: 'Secundario', value: `${selectedPerson.temperamentSecondaryPercent || 30}% ${selectedPerson.temperamentSecondary || 'Sanguineo'}`, detail: 'traços complementares' },
    { label: 'Perfil', value: selectedPerson.behavioralProfile || 'Estavel', detail: `${selectedPerson.behavioralProfilePercent || 75}% de aderencia comportamental` },
    { label: 'Leitura', value: selectedPerson.relationalClassification || 'Relacionamento adequado', detail: 'síntese relacional' },
  ] : []

  const productivitySnapshot = selectedPerson ? [
    { label: 'Eficiência', value: `${selectedPerson.productivityEfficiency ?? 0}%`, detail: 'capacidade de concluir tarefas' },
    { label: 'Qualidade', value: `${selectedPerson.productivityQuality ?? 0}%`, detail: 'confiabilidade das entregas' },
    { label: 'Organização', value: `${selectedPerson.productivityOrganization ?? 0}%`, detail: 'gestão de prioridades' },
    { label: 'Índice geral', value: `${productivityIndex}%`, detail: productivityDiagnosis.label },
  ] : []

  function syncDraftField<K extends keyof Person>(key: K, value: Person[K]) {
    setDraft(current => (current ? { ...current, [key]: value } : current))
    setDraftDirty(true)
  }

  function addDraftFile() {
    if (!fileInput.trim()) return
    setDraft(current => (current ? { ...current, files: Array.from(new Set([...(current.files || []), fileInput.trim()])) } : current))
    setDraftDirty(true)
    setFileInput('')
  }

  function handleAvatarFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      setDraft(current => (current ? { ...current, avatar: result } : current))
      setDraftDirty(true)
    }
    reader.readAsDataURL(file)
  }

  function removeDraftFile(name: string) {
    setDraft(current => (current ? { ...current, files: (current.files || []).filter(file => file !== name) } : current))
    setDraftDirty(true)
  }

  function updateAssessmentForm(rawText: string) {
    try {
      const parsed = rawText.trim() ? JSON.parse(rawText) : {}
      setDraft(current => (current ? { ...current, assessmentForm: parsed } : current))
      setDraftDirty(true)
    } catch {}
  }

  function startNewPerson() {
    const next = createEmptyDraft()
    setCreatingPerson(true)
    setSelectedPersonId(next.id)
    setPanelTab('editar')
    setWorkspaceMode('completo')
    setDraft(next)
    setDraftDirty(false)
    setLastSavedAt('')
  }

  async function saveDraft(silent = false) {
    if (!draft) return
    if (!silent) setSavingDraft(true)
    try {
      const payload = {
        ...draft,
        score: Number(draft.score || 0),
        leadershipPercent: Number(draft.leadershipPercent || 0),
        leadershipLevel: (draft.leadershipLevel || 3) as LeadershipLevel,
        leadershipProfile: draft.leadershipProfile || 'Executor',
        leadershipPotential: draft.leadershipPotential || 'Alto',
        leadershipReadiness: draft.leadershipReadiness || 'Potencial em desenvolvimento',
        leaderDevelopment: draft.leaderDevelopment || 'Desenvolve regularmente',
        temperamentPrimary: draft.temperamentPrimary || 'Fleumatico',
        temperamentPrimaryPercent: Number(draft.temperamentPrimaryPercent || 0),
        temperamentSecondary: draft.temperamentSecondary || 'Sanguineo',
        temperamentSecondaryPercent: Number(draft.temperamentSecondaryPercent || 0),
        temperamentReason: draft.temperamentReason || '',
        behavioralProfile: draft.behavioralProfile || 'Estavel',
        behavioralProfilePercent: Number(draft.behavioralProfilePercent || 0),
        decisionStyle: draft.decisionStyle || 'Busca equilibrio entre velocidade e analise',
        interpersonalLevel: draft.interpersonalLevel || 'Equilibrado',
        convivenceLevel: draft.convivenceLevel || 'Facil de lidar',
        collaborationLevel: draft.collaborationLevel || 'Colabora ativamente com os demais',
        relationalIntelligence: draft.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes',
        relationalClassification: draft.relationalClassification || 'Relacionamento adequado',
        pressureResponse: draft.pressureResponse || 'Mantem a calma',
        productivityEfficiency: Number(draft.productivityEfficiency || 0),
        productivityQuality: Number(draft.productivityQuality || 0),
        productivityOrganization: Number(draft.productivityOrganization || 0),
        productivityCommitment: Number(draft.productivityCommitment || 0),
        productivityAutonomy: Number(draft.productivityAutonomy || 0),
        productivityIndex: Number(draft.productivityIndex || 0),
        productivityDiagnosis: draft.productivityDiagnosis || '',
        strengths: draft.strengths || [],
        risks: draft.risks || [],
        files: draft.files || [],
        assessmentForm: draft.assessmentForm || {},
      }

      if (creatingPerson) {
        const created = await onCreatePerson(payload)
        if (created) {
          setCreatingPerson(false)
          setSelectedPersonId(created.id)
          setDraft({ ...created, files: [...(created.files || [])] })
        }
      } else {
        await onUpdatePerson(draft.id, payload)
      }
      setDraftDirty(false)
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } finally {
      if (!silent) setSavingDraft(false)
    }
  }

  return (
    <section className="space-y-5 pb-24">
      <Surface className="overflow-hidden">
        <div className="p-5 xl:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Central executiva de pessoas</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-black leading-tight text-white">Liderança, temperamento e produtividade</h2>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/70">{people.length} perfis</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                {selectedPerson
                  ? `${selectedPerson.name} atua como ${selectedPerson.role}. A leitura executiva fica centralizada para editar, salvar e confiar no resultado em tempo real.`
                  : 'Selecione uma pessoa para abrir a leitura executiva consolidada.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={startNewPerson} className="h-10 rounded-2xl border border-[#0ABD78]/30 bg-[#0ABD78]/10 px-4 text-xs font-black text-[#7AF0C0] transition hover:-translate-y-0.5">
                Novo cadastro inteligente
              </button>
              <button onClick={() => setWorkspaceMode(mode => (mode === 'simplificado' ? 'completo' : 'simplificado'))} className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:border-white/20 hover:bg-white/[0.08]">
                {workspaceMode === 'simplificado' ? 'Vista completa' : 'Vista compacta'}
              </button>
              <button onClick={() => selectedPerson && onCreateAction(selectedPerson, `Relatorio geral - ${selectedPerson.name}`)} className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:border-white/20 hover:bg-white/[0.08]">Relatório geral</button>
              <button onClick={() => selectedPerson && onCreateAction(selectedPerson, `Relatorio completo - ${selectedPerson.name}`)} className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black transition hover:-translate-y-0.5">Abrir relatório</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Liderança média" value={`${averageLeadership}%`} detail={`${readyLeaders} prontos para liderar`} color="#C4B5FD" />
            <MetricCard label="Temperamento médio" value={`${averageTemperament}%`} detail="leitura relacional consolidada" color="#38BDF8" />
            <MetricCard label="Relacionamento médio" value={`${Math.round((relationshipIndex + friendlinessIndex) / 2 || 0)}%`} detail="convivência e inteligência relacional" color="#0ABD78" />
            <MetricCard label="Produtividade média" value={`${averageProductivity}%`} detail="índice geral do time" color="#F8A303" />
          </div>

          <div className="mt-4 rounded-[1.55rem] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Estado da ficha</p>
                <p className="mt-1 text-sm font-semibold text-white/60">
                  {creatingPerson ? 'Criando novo cadastro inteligente' : savingDraft ? 'Salvando...' : draftDirty ? 'Alterações pendentes' : 'Atualização em tempo real'}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/35">{lastSavedAt ? `Último salvamento: ${lastSavedAt}` : 'Ainda não salvo nesta sessão'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">N{selectedPerson?.leadershipLevel || 3}</span>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{selectedLeadershipPercent}% liderança</span>
                <button onClick={() => void saveDraft()} className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black transition hover:-translate-y-0.5">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Surface className="overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Cargos e escalação</p>
              <h3 className="mt-2 text-2xl font-black text-white">Leia o time por cargo e foque no centro executivo.</h3>
              <p className="mt-2 text-sm text-white/50">A navegação saiu da lateral e virou uma faixa limpa, para a ficha ficar no meio e sem ruído visual.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWorkspaceMode(mode => (mode === 'simplificado' ? 'completo' : 'simplificado'))} className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">
                {workspaceMode === 'simplificado' ? 'Vista completa' : 'Vista compacta'}
              </button>
              <span className="rounded-full bg-white/[0.06] px-3 py-2 text-xs font-black text-white/70">{filteredPeople.length} perfis</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-4">
            {roleTabs.map(tab => {
              const count = tab === 'Todos' ? people.length : people.filter(person => (person.unit || person.role).toLowerCase().includes(tab.toLowerCase())).length
              const active = roleFilter === tab
              return (
                <button
                  key={tab}
                  onClick={() => setRoleFilter(tab)}
                  className="rounded-full border px-4 py-2 text-xs font-black transition"
                  style={{
                    borderColor: active ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.08)',
                    background: active ? 'rgba(248,163,3,0.12)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#F8A303' : 'rgba(255,255,255,0.76)',
                  }}
                >
                  {tab}
                  <span className="ml-2 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-black text-white/60">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {lineupPeople.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-6 sm:col-span-2 xl:col-span-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Base zerada</p>
                <h4 className="mt-2 text-2xl font-black text-white">Nenhuma pessoa cadastrada ainda.</h4>
                <p className="mt-2 max-w-2xl text-sm text-white/55">
                  Use o cadastro inteligente para criar a primeira ficha. A partir dele, o sistema salva a base local, sincroniza no backend e envia o snapshot para o Drive.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={startNewPerson} className="h-10 rounded-2xl bg-[#0ABD78] px-4 text-xs font-black text-black">Criar primeiro cadastro</button>
                  <button onClick={() => void saveDraft()} className="h-10 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-black text-white">Salvar base atual</button>
                </div>
              </div>
            )}
            {lineupPeople.map(person => {
              const active = person.id === selectedPerson?.id
              const leadershipPercent = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
              return (
                <button
                  key={person.id}
                  onClick={() => {
                    setSelectedPersonId(person.id)
                    setPanelTab('resumo')
                  }}
                  className="rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5"
                  style={{
                    borderColor: active ? 'rgba(248,163,3,0.4)' : 'rgba(255,255,255,0.08)',
                    background: active ? 'rgba(248,163,3,0.08)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <img src={person.avatar} alt={person.name} className="h-14 w-14 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-white">{person.name}</p>
                          <p className="mt-1 text-sm font-semibold text-white/60">{person.role}</p>
                          <p className="mt-1 text-sm font-black text-[#A78BFA]">{person.unit}</p>
                        </div>
                        <span className="rounded-full bg-[#8B5CF6]/16 px-3 py-1 text-xs font-black text-[#C4B5FD]">{leadershipPercent}%</span>
                      </div>
                    </div>
                  </div>
                  {workspaceMode === 'completo' ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">N{person.leadershipLevel || 3}</span>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{person.leadershipProfile || 'Executor'}</span>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{person.productivityIndex || 0}%</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        <ProgressRow label="Liderança" value={leadershipPercent} color="#8B5CF6" />
                        <ProgressRow label="Produtividade" value={person.productivityIndex || 0} color="#0ABD78" />
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <ProgressRow label="Liderança" value={leadershipPercent} color="#8B5CF6" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Relatorio central</p>
              <p className="mt-2 truncate text-2xl font-black text-white">{selectedPerson?.name || 'Selecione alguém'}</p>
              <p className="mt-1 text-sm font-semibold text-white/55">{selectedPerson?.role || 'Sem cargo'}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Status</p>
              <p className="mt-1 text-sm font-black text-[#C4B5FD]">N{selectedPerson?.leadershipLevel || 3}</p>
              <p className="mt-1 text-xs text-white/45">{selectedLeadershipPercent}% liderança</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-4">
            {([
              { id: 'resumo', label: 'Resumo' },
              { id: 'editar', label: 'Editar' },
              { id: 'arquivos', label: 'Arquivos' },
              { id: 'relatorios', label: 'Relatórios' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setPanelTab(tab.id)}
                className="h-10 rounded-2xl px-4 text-xs font-black transition"
                style={{
                  background: panelTab === tab.id ? '#F8A303' : 'rgba(255,255,255,0.04)',
                  color: panelTab === tab.id ? '#05070D' : 'rgba(255,255,255,0.68)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-5">
            {panelTab === 'resumo' && selectedPerson && (
              <div className="space-y-4">
                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Liderança"
                      value={`${selectedLeadershipPercent}%`}
                      detail={`N${selectedPerson.leadershipLevel || 3} • ${selectedPerson.leadershipProfile || 'Executor'}`}
                      color="#8B5CF6"
                    />
                    <MetricCard
                      label="Temperamento"
                      value={`${selectedPerson.behavioralProfilePercent || 75}%`}
                      detail={`${selectedPerson.temperamentPrimaryPercent || 70}% ${selectedPerson.temperamentPrimary || 'Fleumático'} / ${selectedPerson.temperamentSecondaryPercent || 30}% ${selectedPerson.temperamentSecondary || 'Sanguíneo'}`}
                      color="#38BDF8"
                    />
                    <MetricCard
                      label="Relacionamento"
                      value={`${relationshipIndex}%`}
                      detail={selectedPerson.relationalClassification || 'Relacionamento adequado'}
                      color="#0ABD78"
                    />
                    <MetricCard
                      label="Produtividade"
                      value={`${productivityIndex}%`}
                      detail={productivityDiagnosis.label}
                      color="#F8A303"
                    />
                  </div>

                  <p className="mt-4 text-sm text-white/55">
                    {selectedPerson.name} atua como {selectedPerson.role}. Nível {selectedPerson.leadershipLevel || 3}, perfil {selectedPerson.leadershipProfile || 'Executor'}, potencial {selectedPerson.leadershipPotential || 'Alto'} e prontidão {selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {leadershipSnapshot.map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                        <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                        <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Temperamento e personalidade</p>
                  <p className="mt-2 text-sm text-white/55">
                    {selectedPerson.temperamentPrimaryPercent || 70}% {selectedPerson.temperamentPrimary || 'Fleumático'} e {selectedPerson.temperamentSecondaryPercent || 30}% {selectedPerson.temperamentSecondary || 'Sanguíneo'}.
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white/45">
                    {selectedPerson.temperamentReason || 'Leitura calculada a partir do cargo, área e contexto de trabalho.'}
                    {' '}• Facilidade de convivência: {friendlinessIndex}%.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {temperamentSnapshot.map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                        <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                        <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Produtividade</p>
                  <p className="mt-2 text-sm text-white/55">Índice geral de produtividade: {productivityIndex}% - {productivityDiagnosis.label}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {productivitySnapshot.map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{item.label}</p>
                        <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                        <p className="mt-1 text-xs text-white/38">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {panelTab === 'editar' && draft && (
              <div className="space-y-4">
                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Editar profissional</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Input value={draft.name || ''} onChange={event => syncDraftField('name', event.target.value)} placeholder="Nome" />
                    <Input value={draft.role || ''} onChange={event => syncDraftField('role', event.target.value)} placeholder="Cargo" />
                    <Input value={draft.unit || ''} onChange={event => syncDraftField('unit', event.target.value)} placeholder="Área / setor" />
                    <Input value={draft.avatar || ''} onChange={event => syncDraftField('avatar', event.target.value)} placeholder="URL da foto" />
                    <label className="flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-xs font-black text-white/60 md:col-span-2">
                      Trocar foto
                      <input type="file" accept="image/*" className="hidden" onChange={event => handleAvatarFile(event.target.files?.[0] || null)} />
                    </label>
                    <Input value={draft.training || ''} onChange={event => syncDraftField('training', event.target.value)} placeholder="Treinamento" />
                    <Input value={draft.nextReview || ''} onChange={event => syncDraftField('nextReview', event.target.value)} placeholder="Próxima revisão" />
                    <Input value={draft.email || ''} onChange={event => syncDraftField('email', event.target.value)} placeholder="E-mail" />
                    <Input value={draft.phone || ''} onChange={event => syncDraftField('phone', event.target.value)} placeholder="Telefone" />
                    <textarea
                      value={draft.bio || ''}
                      onChange={event => syncDraftField('bio', event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none md:col-span-2"
                      placeholder="Resumo executivo"
                    />
                    <textarea
                      value={JSON.stringify(draft.assessmentForm || {}, null, 2)}
                      onChange={event => updateAssessmentForm(event.target.value)}
                      className="min-h-40 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-white/80 outline-none md:col-span-2"
                      placeholder='{"bloco1":{"1":5,"2":4},"observacoes":"..."}'
                    />
                    <p className="text-xs text-white/35 md:col-span-2">
                      Formulário inteligente: deixe aqui a base estruturada em JSON. Quando você me mandar o modelo final, eu adapto para campos visuais sem perder a base.
                    </p>
                  </div>
                </div>

                <ChoiceGroup label="Eixo 1 - Nível de maturidade" value={draft.leadershipLevel || 3} options={leadershipMaturityOptions} onChange={value => syncDraftField('leadershipLevel', value as LeadershipLevel)} />
                <ChoiceGroup label="Eixo 2 - Perfil de liderança" value={draft.leadershipProfile || 'Executor'} options={leadershipProfileOptions} onChange={value => syncDraftField('leadershipProfile', value as LeadershipProfile)} />
                <ChoiceGroup label="Potencial para cargos maiores" value={draft.leadershipPotential || 'Alto'} options={leadershipPotentialOptions} onChange={value => syncDraftField('leadershipPotential', value as LeadershipPotential)} />
                <ChoiceGroup label="Prontidão para liderança" value={draft.leadershipReadiness || 'Potencial em desenvolvimento'} options={leadershipReadinessOptions} onChange={value => syncDraftField('leadershipReadiness', value as LeadershipReadiness)} />
                <ChoiceGroup label="Capacidade de desenvolver outros líderes" value={draft.leaderDevelopment || 'Desenvolve regularmente'} options={leaderDevelopmentOptions} onChange={value => syncDraftField('leaderDevelopment', value as LeaderDevelopment)} />
                <ChoiceGroup label="Temperamento predominante" value={draft.temperamentPrimary || 'Fleumatico'} options={temperamentOptions} onChange={value => syncDraftField('temperamentPrimary', value as TemperamentType)} />
                <ChoiceGroup label="Temperamento secundário" value={draft.temperamentSecondary || 'Sanguineo'} options={temperamentOptions} onChange={value => syncDraftField('temperamentSecondary', value as TemperamentType)} />
                <ChoiceGroup label="Perfil comportamental" value={draft.behavioralProfile || 'Estavel'} options={behavioralProfileOptions} onChange={value => syncDraftField('behavioralProfile', value as BehavioralProfile)} />
                <ChoiceGroup label="Tomada de decisão" value={draft.decisionStyle || 'Busca equilibrio entre velocidade e analise'} options={decisionStyleOptions} onChange={value => syncDraftField('decisionStyle', value as DecisionStyle)} />
                <ChoiceGroup label="Relacionamento interpessoal" value={draft.interpersonalLevel || 'Equilibrado'} options={interpersonalLevelOptions} onChange={value => syncDraftField('interpersonalLevel', value as InterpersonalLevel)} />
                <ChoiceGroup label="Resposta à pressão" value={draft.pressureResponse || 'Mantem a calma'} options={pressureResponseOptions} onChange={value => syncDraftField('pressureResponse', value as PressureResponse)} />
                <ChoiceGroup label="Facilidade de convivência" value={draft.convivenceLevel || 'Facil de lidar'} options={convivenceOptions} onChange={value => syncDraftField('convivenceLevel', value as ConvivenceLevel)} />
                <ChoiceGroup label="Trabalho em equipe" value={draft.collaborationLevel || 'Colabora ativamente com os demais'} options={collaborationOptions} onChange={value => syncDraftField('collaborationLevel', value as CollaborationLevel)} />
                <ChoiceGroup label="Inteligência relacional" value={draft.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes'} options={relationalIntelligenceOptions} onChange={value => syncDraftField('relationalIntelligence', value as RelationalIntelligence)} />
                <ChoiceGroup label="Classificação geral de relacionamento" value={draft.relationalClassification || 'Relacionamento adequado'} options={relationalClassificationOptions} onChange={value => syncDraftField('relationalClassification', value as RelationalClassification)} />

                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Produtividade</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Input value={String(draft.productivityEfficiency ?? '')} onChange={event => syncDraftField('productivityEfficiency', Number(event.target.value || 0))} placeholder="Eficiência %" />
                    <Input value={String(draft.productivityQuality ?? '')} onChange={event => syncDraftField('productivityQuality', Number(event.target.value || 0))} placeholder="Qualidade %" />
                    <Input value={String(draft.productivityOrganization ?? '')} onChange={event => syncDraftField('productivityOrganization', Number(event.target.value || 0))} placeholder="Organização %" />
                    <Input value={String(draft.productivityCommitment ?? '')} onChange={event => syncDraftField('productivityCommitment', Number(event.target.value || 0))} placeholder="Comprometimento %" />
                    <Input value={String(draft.productivityAutonomy ?? '')} onChange={event => syncDraftField('productivityAutonomy', Number(event.target.value || 0))} placeholder="Autonomia %" />
                    <Input value={String(draft.productivityIndex ?? '')} onChange={event => syncDraftField('productivityIndex', Number(event.target.value || 0))} placeholder="Índice geral %" />
                  </div>
                  <Input value={draft.productivityDiagnosis || ''} onChange={event => syncDraftField('productivityDiagnosis', event.target.value)} placeholder="Diagnóstico automático" className="mt-3" />
                </div>
              </div>
            )}

            {panelTab === 'arquivos' && draft && (
              <div className="space-y-4">
                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Arquivos da pessoa</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Input value={fileInput} onChange={event => setFileInput(event.target.value)} placeholder="Adicionar arquivo ou link" />
                    <button onClick={addDraftFile} className="h-11 rounded-2xl bg-white/[0.06] px-4 text-xs font-black text-white">+</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(draft.files || []).map(file => (
                      <button key={file} onClick={() => removeDraftFile(file)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/65">
                        <PaperClipIcon className="h-3.5 w-3.5" />
                        {file}
                        <TrashIcon className="h-3.5 w-3.5 text-white/35" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {panelTab === 'relatorios' && selectedPerson && (
              <div className="space-y-4">
                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Relatório executivo</p>
                  <div className="mt-2 text-sm text-white/55">Aqui reunimos liderança, temperamento e produtividade em uma leitura central.</div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <button onClick={() => onCreateAction(selectedPerson, `Relatorio completo - ${selectedPerson.name}`)} className="h-11 rounded-2xl bg-[#0ABD78] px-4 text-xs font-black text-black">Relatório completo</button>
                    <button onClick={() => onCreateAction(selectedPerson, `Relatorio segmentado - ${selectedPerson.name}`)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">Relatório segmentado</button>
                    <button onClick={() => openSofi(`Sofi, gere um relatório executivo completo de ${selectedPerson.name}. Liderança: Nível ${selectedPerson.leadershipLevel || 3}, perfil ${selectedPerson.leadershipProfile || 'Executor'}, potencial ${selectedPerson.leadershipPotential || 'Alto'}, prontidão ${selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}, desenvolve líderes ${selectedPerson.leaderDevelopment || 'Desenvolve regularmente'}. Temperamento: ${selectedPerson.temperamentPrimaryPercent || 70}% ${selectedPerson.temperamentPrimary || 'Fleumatico'} e ${selectedPerson.temperamentSecondaryPercent || 30}% ${selectedPerson.temperamentSecondary || 'Sanguineo'}. Produtividade: índice ${productivityIndex}%, diagnóstico ${productivityDiagnosis.label}. Inclua arquivos ${(selectedPerson.files || []).join(', ')} e um plano de desenvolvimento.`)} className="h-11 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black">Gerar com Sofi</button>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Indicadores</p>
                  <div className="mt-4 space-y-3">
                    <ProgressRow label="Liderança" value={selectedLeadershipPercent} color="#8B5CF6" />
                    <ProgressRow label="Produtividade" value={productivityIndex} color="#0ABD78" />
                    <ProgressRow label="Autonomia" value={selectedPerson.productivityAutonomy || 0} color="#F8A303" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-[#090B12]/98 px-5 py-4 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{savingDraft ? 'Salvando...' : draftDirty ? 'Alterações pendentes' : 'Atualização em tempo real'}</p>
                <p className="mt-1 text-[11px] font-semibold text-white/30">{lastSavedAt ? `Último salvamento: ${lastSavedAt}` : 'Ainda não salvo nesta sessão'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void saveDraft()} className="h-11 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black">Salvar</button>
                <button type="button" onClick={() => selectedPerson && onCreateAction(selectedPerson, `Plano de ação - ${selectedPerson.name}`)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">Criar plano</button>
              </div>
            </div>
          </div>
        </Surface>
      </div>

      <Surface className="overflow-hidden">
        <SectionHeader eyebrow="Ações" title="Fluxo aberto do time" />
        <div className="divide-y divide-white/10">
          {work.slice(0, 5).length === 0 && <p className="p-5 text-sm text-white/38">Nenhuma ação de pessoas em aberto.</p>}
          {work.slice(0, 5).map(item => (
            <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_110px_140px] md:items-center">
              <div>
                <p className="font-black text-white">{item.title}</p>
                <p className="mt-1 text-xs text-white/38">{item.owner} • {item.due}</p>
              </div>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/55">{item.priority}</span>
              <button onClick={() => openSofi(`Sofi, assuma a ação de pessoas "${item.title}" com contexto de ${item.owner}.`)} className="h-10 rounded-2xl bg-white/[0.07] px-4 text-xs font-black text-white">Abrir</button>
            </div>
          ))}
        </div>
      </Surface>
    </section>
  )
}

function FinanceRow({ item }: { item: FinanceLine }) {
  const color = item.type === 'Receita' ? '#0ABD78' : '#FF4757'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">{item.label}</p>
        <p className="text-sm font-black" style={{ color }}>{money.format(item.amount)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-white/35">
        <span>{item.type}</span>
        <span>{item.status}</span>
        <span>{item.due}</span>
      </div>
    </div>
  )
}

function AssetCard({ item, onAdjustAsset }: { item: Asset; onAdjustAsset: (id: string, delta: number) => void }) {
  const critical = item.qty <= item.min
  const coverage = Math.min(100, Math.round((item.qty / Math.max(1, item.min)) * 100))
  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-white">{item.name}</p>
          <p className="mt-1 text-xs font-semibold text-white/38">{item.category} • {item.location}</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: critical ? '#FF4757' : '#0ABD78', background: critical ? 'rgba(255,71,87,0.14)' : 'rgba(10,189,120,0.14)' }}>{item.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Atual" value={item.qty.toString()} />
        <MiniStat label="Minimo" value={item.min.toString()} />
        <MiniStat label="Custo" value={money.format(item.unitCost || 0)} />
      </div>
      <div className="mt-4">
        <div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${coverage}%`, background: critical ? '#FF4757' : '#0ABD78' }} /></div>
        <p className="mt-2 text-xs text-white/38">Fornecedor: {item.supplier} • Responsavel: {item.owner}</p>
        <p className="mt-1 text-xs text-white/38">Ultima movimentacao: {item.lastMove}</p>
        <p className="mt-3 text-sm font-bold text-white">{item.nextAction}</p>
      </div>
      <div className="mt-4 grid grid-cols-[48px_48px_1fr] gap-2">
        <button onClick={() => onAdjustAsset(item.id, -1)} className="h-10 rounded-xl bg-white/[0.06] font-black text-white">-</button>
        <button onClick={() => onAdjustAsset(item.id, 1)} className="h-10 rounded-xl bg-[#E07B39] font-black text-black">+</button>
        <button onClick={() => openSofi(`Sofi, avalie o item ${item.name}, estoque atual ${item.qty}, minimo ${item.min}, e gere um plano de reposicao.`)} className="h-10 rounded-xl bg-[#F8A303] px-3 text-xs font-black text-black">Auditar com Sofi</button>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function PersonCard({ person, onCreateAction }: { person: Person; onCreateAction: (person: Person, title: string) => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
      <div className="flex items-start gap-3">
        <img src={person.avatar} alt={person.name} className="h-16 w-16 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-black leading-tight text-white">{person.name}</p>
              <p className="mt-1 text-sm font-semibold text-white/70">{person.role}</p>
              <p className="mt-1 text-sm font-black text-[#A78BFA]">{person.unit}</p>
            </div>
            <span className="rounded-full bg-[#8B5CF6]/16 px-3 py-1 text-sm font-black text-[#A78BFA]">{person.score?.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Pulso" value={`${person.pulse || 0}%`} />
        <MiniStat label="Presenca" value={`${person.attendance || 0}%`} />
        <MiniStat label="Carga" value={`${person.workload || 0}%`} />
      </div>

      <div className="mt-4 space-y-2">
        <ProgressRow label="Engajamento" value={person.pulse || 0} color="#8B5CF6" />
        <ProgressRow label="Carga de trabalho" value={person.workload || 0} color="#F8A303" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(person.strengths || []).map(tag => (
          <span key={tag} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/60">{tag}</span>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Proxima acao</p>
        <p className="mt-2 text-lg font-black text-white">{person.nextAction}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={() => onCreateAction(person, `Plano de desenvolvimento - ${person.name}`)} className="h-10 rounded-2xl bg-[#8B5CF6] px-4 text-xs font-black text-white">Criar plano</button>
        <button onClick={() => openSofi(`Sofi, assuma o acompanhamento de ${person.name}. Cargo: ${person.role}. Proxima acao: ${person.nextAction}.`)} className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">Abrir com Sofi</button>
      </div>
    </div>
  )
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white/68">{label}</p>
        <p className="text-sm font-black text-white/68">{value}%</p>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | number
  options: Array<{ value: string | number; label: string; detail: string }>
  onChange: (value: string | number) => void
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-black text-white/55">
          {typeof value === 'number' ? `N${value}` : value}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map(option => {
          const active = option.value === value
          return (
            <button
              key={String(option.value)}
              onClick={() => onChange(option.value)}
              className="rounded-2xl border p-3 text-left transition"
              style={{
                borderColor: active ? 'rgba(248,163,3,0.38)' : 'rgba(255,255,255,0.08)',
                background: active ? 'rgba(248,163,3,0.08)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{option.label}</p>
                  <p className="mt-1 text-xs text-white/45">{option.detail}</p>
                </div>
                {active && <SparklesIcon className="h-4 w-4 text-[#F8A303]" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
