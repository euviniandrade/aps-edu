'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '@/lib/api'
import { PROMOTER_QUESTIONS, getPromoterFormQuestionSections } from '@/lib/promoter-form'
import { academicEventsFromState, readAcademicState } from '@/lib/academic'
import restoredPromoterSubmissions from '@/data/restored-promoter-submissions.json'
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
  XMarkIcon,
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
  color?: string
  checklist?: Array<{ id: string; title: string; done: boolean }>
  comments?: Array<{ id: string; author: string; content: string; createdAt: string }>
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
type LeadershipProfile = 'Executor' | 'Entusiasta' | 'Relacional' | 'Organizador' | 'Desenvolvedor' | 'Estratégico' | 'Estrategico' | 'Influenciador'
type LeadershipPotential = 'Baixo' | 'Moderado' | 'Alto' | 'Muito Alto' | 'Excepcional'
type LeadershipReadiness =
  | 'Ainda não demonstra perfil de liderança'
  | 'Potencial em desenvolvimento'
  | 'Pronto para liderar pequenas equipes'
  | 'Pronto para liderar setores/departamentos'
  | 'Pronto para liderar unidades ou grandes projetos'
type LeaderDevelopment =
  | 'Não desenvolve'
  | 'Desenvolve ocasionalmente'
  | 'Desenvolve regularmente'
  | 'Forma novos líderes de maneira consistente'
  | 'Multiplica líderes e fortalece a cultura institucional'
type TemperamentType = 'Sanguíneo' | 'Colérico' | 'Fleumático' | 'Melancólico' | 'Sanguineo' | 'Colerico' | 'Fleumatico' | 'Melancolico'
type BehavioralProfile = 'Executor' | 'Influenciador' | 'Analítico' | 'Estável' | 'Analitico' | 'Estavel'
type DecisionStyle =
  | 'Decide rapidamente mesmo com poucas informações'
  | 'Busca equilíbrio entre velocidade e análise'
  | 'Analisa profundamente antes de decidir'
  | 'Prefere consultar outras pessoas antes de decidir'
  | 'Busca equilibrio entre velocidade e análise'
type InterpersonalLevel = 'Muito reservado' | 'Reservado' | 'Equilibrado' | 'Comunicativo' | 'Extremamente comunicativo'
type PressureResponse = 'Mantém a calma' | 'Assume o controle' | 'Busca apoio da equipe' | 'Torna-se mais analítico' | 'Demonstra dificuldade sob pressão' | 'Mantem a calma' | 'Torna-se mais analitico' | 'Demonstra dificuldade sob pressao'
type CollaborationLevel = 'Atua como agregador da equipe' | 'Colabora ativamente com os demais' | 'Colabora quando solicitado' | 'Prefere trabalhar de forma individual' | 'Demonstra resistência ao trabalho em equipe'
type ConvivenceLevel =
  | 'Muito fácil de lidar'
  | 'Fácil de lidar'
  | 'Moderadamente fácil de lidar'
  | 'Difícil de lidar em algumas situações'
  | 'Dificil de lidar em algumas situações'
  | 'Frequentemente difícil de lidar'
  | 'Muito facil de lidar'
  | 'Facil de lidar'
  | 'Moderadamente facil de lidar'
  | 'Frequentemente dificil de lidar'
type RelationalIntelligence =
  | 'Recebe feedbacks com maturidade e busca crescimento'
  | 'Geralmente aceita feedbacks e faz ajustes'
  | 'Aceita feedbacks com alguma resistência inicial'
  | 'Tem dificuldade em aceitar feedbacks ou opiniões diferentes'
  | 'Frequentemente reage de forma defensiva ou conflituosa'
type RelationalClassification =
  | 'Referência positiva de relacionamento e trabalho em equipe'
  | 'Relacionamento acima da média'
  | 'Relacionamento adequado'
  | 'Necessita desenvolver competências relacionais'
  | 'Necessita acompanhamento prioritário em relacionamento interpessoal'

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
  temperamentTertiary?: TemperamentType
  temperamentTertiaryPercent?: number
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
const PEOPLE_SUBMISSIONS_CACHE_KEY = 'aps30_people_submissions_cache_v1'

const leadershipMaturityOptions: Array<{ value: LeadershipLevel; label: string; detail: string }> = [
  { value: 1, label: 'Executor', detail: 'Cumpre tarefas e depende de direcionamento.' },
  { value: 2, label: 'Colaborador', detail: 'Sugere melhorias e assume pequenas frentes.' },
  { value: 3, label: 'Líder Operacional', detail: 'Coordena pessoas e garante a execução.' },
  { value: 4, label: 'Líder Estratégico', detail: 'Planeja, desenvolve pessoas e influencia a equipe.' },
  { value: 5, label: 'Líder Multiplicador', detail: 'Forma novos líderes e fortalece a cultura.' },
]

const leadershipProfileOptions: Array<{ value: LeadershipProfile; label: string; detail: string }> = [
  { value: 'Executor', label: 'Executor', detail: 'Foco em ação e entrega.' },
  { value: 'Entusiasta', label: 'Entusiasta', detail: 'Motiva pessoas e gera energia.' },
  { value: 'Relacional', label: 'Relacional', detail: 'Cria conexão e confiança.' },
  { value: 'Organizador', label: 'Organizador', detail: 'Processos, planejamento e controle.' },
  { value: 'Desenvolvedor', label: 'Desenvolvedor', detail: 'Forma pessoas e acompanha de perto.' },
  { value: 'Estratégico', label: 'Estratégico', detail: 'Visão de futuro e crescimento.' },
  { value: 'Influenciador', label: 'Influenciador', detail: 'Mobiliza equipes e inspira.' },
]

const leadershipPotentialOptions: Array<{ value: LeadershipPotential; label: string; detail: string }> = [
  { value: 'Baixo', label: 'Baixo', detail: 'Ainda precisa consolidar base.' },
  { value: 'Moderado', label: 'Moderado', detail: 'Sinaliza evolução com suporte.' },
  { value: 'Alto', label: 'Alto', detail: 'Pronto para ganhar mais responsabilidades.' },
  { value: 'Muito Alto', label: 'Muito Alto', detail: 'Forte candidato a cargos maiores.' },
  { value: 'Excepcional', label: 'Excepcional', detail: 'Perfil raro de liderança.' },
]

const leadershipReadinessOptions: Array<{ value: LeadershipReadiness; label: string; detail: string }> = [
  { value: 'Ainda não demonstra perfil de liderança', label: 'Ainda não demonstra', detail: 'Precisa de base e direcionamento.' },
  { value: 'Potencial em desenvolvimento', label: 'Potencial em desenvolvimento', detail: 'Evolui com acompanhamento.' },
  { value: 'Pronto para liderar pequenas equipes', label: 'Pequenas equipes', detail: 'Ja pode coordenar rotinas simples.' },
  { value: 'Pronto para liderar setores/departamentos', label: 'Setores / departamentos', detail: 'Pronto para uma liderança maior.' },
  { value: 'Pronto para liderar unidades ou grandes projetos', label: 'Unidades / grandes projetos', detail: 'Tem maturidade para amplitude institucional.' },
]

const leaderDevelopmentOptions: Array<{ value: LeaderDevelopment; label: string; detail: string }> = [
  { value: 'Não desenvolve', label: 'Não desenvolve', detail: 'Ainda não forma outros líderes.' },
  { value: 'Desenvolve ocasionalmente', label: 'Ocasionalmente', detail: 'Ajuda pontualmente outros profissionais.' },
  { value: 'Desenvolve regularmente', label: 'Regularmente', detail: 'Acompanha e orienta com frequência.' },
  { value: 'Forma novos líderes de maneira consistente', label: 'Forma líderes', detail: 'Prepara novos líderes de forma constante.' },
  { value: 'Multiplica líderes e fortalece a cultura institucional', label: 'Multiplica líderes', detail: 'Cria legado e cultura de sucessão.' },
]

const temperamentOptions: Array<{ value: TemperamentType; label: string; detail: string }> = [
  { value: 'Sanguíneo', label: 'Sanguíneo', detail: 'Comunicativo, entusiasmado e sociável.' },
  { value: 'Colérico', label: 'Colérico', detail: 'Decisivo, competitivo e orientado a resultados.' },
  { value: 'Fleumático', label: 'Fleumático', detail: 'Calmo, estável e bom mediador.' },
  { value: 'Melancólico', label: 'Melancólico', detail: 'Analítico, organizado e detalhista.' },
]

const behavioralProfileOptions: Array<{ value: BehavioralProfile; label: string; detail: string }> = [
  { value: 'Executor', label: 'Executor', detail: 'Faz acontecer e resolve rápido.' },
  { value: 'Influenciador', label: 'Influenciador', detail: 'Convence pessoas e comunica bem.' },
  { value: 'Analítico', label: 'Analítico', detail: 'Gosta de dados, processos e precisão.' },
  { value: 'Estável', label: 'Estável', detail: 'Mantém equilíbrio e confiança.' },
]

const decisionStyleOptions: Array<{ value: DecisionStyle; label: string; detail: string }> = [
  { value: 'Decide rapidamente mesmo com poucas informações', label: 'Rápida', detail: 'Age com velocidade e firmeza.' },
  { value: 'Busca equilíbrio entre velocidade e análise', label: 'Equilibrada', detail: 'Concilia rapidez e critério.' },
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
  { value: 'Mantém a calma', label: 'Mantém a calma', detail: 'Sustenta estabilidade sob pressão.' },
  { value: 'Assume o controle', label: 'Assume o controle', detail: 'Centraliza e organiza a resposta.' },
  { value: 'Busca apoio da equipe', label: 'Busca apoio', detail: 'Ativa o coletivo rapidamente.' },
  { value: 'Torna-se mais analítico', label: 'Mais analítico', detail: 'Redobra a leitura técnica.' },
  { value: 'Demonstra dificuldade sob pressão', label: 'Dificuldade', detail: 'Perde fluidez em cenários tensos.' },
]

const collaborationOptions: Array<{ value: CollaborationLevel; label: string; detail: string }> = [
  { value: 'Atua como agregador da equipe', label: 'Agregador', detail: 'Cria conexão e unidade.' },
  { value: 'Colabora ativamente com os demais', label: 'Colabora ativamente', detail: 'Participa e contribui sempre.' },
  { value: 'Colabora quando solicitado', label: 'Quando solicitado', detail: 'Ajuda sob demanda.' },
  { value: 'Prefere trabalhar de forma individual', label: 'Individual', detail: 'Entrega sozinho com autonomia.' },
  { value: 'Demonstra resistência ao trabalho em equipe', label: 'Resistência', detail: 'Precisa de mediação e apoio.' },
]

const convivenceOptions: Array<{ value: ConvivenceLevel; label: string; detail: string }> = [
  { value: 'Muito fácil de lidar', label: 'Muito fácil', detail: 'Flexível, receptivo e colaborativo.' },
  { value: 'Fácil de lidar', label: 'Fácil', detail: 'Boa convivência e comunicação adequada.' },
  { value: 'Moderadamente fácil de lidar', label: 'Moderada', detail: 'Algumas particularidades sem comprometer.' },
  { value: 'Difícil de lidar em algumas situações', label: 'Difícil em alguns casos', detail: 'Pode reagir ou resistir em certos cenários.' },
  { value: 'Frequentemente difícil de lidar', label: 'Frequentemente difícil', detail: 'Exige acompanhamento constante.' },
]

const relationalIntelligenceOptions: Array<{ value: RelationalIntelligence; label: string; detail: string }> = [
  { value: 'Recebe feedbacks com maturidade e busca crescimento', label: 'Maturidade alta', detail: 'Escuta e evolui com feedbacks.' },
  { value: 'Geralmente aceita feedbacks e faz ajustes', label: 'Aceita bem', detail: 'Faz ajustes quando orientado.' },
  { value: 'Aceita feedbacks com alguma resistência inicial', label: 'Resistência inicial', detail: 'Precisa de tempo para processar.' },
  { value: 'Tem dificuldade em aceitar feedbacks ou opiniões diferentes', label: 'Dificuldade', detail: 'Tem atrito com visões distintas.' },
  { value: 'Frequentemente reage de forma defensiva ou conflituosa', label: 'Defensiva', detail: 'Reage sob tensão relacional.' },
]

const relationalClassificationOptions: Array<{ value: RelationalClassification; label: string; detail: string }> = [
  { value: 'Referência positiva de relacionamento e trabalho em equipe', label: 'Referência positiva', detail: 'Modelo de convívio e equipe.' },
  { value: 'Relacionamento acima da média', label: 'Acima da média', detail: 'Boa convivência consistente.' },
  { value: 'Relacionamento adequado', label: 'Adequado', detail: 'Atende ao esperado.' },
  { value: 'Necessita desenvolver competências relacionais', label: 'Desenvolver', detail: 'Precisa fortalecer relações.' },
  { value: 'Necessita acompanhamento prioritário em relacionamento interpessoal', label: 'Acompanhamento', detail: 'Prioridade em relações.' },
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
  { id: 'aprovação', title: 'Aguardando aprovação', color: '#F8A303' },
  { id: 'revisao', title: 'Em revisão', color: '#8B5CF6' },
  { id: 'concluido', title: 'Concluído', color: '#34D399' },
]

const fallbackState: ManagementState = {
  work: [
    {
      id: 'T-1024',
      title: 'Fechar roteiro de matrículas 2026',
      owner: 'Secretaria escolar',
      area: 'Matrículas',
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
      owner: 'Operação',
      area: 'Suprimentos',
      stage: 'Aguardando aprovação',
      priority: 'Alta',
      due: 'Amanhã',
      project: 'Infraestrutura escolar',
      description: 'Consolidar cotações, verba e justificativa para direcao.',
      attachments: ['cotação-ti.xlsx'],
      tags: ['aprovação', 'compras'],
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
      project: 'Trilha de liderança',
      description: 'Montar pauta, materiais e critérios de avaliação.',
      attachments: ['trilha-coordenadores.pdf'],
      tags: ['liderança'],
      participants: ['Marina Costa', 'Pessoas'],
    },
    {
      id: 'T-1027',
      title: 'Atualizar política de atendimento familiar',
      owner: 'Direção',
      area: 'Governança',
      stage: 'Novo',
      priority: 'Media',
      due: 'Esta semana',
      project: 'Experiência da família',
      description: 'Ajustar tom institucional, tempos de retorno e canais oficiais.',
      attachments: ['politica-atendimento.docx'],
      tags: ['comunicação'],
      participants: ['Direção', 'Secretaria escolar'],
    },
    {
      id: 'T-1028',
      title: 'Concluir relatório mensal de desempenho',
      owner: 'Gestão',
      area: 'Relatórios',
      stage: 'Em revisão',
      priority: 'Alta',
      due: '18/06',
      project: 'Fechamento mensal',
      description: 'Revisar notas, indicadores de unidades e versão executiva.',
      attachments: ['desempenho-maio.pptx'],
      tags: ['executivo'],
      participants: ['Gestão', 'IA da Educação'],
    },
  ],
  admissions: [
    { id: 'MAT-2041', family: 'Família Silva', student: 'Pedro Silva - 6º ano', stage: 'Visita pedagógica', value: 1850, next: 'Confirmar presença da família' },
    { id: 'MAT-2042', family: 'Família Andrade', student: 'Lívia Andrade - 1º ano', stage: 'Proposta enviada', value: 1620, next: 'Enviar documentação' },
    { id: 'MAT-2043', family: 'Família Rocha', student: 'Emanuel Rocha - 4º ano', stage: 'Contato inicial', value: 1740, next: 'Agendar visita escolar' },
  ],
  people: [],
  finance: [
    { id: 'F-1', label: 'Matrículas previstas', type: 'Receita', amount: 3470, status: 'Previsto', due: 'Hoje' },
    { id: 'F-2', label: 'Compra de materiais pedagógicos', type: 'Despesa', amount: 980, status: 'A aprovar', due: 'Amanhã' },
    { id: 'F-3', label: 'Repasse de eventos escolares', type: 'Receita', amount: 2200, status: 'Confirmado', due: '20/06' },
  ],
  assets: [
    { id: 'A-1', name: 'Kits de matrícula', category: 'Material de secretaria', location: 'Secretaria APS', qty: 42, min: 60, status: 'Repor', supplier: 'Gráfica parceira', unitCost: 18.9, lastMove: '11/06', owner: 'Secretaria', nextAction: 'Comprar 30 unidades para campanha 2026' },
    { id: 'A-2', name: 'Projetores multimídia', category: 'Tecnologia educacional', location: 'Sala de recursos', qty: 4, min: 5, status: 'Crítico', supplier: 'TI regional', unitCost: 2490, lastMove: '08/06', owner: 'Operação', nextAction: 'Abrir aprovação de compra de 2 unidades' },
    { id: 'A-3', name: 'Chromebooks pedagógicos', category: 'Tecnologia educacional', location: 'Laboratório móvel', qty: 18, min: 16, status: 'Ok', supplier: 'Fornecedor homologado', unitCost: 1480, lastMove: '10/06', owner: 'Pedagógico', nextAction: 'Agendar conferência patrimonial' },
  ],
  knowledge: [
    { id: 'D-1', title: 'Política de matrícula 2026', type: 'Documento', owner: 'Secretaria', status: 'Revisão' },
    { id: 'D-2', title: 'Ata do comitê executivo', type: 'Nota', owner: 'Direção', status: 'Publicada' },
    { id: 'D-3', title: 'Checklist de abertura semanal', type: 'Checklist', owner: 'Operação', status: 'Ativo' },
  ],
  automations: [
    { id: 'AU-1', trigger: 'Tarefa vence hoje', action: 'Notificar responsável e resumir risco para a direção', status: 'Ativa' },
    { id: 'AU-2', trigger: 'Estoque abaixo do mínimo', action: 'Criar solicitação de compra e pedir aprovação', status: 'Ativa' },
    { id: 'AU-3', trigger: 'Evento novo no Google', action: 'Sincronizar na agenda mestra da Central Operacional', status: 'Ativa' },
  ],
}

