'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  ArrowPathIcon,
  Bars3Icon,
  BoltIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PencilIcon,
  PencilSquareIcon,
  PhotoIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

type ProviderStatus = {
  id: string
  name: string
  role: string
  configured: boolean
}

type IntegrationStatus = {
  id: string
  name: string
  services: string[]
  envReady: boolean
  connected: boolean
  connectUrl: string | null
}

type SofiFolder = {
  id: string
  name: string
}

type SofiAction = {
  type: string
  data: any
}

type SofiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  display?: string
  provider?: string
  createdAt: string
  action?: SofiAction | null
  actionStatus?: 'done' | 'error'
  actionSummary?: string
  actionRoute?: string
}

type SofiThread = {
  id: string
  title: string
  folderId: string
  createdAt: string
  updatedAt: string
  providerMode: string
  messages: SofiMessage[]
}

type PlatformContext = {
  path: string
  label: string
  recordedAt: string
}

type ActionExecutionResult = {
  message: string
  route?: string
}

const SOFI_CHAT_FOLDERS_KEY = 'aps_edu_sofi_folders_v1'
const SOFI_CHAT_THREADS_KEY = 'aps_edu_sofi_threads_v1'
const SOFI_CHAT_ACTIVE_THREAD_KEY = 'aps_edu_sofi_active_thread_v1'
const SOFI_WORKSPACE_NOTE_KEY = 'aps_edu_sofi_workspace_note_v1'
const SOFI_SIDEBAR_COMPACT_KEY = 'aps_edu_sofi_sidebar_compact_v1'

const defaultFolders: SofiFolder[] = [
  { id: 'geral', name: 'Geral' },
  { id: 'projetos', name: 'Projetos' },
  { id: 'escola', name: 'Escola' },
  { id: 'financeiro', name: 'Financeiro' },
  { id: 'pessoas', name: 'Pessoas' },
]

