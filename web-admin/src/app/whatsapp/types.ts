// ── Tipos para WhatsApp CRM
export type Tab = 'chats' | 'kanban' | 'mass' | 'groups' | 'ai' | 'analytics'
export type Stage = 'Inbox' | 'Hoje' | 'Acompanhar' | 'Pessoal' | 'Concluido' | 'Pausado'
export type ContactLabel = 'VIP' | 'Familia' | 'Trabalho' | 'Igreja' | 'Follow-up' | 'Urgente'

export interface QuickReply {
  id: string
  title: string
  text: string
}

export interface InternalNote {
  id: string
  chatId: string
  text: string
  at: string
}

export interface Contact {
  chatId: string
  phone: string
  name: string
  lastMessage: string
  lastAt: string
  unread: number
  timestamp: number
  avatarUrl?: string
  isGroup?: boolean
  stage?: Stage
}

export interface Message {
  id: string
  from: 'lead' | 'agent' | 'sofi'
  text: string
  at: string
  name?: string
  ts?: number
  ack?: number
}

export interface WaState {
  connected: boolean
  ready: boolean
  qrDataUrl?: string | null
  error?: string | null
}

export interface Group {
  id: string
  name: string
  description: string
  participants: number
  members: {
    id: string
    phone: string
    admin: boolean
  }[]
}

export interface MassRecipient {
  phone: string
  nome?: string
  empresa?: string
  avatarUrl?: string
  [key: string]: string | undefined
}

export interface AiState {
  mode: 'paused' | 'assist' | 'auto'
  tone: string
  maxChars: number
  allowGroups: boolean
  activePlaybook?: string
  playbooks?: Record<'vendas' | 'suporte' | 'pessoal', string>
  training: string[]
  hasGeminiKey?: boolean
}

export interface InstagramRule {
  id: string
  keyword: string
  action: string
  enabled: boolean
  targetStage: string
}

export interface InstagramState {
  connected: boolean
  pageId?: string
  businessId: string
  hasPageToken: boolean
  hasVerifyToken: boolean
  automationEnabled: boolean
  requireFollowGate: boolean
  rules: InstagramRule[]
}

export interface InstagramEvent {
  id?: string
  at?: string
  type: string
  fromId?: string
  fromName?: string
  text?: string
  ruleId?: string | null
  userId?: string
  error?: string
}

export const STAGES: readonly Stage[] = ['Inbox', 'Hoje', 'Acompanhar', 'Pessoal', 'Concluido', 'Pausado'] as const

export const STAGE_COLORS: Record<Stage, string> = {
  Inbox: '#6366F1',
  Hoje: '#F8A303',
  Acompanhar: '#0EA5E9',
  Pessoal: '#EC4899',
  Concluido: '#22C55E',
  Pausado: '#6B7280',
}

export const LABELS: readonly ContactLabel[] = ['VIP', 'Familia', 'Trabalho', 'Igreja', 'Follow-up', 'Urgente'] as const

export const QUICK_REPLIES_KEY = 'sofi_quick_replies'
export const NOTES_KEY = 'sofi_internal_notes'
export const CRM_KEY = 'sofi_crm_stages'
export const ARCHIVE_KEY = 'sofi_crm_archived'
export const LABELS_KEY = 'sofi_crm_labels'
