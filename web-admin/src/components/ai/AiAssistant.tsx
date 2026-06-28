'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import api from '@/lib/api'
import {
  XMarkIcon,
  PaperAirplaneIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PaperClipIcon,
  StopCircleIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  FolderIcon,
  Squares2X2Icon,
  PencilSquareIcon,
  ArrowPathIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

interface Message {
  role: 'user' | 'assistant'
  content: string
  display?: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}

const SOFI_MEMORY_KEY = 'aps_edu_sofi_global_messages_v1'
const SOFI_MEMORY_SUMMARY_KEY = 'aps_edu_sofi_memory_summary_v1'
const SOFI_MEMORY_RECORDS_KEY = 'aps_edu_sofi_memory_records_v1'
const SOFI_SIDEBAR_COMPACT_KEY = 'aps_edu_sofi_sidebar_compact_v1'
const SOFI_MAX_MESSAGES = 260
const SOFI_CONVERSATIONS_KEY = 'aps_edu_sofi_conversations_v1'
const SOFI_DRAG_POS_KEY = 'aps_edu_sofi_btn_pos_v1'

const SOFI_PROJECTS = [
  { title: 'APS30', subtitle: 'Contexto institucional', count: '12 chats' },
  { title: 'Operação', subtitle: 'Agenda, tarefas e relatórios', count: '8 chats' },
  { title: 'Escola', subtitle: 'Matrículas, documentos e calendário', count: '5 chats' },
  { title: 'Pessoas', subtitle: 'Liderança, temperamento e produtividade', count: '4 chats' },
]

const SOFI_QUICK_ACTIONS = [
  { label: 'Criar tarefa', text: 'Crie uma tarefa executável com responsável, prazo e prioridade.' },
  { label: 'Agendar', text: 'Agende um compromisso com contexto, participantes e lembrete.' },
  { label: 'Gerar documento', text: 'Gere um documento executivo pronto para revisão.' },
]

const SOFI_PROVIDER_MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'executivo', label: 'Executivo' },
  { id: 'operacional', label: 'Operacional' },
  { id: 'criativo', label: 'Criativo' },
]

const TRANSCRIBE_INTENT = /transcrev|transcri[cç][aã]o|degrav|texto do [aá]udio|s[oó] transcri/i

interface AiAssistantProps {
  embedded?: boolean
}

function formatSeconds(total: number) {
  const min = Math.floor(total / 60).toString().padStart(2, '0')
  const sec = (total % 60).toString().padStart(2, '0')
  return `${min}:${sec}`
}

function isAudioOrVideo(file: File) {
  return file.type.startsWith('audio/') || file.type.startsWith('video/')
}

function renderRichText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function SparklesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6L12 2z"/>
    </svg>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 0.18, 0.36].map((d, i) => (
        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: 'rgba(248,163,3,0.7)', animationDelay: `${d}s` }} />
      ))}
    </div>
  )
}

// JSON action parser  same logic as minha-area
function calendarPayloadForTask(task: any) {
  if (!task?.dueDate || !task?.title) return null
  const start = new Date(`${task.dueDate}T09:00:00`)
  const duration = Math.max(15, Number(task.duration) || 30)
  const end = new Date(start.getTime() + duration * 60 * 1000)
  return {
    title: `Tarefa: ${task.title}`,
    start: start.toISOString(),
    end: end.toISOString(),
    description: task.notes || 'Criado automaticamente pela IA da Educação na APS-EDU.',
    reminderMinutes: 60,
  }
}