const defaultThread: SofiThread = {
  id: 'thread-inicial',
  title: 'Novo chat',
  folderId: 'geral',
  providerMode: 'auto',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [],
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function renderStructuredContent(text: string) {
  const lines = text.split('\n').filter(Boolean)

  if (lines.length <= 1) {
    return (
      <p className="whitespace-pre-wrap">
        {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={index} className="font-semibold text-white">
                {part.slice(2, -2)}
              </strong>
            )
          }
          return <span key={index}>{part}</span>
        })}
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
          return (
            <div key={index} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
              <p className="text-white/88">{trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')}</p>
            </div>
          )
        }

        if (trimmed.endsWith(':') || trimmed.startsWith('#')) {
          return (
            <p key={index} className="pt-1 font-semibold text-white">
              {trimmed.replace(/^#+\s*/, '')}
            </p>
          )
        }

        return (
          <p key={index} className="text-white/86">
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}
function calendarPayloadForTask(task: any) {
  if (!task?.dueDate || !task?.title) return null
  const start = new Date(`${task.dueDate}T09:00:00`)
  const duration = Math.max(15, Number(task.duration) || 30)
  const end = new Date(start.getTime() + duration * 60 * 1000)
  return {
    title: `Tarefa: ${task.title}`,
    start: start.toISOString(),
    end: end.toISOString(),
    description: task.notes || 'Criado automaticamente pela Sofi na APS-EDU.',
    reminderMinutes: 60,
  }
}

function parseAction(response: string): { content: string; action: SofiAction | null } {
  let contentFinal = response.replace(/```json[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim()
  let actionFinal: SofiAction | null = null

  try {
    const raw = response
    let startIdx = 0
    while (startIdx < raw.length) {
      const openAt = raw.indexOf('{', startIdx)
      if (openAt === -1) break
      let depth = 0
      let closeAt = -1
      for (let i = openAt; i < raw.length; i++) {
        if (raw[i] === '{') depth++
        else if (raw[i] === '}') {
          depth--
          if (depth === 0) {
            closeAt = i
            break
          }
        }
      }
      if (closeAt === -1) break
      const candidate = raw.substring(openAt, closeAt + 1)
      try {
        const obj = JSON.parse(candidate)
        if (obj && obj.action && obj.action.type) {
          actionFinal = obj.action
          contentFinal = (typeof obj.content === 'string' ? obj.content : '') || contentFinal.replace(candidate, '').trim()
          break
        }
      } catch {}
      startIdx = closeAt + 1
    }
  } catch {}

  return { content: contentFinal || response, action: actionFinal }
}

function actionLabel(type?: string) {
  const map: Record<string, string> = {
    create_task: 'Tarefa pessoal',
    create_tasks: 'Pacote de tarefas',
    create_event: 'Evento de calendario',
    create_ai_artifact: 'Documento / artefato',
    create_management_work: 'Item de gestao',
    create_note: 'Nota executiva',
  }
  return map[type || ''] || 'Acao operacional'
}

function isAudioOrVideo(file: File) {
  return file.type.startsWith('audio/') || file.type.startsWith('video/')
}

async function readFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.'))
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '')
    reader.readAsDataURL(file)
  })
}

export default function AiIntelligenceCenter() {
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [folders, setFolders] = useState<SofiFolder[]>(defaultFolders)
  const [threads, setThreads] = useState<SofiThread[]>([defaultThread])
  const [activeThreadId, setActiveThreadId] = useState(defaultThread.id)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCompact, setSidebarCompact] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [search, setSearch] = useState('')
  const [providerMode, setProviderMode] = useState('auto')
  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const [workspaceNote, setWorkspaceNote] = useState('')
  const [threadMenuId, setThreadMenuId] = useState<string | null>(null)
  const [platformContext, setPlatformContext] = useState<PlatformContext | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const configuredProviders = providers.filter(provider => provider.configured)

  useEffect(() => {
    fetch('/api/ai/status')
      .then(res => res.json())
      .then(data => setProviders(data.providers || []))
      .catch(() => setProviders([]))

    fetch('/api/integrations/status')
      .then(res => res.json())
      .then(data => setIntegrations(Array.isArray(data.providers) ? data.providers : []))
      .catch(() => setIntegrations([]))

    try {
      const savedFolders = JSON.parse(localStorage.getItem(SOFI_CHAT_FOLDERS_KEY) || 'null')
      const savedThreads = JSON.parse(localStorage.getItem(SOFI_CHAT_THREADS_KEY) || 'null')
      const savedActive = localStorage.getItem(SOFI_CHAT_ACTIVE_THREAD_KEY)
      const savedNote = localStorage.getItem(SOFI_WORKSPACE_NOTE_KEY) || ''
      const savedContext = JSON.parse(localStorage.getItem('aps_edu_last_context_v1') || 'null')
      const savedCompact = localStorage.getItem(SOFI_SIDEBAR_COMPACT_KEY) === '1'

      if (Array.isArray(savedFolders) && savedFolders.length) setFolders(savedFolders)
      if (Array.isArray(savedThreads) && savedThreads.length) setThreads(savedThreads)
      if (savedActive) setActiveThreadId(savedActive)
      if (savedNote) setWorkspaceNote(savedNote)
      if (savedContext?.path) setPlatformContext(savedContext)
      setSidebarCompact(savedCompact)
    } catch {}

    const syncContext = () => {
      try {
        const savedContext = JSON.parse(localStorage.getItem('aps_edu_last_context_v1') || 'null')
        if (savedContext?.path) setPlatformContext(savedContext)
      } catch {}
    }

    window.addEventListener('focus', syncContext)
    window.addEventListener('storage', syncContext)
    return () => {
      window.removeEventListener('focus', syncContext)
      window.removeEventListener('storage', syncContext)
    }
  }, [])

  useEffect(() => {
    const syncDesktop = () => setIsDesktop(window.innerWidth >= 1024)
    syncDesktop()
    window.addEventListener('resize', syncDesktop)
    return () => window.removeEventListener('resize', syncDesktop)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!providerMenuRef.current?.contains(event.target as Node)) {
        setProviderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SOFI_CHAT_FOLDERS_KEY, JSON.stringify(folders))
      localStorage.setItem(SOFI_CHAT_THREADS_KEY, JSON.stringify(threads))
      localStorage.setItem(SOFI_CHAT_ACTIVE_THREAD_KEY, activeThreadId)
      localStorage.setItem(SOFI_WORKSPACE_NOTE_KEY, workspaceNote)
      localStorage.setItem(SOFI_SIDEBAR_COMPACT_KEY, sidebarCompact ? '1' : '0')
    } catch {}
  }, [folders, threads, activeThreadId, workspaceNote, sidebarCompact])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threads, activeThreadId, loading])

  const activeThread = useMemo(() => {
    return threads.find(thread => thread.id === activeThreadId) || threads[0]
  }, [threads, activeThreadId])

  const activeFolder = useMemo(() => {
    return folders.find(folder => folder.id === activeThread?.folderId) || folders[0]
  }, [folders, activeThread?.folderId])

  const visibleThreads = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return threads
    return threads.filter(thread => {
      const haystack = `${thread.title} ${thread.messages.map(message => message.content).join(' ')}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [threads, search])

  useEffect(() => {
    if (!activeThread) return
    setProviderMode(activeThread.providerMode || 'auto')
  }, [activeThread?.id])

  function updateThreads(updater: (current: SofiThread[]) => SofiThread[]) {
    setThreads(current => updater(current))
  }

  function createThread(folderId = 'geral') {
    const thread: SofiThread = {
      id: makeId('thread'),
      title: 'Novo chat',
      folderId,
      providerMode: 'auto',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    }
    setThreads(current => [thread, ...current])
    setActiveThreadId(thread.id)
    setProviderMode('auto')
    setThreadMenuId(null)
  }

  function renameThread(threadId: string) {
    const thread = threads.find(item => item.id === threadId)
    const nextName = window.prompt('Novo nome do chat', thread?.title || '')
    if (!nextName?.trim()) return
    updateThreads(current =>
      current.map(item =>
        item.id === threadId
          ? { ...item, title: nextName.trim(), updatedAt: new Date().toISOString() }
          : item
      )
    )
    setThreadMenuId(null)
  }

  function duplicateThread(threadId: string) {
    const thread = threads.find(item => item.id === threadId)
    if (!thread) return
    const duplicate: SofiThread = {
      ...thread,
      id: makeId('thread'),
      title: `${thread.title} (copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [...thread.messages],
    }
    setThreads(current => [duplicate, ...current])
    setActiveThreadId(duplicate.id)
    setThreadMenuId(null)
  }

  function deleteThread(threadId: string) {
    if (threads.length <= 1) return
    if (!window.confirm('Excluir este chat?')) return
    const nextThreads = threads.filter(item => item.id !== threadId)
    setThreads(nextThreads)
    if (activeThreadId === threadId) {
      setActiveThreadId(nextThreads[0]?.id || defaultThread.id)
    }
    setThreadMenuId(null)
  }

  function createFolder() {
    const name = window.prompt('Nome da pasta')
    if (!name?.trim()) return
    setFolders(current => [...current, { id: makeId('folder'), name: name.trim() }])
  }

  function setThreadFolder(threadId: string, folderId: string) {
    updateThreads(current =>
      current.map(thread =>
        thread.id === threadId
          ? { ...thread, folderId, updatedAt: new Date().toISOString() }
          : thread
      )
    )
  }

  async function executeAction(action: SofiAction): Promise<ActionExecutionResult> {
    if (action.type === 'create_task') {
      const created = await api.post('/personal', action.data)
      const calendarPayload = calendarPayloadForTask(created.data)
      if (calendarPayload) await api.post('/calendar', calendarPayload).catch(() => null)
      window.dispatchEvent(new CustomEvent('personal_tasks_updated', { detail: { tasks: [created.data] } }))
      return { message: `Tarefa criada: ${created.data?.title || action.data?.title || 'Nova tarefa'}`, route: '/minha-area' }
    }

    if (action.type === 'create_tasks') {
      const items = Array.isArray(action.data?.tasks) ? action.data.tasks : []
      const created = []
      for (const item of items) {
        if (!item?.title) continue
        const res = await api.post('/personal', item)
        const calendarPayload = calendarPayloadForTask(res.data)
        if (calendarPayload) await api.post('/calendar', calendarPayload).catch(() => null)
        created.push(res.data)
      }
      if (created.length) {
        window.dispatchEvent(new CustomEvent('personal_tasks_updated', { detail: { tasks: created } }))
      }
      return { message: `${created.length} tarefa(s) criadas na sua area.`, route: '/minha-area' }
    }

    if (action.type === 'create_event') {
      await api.post('/calendar', action.data)
      window.dispatchEvent(new CustomEvent('sofi_action_completed', { detail: { type: action.type, data: action.data } }))
      return { message: `Evento criado: ${action.data?.title || 'Novo evento'}`, route: '/meu-dia' }
    }

    if (action.type === 'send_email') {
      await api.post('/gmail', action.data)
      return { message: `E-mail preparado/enviado: ${action.data?.subject || 'Nova mensagem'}`, route: '/minha-area' }
    }

    if (action.type === 'drive_create_folder') {
      await api.post('/drive', action.data)
      return { message: `Pasta criada no Drive: ${action.data?.name || 'Nova pasta'}`, route: '/minha-area' }
    }

    if (action.type === 'create_ai_artifact') {
      const current = JSON.parse(localStorage.getItem('aps_edu_ai_center_artifacts') || '[]')
      const artifact = {
        id: `art-${Date.now()}`,
        type: action.data?.type || 'Documento',
        title: action.data?.title || 'Artefato criado pela Sofi',
        owner: action.data?.owner || 'Sofi IA',
        status: action.data?.status || 'Rascunho',
        createdAt: new Date().toLocaleString('pt-BR'),
        content: action.data?.content || action.data?.description || '',
      }
      localStorage.setItem('aps_edu_ai_center_artifacts', JSON.stringify([artifact, ...current].slice(0, 32)))
      window.dispatchEvent(new CustomEvent('ai_artifacts_updated', { detail: { artifact } }))
      return { message: `Artefato criado: ${artifact.title}`, route: '/inovacao' }
    }

    if (action.type === 'create_management_work') {
      const saved = localStorage.getItem('aps_edu_management_state_v2')
      const current = saved ? JSON.parse(saved) : {}
      const work = Array.isArray(current.work) ? current.work : []
      const item = {
        id: `T-${Date.now()}`,
        title: action.data?.title || 'Nova tarefa criada pela Sofi',
        owner: action.data?.owner || 'Sofi IA',
        area: action.data?.area || 'Centro',
        stage: action.data?.stage || 'Novo',
        priority: action.data?.priority || 'Alta',
        due: action.data?.due || 'Hoje',
      }
      const next = { ...current, work: [item, ...work] }
      localStorage.setItem('aps_edu_management_state_v2', JSON.stringify(next))
      window.dispatchEvent(new CustomEvent('management_state_updated', { detail: next }))
      return { message: `Item criado na gestao: ${item.title}`, route: '/gestao?view=kanban' }
    }

    if (action.type === 'create_note') {
      const current = JSON.parse(localStorage.getItem('aps_edu_sofi_notes') || '[]')
      const note = {
        id: `note-${Date.now()}`,
        title: action.data?.title || 'Nota da Sofi',
        content: action.data?.content || '',
        createdAt: new Date().toLocaleString('pt-BR'),
      }
      localStorage.setItem('aps_edu_sofi_notes', JSON.stringify([note, ...current].slice(0, 100)))
      window.dispatchEvent(new CustomEvent('sofi_notes_updated', { detail: { note } }))
      return { message: `Nota salva: ${note.title}`, route: '/minha-area' }
    }

    throw new Error('Acao ainda nao suportada nesta tela.')
  }

  function systemInstruction() {
    return `Voce e a Sofi, assistente executiva da APS EDU.
Responda em portugues do Brasil com clareza, objetividade e profundidade pratica.
Mantenha continuidade da conversa, proponha acoes aplicaveis e considere o contexto operacional.

Quando o usuario pedir uma acao real, voce PODE devolver um JSON valido no formato:
{"content":"mensagem humana curta","action":{"type":"create_task|create_tasks|create_event|send_email|drive_create_folder|create_ai_artifact|create_management_work|create_note","data":{...}}}

Regras:
- Use create_task para 1 tarefa pessoal.
- Use create_tasks para varias tarefas pessoais.
- Use create_event para compromisso/calendario.
- Use send_email para e-mails operacionais.
- Use drive_create_folder para organizar pastas no Drive.
- Use create_ai_artifact para documentos, atas, politicas, roteiros, comunicados ou checklists.
- Use create_management_work para itens do centro operacional/kanban de gestao.
- Use create_note para notas curtas e memoria executiva.
- Se nao for executar nada, responda normalmente sem JSON.
- Sempre mantenha "content" claro e profissional.`
  }

  async function transcribeFile(file: File) {
    const fileBase64 = await readFileBase64(file)
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Falha ao processar anexo.')
    return data.text || ''
  }

  function updateThreadMessage(threadId: string, messageId: string, updater: (message: SofiMessage) => SofiMessage) {
    updateThreads(current =>
      current.map(thread =>
        thread.id !== threadId
          ? thread
          : {
              ...thread,
              messages: thread.messages.map(message => (message.id === messageId ? updater(message) : message)),
              updatedAt: new Date().toISOString(),
            }
      )
    )
  }

  async function sendMessage(prefilled?: string) {
    const rawContent = (prefilled || input).trim()
    if ((!rawContent && !attachedFile) || loading || !activeThread) return

    let content = rawContent
    let imageBase64: string | undefined
    let imageMimeType: string | undefined
    let display = rawContent

    if (attachedFile) {
      display = `${attachedFile.type.startsWith('image/') ? 'Imagem' : isAudioOrVideo(attachedFile) ? 'Audio' : 'Arquivo'}: ${attachedFile.name}${rawContent ? `\n${rawContent}` : ''}`
      if (attachedFile.type.startsWith('image/')) {
        imageBase64 = await readFileBase64(attachedFile)
        imageMimeType = attachedFile.type
        content = rawContent || 'Analise este anexo visual e proponha a melhor acao operacional.'
      } else {
        const extractedText = await transcribeFile(attachedFile)
        content = `${extractedText}\n\nPedido do usuario: ${rawContent || (isAudioOrVideo(attachedFile) ? 'Transcreva e organize este audio.' : 'Analise este documento e estruture os proximos passos.')}`
      }
    }

    const userMessage: SofiMessage = {
      id: makeId('msg'),
      role: 'user',
      content,
      display,
      createdAt: new Date().toISOString(),
    }

    const currentThread = activeThread
    const nextMessages = [...currentThread.messages, userMessage]
    const nextTitle = currentThread.messages.length === 0 ? content.slice(0, 56) : currentThread.title

    updateThreads(current =>
      current.map(thread =>
        thread.id === currentThread.id
          ? {
              ...thread,
              title: nextTitle || 'Novo chat',
              providerMode,
              messages: nextMessages,
              updatedAt: new Date().toISOString(),
            }
          : thread
      )
    )

    setInput('')
    setAttachedFile(null)
    setAttachmentPreview('')
    setLoading(true)
    let assistantMessageId = ''

    try {
      const historyText = nextMessages
        .slice(-10)
        .map(message => `${message.role === 'user' ? 'Usuario' : 'Sofi'}: ${message.content}`)
        .join('\n\n')

      const contextParts = [
        `Pasta atual: ${activeFolder?.name || 'Geral'}`,
        platformContext?.label ? `Tela recente da plataforma: ${platformContext.label}` : '',
        platformContext?.path ? `Rota recente: ${platformContext.path}` : '',
        workspaceNote ? `Memoria ativa da gestora: ${workspaceNote}` : '',
        integrations.length
          ? `Integracoes externas: ${integrations.map(item => `${item.name}=${item.connected ? 'conectado' : item.envReady ? 'pronto para conectar' : 'nao configurado'}`).join('; ')}`
          : '',
      ].filter(Boolean)

      const prompt = `${systemInstruction()}

Contexto ativo:
${contextParts.join('\n')}

Historico recente:
${historyText}

Pedido atual:
${content}`

      assistantMessageId = makeId('msg')
      const draftAssistantMessage: SofiMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        provider: providerMode,
        createdAt: new Date().toISOString(),
      }

      updateThreads(current =>
        current.map(thread =>
          thread.id === currentThread.id
            ? {
                ...thread,
                providerMode,
                messages: [...nextMessages, draftAssistantMessage],
                updatedAt: new Date().toISOString(),
              }
            : thread
        )
      )

      setStreamingMessageId(assistantMessageId)

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          stream: true,
          imageBase64,
          imageMimeType,
          preferredProvider: providerMode === 'auto' ? undefined : providerMode,
        }),
      })

      if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => null)
        throw new Error(failure?.error || 'Nao consegui responder agora.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let finalProvider = providerMode

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const line = event
            .split('\n')
            .find(item => item.startsWith('data: '))

          if (!line) continue

          const payload = JSON.parse(line.slice(6))
          if (payload.type === 'meta') {
            finalProvider = payload.providerLabel || payload.provider || finalProvider
            updateThreadMessage(currentThread.id, assistantMessageId, message => ({
              ...message,
              provider: finalProvider,
            }))
          }

          if (payload.type === 'delta') {
            accumulated += payload.text || ''
            updateThreadMessage(currentThread.id, assistantMessageId, message => ({
              ...message,
              content: accumulated,
            }))
          }
        }
      }

      const rawAnswer = accumulated || 'Nao consegui responder agora.'
      const parsed = parseAction(rawAnswer)

      updateThreadMessage(currentThread.id, assistantMessageId, message => ({
        ...message,
        content: parsed.content,
        provider: finalProvider,
        action: parsed.action,
      }))

      const assistantMessage: Partial<SofiMessage> = {}
      if (parsed.action) {
        try {
          const actionResult = await executeAction(parsed.action)
          assistantMessage.actionStatus = 'done'
          assistantMessage.actionSummary = actionResult.message
          assistantMessage.actionRoute = actionResult.route
        } catch (error: any) {
          assistantMessage.actionStatus = 'error'
          assistantMessage.actionSummary = error?.message || 'Nao foi possivel executar a acao.'
        }
      }

      updateThreadMessage(currentThread.id, assistantMessageId, message => ({
        ...message,
        ...assistantMessage,
      }))
    } catch (error: any) {
      const messageText = error?.message || 'Nao consegui me conectar agora. Tente novamente em instantes.'
      if (assistantMessageId) {
        updateThreadMessage(currentThread.id, assistantMessageId, message => ({
          ...message,
          content: messageText,
          provider: providerMode,
        }))
      } else {
        const fallbackAssistantMessage: SofiMessage = {
          id: makeId('msg'),
          role: 'assistant',
          content: messageText,
          provider: providerMode,
          createdAt: new Date().toISOString(),
        }
        updateThreads(current =>
          current.map(thread =>
            thread.id === currentThread.id
              ? {
                  ...thread,
                  messages: [...thread.messages, fallbackAssistantMessage],
                  updatedAt: new Date().toISOString(),
                }
              : thread
          )
        )
      }
    } finally {
      setStreamingMessageId(null)
      setLoading(false)
    }
  }

  function handleKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  function renderActionDetails(action?: SofiAction | null) {
    if (!action?.data) return null

    const detailsByType: Record<string, Array<{ label: string; value?: string }>> = {
      create_task: [
        { label: 'Titulo', value: action.data.title },
        { label: 'Prioridade', value: action.data.priority },
        { label: 'Prazo', value: action.data.dueDate },
      ],
      create_tasks: [
        { label: 'Quantidade', value: String(Array.isArray(action.data.tasks) ? action.data.tasks.length : 0) },
        { label: 'Destino', value: 'Minha area' },
      ],
      create_event: [
        { label: 'Evento', value: action.data.title },
        { label: 'Inicio', value: action.data.start ? formatDateTime(action.data.start) : '' },
        { label: 'Fim', value: action.data.end ? formatDateTime(action.data.end) : '' },
      ],
      create_ai_artifact: [
        { label: 'Tipo', value: action.data.type },
        { label: 'Titulo', value: action.data.title },
        { label: 'Responsavel', value: action.data.owner },
      ],
      create_management_work: [
        { label: 'Item', value: action.data.title },
        { label: 'Area', value: action.data.area },
        { label: 'Etapa', value: action.data.stage },
      ],
      create_note: [
        { label: 'Nota', value: action.data.title },
        { label: 'Destino', value: 'Memoria executiva' },
      ],
    }

    const items = (detailsByType[action.type] || []).filter(item => item.value)
    if (!items.length) return null

    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <div key={`${action.type}-${item.label}`} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">{item.label}</p>
            <p className="mt-1 text-sm font-medium text-white/84">{item.value}</p>
          </div>
        ))}
      </div>
    )
  }

  const recentThreads = useMemo(
    () =>
      [...visibleThreads].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [visibleThreads]
  )

  const providerLabel =
    providerMode === 'auto'
      ? 'Auto'
      : configuredProviders.find(provider => provider.id === providerMode)?.name || providerMode

  const effectiveSidebarCompact = isDesktop && sidebarCompact && !sidebarPeek
  const sidebarPanelVisible = !isDesktop || !effectiveSidebarCompact
  const railWidth = isDesktop ? 64 : 0
  const sidebarPanelWidth = sidebarPanelVisible ? 288 : 0
  const sidebarWidth = railWidth + sidebarPanelWidth

  return (
    <div className="relative -m-5 h-[calc(100vh-5.75rem)] overflow-hidden bg-black lg:-m-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_18%),radial-gradient(circle_at_78%_12%,rgba(248,163,3,0.08),transparent_12%),radial-gradient(circle_at_48%_100%,rgba(59,130,246,0.05),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.012),transparent_16%,transparent_84%,rgba(255,255,255,0.012))]" />

      {!isDesktop && sidebarOpen ? (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <div
        className="relative grid h-full min-h-0 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ gridTemplateColumns: isDesktop ? `${sidebarWidth}px minmax(0,1fr)` : 'minmax(0,1fr)' }}
      >
        {isDesktop ? (
          <aside className="relative z-20 flex min-h-0 border-r border-white/[0.08] bg-black">
            <div
              onMouseEnter={() => sidebarCompact && setSidebarPeek(true)}
              onMouseLeave={() => setSidebarPeek(false)}
              className="flex w-[64px] flex-col items-center justify-between border-r border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(255,255,255,0))] py-4 transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
            >
              <div className="flex w-full flex-col items-center gap-4">
                <button
                  onClick={() => setSidebarCompact(false)}
                  className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] text-[#F8A303] shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-[1px] hover:border-white/22 hover:bg-white/[0.05]"
                >
                  <SparklesIcon className="h-5 w-5" />
                </button>

                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/78">Sofi</p>

                <button
                  onClick={() => createThread(activeFolder?.id || 'geral')}
                  className="flex h-11 w-11 items-center justify-center rounded-[1.05rem] border border-white/10 text-white/72 transition duration-300 hover:-translate-y-[1px] hover:border-white/18 hover:bg-white/[0.05] hover:text-white"
                >
                  <PencilSquareIcon className="h-[18px] w-[18px]" />
                </button>

                <button
                  onClick={() => setSidebarCompact(value => !value)}
                  className="flex h-11 w-11 items-center justify-center rounded-[1.05rem] border border-white/10 text-white/62 transition duration-300 hover:-translate-y-[1px] hover:border-white/18 hover:bg-white/[0.05] hover:text-white"
                >
                  <Bars3Icon className="h-[18px] w-[18px]" />
                </button>

                <button
                  onClick={() => setSidebarCompact(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-[1.05rem] border border-white/10 text-white/62 transition duration-300 hover:-translate-y-[1px] hover:border-white/18 hover:bg-white/[0.05] hover:text-white"
                >
                  <MagnifyingGlassIcon className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="flex-1" />
            </div>

            {sidebarPanelVisible ? (
              <div className="flex min-h-0 w-[288px] flex-col bg-[linear-gradient(180deg,rgba(6,8,12,0.985),rgba(6,8,12,0.95))] transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)]">
                <div className="flex items-center justify-between px-5 pb-4 pt-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">
                    <SparklesIcon className="h-4 w-4 text-[#F8A303]" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">Sofi IA</span>
                  </div>
                  <button
                    onClick={() => setSidebarCompact(true)}
                    className="rounded-xl border border-white/10 p-2 text-white/62 transition duration-300 hover:bg-white/[0.05] hover:text-white"
                  >
                    <Bars3Icon className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-4">
                  <button
                    onClick={() => createThread(activeFolder?.id || 'geral')}
                    className="flex h-[56px] w-full items-center gap-3 rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.07))] px-5 text-[15px] font-medium text-white shadow-[0_18px_40px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.03] transition duration-300 hover:-translate-y-[1px] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0.09))]"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                    Novo chat
                  </button>

                  <div className="mt-4 flex h-[52px] items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.015] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <MagnifyingGlassIcon className="h-5 w-5 text-white/42" />
                    <input
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="Buscar chats"
                      className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/32"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-5">
                  <div>
                    <div className="mb-3 flex items-center justify-between px-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">Pastas</p>
                      <button onClick={createFolder} className="text-[12px] text-white/46 transition hover:text-white">
                        Nova
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {folders.map(folder => {
                        const count = visibleThreads.filter(thread => thread.folderId === folder.id).length
                        const active = activeFolder?.id === folder.id
                        return (
                          <button
                            key={folder.id}
                            onClick={() => {
                              const existing = visibleThreads.find(thread => thread.folderId === folder.id)
                              if (existing) setActiveThreadId(existing.id)
                              else createThread(folder.id)
                            }}
                            className={`flex w-full items-center gap-3 rounded-[1rem] px-3 py-2.5 text-left transition duration-300 ${
                              active ? 'bg-white/[0.09] text-white shadow-[0_10px_28px_rgba(0,0,0,0.14)] ring-1 ring-white/[0.04]' : 'text-white/72 hover:bg-white/[0.05] hover:text-white'
                            }`}
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-semibold uppercase text-white/72">
                              {folder.name.slice(0, 1)}
                            </span>
                            <span className="flex-1 truncate text-[14px] font-medium">{folder.name}</span>
                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-white/70">
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="mb-3 px-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">Recentes</p>
                    </div>

                    <div className="space-y-2">
                      {recentThreads.map(thread => {
                        const active = thread.id === activeThreadId
                        const menuOpen = threadMenuId === thread.id
                        return (
                          <div key={thread.id} className="relative">
                            <button
                              onClick={() => setActiveThreadId(thread.id)}
                              className={`w-full rounded-[1.15rem] px-4 py-3 text-left transition duration-300 ${
                                active ? 'bg-white/[0.10] text-white shadow-[0_10px_28px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.05]' : 'text-white/68 hover:bg-white/[0.05] hover:text-white'
                              }`}
                            >
                              <p className="line-clamp-1 text-[14px] font-medium">{thread.title}</p>
                              <p className="mt-1 text-xs text-white/34">
                                {thread.messages.length === 0 ? '0 msgs' : `${thread.messages.length} msgs`} {` ${formatDate(thread.updatedAt)}`}
                              </p>
                            </button>

                            <button
                              onClick={() => setThreadMenuId(menuOpen ? null : thread.id)}
                              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white/72"
                            >
                              <EllipsisHorizontalIcon className="h-4 w-4" />
                            </button>

                            {menuOpen ? (
                              <div className="absolute right-3 top-12 z-20 w-48 rounded-2xl border border-white/10 bg-[#0C1019]/98 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
                                <button onClick={() => renameThread(thread.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/74 transition hover:bg-white/[0.06]">
                                  <PencilIcon className="h-4 w-4" />
                                  Renomear
                                </button>
                                <button onClick={() => duplicateThread(thread.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/74 transition hover:bg-white/[0.06]">
                                  <DocumentDuplicateIcon className="h-4 w-4" />
                                  Duplicar
                                </button>
                                <button onClick={() => deleteThread(thread.id)} disabled={threads.length <= 1} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-40">
                                  <TrashIcon className="h-4 w-4" />
                                  Excluir
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/[0.08] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1bb75f] text-sm font-semibold text-white">
                      EU
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">euviniandrade</p>
                      <p className="text-[12px] text-white/42">Plus</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        ) : (
          <aside className={`absolute inset-y-0 left-0 z-40 flex w-[88vw] max-w-[340px] flex-col border-r border-white/[0.08] bg-black/98 backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5">
                <SparklesIcon className="h-4 w-4 text-[#F8A303]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">Sofi IA</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-white/10 p-2 text-white/62 transition duration-300 hover:bg-white/[0.05] hover:text-white"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4">
              <button
                onClick={() => createThread(activeFolder?.id || 'geral')}
                className="flex h-[54px] w-full items-center gap-3 rounded-[1.3rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.08))] px-5 text-[15px] font-medium text-white shadow-[0_16px_34px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-[1px] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.1))]"
              >
                <PencilSquareIcon className="h-5 w-5" />
                Novo chat
              </button>

              <div className="mt-4 flex h-[54px] items-center gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.015] px-4">
                <MagnifyingGlassIcon className="h-5 w-5 text-white/42" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar chats"
                  className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/32"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-5">
              <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">Projetos</p>
              <div className="space-y-1.5">
                {folders.map(folder => {
                  const count = visibleThreads.filter(thread => thread.folderId === folder.id).length
                  const active = activeFolder?.id === folder.id
                  return (
                    <button
                      key={folder.id}
                      onClick={() => {
                        const existing = visibleThreads.find(thread => thread.folderId === folder.id)
                        if (existing) setActiveThreadId(existing.id)
                        else createThread(folder.id)
                        setSidebarOpen(false)
                      }}
                      className={`flex w-full items-center gap-3 rounded-[1rem] px-3 py-2.5 text-left transition duration-300 ${
                        active ? 'bg-white/[0.09] text-white shadow-[0_10px_28px_rgba(0,0,0,0.14)]' : 'text-white/72 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-semibold uppercase text-white/72">
                        {folder.name.slice(0, 1)}
                      </span>
                      <span className="flex-1 truncate text-[14px] font-medium">{folder.name}</span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-white/70">
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <p className="mb-3 mt-7 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/34">Chats</p>
              <div className="space-y-2">
                {recentThreads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id)
                      setSidebarOpen(false)
                    }}
                    className={`w-full rounded-[1.15rem] px-4 py-3 text-left transition duration-300 ${
                      thread.id === activeThreadId ? 'bg-white/[0.10] text-white shadow-[0_10px_28px_rgba(0,0,0,0.16)]' : 'text-white/68 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <p className="line-clamp-1 text-[14px] font-medium">{thread.title}</p>
                    <p className="mt-1 text-xs text-white/34">
                      {thread.messages.length === 0 ? '0 msgs' : `${thread.messages.length} msgs`} {` ${formatDate(thread.updatedAt)}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <section className="relative min-h-0 bg-black">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%,transparent_82%,rgba(255,255,255,0.01))]" />

          <header className="relative z-10 flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 pb-3 pt-4 md:px-6 md:pb-4 md:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              {!isDesktop ? (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 text-white/72 transition duration-300 hover:bg-white/[0.05] hover:text-white"
                >
                  <Bars3Icon className="h-[18px] w-[18px]" />
                </button>
              ) : null}

              <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.015] text-white/78 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
                <ChatBubbleLeftRightIcon className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold tracking-tight text-white md:text-[18px]">{activeThread?.title || 'Novo chat'}</p>
                <p className="truncate text-[12px] text-white/34 md:text-sm">{activeFolder?.name || 'Geral'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0" ref={providerMenuRef}>
              <button
                onClick={() => setProviderMenuOpen(value => !value)}
                className="flex h-11 min-w-[132px] items-center justify-between rounded-[1.1rem] border border-white/10 bg-white/[0.02] px-3.5 text-[15px] font-semibold text-white transition duration-300 hover:border-white/16 hover:bg-white/[0.05] md:h-12 md:min-w-[176px] md:px-4 md:text-[17px]"
              >
                <span className="truncate">{providerLabel}</span>
                <span className={`text-sm text-white/50 transition ${providerMenuOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {providerMenuOpen ? (
                <div className="absolute right-0 top-14 z-30 min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#0C1019]/98 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
                  <button
                    onClick={() => {
                      setProviderMode('auto')
                      setProviderMenuOpen(false)
                      updateThreads(current =>
                        current.map(thread =>
                          thread.id === activeThreadId ? { ...thread, providerMode: 'auto' } : thread
                        )
                      )
                    }}
                    className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      providerMode === 'auto'
                        ? 'bg-white/[0.08] text-white'
                        : 'text-white/72 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    Auto
                  </button>
                  {configuredProviders.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setProviderMode(provider.id)
                        setProviderMenuOpen(false)
                        updateThreads(current =>
                          current.map(thread =>
                            thread.id === activeThreadId ? { ...thread, providerMode: provider.id } : thread
                          )
                        )
                      }}
                      className={`mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        providerMode === provider.id
                          ? 'bg-[#F8A303]/14 text-[#FDC347]'
                          : 'text-white/72 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>
              ) : null}
              </div>
            </div>
          </header>

          <div className="relative h-[calc(100%-76px)] min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto px-4 pb-44 pt-1 md:px-6 md:pt-2">
              {activeThread?.messages.length ? (
                <div className="mx-auto flex w-full max-w-[920px] flex-col gap-7 pb-8 pt-6 md:gap-8 md:pt-8">
                  {activeThread.messages.map(message => (
                    <div key={message.id} className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[90%] gap-3 md:max-w-[88%] md:gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div
                          className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border text-xs font-semibold ${
                            message.role === 'user'
                              ? 'border-[#F8A303]/25 bg-[#F8A303]/12 text-[#F8A303]'
                              : 'border-white/8 bg-white/[0.05] text-white/72'
                          }`}
                        >
                          {message.role === 'user' ? 'V' : 'S'}
                        </div>

                        <div className="space-y-3">
                          <div
                            className={`rounded-[1.65rem] border px-5 py-4 text-[15px] leading-7 shadow-[0_18px_48px_rgba(0,0,0,0.14)] ${
                              message.role === 'user'
                                ? 'border-[#F8A303]/18 bg-[linear-gradient(180deg,rgba(248,163,3,0.16),rgba(248,163,3,0.08))] text-white'
                                : 'border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] text-white/88'
                            }`}
                          >
                            <div>{renderStructuredContent(message.display || message.content)}</div>
                            <div className="mt-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2 text-[11px] font-medium text-white/28">
                                <span>{formatTime(message.createdAt)}</span>
                                {message.provider ? <span>| {message.provider}</span> : null}
                                {message.id === streamingMessageId ? <span>| respondendo...</span> : null}
                              </div>
                              <button
                                onClick={() => copyText(message.content)}
                                className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/46 opacity-0 transition group-hover:opacity-100 hover:text-white/80"
                              >
                                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                                Copiar
                              </button>
                            </div>
                          </div>

                          {message.action ? (
                            <div className={`rounded-[1.35rem] border px-4 py-3 ${
                              message.actionStatus === 'done'
                                ? 'border-emerald-400/16 bg-emerald-400/7'
                                : 'border-rose-400/16 bg-rose-400/7'
                            }`}>
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
                                    {actionLabel(message.action.type)}
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-white">
                                    {message.actionSummary || 'Acao processada pela Sofi.'}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  message.actionStatus === 'done'
                                    ? 'bg-emerald-400/12 text-emerald-300'
                                    : 'bg-rose-400/12 text-rose-300'
                                }`}>
                                  {message.actionStatus === 'done' ? 'Concluida' : 'Falhou'}
                                </span>
                              </div>

                              {renderActionDetails(message.action)}

                              {message.actionRoute ? (
                                <div className="mt-3">
                                  <button
                                    onClick={() => router.push(message.actionRoute || '/')}
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/76 transition hover:bg-white/[0.08]"
                                  >
                                    Abrir area relacionada
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {message.role === 'assistant' && message.content ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {[
                                {
                                  label: 'Aprovar',
                                  prompt: `A partir da resposta abaixo, registre uma aprovacao executiva curta e objetiva.\n\n${message.content}`,
                                  icon: CheckCircleIcon,
                                },
                                {
                                  label: 'Agendar',
                                  prompt: `Com base na resposta abaixo, crie um compromisso no calendario com titulo, horario sugerido e lembrete.\n\n${message.content}`,
                                  icon: CalendarDaysIcon,
                                },
                                {
                                  label: 'Delegar',
                                  prompt: `Com base na resposta abaixo, delegue em tarefas objetivas com responsavel, prioridade e prazo.\n\n${message.content}`,
                                  icon: UserPlusIcon,
                                },
                                {
                                  label: 'Gerar documento',
                                  prompt: `Transforme a resposta abaixo em um documento operacional pronto para uso.\n\n${message.content}`,
                                  icon: ClipboardDocumentIcon,
                                },
                              ].map(item => {
                                const Icon = item.icon
                                return (
                                  <button
                                    key={`${message.id}-${item.label}`}
                                    onClick={() => sendMessage(item.prompt)}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/58 transition hover:bg-white/[0.06] hover:text-white"
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {item.label}
                                  </button>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}

                  {loading ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-5 py-4 text-sm text-white/58">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#F8A303]" />
                        Sofi esta pensando...
                      </div>
                    </div>
                  ) : null}

                  <div ref={bottomRef} />
                </div>
              ) : (
                <div className="flex min-h-full items-center justify-center px-2 md:px-4">
                  <div className="w-full max-w-[780px] pb-14 md:pb-16">
                    <div className="text-center">
                      <h1 className="text-[1.4rem] font-normal leading-[1.08] tracking-tight text-white sm:text-[1.65rem] md:text-[2.2rem]">
                        Por onde começamos?
                      </h1>
                    </div>

                    <div className="mx-auto mt-7 max-w-[780px] md:mt-8">
                      <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,33,33,0.96),rgba(23,23,23,0.96))] px-4 py-3.5 shadow-[0_32px_100px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.03] transition duration-300 hover:border-white/14 md:rounded-[2rem] md:px-5 md:py-4">
                        {attachedFile ? (
                          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/74">
                            {attachedFile.type.startsWith('image/') ? <PhotoIcon className="h-4 w-4" /> : <PaperClipIcon className="h-4 w-4" />}
                            <span className="truncate">{attachedFile.name}</span>
                            <button onClick={() => { setAttachedFile(null); setAttachmentPreview('') }} className="ml-auto rounded-full p-1 text-white/48 transition hover:bg-white/[0.06] hover:text-white">
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2.5 md:gap-3">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-transparent text-white/78 transition duration-300 hover:border-white/10 hover:bg-white/[0.06] md:h-11 md:w-11"
                          >
                            <PaperClipIcon className="h-5 w-5 md:h-6 md:w-6" />
                          </button>

                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*,audio/*,.pdf,.txt,.doc,.docx,.csv"
                            onChange={event => {
                              const file = event.target.files?.[0]
                              if (!file) return
                              setAttachedFile(file)
                              setAttachmentPreview(file.type.startsWith('image/') ? 'Imagem pronta' : isAudioOrVideo(file) ? 'Audio para transcricao' : 'Documento anexado')
                              event.currentTarget.value = ''
                            }}
                          />

                          <textarea
                            value={input}
                            onChange={event => setInput(event.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Pergunte, anexe ou peça uma ação"
                            className="min-h-[44px] flex-1 resize-none bg-transparent py-1.5 text-[0.98rem] leading-7 text-white outline-none placeholder:text-white/42 md:min-h-[48px] md:text-[1rem] md:leading-7"
                          />

                          <div className="flex items-center gap-2">
                            <span className="hidden text-[14px] text-white/58 lg:inline">{'Instantâneo'}</span>
                            <button
                              onClick={() => sendMessage()}
                              disabled={(!input.trim() && !attachedFile) || loading}
                              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white text-black shadow-[0_12px_32px_rgba(255,255,255,0.16)] transition duration-300 hover:scale-[1.03] hover:shadow-[0_18px_40px_rgba(255,255,255,0.2)] disabled:border-white/10 disabled:bg-white/12 disabled:text-white/30 md:h-12 md:w-12"
                            >
                              <PaperAirplaneIcon className="h-5 w-5 text-black" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:mt-7">
                        <button
                          onClick={() => sendMessage('Crie uma imagem institucional para uma campanha escolar.')}
                          className="inline-flex items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.015] px-5 py-2.5 text-[14px] text-white/82 transition duration-300 hover:-translate-y-[1px] hover:bg-white/[0.05] hover:text-white md:px-5 md:py-2.5"
                        >
                          <PhotoIcon className="h-5 w-5" />
                          Crie uma imagem
                        </button>
                        <button
                          onClick={() => sendMessage('Escreva ou edite um documento operacional com linguagem profissional.')}
                          className="inline-flex items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.015] px-5 py-2.5 text-[14px] text-white/82 transition duration-300 hover:-translate-y-[1px] hover:bg-white/[0.05] hover:text-white md:px-5 md:py-2.5"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                          Escreva ou edite
                        </button>
                        <button
                          onClick={() => sendMessage('Faça uma pesquisa e traga um parecer objetivo com contexto e fontes.')}
                          className="inline-flex items-center justify-center gap-3 rounded-full border border-white/12 bg-white/[0.015] px-5 py-2.5 text-[14px] text-white/82 transition duration-300 hover:-translate-y-[1px] hover:bg-white/[0.05] hover:text-white md:px-5 md:py-2.5"
                        >
                          <MagnifyingGlassIcon className="h-5 w-5" />
                          Consulte algo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeThread?.messages.length ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.96)_55%,rgba(0,0,0,1))]" />

                <div className="absolute inset-x-0 bottom-0 px-4 pb-5 md:px-6 md:pb-7">
                  <div className="mx-auto w-full max-w-[920px]">
                    <div className="rounded-[1.95rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,33,33,0.96),rgba(23,23,23,0.96))] px-4 py-4 shadow-[0_36px_120px_rgba(0,0,0,0.52)] ring-1 ring-white/[0.03] transition duration-300 hover:border-white/14 md:rounded-[2.15rem] md:px-5 md:py-5">
                      {attachedFile ? (
                        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/74">
                          {attachedFile.type.startsWith('image/') ? <PhotoIcon className="h-4 w-4" /> : <PaperClipIcon className="h-4 w-4" />}
                          <span className="truncate">{attachedFile.name}</span>
                          <button onClick={() => { setAttachedFile(null); setAttachmentPreview('') }} className="ml-auto rounded-full p-1 text-white/48 transition hover:bg-white/[0.06] hover:text-white">
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2.5 md:gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-transparent text-white/78 transition duration-300 hover:border-white/10 hover:bg-white/[0.06] md:h-11 md:w-11"
                        >
                          <PaperClipIcon className="h-5 w-5 md:h-6 md:w-6" />
                        </button>

                        <textarea
                          value={input}
                          onChange={event => setInput(event.target.value)}
                          onKeyDown={handleKey}
                          placeholder="Pergunte alguma coisa"
                          className="min-h-[52px] flex-1 resize-none bg-transparent py-2 text-[1rem] leading-7 text-white outline-none placeholder:text-white/42 md:min-h-[58px] md:text-[1.05rem] md:leading-8"
                        />

                        <div className="flex items-center gap-2">
                            <span className="hidden text-[14px] text-white/58 lg:inline">{'Instantâneo'}</span>
                          <button
                            onClick={() => sendMessage()}
                            disabled={(!input.trim() && !attachedFile) || loading}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white text-black shadow-[0_12px_32px_rgba(255,255,255,0.16)] transition duration-300 hover:scale-[1.03] hover:shadow-[0_18px_40px_rgba(255,255,255,0.2)] disabled:border-white/10 disabled:bg-white/12 disabled:text-white/30 md:h-12 md:w-12"
                          >
                            <PaperAirplaneIcon className="h-5 w-5 text-black" />
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