const calendarConnections: CalendarConnection[] = [
  { id: 'google', name: 'Google Calendar', source: 'Base principal', status: 'Conectado', sync: 'Agora', color: '#29ABE2' },
  { id: 'microsoft', name: 'Outlook / Microsoft 365', source: 'Calendário externo', status: 'Pendente', sync: 'Aguardando OAuth', color: '#4A9EFF' },
  { id: 'icloud', name: 'iCloud Calendar', source: 'Calendário externo', status: 'Pendente', sync: 'Aguardando app password', color: '#A78BFA' },
]

const baseAgenda: AgendaEvent[] = [
  { id: 'EV-1', time: '08:30', title: 'Abertura operacional e prioridades do dia', area: 'Central', source: 'Google', color: '#F8A303' },
  { id: 'EV-2', time: '09:30', title: 'Visitas de famílias e pipeline de matrículas', area: 'Escola', source: 'Google', color: '#29ABE2' },
  { id: 'EV-3', time: '11:00', title: 'Despachos financeiros pendentes', area: 'Financeiro', source: 'Outlook', color: '#4A9EFF' },
  { id: 'EV-4', time: '14:00', title: 'Compras, estoque e patrimônio', area: 'Operação', source: 'Google', color: '#E07B39' },
  { id: 'EV-5', time: '16:00', title: 'Pessoas, treinamento e acompanhamento', area: 'Pessoas', source: 'iCloud', color: '#8B5CF6' },
]

const weeklyPanoramaBase: WeeklyDay[] = [
  { id: 'seg', weekday: 'Seg', label: 'Hoje', load: 92, count: 8, focus: 'Governança e agenda' },
  { id: 'ter', weekday: 'Ter', label: 'Amanhã', load: 76, count: 6, focus: 'Matrículas e financeiro' },
  { id: 'qua', weekday: 'Qua', label: '18/06', load: 64, count: 5, focus: 'Pessoas e reuniões' },
  { id: 'qui', weekday: 'Qui', label: '19/06', load: 52, count: 4, focus: 'Backoffice escolar' },
  { id: 'sex', weekday: 'Sex', label: '20/06', load: 83, count: 7, focus: 'Fechamento semanal' },
]

const sofiThreadsBase: SofiThread[] = [
  { id: 'S-1', title: 'Comando do dia', scope: 'Agenda + prioridades', lastAction: 'Atualizado ha 5 min' },
  { id: 'S-2', title: 'Projeto Matrículas 2026', scope: 'Projeto / pasta', lastAction: '2 arquivos gerados' },
  { id: 'S-3', title: 'Financeiro executivo', scope: 'Despesas + aprovações', lastAction: '1 rascunho de e-mail' },
]

function openSofi(prompt: string) {
  window.dispatchEvent(new CustomEvent('aps:open-sofi', { detail: { prompt } }))
}

function Surface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[1.35rem] border border-[#D8E5F0] bg-white shadow-[0_18px_48px_rgba(0,63,117,0.08)] ${className}`}>{children}</section>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 w-full rounded-2xl border border-[#C9DBEA] bg-white px-3 text-sm font-semibold text-[#0B1F36] outline-none transition placeholder:text-[#6B7F94] focus:border-[#00A9E0] focus:ring-4 focus:ring-[#00A9E0]/15 ${props.className || ''}`} />
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
  if (text.includes('coorden') || text.includes('direcao') || text.includes('gestão')) return 'Estratégico'
  if (text.includes('secretaria') || text.includes('atendimento') || text.includes('matricula')) return 'Organizador'
  if (text.includes('operação') || text.includes('suporte') || text.includes('processo')) return 'Executor'
  if (text.includes('pedagog') || text.includes('formação') || text.includes('trein')) return 'Desenvolvedor'
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
  return 'Ainda não demonstra perfil de liderança'
}

function inferLeaderDevelopment(level: LeadershipLevel): LeaderDevelopment {
  if (level >= 5) return 'Multiplica líderes e fortalece a cultura institucional'
  if (level === 4) return 'Forma novos líderes de maneira consistente'
  if (level === 3) return 'Desenvolve regularmente'
  if (level === 2) return 'Desenvolve ocasionalmente'
  return 'Não desenvolve'
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
    return { primary: 'Sanguíneo' as TemperamentType, secondary: 'Fleumático' as TemperamentType, rationale: 'perfil comunicativo e relacional' }
  }
  if (text.includes('coord') || text.includes('gestão') || text.includes('direcao') || text.includes('lider')) {
    return { primary: 'Colérico' as TemperamentType, secondary: 'Melancólico' as TemperamentType, rationale: 'decisão, foco em resultado e estrutura' }
  }
  if (text.includes('anal') || text.includes('finance') || text.includes('planej') || text.includes('processo')) {
    return { primary: 'Melancólico' as TemperamentType, secondary: 'Colérico' as TemperamentType, rationale: 'análise, detalhe e controle' }
  }
  return { primary: 'Fleumático' as TemperamentType, secondary: 'Sanguíneo' as TemperamentType, rationale: 'estabilidade e equilibrio' }
}