function parseAction(response: string): { content: string; action: any | null } {
  let contentFinal = response.replace(/```json[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim()
  let actionFinal: any = null
  try {
    const rStr = response
    let startIdx = 0
    while (startIdx < rStr.length) {
      const openAt = rStr.indexOf('{', startIdx)
      if (openAt === -1) break
      let depth = 0; let closeAt = -1
      for (let ci = openAt; ci < rStr.length; ci++) {
        if (rStr[ci] === '{') depth++
        else if (rStr[ci] === '}') { depth--; if (depth === 0) { closeAt = ci; break } }
      }
      if (closeAt === -1) break
      const candidate = rStr.substring(openAt, closeAt + 1)
      try {
        const obj = JSON.parse(candidate)
        if (obj && obj.action && obj.action.type) {
          actionFinal = obj.action
          contentFinal = (typeof obj.content === 'string' ? obj.content : '')
            || contentFinal.replace(candidate, '').trim()
          break
        }
      } catch (_) {}
      startIdx = closeAt + 1
    }
  } catch (_) {}
  return { content: contentFinal || response, action: actionFinal }
}

export default function AiAssistant({ embedded = false }: AiAssistantProps = {}) {
  const [open, setOpen]           = useState(embedded)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking]    = useState(false)
  const [pulse, setPulse]         = useState(false)
  const [unread, setUnread]       = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [transcriptionPreview, setTranscriptionPreview] = useState('')
  const [errorText, setErrorText] = useState('')
  const [mounted, setMounted] = useState(false)
  const [memoryLoaded, setMemoryLoaded] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [providerMode, setProviderMode] = useState('auto')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{x: number; y: number} | null>(null)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({x: 0, y: 0})
  const btnRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const dockLeft = !embedded && (
    pathname?.startsWith('/gestao') ||
    pathname?.startsWith('/escolar-financeiro')
  )
  const dockButtonClass = dockLeft
    ? 'left-4 bottom-24 sm:bottom-24 md:left-[20rem]'
    : 'right-4 bottom-6 sm:right-6 sm:bottom-6'

  const bottomRef     = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLTextAreaElement>(null)
  const recogRef      = useRef<any>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(SOFI_MEMORY_KEY)
      if (saved) setMessages(JSON.parse(saved))
      const sidebarPreference = localStorage.getItem(SOFI_SIDEBAR_COMPACT_KEY)
      if (sidebarPreference) setSidebarExpanded(sidebarPreference === 'expanded')
      const savedMode = localStorage.getItem('aps_edu_sofi_provider_mode_v1')
      if (savedMode) setProviderMode(savedMode)
    } catch {}
    setMemoryLoaded(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(SOFI_SIDEBAR_COMPACT_KEY, sidebarExpanded ? 'expanded' : 'compact')
    } catch {}
  }, [mounted, sidebarExpanded])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem('aps_edu_sofi_provider_mode_v1', providerMode)
    } catch {}
  }, [mounted, providerMode])

  // Load drag position and conversations from localStorage
  useEffect(() => {
    try {
      const pos = localStorage.getItem(SOFI_DRAG_POS_KEY)
      if (pos) setDragPos(JSON.parse(pos))
      const convs = localStorage.getItem(SOFI_CONVERSATIONS_KEY)
      if (convs) setConversations(JSON.parse(convs))
    } catch {}
  }, [])

  // Drag handlers for floating button
  const startDrag = useCallback((e: React.MouseEvent) => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    isDraggingRef.current = true
    e.preventDefault()

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      const x = ev.clientX - dragOffsetRef.current.x
      const y = ev.clientY - dragOffsetRef.current.y
      const clampedX = Math.max(0, Math.min(window.innerWidth - 56, x))
      const clampedY = Math.max(0, Math.min(window.innerHeight - 56, y))
      setDragPos({ x: clampedX, y: clampedY })
    }
    const onUp = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      const x = ev.clientX - dragOffsetRef.current.x
      const y = ev.clientY - dragOffsetRef.current.y
      const final = { x: Math.max(0, Math.min(window.innerWidth - 56, x)), y: Math.max(0, Math.min(window.innerHeight - 56, y)) }
      setDragPos(final)
      try { localStorage.setItem(SOFI_DRAG_POS_KEY, JSON.stringify(final)) } catch {}
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Save conversation helper
  const saveCurrentConversation = useCallback((msgs: Message[]) => {
    if (msgs.length <= 1) return
    const firstUser = msgs.find(m => m.role === 'user')
    const title = firstUser ? firstUser.content.slice(0, 45) : 'Nova conversa'
    setConversations(prev => {
      const existing = activeConvId ? prev.find(c => c.id === activeConvId) : null
      let updated: Conversation[]
      if (existing) {
        updated = prev.map(c => c.id === activeConvId ? { ...c, messages: msgs, title, updatedAt: Date.now() } : c)
      } else {
        const newConv: Conversation = { id: `conv-${Date.now()}`, title, messages: msgs, updatedAt: Date.now() }
        setActiveConvId(newConv.id)
        updated = [newConv, ...prev].slice(0, 50)
      }
      try { localStorage.setItem(SOFI_CONVERSATIONS_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [activeConvId])

  // Load a conversation
  const loadConversation = useCallback((conv: Conversation) => {
    setActiveConvId(conv.id)
    setMessages(conv.messages)
    setInput('')
  }, [])

  // Start a new conversation
  const newConversation = useCallback(() => {
    saveCurrentConversation(messages)
    setActiveConvId(null)
    setMessages([])
    setInput('')
  }, [messages, saveCurrentConversation])

  // Init greeter
  useEffect(() => {
    if (memoryLoaded && messages.length === 0) {
      const h = new Date().getHours()
      const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
      setMessages([{
        role: 'assistant',
        content: `${g}! Sou a **IA da Educação**, sua assistente de IA.\n\nPosso criar tarefas, buscar na internet, gerar imagens, gerenciar seus e-mails e apoiar a gestão da APS EDU. Como posso te ajudar agora?`,
      }])
    }
  }, [memoryLoaded, messages.length])

  useEffect(() => {
    if (!memoryLoaded) return
    try {
      const compact = messages.slice(-SOFI_MAX_MESSAGES)
      localStorage.setItem(SOFI_MEMORY_KEY, JSON.stringify(compact))
      const summary = compact.slice(-40).map(msg => `${msg.role === 'user' ? 'Usuário' : 'IA da Educação'}: ${msg.content.substring(0, 500)}`).join('\n')
      localStorage.setItem(SOFI_MEMORY_SUMMARY_KEY, summary)
    } catch {}
  }, [messages, memoryLoaded])

  // Auto-save current conversation when messages change
  useEffect(() => {
    if (memoryLoaded && messages.length > 1) {
      saveCurrentConversation(messages)
    }
  }, [messages, memoryLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pulse animation periodically when closed
  useEffect(() => {
    if (open) return
    const t = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 800) }, 8000)
    return () => clearInterval(t)
  }, [open])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    const handleOpenSofi = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail
      if (detail?.prompt) setInput(detail.prompt)
      setOpen(true)
    }

    window.addEventListener('aps:open-sofi', handleOpenSofi as EventListener)
    return () => window.removeEventListener('aps:open-sofi', handleOpenSofi as EventListener)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    return () => {
      recogRef.current?.stop?.()
      mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop())
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      window.speechSynthesis?.cancel()
    }
  }, [])

  // Voice recognition
  const initRecognition = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) return null
    const r = new SpeechRec()
    r.lang = 'pt-BR'; r.continuous = false; r.interimResults = false
    r.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript || ''
      setInput(p => p + t)
      setIsListening(false)
    }
    r.onerror = () => setIsListening(false)
    r.onend   = () => setIsListening(false)
    return r
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) { recogRef.current?.stop(); setIsListening(false); return }
    const r = initRecognition()
    if (!r) { alert('Reconhecimento de voz não suportado neste navegador.'); return }
    recogRef.current = r
    r.start()
    setIsListening(true)
  }, [isListening, initRecognition])

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/\*\*/g,'').replace(/[#*_`]/g,'').replace(/\[.*?\]/g,'').substring(0, 600)
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 1.1; u.volume = 0.9
    const voices = window.speechSynthesis.getVoices()
    const ptBR = voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt'))
    if (ptBR) u.voice = ptBR
    u.onstart = () => setIsSpeaking(true)
    u.onend   = () => setIsSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [voiceEnabled])

  const stopSpeaking = () => { window.speechSynthesis?.cancel(); setIsSpeaking(false) }

  const transcribeFile = async (file: File) => {
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'))
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '')
      reader.readAsDataURL(file)
    })

    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: b64, mimeType: file.type || 'application/octet-stream', fileName: file.name }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Falha ao transcrever arquivo.')
    return data.text || ''
  }

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }, [])

  const startRecording = useCallback(async () => {
    setErrorText('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorText('Gravação de áudio não suportada neste navegador. Use anexo de áudio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
        setIsRecording(false)
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        if (blob.size === 0) {
          setErrorText('Não consegui capturar áudio. Tente novamente.')
          return
        }
        const file = new File([blob], `sofi-audio-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, { type: mimeType })
        sendMessage(input.trim() || 'Transcreva este áudio.', file)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecordingSeconds(0)
      setIsRecording(true)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      setErrorText('Não consegui acessar o microfone. Verifique a permissão do navegador.')
    }
  }, [input])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  // Execute AI actions
  const executeAction = async (action: { type: string; data: any }) => {
    try {
      if (action.type === 'update_workday') {
        const saved = localStorage.getItem('aps_workday')
        const current = saved ? JSON.parse(saved) : { startHour: 8, startMin: 0, endHour: 18, endMin: 0 }
        const updated = { ...current, ...action.data }
        localStorage.setItem('aps_workday', JSON.stringify(updated))
        // Dispatch event so minha-area can listen
        window.dispatchEvent(new CustomEvent('workday_updated', { detail: updated }))
      } else if (action.type === 'create_task') {
        const created = await api.post('/personal', action.data)
        const calendarPayload = calendarPayloadForTask(created.data)
        if (calendarPayload) await api.post('/calendar', calendarPayload).catch(() => null)
        window.dispatchEvent(new CustomEvent('personal_tasks_updated', { detail: { tasks: [created.data] } }))
        addMsg('assistant', `✅ Tarefa criada e destacada na sua área: **${created.data?.title || action.data?.title || 'Nova tarefa'}**`)
      } else if (action.type === 'create_tasks') {
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
          addMsg('assistant', `✅ ${created.length} tarefas criadas e destacadas na sua área:\n${created.map((t: any, i: number) => `${i + 1}. ${t.title}`).join('\n')}`)
        }
      } else if (action.type === 'create_event') {
        await api.post('/calendar', action.data)
        window.dispatchEvent(new CustomEvent('sofi_action_completed', { detail: { type: action.type, data: action.data } }))
        addMsg('assistant', `✅ Evento criado: **${action.data?.title || 'Novo evento'}**`)
      } else if (action.type === 'send_email') {
        await api.post('/gmail', action.data)
        addMsg('assistant', `✅ E-mail preparado/enviado: **${action.data?.subject || 'Mensagem'}**`)
      } else if (action.type === 'create_ai_artifact') {
        const current = JSON.parse(localStorage.getItem('aps_edu_ai_center_artifacts') || '[]')
        const artifact = {
          id: `art-${Date.now()}`,
          type: action.data?.type || 'Documento',
          title: action.data?.title || 'Artefato criado pela IA da Educação',
          owner: action.data?.owner || 'IA da Educação',
          status: action.data?.status || 'Rascunho',
          createdAt: new Date().toLocaleString('pt-BR'),
          content: action.data?.content || action.data?.description || '',
        }
        localStorage.setItem('aps_edu_ai_center_artifacts', JSON.stringify([artifact, ...current].slice(0, 32)))
        window.dispatchEvent(new CustomEvent('ai_artifacts_updated', { detail: { artifact } }))
        addMsg('assistant', `✅ Artefato criado na IA da Educação: **${artifact.title}**`)
      } else if (action.type === 'create_management_work') {
        const saved = localStorage.getItem('aps_edu_management_state_v2')
        const current = saved ? JSON.parse(saved) : {}
        const work = Array.isArray(current.work) ? current.work : []
        const item = {
          id: `T-${Date.now()}`,
          title: action.data?.title || 'Nova tarefa criada pela IA da Educação',
          owner: action.data?.owner || 'IA da Educação',
          area: action.data?.area || 'Centro',
          stage: action.data?.stage || 'Novo',
          priority: action.data?.priority || 'Alta',
          due: action.data?.due || 'Hoje',
        }
        const next = { ...current, work: [item, ...work] }
        localStorage.setItem('aps_edu_management_state_v2', JSON.stringify(next))
        window.dispatchEvent(new CustomEvent('management_state_updated', { detail: next }))
        addMsg('assistant', `✅ Tarefa criada no Centro de Gestão: **${item.title}**`)
      } else if (action.type === 'create_note') {
        const current = JSON.parse(localStorage.getItem('aps_edu_sofi_notes') || '[]')
        const note = { id: `note-${Date.now()}`, title: action.data?.title || 'Nota da IA da Educação', content: action.data?.content || '', createdAt: new Date().toLocaleString('pt-BR') }
        localStorage.setItem('aps_edu_sofi_notes', JSON.stringify([note, ...current].slice(0, 100)))
        window.dispatchEvent(new CustomEvent('sofi_notes_updated', { detail: { note } }))
        addMsg('assistant', `✅ Nota salva: **${note.title}**`)
      } else if (action.type === 'web_search') {
        setLoading(true)
        const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: action.data.query }) })
        const sd = await res.json()
        const ctx = sd.answer ? `Resposta direta: ${sd.answer}\n\n` : ''
        const rtxt = (sd.results || []).map((r: any, i: number) => `${i+1}. ${r.title}: ${r.snippet}`).join('\n')
        const prompt = `[RESULTADO DA BUSCA por "${action.data.query}"]\n${ctx}${rtxt}\n\n---\nResponda à pergunta original de forma clara e resumida em português.`
        const ar = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
        const ad = await ar.json()
        const summary = ad.content || ctx + rtxt || 'Sem resultados.'
        addMsg('assistant', `🔍 **Pesquisa: "${action.data.query}"**\n\n${summary}`)
        setLoading(false)
      } else if (action.type === 'generate_image') {
        setLoading(true)
        const res = await fetch('/api/imagine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: action.data.prompt, style: action.data.style }) })
        const id = await res.json()
        if (id.imageBase64) {
          addMsg('assistant', `[IMAGE:data:${id.mimeType};base64,${id.imageBase64}]`)
        } else {
          addMsg('assistant', `⚠️ Não consegui gerar a imagem.`)
        }
        setLoading(false)
      } else if (action.type === 'gmail_trash' || action.type === 'gmail_archive' || action.type === 'gmail_mark_read') {
        const res = await api.post('/gmail', { action: action.type, ...action.data })
        const count = res.data?.count || 0
        addMsg('assistant', `✅ Ação executada em ${count} e-mail(s).`)
      } else if (action.type === 'drive_create_folder') {
        await api.post('/drive', action.data)
      } else if (action.type === 'save_memory') {
        const current = JSON.parse(localStorage.getItem(SOFI_MEMORY_RECORDS_KEY) || '[]')
        const memory = { id: `mem-${Date.now()}`, ...action.data, createdAt: new Date().toLocaleString('pt-BR') }
        localStorage.setItem(SOFI_MEMORY_RECORDS_KEY, JSON.stringify([memory, ...(Array.isArray(current) ? current : [])].slice(0, 500)))
        await api.post('/memory', action.data).catch(() => null)
        addMsg('assistant', '✅ Memória salva para as próximas conversas.')
      } else if (action.type === 'save_to_kb') {
        await api.post('/knowledge', action.data)
      } else if (action.type === 'generate_ata') {
        const res = await api.post('/docs', { action: 'generate_ata', ...action.data })
        const url = res.data?.url
        if (url) addMsg('assistant', `📋 ATA gerada! [Abrir documento](${url})`)
      }
    } catch (_) {}
  }

  const addMsg = (role: 'user' | 'assistant', content: string) => {
    setMessages(p => [...p, { role, content }])
    if (role === 'assistant' && !open) setUnread(n => n + 1)
  }

  const sendMessage = async (text?: string, file?: File | null) => {
    const content = (text || input).trim()
    if ((!content && !attachedFile && !file) || loading) return

    let finalContent = content
    let imageBase64: string | undefined
    let imageMimeType: string | undefined
    let extractedTextContent = ''
    const sendFile = file || attachedFile
    const wantsTranscriptOnly = !!sendFile && isAudioOrVideo(sendFile) && (!content || TRANSCRIBE_INTENT.test(content))

    if (sendFile) {
      setLoading(true)
      setErrorText('')
      if (sendFile.type.startsWith('image/')) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
          reader.onload = () => resolve((reader.result as string).split(',')[1] || '')
          reader.readAsDataURL(sendFile)
        })
        imageBase64 = b64
        imageMimeType = sendFile.type
        finalContent = content || 'Análise esta imagem.'
      } else {
        try {
          const extractedText = await transcribeFile(sendFile)
          extractedTextContent = extractedText
          const marker = isAudioOrVideo(sendFile) ? 'AUDIO_TRANSCRIBED' : 'DOC_CONTENT'
          const instruction = content || (isAudioOrVideo(sendFile) ? 'Transcreva este áudio.' : 'Análise este arquivo.')
          finalContent = `[${marker}:${sendFile.name}]\n${extractedText}\n\n${instruction}`
          setTranscriptionPreview(extractedText)
        } catch (err: any) {
          setLoading(false)
          setErrorText(err?.message || 'Não consegui processar o arquivo.')
          addMsg('assistant', `❌ ${err?.message || 'Não consegui processar o arquivo.'}`)
          setAttachedFile(null)
          return
        }
      }
      setAttachedFile(null)
    }

    const display = sendFile ? `📎 } ${sendFile.name}${content ? '\n' + content : ''}` : content
    const newMessages: Message[] = [...messages, { role: 'user', content: finalContent, display }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    if (sendFile && wantsTranscriptOnly) {
      const transcript = extractedTextContent.trim()
      const answer = transcript
        ? `🎙️ **Transcrição do áudio**\n\n${transcript}`
        : 'Não encontrei texto audível neste áudio.'
      addMsg('assistant', answer)
      speak(transcript ? 'Transcrição concluída.' : 'Não encontrei texto audível neste áudio.')
      setLoading(false)
      return
    }

    try {
      let rawContent = ''
      let rawAction: any = null

      if (imageBase64 && imageMimeType) {
        const r = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalContent, imageBase64, imageMimeType }) })
        const d = await r.json()
        rawContent = d.content || ''
      } else {
        const trimmed = newMessages.slice(-12).map(({ role, content }) => ({ role, content }))
        const pageContext = typeof window !== 'undefined' ? window.location.pathname : ''
        const areaContext = pageContext.split('/').filter(Boolean)[0] || 'dashboard'
        const persistentMemory = typeof window !== 'undefined' ? localStorage.getItem(SOFI_MEMORY_SUMMARY_KEY) || '' : ''
        const savedRecords = typeof window !== 'undefined' ? localStorage.getItem(SOFI_MEMORY_RECORDS_KEY) || '[]' : '[]'
        try {
          const res = await api.post('/ai/chat', { messages: trimmed, context: { userName: 'Vinicius', page: pageContext, area: areaContext, mode: providerMode, persistentMemory, savedRecords } })
          rawContent = res.data?.content ?? res.data?.message ?? ''
          rawAction  = res.data?.action ?? null
        } catch {
          const fallbackPrompt = `Você é a IA da Educação, assistente virtual do Departamento de Educação da Associação Paulista Sul (APS).
Responda em português do Brasil com padrão executivo, prático e humano.
Quando houver transcrição de áudio ou conteúdo de documento, trate como fonte principal.
Você tem memória persistente entre páginas. Use o contexto abaixo para manter continuidade e não reiniciar a conversa.
Página atual: ${pageContext}
Área atual: ${areaContext}
Modo selecionado: ${providerMode}
Memória persistente recente:
${persistentMemory || 'Sem memória persistente ainda.'}
Registros salvos:
${savedRecords}

Você pode executar ações reais na plataforma quando o usuário pedir. Se a intenção for modificar o site, devolva junto da resposta um JSON com action.
Ações disponíveis:
- create_tasks: cria tarefas pessoais.
- create_task: cria uma tarefa pessoal.
- create_event: cria evento/calendário.
- create_ai_artifact: cria artefato na IA da Educação. Campos: type, title, owner, status, content.
- create_management_work: cria tarefa no Centro de Gestão. Campos: title, owner, area, stage, priority, due.
- create_note: salva nota da IA da Educação. Campos: title, content.
- save_memory: salva memória estruturada. Campos livres.
- web_search: pesquisa web. Campo: query.

Formato de lote de tarefas:
{"content":"✅ Vou criar as tarefas agora.","action":{"type":"create_tasks","data":{"tasks":[{"title":"...","priority":"high|medium|low","duration":30,"category":"trabalho|campanha|pessoal","dueDate":"YYYY-MM-DD","notes":"..."}]}}}

Formato de artefato:
{"content":"✅ Vou criar o artefato agora.","action":{"type":"create_ai_artifact","data":{"type":"Documento","title":"...","owner":"IA da Educação","status":"Rascunho","content":"..."}}}

Histórico recente:
${trimmed.map(m => `${m.role === 'user' ? 'Usuário' : 'IA da Educação'}: ${m.content}`).join('\n\n')}

Entregue uma resposta clara, acionável e de alto nível.`
          const fallback = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: fallbackPrompt }),
          })
          const fd = await fallback.json()
          rawContent = fd.content || fd.error || ''
        }
      }

      // Parse inline JSON if action not already extracted
      if (!rawAction) {
        const parsed = parseAction(rawContent)
        rawContent = parsed.content
        rawAction  = parsed.action
      }

      const finalMsg = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)
      addMsg('assistant', finalMsg || 'Pode reformular?')
      speak(finalMsg)

      if (rawAction) await executeAction(rawAction)
    } catch {
      addMsg('assistant', '❌ Não consegui me conectar agora. Tente em instantes.')
    }
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const assistantContent = (
    <>
      {/*  FLOATING BUTTON  */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0A0C14]/95 shadow-[0_12px_30px_rgba(0,0,0,0.36)] transition-all duration-300 hover:scale-105 active:scale-95 group ${dockButtonClass}`}
          style={{
            background: 'linear-gradient(180deg, rgba(14,17,27,0.98), rgba(8,10,18,0.98))',
            boxShadow: '0 10px 28px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.09)',
            animation: pulse ? 'sofiBounce 0.8s ease' : undefined,
          }}
          title="Conversar com IA da Educação"
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <SparklesIcon size={20} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4757] text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </div>
        </button>
      )}

      {/*  PANEL  */}
      {open && (
        <div
          className={`fixed z-50 flex overflow-hidden border border-white/10 bg-[#060814]/96 shadow-[0_28px_80px_rgba(0,0,0,0.68)] backdrop-blur-2xl ${embedded ? 'inset-0 rounded-none' : `inset-y-3 rounded-[28px] ${dockLeft ? 'left-3 md:left-[19rem]' : 'right-3 sm:right-6'} w-[min(1120px,calc(100vw-24px))]`}`}
          style={{
            height: embedded ? '100vh' : 'calc(100vh - 24px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.82), 0 0 0 1px rgba(248,163,3,0.08)',
            animation: 'scaleIn 0.18s ease',
          }}
        >
          <aside
            className={`hidden md:flex flex-col border-r border-white/10 bg-white/[0.02] transition-all duration-300 ease-out ${sidebarExpanded ? 'w-[270px]' : 'w-[84px]'}`}
          >
            <div className="border-b border-white/10 p-3">
              <div className={`flex ${sidebarExpanded ? 'items-center justify-between' : 'justify-center'}`}>
                <button
                  onClick={() => setSidebarExpanded(v => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85 transition hover:bg-white/[0.08]"
                  title={sidebarExpanded ? 'Recolher barra' : 'Expandir barra'}
                >
                  <Squares2X2Icon className="h-5 w-5" />
                </button>
                {sidebarExpanded && (
                  <button
                    onClick={newConversation}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-white transition hover:bg-white/[0.08]"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    Novo chat
                  </button>
                )}
              </div>
            </div>

            <div className="border-b border-white/10 p-3">
              <button
                onClick={() => setSidebarExpanded(v => !v)}
                className={`flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.05] ${sidebarExpanded ? 'justify-start' : 'justify-center'}`}
              >
                <MagnifyingGlassIcon className="h-4 w-4 flex-shrink-0 text-white/35" />
                {sidebarExpanded && (
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar conversas"
                    className="w-full bg-transparent text-sm text-white/85 outline-none ring-0 placeholder:text-white/30 focus:outline-none focus:ring-0 focus-visible:outline-none"
                  />
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {sidebarExpanded ? (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Pastas</p>
                  <div className="mt-3 space-y-2">
                    {SOFI_PROJECTS.map(project => (
                      <button
                        key={project.title}
                        className="flex w-full items-start justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.05]"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <FolderIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/35" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">{project.title}</p>
                            <p className="mt-1 text-xs text-white/45">{project.subtitle}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-white/55">{project.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Recentes</p>
                    <button className="text-[11px] font-black text-[#FDC347]">Ver tudo</button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      { title: 'Resumo da semana', meta: 'Operação ⬢ hoje' },
                      { title: 'Plano executivo', meta: 'Pessoas ⬢ ontem' },
                      { title: 'Agenda central', meta: 'Calendário ⬢ 2h' },
                    ].map(item => (
                      <button
                        key={item.title}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{item.title}</p>
                          <p className="mt-1 text-xs text-white/40">{item.meta}</p>
                        </div>
                        <ChatBubbleLeftRightIcon className="h-4 w-4 flex-shrink-0 text-white/25" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {[PencilSquareIcon, FolderIcon, ChatBubbleLeftRightIcon].map((Icon, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSidebarExpanded(true)}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08]"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-3">
              <div className={`flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-3 py-3 ${sidebarExpanded ? '' : 'justify-center'}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {sidebarExpanded && (
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">Online</p>
                    <p className="text-xs text-white/40">Memória ativa e contexto persistente</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">IA da Educação</p>
                  <h3 className="truncate text-lg font-black text-white">{conversations.find(c => c.id === activeConvId)?.title || 'Nova conversa'}</h3>
                <p className="mt-1 text-xs text-white/40">Pronta para agir com contexto entre páginas.</p>
                </div>
                <div className="flex items-center gap-2">
                <select
                  value={providerMode}
                  onChange={event => setProviderMode(event.target.value)}
                  className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-white/75 outline-none"
                  title="Modo da IA da Educação"
                >
                  {SOFI_PROVIDER_MODES.map(mode => (
                    <option key={mode.id} value={mode.id} className="bg-[#10131d] text-white">
                      {mode.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={newConversation}
                  className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.06]"
                  title="Reiniciar chat"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
                {isSpeaking && (
                  <button onClick={stopSpeaking} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.06]" title="Parar voz">
                    <SpeakerXMarkIcon className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setVoiceEnabled(v => !v)}
                  className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.06]"
                  title={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}
                >
                  {voiceEnabled ? <SpeakerWaveIcon className="h-4 w-4" /> : <SpeakerXMarkIcon className="h-4 w-4" />}
                </button>
                {!embedded && (
                  <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.06]">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.length <= 1 ? (
                <div className="mx-auto flex min-h-[420px] max-w-[920px] flex-col items-center justify-center text-center">
                  <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">Tudo pronto? Então vamos lá!</p>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                    Contexto vivo, respostas diretas e ações prontas para executar.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {SOFI_QUICK_ACTIONS.map(item => (
                      <button
                        key={item.label}
                        onClick={() => sendMessage(item.text)}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/72 transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[920px] space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F8A303] to-[#FDC347] text-black">
                          <SparklesIcon size={13} />
                        </div>
                      )}
                      <div
                        className="max-w-[min(80%,760px)] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-sm leading-6"
                        style={
                          msg.role === 'user'
                            ? {
                                background: 'linear-gradient(135deg,rgba(248,163,3,0.18),rgba(253,195,71,0.08))',
                                border: '1px solid rgba(248,163,3,0.22)',
                                color: 'rgba(255,255,255,0.92)',
                                borderBottomRightRadius: 8,
                              }
                            : {
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                color: 'rgba(255,255,255,0.88)',
                                borderBottomLeftRadius: 8,
                              }
                        }
                      >
                        {msg.content.startsWith('[IMAGE:') ? (
                          <img src={msg.content.replace('[IMAGE:', '').replace(']', '')} alt="gerado" className="rounded-2xl max-w-full" />
                        ) : (
                          renderRichText(msg.display || msg.content)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loading && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F8A303] to-[#FDC347] text-black">
                    <SparklesIcon size={13} />
                  </div>
                  <div className="rounded-2xl border border-white/7 bg-white/[0.05] px-4 py-3 text-sm text-white/75">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5">
              {attachedFile && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-[#F8A303]/20 bg-[#F8A303]/10 px-3 py-2 text-xs text-[#FDC347]">
                  <span>{isAudioOrVideo(attachedFile) ? '?udio pronto para transcri??o' : 'Arquivo anexado'} ? {attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} className="ml-auto text-white/50 transition hover:text-white">×</button>
                </div>
              )}

              {(isRecording || errorText) && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs"
                  style={{
                    background: isRecording ? 'rgba(255,71,87,0.1)' : 'rgba(255,71,87,0.08)',
                    borderColor: 'rgba(255,71,87,0.18)',
                    color: isRecording ? '#FF8A95' : '#FF6B78',
                  }}>
                  {isRecording ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-[#FF4757]" />
                      <span>Gravando ?udio ? {formatSeconds(recordingSeconds)}</span>
                    </>
                  ) : (
                    <span>{errorText}</span>
                  )}
                </div>
              )}

              <div className="mx-auto max-w-[920px] rounded-[28px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/45 transition hover:bg-white/[0.06]"
                    title="Anexar arquivo"
                  >
                    <PaperClipIcon className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,audio/*,.pdf,.txt,.doc,.docx,.csv"
                    onChange={e => e.target.files?.[0] && setAttachedFile(e.target.files[0])}
                  />
                  <button
                    onClick={toggleRecording}
                    disabled={loading}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/45 transition hover:bg-white/[0.06]"
                    title={isRecording ? 'Parar e transcrever ?udio' : 'Gravar ?udio para transcrever'}
                    style={{
                      color: isRecording ? '#FF4757' : 'rgba(255,255,255,0.45)',
                      boxShadow: isRecording ? '0 0 0 1px rgba(255,71,87,0.25)' : 'none',
                    }}
                  >
                    {isRecording ? <StopCircleIcon className="h-4 w-4" /> : <DocumentTextIcon className="h-4 w-4" />}
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={isRecording ? 'Gravando ?udio para transcri??o...' : isListening ? '?? Ouvindo...' : 'Pergunte ? IA da Educação...'}
                    disabled={loading || isRecording}
                    rows={1}
                    className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none ring-0 placeholder:text-white/30 focus:outline-none focus:ring-0 focus-visible:outline-none"
                    style={{ color: 'rgba(255,255,255,0.9)', boxShadow: 'none', border: 'none', appearance: 'none' }}
                  />
                  <button
                    onClick={toggleListening}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/45 transition hover:bg-white/[0.06]"
                    title="Falar"
                    style={{
                      color: isListening ? '#FF4757' : 'rgba(255,255,255,0.45)',
                      background: isListening ? 'rgba(255,71,87,0.15)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <MicrophoneIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => sendMessage()}
                    disabled={(!input.trim() && !attachedFile) || loading || isRecording}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl transition"
                    style={{
                      background: (input.trim() || attachedFile) && !loading
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))'
                        : 'rgba(255,255,255,0.06)',
                      color: (input.trim() || attachedFile) && !loading ? '#060814' : 'rgba(255,255,255,0.34)',
                    }}
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mx-auto mt-3 flex max-w-[920px] flex-wrap gap-2">
                {SOFI_QUICK_ACTIONS.map(item => (
                  <button
                    key={item.label}
                    onClick={() => sendMessage(item.text)}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sofiBounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.92) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </>
  )

  if (!mounted) return null
  return createPortal(assistantContent, document.body)
}