function inferBehavioralProfile(person: Partial<Person>): BehavioralProfile {
  const text = `${person.role || ''} ${person.unit || ''} ${person.name || ''}`.toLowerCase()
  if (text.includes('anal') || text.includes('finance') || text.includes('contabil') || text.includes('auditoria')) return 'Analítico'
  if (text.includes('atendimento') || text.includes('famil') || text.includes('relacion') || text.includes('comunic')) return 'Influenciador'
  if (text.includes('rotina') || text.includes('operação') || text.includes('secretaria') || text.includes('suporte')) return 'Executor'
  return 'Estável'
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

const legacyPeopleText: Record<string, string> = {
  Estrategico: 'Estratégico',
  Analitico: 'Analítico',
  Estavel: 'Estável',
  'Busca equilibrio entre velocidade e análise': 'Busca equilíbrio entre velocidade e análise',
  'Ainda nao demonstra perfil de lideranca': 'Ainda não demonstra perfil de liderança',
  'Nao desenvolve': 'Não desenvolve',
  'Forma novos lideres de maneira consistente': 'Forma novos líderes de maneira consistente',
  'Multiplica lideres e fortalece a cultura institucional': 'Multiplica líderes e fortalece a cultura institucional',
  'Mantem a calma': 'Mantém a calma',
  'Torna-se mais analitico': 'Torna-se mais analítico',
  'Demonstra dificuldade sob pressao': 'Demonstra dificuldade sob pressão',
  'Demonstra resistencia ao trabalho em equipe': 'Demonstra resistência ao trabalho em equipe',
  'Muito facil de lidar': 'Muito fácil de lidar',
  'Facil de lidar': 'Fácil de lidar',
  'Moderadamente facil de lidar': 'Moderadamente fácil de lidar',
  'Dificil de lidar em algumas situações': 'Difícil de lidar em algumas situações',
  'Frequentemente dificil de lidar': 'Frequentemente difícil de lidar',
  'Aceita feedbacks com alguma resistencia inicial': 'Aceita feedbacks com alguma resistência inicial',
  'Tem dificuldade em aceitar feedbacks ou opinioes diferentes': 'Tem dificuldade em aceitar feedbacks ou opiniões diferentes',
  'Referencia positiva de relacionamento e trabalho em equipe': 'Referência positiva de relacionamento e trabalho em equipe',
  'Relacionamento acima da media': 'Relacionamento acima da média',
  'Necessita desenvolver competencias relacionais': 'Necessita desenvolver competências relacionais',
  'Necessita acompanhamento prioritario em relacionamento interpessoal': 'Necessita acompanhamento prioritário em relacionamento interpessoal',
}

function normalizePeopleText<T extends string | undefined>(value: T): T {
  if (!value) return value
  return (legacyPeopleText[value] || value) as T
}

function normalizePerson(person: Partial<Person>): Person {
  const baseLevel = person.leadershipLevel ? clampNumber(person.leadershipLevel, 1, 5) as LeadershipLevel : levelFromScore(person.score)
  const normalizedProfile = normalizePeopleText(person.leadershipProfile) as LeadershipProfile | undefined
  const profile = (normalizedProfile && leadershipProfileOptions.some(option => option.value === normalizedProfile))
    ? normalizedProfile
    : inferLeadershipProfile(person)
  const potential = (person.leadershipPotential && leadershipPotentialOptions.some(option => option.value === person.leadershipPotential))
    ? person.leadershipPotential
    : inferLeadershipPotential(baseLevel)
  const normalizedReadiness = normalizePeopleText(person.leadershipReadiness) as LeadershipReadiness | undefined
  const readiness = (normalizedReadiness && leadershipReadinessOptions.some(option => option.value === normalizedReadiness))
    ? normalizedReadiness
    : inferLeadershipReadiness(baseLevel)
  const normalizedDevelopment = normalizePeopleText(person.leaderDevelopment) as LeaderDevelopment | undefined
  const development = (normalizedDevelopment && leaderDevelopmentOptions.some(option => option.value === normalizedDevelopment))
    ? normalizedDevelopment
    : inferLeaderDevelopment(baseLevel)
  const temperament = inferTemperament(person)
  const temperamentPrimary = (person.temperamentPrimary && temperamentOptions.some(option => option.value === person.temperamentPrimary))
    ? person.temperamentPrimary
    : temperament.primary
  const temperamentSecondary = (person.temperamentSecondary && temperamentOptions.some(option => option.value === person.temperamentSecondary))
    ? person.temperamentSecondary
    : temperament.secondary
  const normalizedBehavioralProfile = normalizePeopleText(person.behavioralProfile) as BehavioralProfile | undefined
  const behavioralProfile = (normalizedBehavioralProfile && behavioralProfileOptions.some(option => option.value === normalizedBehavioralProfile))
    ? normalizedBehavioralProfile
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
    training: person.training || 'Trilha de integração',
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
    decisionStyle: person.decisionStyle || 'Busca equilíbrio entre velocidade e análise',
    interpersonalLevel: person.interpersonalLevel || 'Equilibrado',
    convivenceLevel: (normalizePeopleText(person.convivenceLevel) as ConvivenceLevel | undefined) || 'Fácil de lidar',
    collaborationLevel: (normalizePeopleText(person.collaborationLevel) as CollaborationLevel | undefined) || 'Colabora ativamente com os demais',
    relationalIntelligence: (normalizePeopleText(person.relationalIntelligence) as RelationalIntelligence | undefined) || 'Geralmente aceita feedbacks e faz ajustes',
    relationalClassification: (normalizePeopleText(person.relationalClassification) as RelationalClassification | undefined) || 'Relacionamento adequado',
    pressureResponse: (normalizePeopleText(person.pressureResponse) as PressureResponse | undefined) || 'Mantém a calma',
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
    nextAction: person.nextAction || 'Acompanhar evolução da liderança',
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
    color: item.color || '',
    checklist: Array.isArray(item.checklist) ? item.checklist : [],
    comments: Array.isArray(item.comments) ? item.comments : [],
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
  const [queryView, setQueryView] = useState('agenda')
  useEffect(() => {
    if (forcedView || typeof window === 'undefined') return
    setQueryView(new URLSearchParams(window.location.search).get('view') || 'agenda')
  }, [forcedView])
  const activeView = forcedView || queryView
  const [state, setState] = useState<ManagementState>(fallbackState)
  const [workflowColumns, setWorkflowColumns] = useState<WorkflowColumn[]>(defaultWorkflowColumns)
  const [source, setSource] = useState<'api' | 'local'>('local')
  const [loading, setLoading] = useState(true)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickOwner, setQuickOwner] = useState('Vinicius')
  const [quickProject, setQuickProject] = useState('Operação do dia')
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
    const academic = academicEventsFromState(readAcademicState())
      .slice(0, 8)
      .map(event => ({
        id: event.id,
        time: event.time,
        title: event.title,
        area: event.location || 'Faculdade',
        source: 'Acadêmico',
        color: '#0ABD78',
      }))
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
    return [...academic, ...baseAgenda, ...derived]
  }, [state.work])

  const weeklyPanorama = useMemo(() => {
    return weeklyPanoramaBase.map((day, index) => ({
      ...day,
      count: day.count + (index === 0 ? state.work.filter(item => item.due === 'Hoje').length : 0),
    }))
  }, [state.work])

  const sofiContext = useMemo(() => {
    return `IA da Educação, atue como chefe da Central Operacional. Contexto completo: ${JSON.stringify({
      tarefas: state.work,
      agenda: agendaEvents,
      matriculas: state.admissions,
      financeiro: state.finance,
      pessoas: state.people,
      estoque: state.assets,
      documentos: state.knowledge,
      automações: state.automations,
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
      owner: quickOwner.trim() || 'IA da Educação',
      area: activeView === 'escolar' ? 'Escola' : activeView === 'pessoas' ? 'Pessoas' : 'Central',
      stage: workflowColumns[0]?.title || 'Novo',
      priority: 'Alta',
      due: 'Hoje',
      project: quickProject.trim() || 'Operação do dia',
      description: 'Item criado rapidamente pela Central Operacional.',
      attachments: quickAttachment.trim() ? [quickAttachment.trim()] : [],
      tags: ['rapido'],
      participants: [quickOwner.trim() || 'IA da Educação'],
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
          student: 'Aluno em qualificação',
          stage: 'Contato inicial',
          value: 1500,
          next: 'Agendar visita pedagógica',
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
          title: type === 'E-mail' ? 'Rascunho criado pela IA da Educação' : 'Documento operacional em revisão',
          type,
          owner: 'IA da Educação',
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
        temperamentPrimary: person.temperamentPrimary || 'Fleumático',
        temperamentPrimaryPercent: Number(person.temperamentPrimaryPercent || 70),
        temperamentSecondary: person.temperamentSecondary || 'Sanguíneo',
        temperamentSecondaryPercent: Number(person.temperamentSecondaryPercent || 30),
        temperamentReason: person.temperamentReason || '',
        behavioralProfile: (normalizePeopleText(person.behavioralProfile) as BehavioralProfile | undefined) || 'Estável',
        behavioralProfilePercent: Number(person.behavioralProfilePercent || 75),
        decisionStyle: person.decisionStyle || 'Busca equilíbrio entre velocidade e análise',
        interpersonalLevel: person.interpersonalLevel || 'Equilibrado',
        convivenceLevel: (normalizePeopleText(person.convivenceLevel) as ConvivenceLevel | undefined) || 'Fácil de lidar',
        collaborationLevel: person.collaborationLevel || 'Colabora ativamente com os demais',
        relationalIntelligence: person.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes',
        relationalClassification: person.relationalClassification || 'Relacionamento adequado',
        pressureResponse: (normalizePeopleText(person.pressureResponse) as PressureResponse | undefined) || 'Mantém a calma',
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
          <MetricCard label="Matrículas" value={money.format(state.admissions.reduce((sum, item) => sum + item.value, 0))} detail={`${state.admissions.length} famílias`} color="#00A9E0" />
          <MetricCard label="Saldo" value={money.format(totals.balance)} detail="projeção da semana" color="#005DAA" />
          <MetricCard label="Pessoas" value={`${totals.peoplePulse}%`} detail="pulso médio" color="#8B5CF6" />
        </section>
      )}

      {activeView !== 'pessoas' && (
        <form onSubmit={addQuickWork} className="grid gap-2 rounded-[1.2rem] border border-[#C9DBEA] bg-white p-3 shadow-[0_18px_44px_rgba(0,63,117,0.10)] xl:grid-cols-[minmax(260px,1.2fr)_180px_180px_180px_48px]">
          <Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Criar tarefa rápida..." />
          <Input value={quickOwner} onChange={event => setQuickOwner(event.target.value)} placeholder="Responsável" />
          <Input value={quickProject} onChange={event => setQuickProject(event.target.value)} placeholder="Projeto / pasta" />
          <Input value={quickAttachment} onChange={event => setQuickAttachment(event.target.value)} placeholder="Arquivo ou link" />
          <button className="flex h-11 items-center justify-center rounded-2xl bg-[#F8A303] text-black">
            <PlusIcon className="h-5 w-5" />
          </button>
        </form>
      )}

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
    <div className="rounded-[1.1rem] border border-[#D8E5F0] bg-white p-4 shadow-[0_12px_32px_rgba(0,63,117,0.07)]">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">{label}</p>
      <p className="mt-2 truncate text-2xl font-black leading-tight" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#37516D]">{detail}</p>
    </div>
  )
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#D8E5F0] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7F94]">{eyebrow}</p>}
        <h2 className="text-xl font-black text-[#0B1F36]">{title}</h2>
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
  const [checklistInput, setChecklistInput] = useState('')
  const [commentInput, setCommentInput] = useState('')

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
      checklist: selectedWork.checklist || [],
      comments: selectedWork.comments || [],
      color: selectedWork.color || '',
    })
    setChecklistInput('')
    setCommentInput('')
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

  function addChecklistItem() {
    const title = checklistInput.trim()
    if (!title) return
    setWorkDraft(current => current ? {
      ...current,
      checklist: [...(current.checklist || []), { id: `C-${Date.now()}`, title, done: false }],
    } : current)
    setChecklistInput('')
  }

  function toggleChecklistItem(id: string) {
    setWorkDraft(current => current ? {
      ...current,
      checklist: (current.checklist || []).map(item => item.id === id ? { ...item, done: !item.done } : item),
    } : current)
  }

  function removeChecklistItem(id: string) {
    setWorkDraft(current => current ? {
      ...current,
      checklist: (current.checklist || []).filter(item => item.id !== id),
    } : current)
  }

  function addComment() {
    const content = commentInput.trim()
    if (!content) return
    setWorkDraft(current => current ? {
      ...current,
      comments: [
        ...(current.comments || []),
        {
          id: `CM-${Date.now()}`,
          author: 'Equipe APS',
          content,
          createdAt: new Date().toISOString(),
        },
      ],
    } : current)
    setCommentInput('')
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
      color: workDraft.color || '',
      checklist: workDraft.checklist || [],
      comments: workDraft.comments || [],
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
                <h2 className="mt-2 text-2xl font-black text-white">Agenda, tarefas e decisões em uma leitura única</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/55">
                  {agendaEvents.length} compromissos carregados · {weeklyPanorama.length} blocos do panorama semanal · {workflowColumns.length} etapas ativas.
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
                    <p className="mt-1 text-sm font-semibold text-white/55">etapas de execução</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.55rem] border border-white/10 bg-gradient-to-r from-[#F8A303]/14 via-white/[0.03] to-white/[0.02] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Relatório central</p>
                      <p className="mt-2 text-sm font-black text-white">Leitura executiva consolidada</p>
                      <p className="mt-2 text-sm text-white/55">
                        Abra a visão de agenda para detalhar compromissos, decisões, responsáveis e próximos passos em uma leitura única.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onAddKnowledge('agenda')}
                        className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
                      >
                        Abrir relatório
                      </button>
                      <button
                        onClick={() => onAddKnowledge('agenda-sofi')}
                        className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white"
                      >
                        Gerar com IA da Educação
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Surface>

            <div className="hidden 2xl:block" />
          </div>

          <Surface className="overflow-hidden">
            <SectionHeader eyebrow="Panorama semanal" title="Carga, foco e distribuição da semana" />
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
                    <p className="mt-1 text-sm text-white/42">{item.owner} ? {item.project || item.area}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-black text-white/60">{item.stage}</span>
                  <span className="text-sm font-black" style={{ color: priorityColor(item.priority) }}>{item.priority}</span>
                  <div className="flex items-center justify-start">
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        openSofi(`IA da Educação, assuma esta tarefa e execute o proximo passo: ${item.title}`)
                      }}
                      className="h-10 rounded-2xl bg-[#0ABD78] px-4 text-xs font-black text-black"
                    >
                      Executar com IA da Educação
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
                      Clique para editar responsável, prazo, participantes, selos, arquivos e o contexto operacional da demanda.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSofi(`IA da Educação, assuma esta demanda: ${workDraft.title}. Responsavel ${workDraft.owner}. Etapa ${workDraft.stage}. Prioridade ${workDraft.priority}.`)}
                      className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white transition hover:border-white/20"
                    >
                      Abrir com IA da Educação
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
                      Salvar alterações
                    </button>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_380px]">
                  <div className="border-r border-white/10 p-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={workDraft.owner} onChange={event => setDraftField('owner', event.target.value)} placeholder="Responsável" className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white" />
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

                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
                      <Input
                        value={workDraft.color || ''}
                        onChange={event => setDraftField('color', event.target.value)}
                        placeholder="Cor do card, ex: #F8A303"
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white"
                      />
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4">
                        <span className="h-5 w-5 rounded-full border border-white/20" style={{ background: workDraft.color || priorityColor(workDraft.priority) }} />
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Cor visual</span>
                      </div>
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

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Checklist</p>
                          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/60">
                            {(workDraft.checklist || []).filter(item => item.done).length}/{workDraft.checklist?.length || 0}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={checklistInput}
                            onChange={event => setChecklistInput(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                addChecklistItem()
                              }
                            }}
                            placeholder="Adicionar item"
                            className="h-10 rounded-2xl border-white/10 bg-black/20 px-4 text-sm font-semibold text-white"
                          />
                          <button type="button" onClick={addChecklistItem} className="h-10 rounded-2xl bg-white/[0.08] px-4 text-xs font-black text-white">
                            Adicionar
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {(workDraft.checklist || []).map(item => (
                            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => toggleChecklistItem(item.id)}
                                className="h-4 w-4 accent-[#F8A303]"
                              />
                              <span className={`flex-1 text-sm font-semibold ${item.done ? 'text-white/35 line-through' : 'text-white/78'}`}>{item.title}</span>
                              <button type="button" onClick={() => removeChecklistItem(item.id)} className="rounded-full p-1 text-white/35 hover:bg-white/[0.06] hover:text-white">
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Comentarios</p>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={commentInput}
                            onChange={event => setCommentInput(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                addComment()
                              }
                            }}
                            placeholder="Registrar comentario"
                            className="h-10 rounded-2xl border-white/10 bg-black/20 px-4 text-sm font-semibold text-white"
                          />
                          <button type="button" onClick={addComment} className="h-10 rounded-2xl bg-white/[0.08] px-4 text-xs font-black text-white">
                            Enviar
                          </button>
                        </div>
                        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                          {(workDraft.comments || []).map(comment => (
                            <div key={comment.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-black text-white/70">{comment.author}</p>
                                <p className="text-[10px] font-semibold text-white/28">{new Date(comment.createdAt).toLocaleString('pt-BR')}</p>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-white/62">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
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
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Ações rápidas</p>
                      <div className="mt-3 grid gap-2">
                        <button
                          type="button"
                          onClick={() => openSofi(`IA da Educação, avance esta atividade dentro do fluxo: ${workDraft.title}. Contexto completo: ${workDraft.description || ''}`)}
                          className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-sm font-semibold text-white transition hover:border-white/20"
                        >
                          Avançar com IA da Educação
                        </button>
                        <button
                          type="button"
                          onClick={() => openSofi(`IA da Educação, gere um resumo executivo desta demanda: ${workDraft.title}. Inclua responsável, prazo, selos, participantes e próximos passos.`)}
                          className="h-11 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-left text-sm font-semibold text-white transition hover:border-white/20"
                        >
                          Gerar resumo
                        </button>
                        <button
                          type="button"
                          onClick={() => openSofi(`IA da Educação, compartilhe esta tarefa com os participantes: ${(workDraft.participants || []).join(', ')}.`)}
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
          const accent = item.color || priorityColor(item.priority)
          const checklistTotal = item.checklist?.length || 0
          const checklistDone = (item.checklist || []).filter(entry => entry.done).length
          const checklistProgress = checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0
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
                <span>?</span>
                <span>{item.project || item.area}</span>
              </div>

              {item.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/58">{item.description}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-white/38">
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/70">{item.due}</span>
                {checklistTotal ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/70">
                    {checklistDone}/{checklistTotal} checklist
                  </span>
                ) : null}
                {item.comments?.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-black text-white/70">
                    {item.comments.length} comentarios
                  </span>
                ) : null}
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

              {checklistTotal ? (
                <div className="mt-3 h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full" style={{ width: `${checklistProgress}%`, background: accent }} />
                </div>
              ) : null}

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
  const [prompt, setPrompt] = useState('Analise meu calendário unificado, reorganize tarefas, destaque riscos e prepare os próximos passos do dia.')

  return (
    <Surface className="p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-[#F8A303]/30 bg-[#F8A303]/12 p-3">
          <SparklesIcon className="h-6 w-6 text-[#F8A303]" />
        </div>
        <div>
          <h3 className="font-black text-white">IA da Educação operadora</h3>
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
          Conversar com a IA da Educação
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
          <SectionHeader eyebrow="Gestão escolar" title="CRM de matrículas e jornada da família" action={<button onClick={onAddAdmission} className="h-10 rounded-2xl bg-[#29ABE2] px-4 text-sm font-black text-black">Nova familia</button>} />
          <div className="divide-y divide-white/10">
            {state.admissions.map(item => (
              <div key={item.id} className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_200px_160px_180px] lg:items-center">
                <div>
                  <p className="font-black text-white">{item.family}</p>
                  <p className="mt-1 text-sm text-white/42">{item.student}</p>
                </div>
                <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-black text-white/60">{item.stage}</span>
                <span className="text-sm font-black text-[#0ABD78]">{money.format(item.value)}</span>
                <button onClick={() => openSofi(`IA da Educação, conduza o follow-up da família ${item.family}. Etapa: ${item.stage}. Próxima ação: ${item.next}.`)} className="h-10 rounded-2xl bg-[#29ABE2]/15 px-4 text-xs font-black text-[#29ABE2]">Assumir com IA da Educação</button>
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
              <h3 className="font-black text-white">Documentos e aprovações</h3>
              <button onClick={() => onAddKnowledge('Documento')} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-white">Novo</button>
            </div>
            <div className="mt-4 space-y-3">
              {state.knowledge.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.title}</p>
                    <p className="text-xs text-white/35">{item.type} ? {item.owner}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">{item.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#F8A303]/14 bg-[#F8A303]/8 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#FDC347]">IA da Educação executiva</p>
              <p className="mt-2 text-sm font-semibold text-white">Pode revisar contratos, gerar comunicados, montar régua de cobrança e preparar a pauta financeira da semana.</p>
              <button
                onClick={() => openSofi('IA da Educação, faça um parecer executivo da gestão escolar e financeira com prioridade em matrícula, caixa, aprovações e patrimônio crítico.')}
                className="mt-4 h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
              >
                Pedir parecer completo
              </button>
            </div>
          </Surface>
        </div>
      </div>

      <Surface className="overflow-hidden">
        <SectionHeader eyebrow="Estoque e patrimônio" title="Controle operacional de itens críticos" />
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
        <CompactInsight label="Destaque" value={topScore?.name || 'Equipe'} detail={topScore ? `${topScore.role} ÷ nota ${topScore.score?.toFixed(1)}` : 'sem avaliação'} color="#F8A303" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Equipe" title="Profissionais com foto, indicadores e próximas ações" />
          <div className="grid gap-4 p-5 xl:grid-cols-3">
            {people.map(item => <PersonCard key={item.id} person={item} onCreateAction={onCreateAction} />)}
          </div>
        </Surface>

        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Fila de pessoas" title="Ações abertas" />
          <div className="divide-y divide-white/10">
            {work.length === 0 && <p className="p-5 text-sm text-white/38">Nenhuma ação de pessoas em aberto.</p>}
            {work.map(item => (
              <div key={item.id} className="p-4">
                <p className="font-black text-white">{item.title}</p>
                <p className="mt-1 text-xs text-white/38">{item.owner} ? {item.due}</p>
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
        temperamentPrimary: draft.temperamentPrimary || 'Fleumático',
        temperamentPrimaryPercent: Number(draft.temperamentPrimaryPercent || 0),
        temperamentSecondary: draft.temperamentSecondary || 'Sanguíneo',
        temperamentSecondaryPercent: Number(draft.temperamentSecondaryPercent || 0),
        temperamentReason: draft.temperamentReason || '',
        behavioralProfile: (normalizePeopleText(draft.behavioralProfile) as BehavioralProfile | undefined) || 'Estável',
        behavioralProfilePercent: Number(draft.behavioralProfilePercent || 0),
        decisionStyle: draft.decisionStyle || 'Busca equilíbrio entre velocidade e análise',
        interpersonalLevel: draft.interpersonalLevel || 'Equilibrado',
        convivenceLevel: (normalizePeopleText(draft.convivenceLevel) as ConvivenceLevel | undefined) || 'Fácil de lidar',
        collaborationLevel: draft.collaborationLevel || 'Colabora ativamente com os demais',
        relationalIntelligence: draft.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes',
        relationalClassification: draft.relationalClassification || 'Relacionamento adequado',
        pressureResponse: (normalizePeopleText(draft.pressureResponse) as PressureResponse | undefined) || 'Mantém a calma',
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
    ? `${selectedPerson.name} atua como ${selectedPerson.role}. Nível ${selectedPerson.leadershipLevel || 3}, perfil ${selectedPerson.leadershipProfile || 'Executor'}, potencial ${selectedPerson.leadershipPotential || 'Alto'} e prontidão ${selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}.`
    : 'Selecione um profissional para ler a liderança, editar campos e abrir os relatórios.'

  const leadershipSnapshot = [
    { label: 'Nível', value: `N${selectedPerson?.leadershipLevel || 3}`, detail: 'maturidade atual' },
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
    { label: 'Dominante', value: `${temperamentPrimaryPercent}% ${selectedPerson.temperamentPrimary || 'Fleumático'}`, detail: selectedPerson.temperamentReason || 'perfil dominante' },
    { label: 'Secundário', value: `${temperamentSecondaryPercent}% ${selectedPerson.temperamentSecondary || 'Sanguíneo'}`, detail: 'traços complementares' },
    { label: 'Perfil', value: selectedPerson.behavioralProfile || 'Estável', detail: `${selectedPerson.behavioralProfilePercent || 75}% de aderência comportamental` },
    { label: 'Leitura', value: selectedPerson.relationalClassification || 'Relacionamento adequado', detail: 'síntese relacional' },
  ] : []
  const productivitySnapshot = selectedPerson ? [
    { label: 'Eficiência', value: `${selectedPerson.productivityEfficiency ?? 0}%`, detail: 'capacidade de concluir tarefas' },
    { label: 'Qualidade', value: `${selectedPerson.productivityQuality ?? 0}%`, detail: 'confiabilidade das entregas' },
    { label: 'Organização', value: `${selectedPerson.productivityOrganization ?? 0}%`, detail: 'gestão de prioridades' },
    { label: 'Índice geral', value: `${productivityIndex}%`, detail: productivityDiagnosis.label },
  ] : []
  const executivePerson = selectedPerson || topLeader || people[0] || null
  const executiveLeadershipPercent = executivePerson?.leadershipPercent ?? 0
  const executiveTemperamentLabel = executivePerson ? `${executivePerson.temperamentPrimaryPercent ?? 70}% ${executivePerson.temperamentPrimary || 'Fleumático'} / ${executivePerson.temperamentSecondaryPercent ?? 30}% ${executivePerson.temperamentSecondary || 'Sanguíneo'}` : 'Sem leitura de temperamento'
  const executiveProductivityLabel = executivePerson ? `${executivePerson.productivityIndex ?? productivityIndex}% ÷ ${inferProductivityDiagnosis(executivePerson.productivityIndex ?? productivityIndex).label}` : 'Sem índice de produtividade'

  return (
    <section className="space-y-5">
      <Surface className="overflow-hidden">
        <div className="p-5 xl:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Central executiva</p>
          <h2 className="mt-2 text-2xl font-black text-white">Liderança, temperamento e produtividade em uma leitura única</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            {executivePerson
              ? `${executivePerson.name} · ${executivePerson.role} · ${executivePerson.unit || 'Equipe'}`
              : 'Selecione uma pessoa para abrir a leitura executiva consolidada.'}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Liderança</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black text-[#C4B5FD]">{executiveLeadershipPercent}%</p>
                  <p className="mt-1 text-sm font-semibold text-white/55">{executivePerson?.leadershipProfile || 'Executor'} · N{executivePerson?.leadershipLevel || 3}</p>
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
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{executivePerson?.behavioralProfile || 'Estável'}</span>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/70">{executivePerson?.decisionStyle || 'Busca equilíbrio entre velocidade e análise'}</span>
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
                <span className="rounded-full bg-white/[0.05] px-3 py-2">Eficiência {executivePerson?.productivityEfficiency ?? 0}%</span>
                <span className="rounded-full bg-white/[0.05] px-3 py-2">Comprometimento {executivePerson?.productivityCommitment ?? 0}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.55rem] border border-white/10 bg-gradient-to-r from-[#F8A303]/14 via-white/[0.03] to-white/[0.02] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">Relatório central</p>
                <p className="mt-2 text-sm font-black text-white">Leitura executiva consolidada</p>
                <p className="mt-2 text-sm text-white/55">
                  Abra a ficha centralizada para detalhar liderança, temperamento, personalidade e produtividade em um relatório único.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => executivePerson && onCreateAction(executivePerson, `Relatorio geral - ${executivePerson.name}`)}
                  className="h-10 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black"
                >
                  Abrir relatório
                </button>
                <button
                  onClick={() => executivePerson && openSofi(`IA da Educação, gere uma leitura executiva central de ${executivePerson.name} com liderança, temperamento, personalidade e produtividade.`)}
                  className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white"
                >
                  Gerar com IA da Educação
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
              onClick={() => selectedPerson && onCreateAction(selectedPerson, `Relatório geral de liderança - ${selectedPerson.name}`)}
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
                      <ProgressRow label="Liderança" value={leadershipPercent} color="#8B5CF6" />
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
                        {temperamentPrimaryPercent}% {selectedPerson?.temperamentPrimary || 'Fleumático'} e {temperamentSecondaryPercent}% {selectedPerson?.temperamentSecondary || 'Sanguíneo'}.
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
                          <p className="mt-1 text-sm font-black text-white">{selectedPerson?.behavioralProfile || 'Estável'}</p>
                          <p className="mt-1 text-xs text-white/38">{selectedPerson?.behavioralProfilePercent || 75}% de aderência</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/32">Tomada de decisão</p>
                          <p className="mt-1 text-sm font-black text-white">{selectedPerson?.decisionStyle || 'Busca equilíbrio entre velocidade e análise'}</p>
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
                        <Input value={draft?.nextReview || ''} onChange={event => syncDraftField('nextReview', event.target.value)} placeholder="Próxima revisão" />
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

                    <ChoiceGroup label="Eixo 1 - Nível de maturidade" value={draft?.leadershipLevel || 3} options={leadershipMaturityOptions} onChange={value => syncDraftField('leadershipLevel', value as LeadershipLevel)} />
                    <ChoiceGroup label="Eixo 2 - Perfil de liderança" value={draft?.leadershipProfile || 'Executor'} options={leadershipProfileOptions} onChange={value => syncDraftField('leadershipProfile', value as LeadershipProfile)} />
                    <ChoiceGroup label="Potencial para cargos maiores" value={draft?.leadershipPotential || 'Alto'} options={leadershipPotentialOptions} onChange={value => syncDraftField('leadershipPotential', value as LeadershipPotential)} />
                    <ChoiceGroup label="Prontidão para liderança" value={draft?.leadershipReadiness || 'Potencial em desenvolvimento'} options={leadershipReadinessOptions} onChange={value => syncDraftField('leadershipReadiness', value as LeadershipReadiness)} />
                    <ChoiceGroup label="Capacidade de desenvolver outros líderes" value={draft?.leaderDevelopment || 'Desenvolve regularmente'} options={leaderDevelopmentOptions} onChange={value => syncDraftField('leaderDevelopment', value as LeaderDevelopment)} />

                    <ChoiceGroup label="Temperamento predominante" value={draft?.temperamentPrimary || 'Fleumático'} options={temperamentOptions} onChange={value => syncDraftField('temperamentPrimary', value as TemperamentType)} />
                    <ChoiceGroup label="Temperamento secundário" value={draft?.temperamentSecondary || 'Sanguíneo'} options={temperamentOptions} onChange={value => syncDraftField('temperamentSecondary', value as TemperamentType)} />
                    <ChoiceGroup label="Perfil comportamental" value={draft?.behavioralProfile || 'Estável'} options={behavioralProfileOptions} onChange={value => syncDraftField('behavioralProfile', value as BehavioralProfile)} />
                    <ChoiceGroup label="Tomada de decisão" value={draft?.decisionStyle || 'Busca equilíbrio entre velocidade e análise'} options={decisionStyleOptions} onChange={value => syncDraftField('decisionStyle', value as DecisionStyle)} />
                    <ChoiceGroup label="Relacionamento interpessoal" value={draft?.interpersonalLevel || 'Equilibrado'} options={interpersonalLevelOptions} onChange={value => syncDraftField('interpersonalLevel', value as InterpersonalLevel)} />
                    <ChoiceGroup label="Resposta à pressão" value={draft?.pressureResponse || 'Mantém a calma'} options={pressureResponseOptions} onChange={value => syncDraftField('pressureResponse', value as PressureResponse)} />
                    <ChoiceGroup label="Facilidade de convivência" value={draft?.convivenceLevel || 'Fácil de lidar'} options={convivenceOptions} onChange={value => syncDraftField('convivenceLevel', value as ConvivenceLevel)} />
                    <ChoiceGroup label="Trabalho em equipe" value={draft?.collaborationLevel || 'Colabora ativamente com os demais'} options={collaborationOptions} onChange={value => syncDraftField('collaborationLevel', value as CollaborationLevel)} />
                    <ChoiceGroup label="Inteligência relacional" value={draft?.relationalIntelligence || 'Geralmente aceita feedbacks e faz ajustes'} options={relationalIntelligenceOptions} onChange={value => syncDraftField('relationalIntelligence', value as RelationalIntelligence)} />
                    <ChoiceGroup label="Classificação geral de relacionamento" value={draft?.relationalClassification || 'Relacionamento adequado'} options={relationalClassificationOptions} onChange={value => syncDraftField('relationalClassification', value as RelationalClassification)} />

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
                        <button onClick={() => selectedPerson && openSofi(`IA da Educação, gere um relatório executivo completo de ${selectedPerson.name}. Liderança: Nível ${selectedPerson.leadershipLevel || 3}, perfil ${selectedPerson.leadershipProfile || 'Executor'}, potencial ${selectedPerson.leadershipPotential || 'Alto'}, prontidão ${selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}, desenvolve líderes ${selectedPerson.leaderDevelopment || 'Desenvolve regularmente'}. Temperamento: ${selectedPerson.temperamentPrimaryPercent || 70}% ${selectedPerson.temperamentPrimary || 'Fleumático'} e ${selectedPerson.temperamentSecondaryPercent || 30}% ${selectedPerson.temperamentSecondary || 'Sanguíneo'}. Produtividade: índice ${productivityIndex}%, diagnóstico ${productivityDiagnosis.label}. Inclua arquivos ${(selectedPerson.files || []).join(', ')} e um plano de desenvolvimento.`)} className="h-11 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black">Gerar com IA da Educação</button>
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
          <SectionHeader eyebrow="Ações" title="Fluxo aberto do time" />
          <div className="divide-y divide-white/10">
            {recentWork.length === 0 && <p className="p-5 text-sm text-white/38">Nenhuma ação de pessoas em aberto.</p>}
            {recentWork.map(item => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_110px_140px] md:items-center">
                <div>
                  <p className="font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-white/38">{item.owner} ? {item.due}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/55">{item.priority}</span>
                <button onClick={() => openSofi(`IA da Educação, assuma a ação de pessoas "${item.title}" com contexto de ${item.owner}.`)} className="h-10 rounded-2xl bg-white/[0.07] px-4 text-xs font-black text-white">Abrir</button>
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
                  onClick={() => openSofi(`IA da Educação, monte um plano de desenvolvimento para ${person.name}, considerando nivel ${person.leadershipLevel || 3}, perfil ${person.leadershipProfile || 'Executor'}, potencial ${person.leadershipPotential || 'Alto'} e prontidao ${person.leadershipReadiness || 'Potencial em desenvolvimento'}.`)}
                  className="mt-4 h-10 rounded-2xl bg-white/[0.07] px-4 text-xs font-black text-white"
                >
                  Pedir plano · IA da Educação
                </button>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </section>
  )
}

function parseSubmissionRaw(submission: any) {
  if (!submission?.rawJson || typeof submission.rawJson !== 'string') return {}
  try {
    return JSON.parse(submission.rawJson)
  } catch {
    return {}
  }
}

function cleanProfileText(value: unknown, fallback = '') {
  const text = String(value || '').trim()
  if (!text) return fallback
  if (text.startsWith('data:image/')) return fallback
  if (text.includes('drive.google.com/uc?export=view&id=')) return fallback
  if (text.length > 1200 && /^(\/9j\/|iVBORw0KGgo|R0lGOD)/.test(text)) return fallback
  return text
}

function resolveSubmissionPhoto(submission: any) {
  const raw: any = parseSubmissionRaw(submission)
  const backup = submission?.backup?.record || raw?.backup?.record || {}
  const candidates = [
    submission?.photoDataUrl,
    raw?.photoDataUrl,
    backup?.photoDataUrl,
    submission?.photoUrl,
    raw?.photoUrl,
    backup?.photoUrl,
    submission?.photo?.webContentLink,
    submission?.photo?.webViewLink,
    raw?.photo?.webContentLink,
    raw?.photo?.webViewLink,
    submission?.notes,
    raw?.notes,
    submission?.bio,
    raw?.bio,
  ].map(value => String(value || '').trim()).filter(Boolean)

  const dataUrl = candidates.find(value => value.startsWith('data:image/'))
  if (dataUrl) return dataUrl

  const base64 = String(submission?.photoBase64 || raw?.photoBase64 || backup?.photoBase64 || '').trim()
  const mimeType = String(submission?.photoMimeType || raw?.photoMimeType || backup?.photoMimeType || 'image/jpeg').trim()
  if (base64 && /^(\/9j\/|iVBORw0KGgo|R0lGOD)/.test(base64)) return `data:${mimeType};base64,${base64}`

  return candidates.find(value => value.includes('drive.google.com/')) || ''
}

function mapSubmissionToPerson(submission: any): Person {
  const raw: any = parseSubmissionRaw(submission)
  const merged = { ...submission, ...raw }
  const computed = merged?.computed || {}
  const indices = computed?.indices || {}
  const temperament = computed?.temperament || {}
  const productivity = computed?.productivity || {}
  const alerts = computed?.alerts || {}
  const finalProfile = computed?.finalProfile || {}
  const leadership = Number(indices?.leadershipPotential?.score || indices?.leadership?.score || indices?.promotionPotential?.score || indices?.promotion?.score || 0)
  const emotional = Number(indices?.emotionalIntelligence?.score || indices?.emotional?.score || 0)
  const relationship = Number(indices?.interpersonalRelationship?.score || indices?.relationship?.score || temperament?.primaryPercent || 75)
  const productivityIndex = Number(productivity?.index || indices?.productivity?.score || 0)
  const photo = resolveSubmissionPhoto(merged)
  const role = String(merged?.role || 'Promotor')

  return {
    id: `FORM-${merged?.id || merged?.email || merged?.promoterName || Date.now()}`,
    name: String(merged?.promoterName || 'Pessoa do formulário'),
    role,
    unit: String(merged?.unit || ''),
    training: role.toLowerCase().includes('diretor') ? 'Diretores' : 'Promotores de matrícula',
    nextReview: 'Revisar formulário',
    avatar: photo,
    score: Math.round(((leadership + productivityIndex + relationship) / 3) / 20),
    leadershipPercent: leadership || 70,
    leadershipLevel: leadership >= 90 ? 5 : leadership >= 80 ? 4 : leadership >= 60 ? 3 : 2,
    leadershipProfile: 'Executor',
    leadershipPotential: leadership >= 85 ? 'Muito Alto' : leadership >= 70 ? 'Alto' : 'Moderado',
    leadershipReadiness: leadership >= 80 ? 'Pronto para liderar pequenas equipes' : 'Potencial em desenvolvimento',
    leaderDevelopment: 'Desenvolve regularmente',
    temperamentPrimary: (temperament?.primary || 'Fleumático') as TemperamentType,
    temperamentPrimaryPercent: Number(temperament?.primaryPercent || 70),
    temperamentSecondary: (temperament?.secondary || 'Sanguíneo') as TemperamentType,
    temperamentSecondaryPercent: Number(temperament?.secondaryPercent || 20),
    temperamentTertiary: (temperament?.tertiary || 'Colérico') as TemperamentType,
    temperamentTertiaryPercent: Number(temperament?.tertiaryPercent ?? 10),
    temperamentReason: String(temperament?.reason || ''),
    behavioralProfile: normalizePeopleText(computed?.behavioralProfile?.profile || 'Estável') as BehavioralProfile,
    behavioralProfilePercent: Number(computed?.behavioralProfile?.percent || relationship || 75),
    decisionStyle: 'Busca equilíbrio entre velocidade e análise',
    interpersonalLevel: relationship >= 85 ? 'Comunicativo' : 'Equilibrado',
    convivenceLevel: relationship >= 80 ? 'Fácil de lidar' : 'Moderadamente fácil de lidar',
    collaborationLevel: 'Colabora ativamente com os demais',
    relationalIntelligence: 'Geralmente aceita feedbacks e faz ajustes',
    relationalClassification: relationship >= 85 ? 'Relacionamento acima da média' : 'Relacionamento adequado',
    pressureResponse: 'Mantém a calma',
    productivityEfficiency: Number(productivity?.efficiency || productivityIndex),
    productivityQuality: Number(productivity?.quality || productivityIndex),
    productivityOrganization: Number(productivity?.organization || productivityIndex),
    productivityCommitment: Number(productivity?.commitment || productivityIndex),
    productivityAutonomy: Number(productivity?.autonomy || productivityIndex),
    productivityIndex,
    productivityDiagnosis: String(productivity?.diagnosis || indices?.productivity?.label || ''),
    pulse: relationship || 75,
    attendance: 0,
    workload: alerts?.procrastination?.level === 'Alto' ? 88 : 60,
    strengths: [finalProfile?.title, temperament?.primary, computed?.behavioralProfile?.profile].filter(Boolean).map(String),
    risks: [
      alerts?.centralization?.level === 'Alto' ? 'centralização' : '',
      alerts?.conflictRisk?.level === 'Alto' ? 'conflitos' : '',
      alerts?.procrastination?.level === 'Alto' ? 'procrastinação' : '',
    ].filter(Boolean),
    nextAction: 'Analisar formulário recebido e validar plano individual.',
    bio: cleanProfileText(finalProfile?.description || merged?.notes, ''),
    email: String(merged?.email || ''),
    phone: String(merged?.phone || ''),
    files: [merged?.driveFolder, merged?.driveSnapshot?.webViewLink, merged?.driveReport?.webViewLink, merged?.photoUrl].filter(Boolean).map(String),
    assessmentForm: merged,
    driveSyncAt: String(merged?.submittedAt || ''),
    driveSyncProvider: 'Google Drive',
    driveSyncFile: merged?.driveSnapshot?.webViewLink || '',
  }
}

function getPersonPhoto(person: Person | null | undefined) {
  if (!person) return ''
  const form: any = person.assessmentForm || {}
  return String(person.avatar || resolveSubmissionPhoto(form) || '')
}

function getInitials(value: string) {
  return String(value || 'APS30')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'S'
}

function isRealSubmittedPerson(person: Person) {
  const name = String(person.name || '').trim().toLowerCase()
  const email = String(person.email || '').trim().toLowerCase()
  if (!name) return false
  if (name.includes('teste') || email.includes('example.com')) return false
  if (['rafael almeida', 'juliana martins', 'marina costa'].includes(name)) return false
  return Boolean(person.assessmentForm || person.email || person.phone)
}

function isVisiblePerson(person: Person) {
  const name = String(person.name || '').trim().toLowerCase()
  const email = String(person.email || '').trim().toLowerCase()
  if (!name) return false
  if (name.includes('teste') || email.includes('example.com')) return false
  return !['rafael almeida', 'juliana martins', 'marina costa'].includes(name)
}

function readCachedSubmittedPeople() {
  try {
    const raw = window.localStorage.getItem(PEOPLE_SUBMISSIONS_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(item => normalizePerson(item)).filter(isRealSubmittedPerson) : []
  } catch {
    return []
  }
}

function writeCachedSubmittedPeople(people: Person[]) {
  try {
    window.localStorage.setItem(PEOPLE_SUBMISSIONS_CACHE_KEY, JSON.stringify(people))
  } catch {}
}

const restoredSubmittedPeople = (restoredPromoterSubmissions as any[])
  .map(mapSubmissionToPerson)
  .filter(isRealSubmittedPerson)

function mergeSubmittedPeople(...groups: Person[][]) {
  const byKey = new Map<string, Person>()
  for (const person of groups.flat()) {
    if (!isRealSubmittedPerson(person)) continue
    const key = `${person.email || person.id || ''}|${person.name}`.toLowerCase()
    byKey.set(key, person)
  }
  return Array.from(byKey.values())
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
  const [viewMode, setViewMode] = useState<'geral' | 'por-cargo' | 'detalhado' | 'promotores' | 'diretores' | 'completo'>('geral')
  const [unitFilter, setUnitFilter] = useState('Todos')
  const [roleFilter, setRoleFilter] = useState('Todos')
  const [traitFilter, setTraitFilter] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [draft, setDraft] = useState<Person | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'relatorio' | 'editar' | 'categorias' | 'arquivos'>('relatorio')
  const [fileInput, setFileInput] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [creatingPerson, setCreatingPerson] = useState(false)
  const [formLinkCopied, setFormLinkCopied] = useState(false)
  const [submittedPeople, setSubmittedPeople] = useState<Person[]>(() => mergeSubmittedPeople(restoredSubmittedPeople, readCachedSubmittedPeople()))

  const allPeople = useMemo(() => {
    const submitted = [...submittedPeople]
      .filter(isRealSubmittedPerson)
      .sort((a, b) => String(a.driveSyncAt || '').localeCompare(String(b.driveSyncAt || '')))
    const manual = people.map(person => normalizePerson(person)).filter(isVisiblePerson)
    const byKey = new Map<string, Person>()
    for (const person of [...submitted, ...manual]) {
      byKey.set(`${person.email || ''}|${person.name}`.toLowerCase(), person)
    }
    return Array.from(byKey.values())
  }, [people, submittedPeople])

  const selectedPerson = draft || allPeople.find(person => person.id === selectedPersonId) || null

  useEffect(() => {
    let active = true
    const loadSubmittedPeople = async () => {
      try {
        const { data } = await api.get('/promoter-forms/submissions')
        const submissions = Array.isArray(data?.submissions) ? data.submissions : []
        const mapped = submissions.map(mapSubmissionToPerson).filter(isRealSubmittedPerson)
        if (!active) return
        if (mapped.length) {
          setSubmittedPeople(current => mergeSubmittedPeople(restoredSubmittedPeople, readCachedSubmittedPeople(), current, mapped))
          writeCachedSubmittedPeople(mapped)
          return
        }
        setSubmittedPeople(current => mergeSubmittedPeople(restoredSubmittedPeople, readCachedSubmittedPeople(), current))
      } catch {
        if (active) setSubmittedPeople(current => mergeSubmittedPeople(restoredSubmittedPeople, readCachedSubmittedPeople(), current))
      }
    }
    void loadSubmittedPeople()
    const timer = window.setInterval(loadSubmittedPeople, 60000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (selectedPersonId && !allPeople.some(person => person.id === selectedPersonId)) {
      setSelectedPersonId('')
      setDraft(null)
      setDrawerOpen(false)
    }
  }, [allPeople, selectedPersonId])

  useEffect(() => {
    if (!selectedPersonId) return
    const next = allPeople.find(person => person.id === selectedPersonId) || null
    setDraft(next ? { ...next, files: [...(next.files || [])] } : null)
    setCreatingPerson(false)
  }, [allPeople, selectedPersonId])

  const filterOptions = useMemo(() => {
    const unique = (values: Array<string | undefined>) => ['Todos', ...Array.from(new Set(values.filter(Boolean) as string[])).sort()]
    return {
      units: unique(allPeople.map(person => person.unit)),
      roles: unique(allPeople.map(person => person.role)),
      traits: ['Todos', 'Liderança alta', 'Produtividade alta', 'Relacionamento forte', 'Atenção', 'Sem foto'],
    }
  }, [allPeople, people])

  const filteredPeople = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return allPeople.filter(person => {
      const leadership = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
      const productivity = person.productivityIndex ?? inferProductivityIndex([
        person.productivityEfficiency,
        person.productivityQuality,
        person.productivityOrganization,
        person.productivityCommitment,
        person.productivityAutonomy,
      ])
      const relationalStrong = ['Referência positiva de relacionamento e trabalho em equipe', 'Relacionamento acima da média'].includes(person.relationalClassification || '')
      const isPromoter = `${person.role} ${person.training} ${person.bio}`.toLowerCase().includes('promotor')
      const isDirector = `${person.role} ${person.training} ${person.bio}`.toLowerCase().includes('diretor') || `${person.role}`.toLowerCase().includes('director')
      const searchable = `${person.name} ${person.role} ${person.unit} ${person.email} ${person.phone} ${(person.strengths || []).join(' ')}`.toLowerCase()

      if (viewMode === 'promotores' && !isPromoter) return false
      if (viewMode === 'diretores' && !isDirector) return false
      if (unitFilter !== 'Todos' && (person.unit || '') !== unitFilter) return false
      if (roleFilter !== 'Todos' && (person.role || '') !== roleFilter) return false
      if (term && !searchable.includes(term)) return false
      if (traitFilter === 'Liderança alta' && leadership < 80) return false
      if (traitFilter === 'Produtividade alta' && productivity < 80) return false
      if (traitFilter === 'Relacionamento forte' && !relationalStrong) return false
      if (traitFilter === 'Atenção' && leadership >= 60 && productivity >= 60 && (person.workload || 0) < 85) return false
      if (traitFilter === 'Sem foto' && getPersonPhoto(person)) return false
      return true
    })
  }, [allPeople, viewMode, unitFilter, roleFilter, traitFilter, searchTerm])

  const lineupPeople = useMemo(() => {
    return [...filteredPeople].sort((a, b) => {
      const aLeadership = a.leadershipPercent ?? Math.round((a.score || 0) * 20)
      const bLeadership = b.leadershipPercent ?? Math.round((b.score || 0) * 20)
      const aProductivity = a.productivityIndex ?? inferProductivityIndex([a.productivityEfficiency, a.productivityQuality, a.productivityOrganization, a.productivityCommitment, a.productivityAutonomy])
      const bProductivity = b.productivityIndex ?? inferProductivityIndex([b.productivityEfficiency, b.productivityQuality, b.productivityOrganization, b.productivityCommitment, b.productivityAutonomy])
      if (viewMode === 'geral') return (a.unit || '').localeCompare(b.unit || '') || a.name.localeCompare(b.name)
      return (bLeadership + bProductivity) - (aLeadership + aProductivity)
    })
  }, [filteredPeople, viewMode])

  const selectedLeadership = selectedPerson?.leadershipPercent ?? Math.round((selectedPerson?.score || 0) * 20)
  const selectedProductivity = selectedPerson?.productivityIndex ?? inferProductivityIndex([
    selectedPerson?.productivityEfficiency,
    selectedPerson?.productivityQuality,
    selectedPerson?.productivityOrganization,
    selectedPerson?.productivityCommitment,
    selectedPerson?.productivityAutonomy,
  ])
  function createEmptyDraft(): Person {
    return {
      id: `P-${Date.now()}`,
      name: '',
      role: 'Promotor de matrículas',
      unit: '',
      training: 'Promotores de matrícula',
      nextReview: '',
      avatar: '',
      score: 0,
      leadershipPercent: 0,
      leadershipLevel: 3,
      leadershipProfile: 'Executor',
      leadershipPotential: 'Alto',
      leadershipReadiness: 'Potencial em desenvolvimento',
      leaderDevelopment: 'Desenvolve regularmente',
      temperamentPrimary: 'Fleumático',
      temperamentPrimaryPercent: 70,
      temperamentSecondary: 'Sanguíneo',
      temperamentSecondaryPercent: 30,
      behavioralProfile: 'Estável',
      behavioralProfilePercent: 75,
      decisionStyle: 'Busca equilíbrio entre velocidade e análise',
      interpersonalLevel: 'Equilibrado',
      convivenceLevel: 'Fácil de lidar',
      collaborationLevel: 'Colabora ativamente com os demais',
      relationalIntelligence: 'Geralmente aceita feedbacks e faz ajustes',
      relationalClassification: 'Relacionamento adequado',
      pressureResponse: 'Mantém a calma',
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

  function selectPerson(person: Person) {
    setSelectedPersonId(person.id)
    setDraft({ ...person, files: [...(person.files || [])] })
    setDrawerOpen(true)
    setPanelTab('relatorio')
  }

  async function copyPublicFormLink() {
    await navigator.clipboard.writeText('https://aps-edu.vercel.app/promotores/form/publico')
    setFormLinkCopied(true)
    window.setTimeout(() => setFormLinkCopied(false), 1800)
  }

  function syncDraftField<K extends keyof Person>(key: K, value: Person[K]) {
    setDraft(current => (current ? { ...current, [key]: value } : current))
  }

  function handleAvatarFile(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDraft(current => (current ? { ...current, avatar: String(reader.result || '') } : current))
    reader.readAsDataURL(file)
  }

  function downloadPhoto(person: Person) {
    const photo = getPersonPhoto(person)
    if (!photo) return
    const link = document.createElement('a')
    link.href = photo
    link.download = `${person.name || 'foto-sofi'}.jpg`.replace(/[\\/:*?"<>|]+/g, '-')
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function reportEscape(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function answerEvidence(person: Person) {
    const form: any = person.assessmentForm || {}
    const answers = form.answers || {}
    const sections = getPromoterFormQuestionSections()

    const getAnswer = (question: any) => {
      const raw = answers[question.id]
      if (raw === undefined || raw === null || raw === '') return null
      if (question.type === 'single') {
        const option = question.options?.[Number(raw)]
        if (!option) return null
        return { question, label: option.label, score: Number(option.score || 0), raw }
      }
      const numeric = Number(raw)
      if (!Number.isFinite(numeric)) return null
      const adjusted = question.reverse ? 6 - numeric : numeric
      const labels = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente']
      return { question, label: labels[Math.max(0, Math.min(4, numeric - 1))] || String(raw), score: adjusted, raw }
    }

    const rows = PROMOTER_QUESTIONS.map(getAnswer).filter(Boolean) as Array<{ question: any; label: string; score: number; raw: unknown }>
    const bySection = sections.map(section => {
      const sectionRows = rows.filter(row => row.question.sectionId === section.id)
      const average = sectionRows.length ? Math.round((sectionRows.reduce((sum, row) => sum + row.score, 0) / (sectionRows.length * 5)) * 100) : 0
      const strengths = sectionRows.filter(row => row.score >= 4).slice(0, 4)
      const attention = sectionRows.filter(row => row.score <= 2).slice(0, 4)
      return { ...section, rows: sectionRows, average, strengths, attention }
    })

    const strongest = [...rows].sort((a, b) => b.score - a.score).slice(0, 7)
    const weakest = [...rows].sort((a, b) => a.score - b.score).slice(0, 7)
    return { rows, bySection, strongest, weakest, answeredCount: rows.length }
  }

  function buildCompleteReportHtml(person: Person) {
    const leadership = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
    const productivity = person.productivityIndex ?? inferProductivityIndex([
      person.productivityEfficiency,
      person.productivityQuality,
      person.productivityOrganization,
      person.productivityCommitment,
      person.productivityAutonomy,
    ])
    const relationship = person.behavioralProfilePercent ?? 75
    const photo = getPersonPhoto(person)
    const form: any = person.assessmentForm || {}
    const productivityLabel = inferProductivityDiagnosis(productivity).label
    const evidence = answerEvidence(person)
    const executive = cleanProfileText(person.bio, '')
    const strengths = (person.strengths || []).filter(Boolean).slice(0, 8)
    const risks = (person.risks || []).filter(Boolean).slice(0, 8)
    const formComputed: any = form.computed || {}
    const alerts = formComputed.alerts || {}
    const photoHtml = photo
      ? `<img class="photo" src="${reportEscape(photo)}" alt="${reportEscape(person.name)}">`
      : `<div class="photo empty">${reportEscape(getInitials(person.name))}</div>`
    const bar = (label: string, value: number, className = '') => `
      <div class="bar"><div><strong>${reportEscape(label)}</strong><span>${Math.round(value || 0)}%</span></div><div class="track"><i class="${className}" style="width:${Math.max(0, Math.min(100, Math.round(value || 0)))}%"></i></div></div>`
    const evidenceList = (items: Array<{ question: any; label: string; score: number }>, empty: string) => items.length
      ? items.map(item => `<li><b>${reportEscape(item.question.prompt)}</b><span>${reportEscape(item.label)}</span></li>`).join('')
      : `<li><b>${empty}</b><span>Sem evidência suficiente nas respostas.</span></li>`
    const sectionCards = evidence.bySection.map(section => `
      <section class="section">
        <div class="sectionHead"><div><p>${reportEscape(section.title)}</p><h2>${section.average}%</h2></div><span>${section.rows.length} respostas</span></div>
        ${bar('índice da dimensão', section.average, 'accent')}
        <div class="evidenceGrid">
          <div><h3>Evidências favoráveis</h3><ul>${evidenceList(section.strengths, 'Nenhuma força dominante nesta dimensão')}</ul></div>
          <div><h3>Pontos para aprofundar</h3><ul>${evidenceList(section.attention, 'Nenhum ponto crítico declarado nesta dimensão')}</ul></div>
        </div>
      </section>`).join('')
    const riskRows = [
      ['Centralização', alerts.centralization?.level, alerts.centralization?.message],
      ['Procrastinação', alerts.procrastination?.level, alerts.procrastination?.message],
      ['Conflito', alerts.conflictRisk?.level, alerts.conflictRisk?.message],
      ['Mudança', alerts.changeResistance?.level, alerts.changeResistance?.message],
      ['Consistência', alerts.consistency?.score ? `${alerts.consistency.score}%` : '', alerts.consistency?.message],
    ].map(([label, level, message]) => `<div class="risk"><b>${reportEscape(label)}</b><span>${reportEscape(level || 'Não identificado')}</span><p>${reportEscape(message || 'Sem sinal relevante nas respostas atuais.')}</p></div>`).join('')
    const sectionAverage = (needle: string) => evidence.bySection.find(section => section.title.toLowerCase().includes(needle.toLowerCase()))?.average || 0
    const answerSource = evidence.answeredCount
      ? `${evidence.answeredCount} respostas auditáveis do formulário APS30`
      : 'sem respostas auditáveis carregadas; leitura exibida como estimativa cadastral e deve ser validada'
    const scoreLabel = (value: number) => {
      if (!evidence.answeredCount) return 'Não conclusivo'
      if (value >= 85) return 'Muito forte'
      if (value >= 70) return 'Adequado'
      if (value >= 55) return 'Em desenvolvimento'
      return 'Ponto crítico'
    }
    const temperamentMeanings: Record<string, string> = {
      // chaves com acento (valores gerados pelo promoter-form.ts)
      'Sanguíneo': 'perfil comunicativo, sociável, persuasivo e movido por interação; precisa cuidar de foco e constância.',
      'Colérico': 'perfil direto, decisivo, competitivo e orientado a resultado; precisa cuidar de escuta e delegação.',
      'Fleumático': 'perfil estável, conciliador, paciente e previsível; precisa cuidar de iniciativa e velocidade de resposta.',
      'Melancólico': 'perfil analítico, criterioso, organizado e sensível à qualidade; precisa cuidar de excesso de perfeccionismo.',
      // chaves sem acento (compatibilidade com dados legados)
      Sanguineo: 'perfil comunicativo, sociável, persuasivo e movido por interação; precisa cuidar de foco e constância.',
      Colerico: 'perfil direto, decisivo, competitivo e orientado a resultado; precisa cuidar de escuta e delegação.',
      Fleumatico: 'perfil estável, conciliador, paciente e previsível; precisa cuidar de iniciativa e velocidade de resposta.',
      Melancolico: 'perfil analítico, criterioso, organizado e sensível à qualidade; precisa cuidar de excesso de perfeccionismo.',
    }
    const diagnosticCards = [
      {
        title: 'Liderança',
        value: leadership,
        type: person.leadershipProfile || 'Perfil em leitura',
        label: scoreLabel(leadership),
        source: `Composição: influência, iniciativa, condução de pessoas, delegação, tomada de decisão e desenvolvimento de equipe. Base: ${answerSource}.`,
        sub: [
          ['Dimensão liderança', sectionAverage('Liderança')],
          ['Cenários práticos', sectionAverage('Cenários')],
          ['Maturidade/validação', sectionAverage('Maturidade')],
        ],
        decision: leadership >= 80
          ? 'Pode receber responsabilidades de coordenação com metas claras e acompanhamento por resultado.'
          : leadership >= 60
            ? 'Tem base para liderar frentes pequenas, mas precisa ser observado em situações reais de conflito, decisão e delegação.'
            : 'Não deve assumir liderança ampliada sem plano de desenvolvimento e validação prática.',
      },
      {
        title: 'Produtividade',
        value: productivity,
        type: productivityLabel,
        label: scoreLabel(productivity),
        source: `Composição: eficiência, qualidade, organização, compromisso, autonomia e risco de procrastinação. Base: ${answerSource}.`,
        sub: [
          ['Eficiência', person.productivityEfficiency || 0],
          ['Qualidade', person.productivityQuality || 0],
          ['Organização', person.productivityOrganization || 0],
          ['Compromisso', person.productivityCommitment || 0],
          ['Autonomia', person.productivityAutonomy || 0],
        ],
        decision: productivity >= 80
          ? 'Tende a sustentar boa entrega com autonomia, desde que metas e prioridades estejam claras.'
          : productivity >= 60
            ? 'Precisa de rotina de prioridades, checagens curtas e metas semanais para separar potencial de entrega real.'
            : 'Exige investigação imediata: pode haver baixa disciplina, baixa clareza, sobrecarga ou inconsistência de respostas.',
      },
      {
        title: 'Relacionamento interpessoal',
        value: relationship,
        type: person.relationalClassification || 'Relacionamento em leitura',
        label: scoreLabel(relationship),
        source: `Composição: convivência, colaboração, recepção de feedback, equilíbrio sob pressão e risco de conflito. Base: ${answerSource}.`,
        sub: [
          ['Perfil comportamental', person.behavioralProfilePercent || 0],
          ['Dimensão relacional', sectionAverage('Relacionamento')],
          ['Maturidade emocional', formComputed.indices?.emotional?.score || sectionAverage('Maturidade')],
        ],
        decision: relationship >= 80
          ? 'Tende a favorecer clima, colaboração e integração de equipe.'
          : relationship >= 60
            ? 'Relacionamento funcional, mas deve ser validado em feedback, pressão e divergência.'
            : 'Ponto prioritário: recomenda conversa individual, observação de convivência e plano de comunicação.',
      },
      {
        title: 'Temperamento dominante',
        value: Number(person.temperamentPrimaryPercent || 0),
        type: person.temperamentPrimary || 'Não identificado',
        label: person.temperamentPrimary ? `${person.temperamentPrimary} predominante` : 'Não conclusivo',
        source: `Não é nota de qualidade. Indica a tendência comportamental dominante. Os três traços somam 100%. Base: ${answerSource}.`,
        sub: [
          [person.temperamentPrimary || 'Dominante', Number(person.temperamentPrimaryPercent || 0)],
          [person.temperamentSecondary || 'Secundário', Number(person.temperamentSecondaryPercent || 0)],
          [person.temperamentTertiary || 'Terciário', Number(person.temperamentTertiaryPercent ?? Math.max(0, 100 - Number(person.temperamentPrimaryPercent || 0) - Number(person.temperamentSecondaryPercent || 0)))],
        ],
        decision: temperamentMeanings[String(person.temperamentPrimary || '')] || 'Temperamento identificado com base nas respostas do formulário. Valide com observação prática.',
      },
    ]
    const diagnosticPanel = diagnosticCards.map(card => `
      <article class="diagnostic">
        <div class="diagnosticTop">
          <div><h3>${reportEscape(card.title)}</h3><strong>${Math.round(card.value || 0)}%</strong></div>
          <span>${reportEscape(card.label)}</span>
        </div>
        <p class="type">${reportEscape(card.type)}</p>
        <p>${reportEscape(card.source)}</p>
        <div class="miniBars">${card.sub.map(([label, value]) => `
          <div><b>${reportEscape(label)}</b><span>${Math.round(Number(value) || 0)}%</span><i><em style="width:${Math.max(0, Math.min(100, Math.round(Number(value) || 0)))}%"></em></i></div>
        `).join('')}</div>
        <div class="decision"><b>Diagnóstico prático</b><p>${reportEscape(card.decision)}</p></div>
      </article>`).join('')
    const interviewQuestions = evidence.weakest.slice(0, 5).map(item => `<li>Peça um exemplo real sobre: <b>${reportEscape(item.question.prompt)}</b><span>Resposta registrada: ${reportEscape(item.label)}</span></li>`).join('')
    const allAnswers = evidence.bySection.map(section => `
      <details>
        <summary>${reportEscape(section.title)} (${section.rows.length})</summary>
        <table><tbody>${section.rows.map(row => `<tr><td>${reportEscape(row.question.id)}</td><td>${reportEscape(row.question.prompt)}</td><td>${reportEscape(row.label)}</td><td>${row.score}/5</td></tr>`).join('')}</tbody></table>
      </details>`).join('')
    const conclusion = [
      leadership >= 80 ? 'Demonstra sinal forte de liderança prática e influência operacional.' : leadership >= 60 ? 'Possui base de liderança, mas precisa de observação em situações reais de condução.' : 'Ainda exige acompanhamento próximo antes de assumir liderança ampliada.',
      productivity >= 80 ? 'Mostra boa tendência de entrega e autonomia.' : productivity >= 60 ? 'Entrega em desenvolvimento; recomenda-se rotina clara de prioridades e checagens.' : 'Produtividade declarada pede investigação, acompanhamento e metas curtas.',
      relationship >= 80 ? 'Relacionamento tende a favorecer trabalho em equipe.' : relationship >= 60 ? 'Relacionamento adequado, com pontos de calibragem em feedback e convivência.' : 'Relacionamento interpessoal deve ser tratado como ponto prioritário de desenvolvimento.',
    ].join(' ')

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório APS30 - ${reportEscape(person.name)}</title><style>
      :root{--bg:#eef5fa;--ink:#0b1f36;--muted:#5d7085;--line:#d7e4ef;--dark:#003f75;--gold:#f6b221;--green:#0a8f68;--blue:#00a9e0;--purple:#005daa}
      *{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#f7fbff,#edf5fa);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif}.page{max-width:1120px;margin:auto;padding:28px}
      .hero{position:relative;display:grid;grid-template-columns:150px 1fr;gap:24px;align-items:center;background:radial-gradient(circle at 100% 0,rgba(246,178,33,.24),transparent 34%),linear-gradient(135deg,#003f75,#005daa);color:#fff;border-radius:30px;padding:26px;box-shadow:0 24px 70px rgba(0,63,117,.20);overflow:hidden}
      .hero:after{content:'';position:absolute;right:-8%;bottom:-35%;width:62%;height:130px;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),rgba(246,178,33,.18),transparent);transform:rotate(-7deg)}
      .brand{position:relative;z-index:1;display:flex;align-items:center;gap:10px;margin-bottom:10px}.brand img{width:30px;height:30px}.brand span{font-size:12px;text-transform:uppercase;letter-spacing:.16em;font-weight:900;color:rgba(255,255,255,.78)}
      .photo{width:150px;height:150px;border-radius:28px;object-fit:cover;border:1px solid rgba(255,255,255,.2)}.empty{display:grid;place-items:center;background:#151b26;font-size:44px;font-weight:900}.eyebrow{margin:0 0 8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:900}h1{font-size:44px;line-height:1;margin:0 0 10px}.muted{color:#aeb8c8}.heroStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.stat{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.07);border-radius:18px;padding:14px}.stat span{display:block;color:#aeb8c8;font-size:12px;font-weight:800}.stat b{display:block;margin-top:4px;font-size:25px}
      .section{margin-top:18px;background:#fff;border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,.05)}.section h2{margin:0 0 12px;font-size:24px}.section h3{margin:0 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:.1em;color:#475569}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.sectionHead p{margin:0;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.sectionHead h2{font-size:38px}.sectionHead span{border-radius:999px;background:#f1f5f9;padding:8px 12px;color:#475569;font-weight:900;font-size:12px}
      .bar{display:grid;grid-template-columns:170px 1fr;gap:12px;align-items:center;margin:10px 0}.bar div:first-child{display:flex;justify-content:space-between;gap:8px;color:#334155}.track{height:12px;background:#e2e8f0;border-radius:99px;overflow:hidden}.track i{display:block;height:100%;background:var(--gold);border-radius:99px}.track i.green{background:var(--green)}.track i.blue{background:var(--blue)}.track i.purple{background:var(--purple)}.track i.accent{background:linear-gradient(90deg,var(--purple),var(--gold))}
      .diagnosticGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.diagnostic{border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,#fff,#f8fbfd);padding:18px}.diagnosticTop{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.diagnosticTop h3{margin:0;color:#003f75}.diagnosticTop strong{display:block;margin-top:5px;font-size:38px;line-height:1;color:#0b1f36}.diagnosticTop span{border-radius:999px;background:#e8f3fb;color:#003f75;padding:8px 10px;font-size:12px;font-weight:900;white-space:nowrap}.diagnostic .type{margin:12px 0 8px;font-weight:900;color:#005daa}.diagnostic p{color:#475569;line-height:1.55}.miniBars{display:grid;gap:9px;margin-top:14px}.miniBars div{display:grid;grid-template-columns:150px 42px 1fr;gap:10px;align-items:center}.miniBars b{font-size:12px;color:#334155}.miniBars span{font-size:12px;font-weight:900;color:#003f75;text-align:right}.miniBars i{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}.miniBars em{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--blue));border-radius:999px}.decision{margin-top:14px;border-left:4px solid var(--gold);border-radius:14px;background:#fff8e6;padding:12px}.decision b{color:#003f75}.decision p{margin:6px 0 0;color:#334155}
      .meta{display:grid;gap:10px}.meta div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #edf2f7;padding-bottom:8px}.pill{display:inline-block;margin:5px 6px 0 0;border-radius:999px;background:#eef2ff;color:#4338ca;padding:8px 12px;font-weight:900;font-size:12px}.danger{background:#fff1f2;color:#be123c}.evidenceGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}ul{margin:0;padding-left:18px}li{margin:0 0 12px;line-height:1.45}li span{display:block;color:var(--muted);font-size:13px;margin-top:3px}.risk{border:1px solid var(--line);border-radius:18px;padding:16px;background:#f8fafc}.risk b{display:block}.risk span{display:inline-block;margin-top:8px;border-radius:999px;background:#111827;color:#fff;padding:5px 9px;font-size:12px;font-weight:900}.risk p{color:#475569}.plan{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.plan div{border:1px solid var(--line);border-radius:18px;padding:16px;background:#fafafa}details{margin-top:10px;border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}summary{cursor:pointer;padding:14px 16px;font-weight:900;background:#f8fafc}table{width:100%;border-collapse:collapse;font-size:12px}td{border-top:1px solid #edf2f7;padding:10px;vertical-align:top}.actions{display:flex;gap:12px;margin:22px 0}.actions button{border:0;border-radius:15px;padding:12px 18px;font-weight:900;cursor:pointer}.primary{background:var(--gold)}.secondary{background:#111827;color:#fff}
      @media print{body{background:#fff}.page{padding:0}.actions{display:none}.section,.hero,.diagnostic{break-inside:avoid}}@media(max-width:780px){.page{padding:14px}.hero,.grid,.evidenceGrid,.plan,.diagnosticGrid{grid-template-columns:1fr}.heroStats{grid-template-columns:1fr 1fr}.bar{grid-template-columns:1fr}.miniBars div{grid-template-columns:1fr 42px}.miniBars i{grid-column:1/-1}.photo{width:132px;height:132px}h1{font-size:34px}}
    </style></head><body><main class="page">
      <section class="hero">${photoHtml}<div style="position:relative;z-index:1"><div class="brand"><img src="/aps30-logo.png" alt="APS30" style="height:32px;object-fit:contain;"><span>APS30</span></div><p class="eyebrow">Relatório profissional APS30</p><h1>${reportEscape(person.name)}</h1><p class="muted">${reportEscape(person.role)} · ${reportEscape(person.unit || 'Unidade não informada')}</p><div class="heroStats"><div class="stat"><span>Liderança</span><b>${leadership}%</b></div><div class="stat"><span>Produtividade</span><b>${productivity}%</b></div><div class="stat"><span>Relacionamento</span><b>${relationship}%</b></div><div class="stat"><span>Respostas lidas</span><b>${evidence.answeredCount}/${PROMOTER_QUESTIONS.length}</b></div></div></div></section>
      <section class="section grid"><div><h2>Dados principais</h2><div class="meta"><div><strong>Cargo</strong><span>${reportEscape(person.role)}</span></div><div><strong>Unidade</strong><span>${reportEscape(person.unit || '-')}</span></div><div><strong>E-mail</strong><span>${reportEscape(person.email || '-')}</span></div><div><strong>WhatsApp</strong><span>${reportEscape(person.phone || '-')}</span></div></div></div><div><h2>Conclusão gerencial</h2><p>${reportEscape(executive || conclusion)}</p><div>${strengths.map(tag => `<span class="pill">${reportEscape(tag)}</span>`).join('')}${risks.map(tag => `<span class="pill danger">${reportEscape(tag)}</span>`).join('')}</div></div></section>
      <section class="section"><h2>Painel diagnóstico dos indicadores</h2><p style="margin-top:-4px;color:#5d7085">Cada indicador abaixo informa o que foi medido, qual base de leitura foi usada e como transformar o dado em decisão profissional.</p><div class="diagnosticGrid">${diagnosticPanel}</div></section>
      <section class="section grid"><div><h2>Leitura comportamental</h2><p><b>Temperamento:</b> ${reportEscape(person.temperamentPrimary || '-')} (${reportEscape(person.temperamentPrimaryPercent || 0)}%) com traços ${reportEscape(person.temperamentSecondary || '-')} (${reportEscape(person.temperamentSecondaryPercent || 0)}%).</p><p><b>Perfil:</b> ${reportEscape(person.behavioralProfile || '-')}.</p><p><b>Feedback:</b> ${reportEscape(person.relationalIntelligence || '-')}.</p></div><div><h2>Entrega e rotina</h2><p><b>Diagnóstico:</b> ${reportEscape(productivityLabel)}.</p><p>Eficiência ${reportEscape(person.productivityEfficiency || 0)}%, qualidade ${reportEscape(person.productivityQuality || 0)}%, organização ${reportEscape(person.productivityOrganization || 0)}%, comprometimento ${reportEscape(person.productivityCommitment || 0)}% e autonomia ${reportEscape(person.productivityAutonomy || 0)}%.</p></div></section>
      ${sectionCards}
      <section class="section"><h2>Sinais de risco e consistência</h2><div class="grid">${riskRows}</div></section>
      <section class="section grid"><div><h2>Maiores evidências positivas</h2><ul>${evidenceList(evidence.strongest, 'Nenhuma evidência positiva dominante')}</ul></div><div><h2>Pontos para entrevista</h2><ul>${interviewQuestions || '<li><b>Sem pontos críticos suficientes</b><span>Use as dimensões para perguntas abertas.</span></li>'}</ul></div></section>
      <section class="section"><h2>Plano de gestão recomendado</h2><div class="plan"><div><b>Primeiros 30 dias</b><p>Validar as tendências do formulário em situações reais: cumprimento de rotina, reação a feedback, colaboração e qualidade de entrega.</p></div><div><b>60 dias</b><p>Definir metas curtas, dar responsabilidade proporcional ao potencial e observar autonomia sem perder acompanhamento.</p></div><div><b>90 dias</b><p>Revisar categoria/função, registrar evolução e decidir próximos desafios com base em evidências, não apenas autopercepção.</p></div></div></section>
      <section class="section"><h2>Anexo auditável das respostas</h2>${allAnswers}</section>
      <div class="actions"><button class="primary" onclick="window.print()">Imprimir / salvar PDF</button><button class="secondary" onclick="window.close()">Fechar</button></div>
    </main></body></html>`
  }

  function openReportHtml(person: Person, download = false) {
    const html = buildCompleteReportHtml(person)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    if (download) {
      const link = document.createElement('a')
      link.href = url
      link.download = `Relatorio APS30 - ${person.name || 'perfil'}.html`.replace(/[\\/:*?"<>|]+/g, '-')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      return
    }
    const reportWindow = window.open(url, '_blank', 'width=1180,height=920')
    if (!reportWindow) {
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  function downloadCompleteReport(person: Person) {
    openReportHtml(person, true)
  }

  function startNewPerson() {
    const next = createEmptyDraft()
    setCreatingPerson(true)
    setSelectedPersonId(next.id)
    setDraft(next)
    setDrawerOpen(true)
    setPanelTab('editar')
  }

  async function saveDraft() {
    if (!draft) return
    setSavingDraft(true)
    try {
      if (creatingPerson) {
        const created = await onCreatePerson(draft)
        if (created) {
          setCreatingPerson(false)
          setSelectedPersonId(created.id)
          setDraft({ ...created, files: [...(created.files || [])] })
        }
      } else {
        await onUpdatePerson(draft.id, draft)
      }
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } finally {
      setSavingDraft(false)
    }
  }

  function addDraftFile() {
    if (!fileInput.trim()) return
    setDraft(current => (current ? { ...current, files: Array.from(new Set([...(current.files || []), fileInput.trim()])) } : current))
    setFileInput('')
  }

  function openCompleteReport(person: Person) {
    openReportHtml(person)
    return

    const leadership = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
    const productivity = person.productivityIndex ?? inferProductivityIndex([
      person.productivityEfficiency,
      person.productivityQuality,
      person.productivityOrganization,
      person.productivityCommitment,
      person.productivityAutonomy,
    ])
    const relationship = person.behavioralProfilePercent ?? 75
    const productivityLabel = inferProductivityDiagnosis(productivity).label
    const executive = cleanProfileText(person.bio, `${person.name} apresenta perfil ${person.behavioralProfile || 'em leitura'}, com liderança em ${leadership}%, produtividade em ${productivity}% e relacionamento em ${relationship}%.`)
    const reportWindow = window.open('', '_blank', 'width=1100,height=900')
    if (!reportWindow) return

    const escape = (value: unknown) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    const chips = [...(person.strengths || []), ...(person.risks || [])]
      .filter(Boolean)
      .slice(0, 8)
      .map(tag => `<span>${escape(tag)}</span>`)
      .join('')

    const resolvedPhoto = getPersonPhoto(person)
    const photo = resolvedPhoto
      ? `<img class="photo" src="${escape(resolvedPhoto)}" alt="${escape(person.name)}" />`
      : `<div class="photo empty">${escape(getInitials(person.name))}</div>`

    reportWindow?.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório APS30 - ${escape(person.name)}</title>
  <style>
    *{box-sizing:border-box} body{margin:0;background:#f5f6f8;color:#111827;font-family:Inter,Arial,sans-serif}
    .page{max-width:1080px;margin:0 auto;padding:32px}
    .hero{display:grid;grid-template-columns:160px 1fr;gap:26px;align-items:center;background:#0b0d14;color:#fff;border-radius:28px;padding:26px;overflow:hidden}
    .photo{width:160px;height:160px;object-fit:cover;border-radius:30px;border:1px solid rgba(255,255,255,.18);background:#181b24}
    .photo.empty{display:grid;place-items:center;font-size:48px;font-weight:900;color:#fff;background:linear-gradient(135deg,#292d38,#111827)}
    .eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.22em;color:#9ca3af;font-weight:800}
    h1{font-size:48px;line-height:.98;margin:14px 0 8px} h2{font-size:20px;margin:0 0 14px}
    .muted{color:#9ca3af}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:26px}
    .stat{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:16px}
    .stat b{display:block;font-size:28px;margin-top:6px}.section{background:#fff;border:1px solid #e5e7eb;border-radius:24px;margin-top:18px;padding:24px}
    .bars{display:grid;gap:12px}.bar{display:grid;grid-template-columns:140px 1fr 52px;gap:12px;align-items:center;font-weight:700}
    .track{height:11px;border-radius:999px;background:#e5e7eb;overflow:hidden}.fill{height:100%;border-radius:999px;background:#f59e0b}
    .fill.green{background:#10b981}.fill.blue{background:#38bdf8}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .chips span{border-radius:999px;background:#eef2ff;color:#4338ca;padding:8px 12px;font-weight:800;font-size:12px}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.meta{display:grid;gap:10px}.meta div{display:flex;justify-content:space-between;border-bottom:1px solid #f0f1f4;padding-bottom:8px}
    .actions{display:flex;gap:12px;margin-top:22px}.actions button{border:0;border-radius:14px;padding:12px 18px;font-weight:900;cursor:pointer}.primary{background:#f59e0b}.secondary{background:#111827;color:#fff}
    @media print{body{background:#fff}.actions{display:none}.page{padding:0}.section,.hero{break-inside:avoid}}
    @media(max-width:760px){.page{padding:14px}.hero,.two{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,1fr)}h1{font-size:36px}.photo{height:140px;width:140px}}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      ${photo}
      <div>
        <p class="eyebrow">Relatório APS30 de Perfil e Liderança</p>
        <h1>${escape(person.name)}</h1>
        <p class="muted">${escape(person.role)} · ${escape(person.unit || 'Unidade não informada')}</p>
        <div class="grid">
          <div class="stat"><small>Liderança</small><b>${leadership}%</b></div>
          <div class="stat"><small>Produtividade</small><b>${productivity}%</b></div>
          <div class="stat"><small>Relacionamento</small><b>${relationship}%</b></div>
          <div class="stat"><small>Perfil</small><b style="font-size:20px">${escape(person.behavioralProfile || 'Em leitura')}</b></div>
        </div>
      </div>
    </section>
    <section class="section two">
      <div>
        <h2>Dados principais</h2>
        <div class="meta">
          <div><strong>Cargo</strong><span>${escape(person.role)}</span></div>
          <div><strong>Unidade</strong><span>${escape(person.unit || '-')}</span></div>
          <div><strong>E-mail</strong><span>${escape(person.email || '-')}</span></div>
          <div><strong>WhatsApp</strong><span>${escape(person.phone || '-')}</span></div>
        </div>
      </div>
      <div>
        <h2>Análise profissional</h2>
        ${executive ? `<p>${escape(executive)}</p>` : `<p>Perfil em consolidação. Use os indicadores abaixo para orientar acompanhamento, conversa individual e plano de desenvolvimento.</p>`}
        <div class="chips">${chips}</div>
      </div>
    </section>
    <section class="section">
      <h2>Indicadores do formulário</h2>
      <div class="bars">
        <div class="bar"><span>Liderança</span><div class="track"><div class="fill" style="width:${leadership}%"></div></div><strong>${leadership}%</strong></div>
        <div class="bar"><span>Produtividade</span><div class="track"><div class="fill green" style="width:${productivity}%"></div></div><strong>${productivity}%</strong></div>
        <div class="bar"><span>Relacionamento</span><div class="track"><div class="fill blue" style="width:${relationship}%"></div></div><strong>${relationship}%</strong></div>
      </div>
    </section>
    <section class="section two">
      <div>
        <h2>Produtividade e entrega</h2>
        <p><strong>Diagnóstico:</strong> ${escape(productivityLabel)}</p>
        <p>Eficiência ${escape(person.productivityEfficiency || 0)}%, qualidade ${escape(person.productivityQuality || 0)}%, organização ${escape(person.productivityOrganization || 0)}%, comprometimento ${escape(person.productivityCommitment || 0)}% e autonomia ${escape(person.productivityAutonomy || 0)}%.</p>
      </div>
      <div>
        <h2>Plano recomendado</h2>
        <p><strong>30 dias:</strong> alinhar rotina, metas e expectativas.</p>
        <p><strong>60 dias:</strong> medir entregas, autonomia e feedbacks.</p>
        <p><strong>90 dias:</strong> revisar categoria, função e próximo desafio.</p>
      </div>
    </section>
    <section class="section two">
      <div>
        <h2>Leitura de liderança</h2>
        <p><strong>Nível:</strong> N${escape(person.leadershipLevel || 3)}</p>
        <p><strong>Perfil:</strong> ${escape(person.leadershipProfile || 'Executor')}</p>
        <p><strong>Potencial:</strong> ${escape(person.leadershipPotential || 'Alto')}</p>
        <p><strong>Prontidão:</strong> ${escape(person.leadershipReadiness || 'Potencial em desenvolvimento')}</p>
      </div>
      <div>
        <h2>Temperamento e relacionamento</h2>
        <p><strong>Temperamento:</strong> ${escape(person.temperamentPrimary || '-')} (${escape(person.temperamentPrimaryPercent || 0)}%)</p>
        <p><strong>Perfil comportamental:</strong> ${escape(person.behavioralProfile || '-')}</p>
        <p><strong>Convivência:</strong> ${escape(person.convivenceLevel || '-')}</p>
        <p><strong>Feedback:</strong> ${escape(person.relationalIntelligence || '-')}</p>
      </div>
    </section>
    <div class="actions">
      <button class="primary" onclick="window.print()">Imprimir / salvar PDF</button>
      <button class="secondary" onclick="window.close()">Fechar</button>
    </div>
  </main>
</body>
</html>`)
    reportWindow?.document.close()
  }

  const viewTabs = [
    { id: 'geral', label: 'Geral' },
    { id: 'por-cargo', label: 'Por Cargo' },
    { id: 'detalhado', label: 'Detalhado' },
    { id: 'promotores', label: 'Promotores' },
    { id: 'diretores', label: 'Diretores' },
    { id: 'completo', label: 'Completo' },
  ] as const

  return (
    <section className="space-y-5 pb-16">
      <Surface className="overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Pessoas</p>
              <h2 className="mt-1 text-2xl font-black text-white">Escalação APS30</h2>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {viewTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`h-10 whitespace-nowrap rounded-2xl px-4 text-xs font-black transition ${viewMode === tab.id ? 'bg-white text-black' : 'bg-white/[0.06] text-white/65 hover:bg-white/[0.1]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/10 p-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar pessoa, unidade, cargo..." />
            <select value={unitFilter} onChange={event => setUnitFilter(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none">
              {filterOptions.units.map(option => <option key={option} className="bg-[#10121A]">{option}</option>)}
            </select>
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none">
              {filterOptions.roles.map(option => <option key={option} className="bg-[#10121A]">{option}</option>)}
            </select>
            <select value={traitFilter} onChange={event => setTraitFilter(event.target.value)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none">
              {filterOptions.traits.map(option => <option key={option} className="bg-[#10121A]">{option}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyPublicFormLink} className="h-11 rounded-2xl border border-[#0ABD78]/25 bg-[#0ABD78]/12 px-4 text-xs font-black text-[#8EF7C2]">
              {formLinkCopied ? 'Link copiado' : 'Enviar formulário'}
            </button>
            <button onClick={startNewPerson} className="h-11 rounded-2xl bg-[#F8A303] px-4 text-xs font-black text-black">Nova pessoa</button>
          </div>
        </div>

        {/* ── POR CARGO: grouped view ── */}
        {viewMode === 'por-cargo' && (() => {
          const CARGO_ORDER = ['Diretor', 'Vice-Diretor', 'Coordenador', 'Secretária', 'Promotor de matrículas', 'Professor', 'Auxiliar']
          const groups = new Map<string, Person[]>()
          for (const person of lineupPeople) {
            const cargo = (person.role || 'Outros').trim()
            if (!groups.has(cargo)) groups.set(cargo, [])
            groups.get(cargo)!.push(person)
          }
          // Sort groups: known order first, then alphabetical
          const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
            const ai = CARGO_ORDER.findIndex(c => a.toLowerCase().includes(c.toLowerCase()))
            const bi = CARGO_ORDER.findIndex(c => b.toLowerCase().includes(c.toLowerCase()))
            if (ai !== -1 && bi !== -1) return ai - bi
            if (ai !== -1) return -1
            if (bi !== -1) return 1
            return a.localeCompare(b)
          })

          const cargoColors: Record<string, string> = {
            'diretor': '#FF6B35', 'vice': '#F8A303', 'coordenador': '#29ABE2',
            'secretár': '#A78BFA', 'promotor': '#0ABD78', 'professor': '#F9C234', 'auxiliar': '#8B9CB0',
          }
          function getCargoColor(cargo: string) {
            const key = Object.keys(cargoColors).find(k => cargo.toLowerCase().includes(k))
            return key ? cargoColors[key] : '#6B7F94'
          }

          return (
            <div className="space-y-6 p-4">
              {sortedGroups.map(([cargo, persons]) => (
                <div key={cargo}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-0.5 w-4 rounded-full" style={{ background: getCargoColor(cargo) }} />
                    <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: getCargoColor(cargo) }}>
                      {cargo}
                    </p>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: `${getCargoColor(cargo)}18`, color: getCargoColor(cargo) }}>
                      {persons.length}
                    </span>
                    <div className="h-px flex-1 rounded-full" style={{ background: `${getCargoColor(cargo)}20` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                    {persons.map(person => {
                      const active = selectedPerson?.id === person.id
                      const photo = getPersonPhoto(person)
                      const leadership = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
                      return (
                        <button
                          key={person.id}
                          onClick={() => selectPerson(person)}
                          className={`group overflow-hidden rounded-[1.35rem] border bg-white/[0.035] text-left transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${active ? 'border-[#F8A303]/60 shadow-[0_0_0_1px_rgba(248,163,3,0.18)]' : 'border-white/10'}`}
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-black/30">
                            {photo ? (
                              <img src={photo} alt={person.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center" style={{ background: `${getCargoColor(cargo)}12` }}>
                                <UserCircleIcon className="h-16 w-16" style={{ color: `${getCargoColor(cargo)}60` }} />
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="truncate text-[11px] font-black leading-tight text-white">{person.name || 'Sem nome'}</p>
                            <p className="mt-0.5 truncate text-[10px] text-white/40">{person.unit || '—'}</p>
                            {leadership > 0 && (
                              <div className="mt-1.5 h-1 rounded-full bg-white/10">
                                <div className="h-1 rounded-full transition-all" style={{ width: `${leadership}%`, background: getCargoColor(cargo) }} />
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {sortedGroups.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-sm text-white/25">Nenhuma pessoa encontrada</p>
                </div>
              )}
            </div>
          )
        })()}

        <div className={`grid gap-4 p-4 ${viewMode === 'por-cargo' ? 'hidden' : ''}`}>
          <div className="min-w-0">
            <div className="pr-1">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {lineupPeople.map(person => {
                  const active = selectedPerson?.id === person.id
                  const photo = getPersonPhoto(person)
                  const leadership = person.leadershipPercent ?? Math.round((person.score || 0) * 20)
                  const productivity = person.productivityIndex ?? inferProductivityIndex([
                    person.productivityEfficiency,
                    person.productivityQuality,
                    person.productivityOrganization,
                    person.productivityCommitment,
                    person.productivityAutonomy,
                  ])
                  const relationship = person.behavioralProfilePercent ?? 75
                  return (
                    <button
                      key={person.id}
                      onClick={() => selectPerson(person)}
                      className={`group overflow-hidden rounded-[1.35rem] border bg-white/[0.035] text-left transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${active ? 'border-[#F8A303]/60 shadow-[0_0_0_1px_rgba(248,163,3,0.18)]' : 'border-white/10'}`}
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-black/30">
                        {photo ? (
                          <img src={photo} alt={person.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#EAF4FF] to-white">
                            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#005DAA] text-xl font-black text-white shadow-lg shadow-[#005DAA]/20">
                              {getInitials(person.name)}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">Sem foto</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-black text-white">{person.name}</p>
                        <p className="mt-1 truncate text-[11px] font-bold text-white/45">{person.role}</p>
                        <p className="mt-2 truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#A78BFA]">{person.behavioralProfile || 'Perfil em leitura'}</p>
                        <div className="mt-3 space-y-1.5">
                          <TinyMeter label="Lid" value={leadership} color="#F8A303" />
                          <TinyMeter label="Prod" value={productivity} color="#0ABD78" />
                          <TinyMeter label="Rel" value={relationship} color="#29ABE2" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="truncate rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white/55">{person.unit || 'Sem unidade'}</span>
                          <span className="truncate rounded-full bg-[#8B5CF6]/12 px-2 py-1 text-[10px] font-black text-[#C4B5FD]">{person.temperamentPrimary || 'Temperamento'}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {!lineupPeople.length && <p className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center text-sm text-white/45">Nenhuma pessoa encontrada com esses filtros.</p>}
            </div>
          </div>

          {drawerOpen && selectedPerson && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-md" onClick={() => setDrawerOpen(false)}>
              <aside className="mx-auto my-6 w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#090B12]/98 shadow-2xl shadow-black/60" onClick={event => event.stopPropagation()}>
                <div className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5 sm:p-7">
                  <button onClick={() => setDrawerOpen(false)} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                  <div className="grid gap-5 pr-12 lg:grid-cols-[180px_1fr] lg:items-center">
                    <div className="relative h-40 w-40 overflow-hidden rounded-[2rem] border border-white/15 bg-black/30 shadow-2xl shadow-black/40 sm:h-44 sm:w-44">
                      {getPersonPhoto(selectedPerson) ? (
                        <img src={getPersonPhoto(selectedPerson)} alt={selectedPerson.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02]">
                          <UserCircleIcon className="h-24 w-24 text-white/20" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Relatório APS30</p>
                      <h3 className="mt-3 max-w-3xl text-4xl font-black leading-none text-white sm:text-5xl">{selectedPerson.name}</h3>
                      <p className="mt-3 text-base font-bold text-white/65 sm:text-lg">{selectedPerson.role} - {selectedPerson.unit || 'Sem unidade'}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <MiniStat label="Liderança" value={`${selectedLeadership}%`} />
                      <MiniStat label="Produtividade" value={`${selectedProductivity}%`} />
                      <MiniStat label="Temperamento" value={selectedPerson.temperamentPrimary || 'N/D'} />
                      <MiniStat label="Perfil" value={selectedPerson.behavioralProfile || 'N/D'} />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto border-b border-white/10 p-3 [scrollbar-width:none]">
                  {(['relatorio', 'editar', 'categorias', 'arquivos'] as const).map(tab => (
                    <button key={tab} onClick={() => setPanelTab(tab)} className={`h-9 rounded-xl px-3 text-[11px] font-black capitalize ${panelTab === tab ? 'bg-white text-black' : 'bg-white/[0.06] text-white/55'}`}>{tab}</button>
                  ))}
                </div>

                <div className="min-h-[280px] p-5">
                  {panelTab === 'relatorio' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 lg:hidden">
                        <MiniStat label="Liderança" value={`${selectedLeadership}%`} />
                        <MiniStat label="Produtividade" value={`${selectedProductivity}%`} />
                        <MiniStat label="Temperamento" value={selectedPerson.temperamentPrimary || 'N/D'} />
                        <MiniStat label="Perfil" value={selectedPerson.behavioralProfile || 'N/D'} />
                      </div>
                      <ProgressRow label="Liderança" value={selectedLeadership} color="#8B5CF6" />
                      <ProgressRow label="Produtividade" value={selectedProductivity} color="#0ABD78" />
                      <ProgressRow label="Carga" value={selectedPerson.workload || 0} color="#F8A303" />
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Liderança</p>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            Nível N{selectedPerson.leadershipLevel || 3}, perfil {selectedPerson.leadershipProfile || 'Executor'}, potencial {selectedPerson.leadershipPotential || 'Alto'} e prontidão: {selectedPerson.leadershipReadiness || 'Potencial em desenvolvimento'}.
                          </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Temperamento</p>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            Predominância {selectedPerson.temperamentPrimary || 'não identificada'} ({selectedPerson.temperamentPrimaryPercent || 0}%) com traços {selectedPerson.temperamentSecondary || 'complementares'} ({selectedPerson.temperamentSecondaryPercent || 0}%).
                          </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Relacionamento</p>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            {selectedPerson.relationalClassification || 'Relacionamento adequado'}. Estilo interpessoal: {selectedPerson.interpersonalLevel || 'Equilibrado'}. Feedback: {selectedPerson.relationalIntelligence || 'em desenvolvimento'}.
                          </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Produtividade</p>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            índice {selectedProductivity}%, com eficiência {selectedPerson.productivityEfficiency || 0}%, qualidade {selectedPerson.productivityQuality || 0}% e autonomia {selectedPerson.productivityAutonomy || 0}%.
                          </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Riscos de gestão</p>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            Atenção para sobrecarga, centralização, procrastinação e ruídos de comunicação. Os marcadores abaixo indicam onde a liderança deve observar evidências antes de decidir próximos passos.
                          </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Plano 30/60/90</p>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            30 dias: alinhar rotina e metas. 60 dias: acompanhar entregas, feedback e autonomia. 90 dias: revisar categoria, responsabilidades e plano individual no APS30.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(selectedPerson.strengths || []).map(tag => <span key={tag} className="rounded-full bg-[#0ABD78]/12 px-3 py-1 text-xs font-black text-[#0ABD78]">{tag}</span>)}
                        {(selectedPerson.risks || []).map(tag => <span key={tag} className="rounded-full bg-[#FF4757]/12 px-3 py-1 text-xs font-black text-[#FF8A96]">{tag}</span>)}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button onClick={() => openCompleteReport(selectedPerson)} className="h-11 rounded-2xl bg-[#0ABD78] text-xs font-black text-black">Ver completo</button>
                        <button onClick={() => downloadCompleteReport(selectedPerson)} className="h-11 rounded-2xl bg-white text-xs font-black text-black">Baixar relatório</button>
                        <button onClick={() => onCreateAction(selectedPerson, `Plano de desenvolvimento - ${selectedPerson.name}`)} className="h-11 rounded-2xl bg-[#8B5CF6] text-xs font-black text-white">Criar plano de ação</button>
                        <button onClick={() => downloadPhoto(selectedPerson)} disabled={!getPersonPhoto(selectedPerson)} className="h-11 rounded-2xl border border-white/10 bg-white/[0.06] text-xs font-black text-white disabled:opacity-35">Baixar foto</button>
                      </div>
                    </div>
                  )}

                  {panelTab === 'editar' && draft && (
                    <div className="space-y-3">
                      <Input value={draft.name || ''} onChange={event => syncDraftField('name', event.target.value)} placeholder="Nome" />
                      <Input value={draft.role || ''} onChange={event => syncDraftField('role', event.target.value)} placeholder="Cargo" />
                      <Input value={draft.unit || ''} onChange={event => syncDraftField('unit', event.target.value)} placeholder="Unidade" />
                      <Input value={draft.email || ''} onChange={event => syncDraftField('email', event.target.value)} placeholder="E-mail" />
                      <Input value={draft.phone || ''} onChange={event => syncDraftField('phone', event.target.value)} placeholder="Telefone" />
                      <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[96px_1fr]">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl bg-black/30">
                          {getPersonPhoto(draft) ? <img src={getPersonPhoto(draft)} alt={draft.name} className="h-full w-full object-cover" /> : <UserCircleIcon className="h-full w-full p-4 text-white/20" />}
                        </div>
                        <div className="flex flex-col justify-center gap-2">
                          <label className="flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035] text-xs font-black text-white/70">
                            Enviar foto do computador
                            <input type="file" accept="image/*" className="hidden" onChange={event => handleAvatarFile(event.target.files?.[0] || null)} />
                          </label>
                          <button type="button" onClick={() => draft && downloadPhoto(draft)} disabled={!getPersonPhoto(draft)} className="h-10 rounded-2xl bg-white/[0.06] text-xs font-black text-white disabled:opacity-35">Baixar foto atual</button>
                        </div>
                      </div>
                      <label className="hidden">
                        <input type="file" accept="image/*" className="hidden" onChange={event => handleAvatarFile(event.target.files?.[0] || null)} />
                      </label>
                      <textarea value={draft.bio || ''} onChange={event => syncDraftField('bio', event.target.value)} placeholder="Resumo" className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none" />
                    </div>
                  )}

                  {panelTab === 'categorias' && draft && (
                    <div className="space-y-3">
                      <Input value={draft.training || ''} onChange={event => syncDraftField('training', event.target.value)} placeholder="Categoria principal. Ex: Promotores de matrícula" />
                      <select value={draft.leadershipProfile || 'Executor'} onChange={event => syncDraftField('leadershipProfile', event.target.value as LeadershipProfile)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none">
                        {leadershipProfileOptions.map(option => <option key={String(option.value)} className="bg-[#10121A]" value={option.value}>{option.label}</option>)}
                      </select>
                      <select value={draft.temperamentPrimary || 'Fleumático'} onChange={event => syncDraftField('temperamentPrimary', event.target.value as TemperamentType)} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white outline-none">
                        {temperamentOptions.map(option => <option key={String(option.value)} className="bg-[#10121A]" value={option.value}>{option.label}</option>)}
                      </select>
                      <Input value={String(draft.leadershipPercent ?? '')} onChange={event => syncDraftField('leadershipPercent', Number(event.target.value || 0))} placeholder="Liderança %" />
                      <Input value={String(draft.productivityIndex ?? '')} onChange={event => syncDraftField('productivityIndex', Number(event.target.value || 0))} placeholder="Produtividade %" />
                      <Input value={draft.nextReview || ''} onChange={event => syncDraftField('nextReview', event.target.value)} placeholder="Próxima revisão" />
                    </div>
                  )}

                  {panelTab === 'arquivos' && draft && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input value={fileInput} onChange={event => setFileInput(event.target.value)} placeholder="Arquivo ou link" />
                        <button onClick={addDraftFile} className="h-11 rounded-2xl bg-white/[0.08] px-4 text-xs font-black text-white">+</button>
                      </div>
                      {(draft.files || []).map(file => <p key={file} className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/60">{file}</p>)}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 p-4">
                  <button onClick={() => void saveDraft()} className="h-12 w-full rounded-2xl bg-[#F8A303] text-xs font-black text-black lg:mx-auto lg:block lg:max-w-sm">{savingDraft ? 'Salvando...' : 'Salvar alterações'}</button>
                  {lastSavedAt && <p className="mt-2 text-center text-[11px] font-semibold text-white/35">Salvo as {lastSavedAt}</p>}
                </div>
              </aside>
            </div>
          )}
        </div>
      </Surface>

      {viewMode === 'completo' && (
        <Surface className="overflow-hidden">
          <SectionHeader eyebrow="Ações" title="Fluxo aberto do time" />
          <div className="divide-y divide-white/10">
            {work.slice(0, 5).length === 0 && <p className="p-5 text-sm text-white/38">Nenhuma ação de pessoas em aberto.</p>}
            {work.slice(0, 5).map(item => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_110px_140px] md:items-center">
                <div>
                  <p className="font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-white/38">{item.owner} - {item.due}</p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white/55">{item.priority}</span>
                <button onClick={() => openSofi(`IA da Educação, assuma a ação de pessoas "${item.title}" com contexto de ${item.owner}.`)} className="h-10 rounded-2xl bg-white/[0.07] px-4 text-xs font-black text-white">Abrir</button>
              </div>
            ))}
          </div>
        </Surface>
      )}
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
          <p className="mt-1 text-xs font-semibold text-white/38">{item.category} ? {item.location}</p>
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
        <p className="mt-2 text-xs text-white/38">Fornecedor: {item.supplier} ? Responsável: {item.owner}</p>
        <p className="mt-1 text-xs text-white/38">última movimentação: {item.lastMove}</p>
        <p className="mt-3 text-sm font-bold text-white">{item.nextAction}</p>
      </div>
      <div className="mt-4 grid grid-cols-[48px_48px_1fr] gap-2">
        <button onClick={() => onAdjustAsset(item.id, -1)} className="h-10 rounded-xl bg-white/[0.06] font-black text-white">-</button>
        <button onClick={() => onAdjustAsset(item.id, 1)} className="h-10 rounded-xl bg-[#E07B39] font-black text-black">+</button>
        <button onClick={() => openSofi(`IA da Educação, avalie o item ${item.name}, estoque atual ${item.qty}, mínimo ${item.min}, e gere um plano de reposição.`)} className="h-10 rounded-xl bg-[#F8A303] px-3 text-xs font-black text-black">Auditar com IA da Educação</button>
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

function TinyMeter({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value || 0)))
  return (
    <div className="grid grid-cols-[34px_1fr_32px] items-center gap-2">
      <span className="text-[10px] font-black uppercase text-white/35">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full rounded-full" style={{ width: `${safeValue}%`, background: color }} />
      </span>
      <span className="text-right text-[10px] font-black" style={{ color }}>{safeValue}%</span>
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
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">Próxima ação</p>
        <p className="mt-2 text-lg font-black text-white">{person.nextAction}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={() => onCreateAction(person, `Plano de desenvolvimento - ${person.name}`)} className="h-10 rounded-2xl bg-[#8B5CF6] px-4 text-xs font-black text-white">Criar plano</button>
        <button onClick={() => openSofi(`IA da Educação, assuma o acompanhamento de ${person.name}. Cargo: ${person.role}. Próxima ação: ${person.nextAction}.`)} className="h-10 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-white">Abrir com IA da Educação</button>
      </div>
    </div>
  )
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white/70">{label}</p>
        <p className="text-sm font-black text-white/70">{value}%</p>
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

      <div className="mt-3 flex flex-col gap-1.5">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={[
              'flex flex-col gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-all',
              value === opt.value
                ? 'border-white/25 bg-white/[0.09]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]',
            ].join(' ')}
          >
            <p className="text-[11px] font-black text-white/80">{opt.label}</p>
            {opt.detail && (
              <p className="text-[10px] text-white/35">{opt.detail}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
