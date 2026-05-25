'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { XMarkIcon, PaperAirplaneIcon, MicrophoneIcon, SpeakerWaveIcon, SpeakerXMarkIcon, PaperClipIcon, StopCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

interface Message {
  role: 'user' | 'assistant'
  content: string
  display?: string
}

const QUICK_PROMPTS = [
  { label: '📊 Análise do dia',     text: 'Faça uma análise rápida do meu dia e me dê um resumo do que preciso fazer agora.' },
  { label: '📋 Tarefas urgentes',   text: 'Quais são as tarefas mais urgentes da rede? O que precisa de atenção imediata?' },
  { label: '👥 Engajamento',        text: 'Como está o engajamento dos colaboradores? Dê dicas práticas para melhorar.' },
  { label: '🚀 Plano da semana',    text: 'Sugira um plano de ação para essa semana com base nos dados da plataforma.' },
  { label: '🧭 Radar de unidade',   text: 'Monte um Radar de Unidade: riscos, prioridades e próximos passos para a Associação Paulista Sul.' },
  { label: '📝 Ata + tarefas',      text: 'Ajude a transformar uma reunião em ata, decisões, responsáveis e tarefas de acompanhamento.' },
]

const TRANSCRIBE_INTENT = /transcrev|transcri[cç][aã]o|degrav|texto do [aá]udio|s[oó] transcri/i

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

// JSON action parser — same logic as minha-area
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

export default function AiAssistant() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking]    = useState(false)
  const [pulse, setPulse]         = useState(false)
  const [unread, setUnread]       = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [transcriptionPreview, setTranscriptionPreview] = useState('')
  const [errorText, setErrorText] = useState('')

  const bottomRef     = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const recogRef      = useRef<any>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  // Init greeter
  useEffect(() => {
    if (messages.length === 0) {
      const h = new Date().getHours()
      const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
      setMessages([{
        role: 'assistant',
        content: `${g}! 👋 Sou a **Sofi**, sua assistente de IA.\n\nPosso criar tarefas, buscar na internet, gerar imagens, gerenciar seus e-mails, e muito mais. Como posso te ajudar agora?`,
      }])
    }
  }, [])

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
      } else if (action.type === 'send_email') {
        await api.post('/gmail', action.data)
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
          addMsg('assistant', `❌ Não consegui gerar a imagem.`)
        }
        setLoading(false)
      } else if (action.type === 'gmail_trash' || action.type === 'gmail_archive' || action.type === 'gmail_mark_read') {
        const res = await api.post('/gmail', { action: action.type, ...action.data })
        const count = res.data?.count || 0
        addMsg('assistant', `✅ Ação executada em ${count} e-mail(s).`)
      } else if (action.type === 'drive_create_folder') {
        await api.post('/drive', action.data)
      } else if (action.type === 'save_memory') {
        await api.post('/memory', action.data)
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
        finalContent = content || 'Analise esta imagem.'
      } else {
        try {
          const extractedText = await transcribeFile(sendFile)
          extractedTextContent = extractedText
          const marker = isAudioOrVideo(sendFile) ? 'AUDIO_TRANSCRIBED' : 'DOC_CONTENT'
          const instruction = content || (isAudioOrVideo(sendFile) ? 'Transcreva este áudio.' : 'Analise este arquivo.')
          finalContent = `[${marker}:${sendFile.name}]\n${extractedText}\n\n${instruction}`
          setTranscriptionPreview(extractedText)
        } catch (err: any) {
          setLoading(false)
          setErrorText(err?.message || 'Não consegui processar o arquivo.')
          addMsg('assistant', `⚠️ ${err?.message || 'Não consegui processar o arquivo.'}`)
          setAttachedFile(null)
          return
        }
      }
      setAttachedFile(null)
    }

    const display = sendFile ? `📎 ${sendFile.name}${content ? '\n' + content : ''}` : content
    const newMessages: Message[] = [...messages, { role: 'user', content: finalContent, display }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    if (sendFile && wantsTranscriptOnly) {
      const transcript = extractedTextContent.trim()
      const answer = transcript
        ? `📝 **Transcrição do áudio**\n\n${transcript}`
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
        try {
          const res = await api.post('/ai/chat', { messages: trimmed, context: { userName: 'Vinicius' } })
          rawContent = res.data?.content ?? res.data?.message ?? ''
          rawAction  = res.data?.action ?? null
        } catch {
          const fallbackPrompt = `Você é a Sofi, assistente virtual do Departamento de Educação da Associação Paulista Sul (APS).
Responda em português do Brasil com padrão executivo, prático e humano.
Quando houver transcrição de áudio ou conteúdo de documento, trate como fonte principal.
Não invente tarefas existentes. Se o usuário pedir para criar várias tarefas, devolva uma ação JSON create_tasks com data.tasks.
Formato de lote:
{"content":"✅ Vou criar as tarefas agora.","action":{"type":"create_tasks","data":{"tasks":[{"title":"...","priority":"high|medium|low","duration":30,"category":"trabalho|campanha|pessoal","dueDate":"YYYY-MM-DD","notes":"..."}]}}}

Histórico recente:
${trimmed.map(m => `${m.role === 'user' ? 'Usuário' : 'Sofi'}: ${m.content}`).join('\n\n')}

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
      addMsg('assistant', '⚠️ Não consegui me conectar agora. Tente em instantes.')
    }
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      {/* ── FLOATING BUTTON ─────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl
                     shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #F8A303, #FDC347)',
            boxShadow: '0 8px 32px rgba(248,163,3,0.5), 0 0 0 1px rgba(248,163,3,0.2)',
            animation: pulse ? 'sofiBounce 0.8s ease' : undefined,
          }}
          title="Conversar com Sofi"
        >
          <div className="relative">
            <SparklesIcon size={20} />
            {unread > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: '#FF4757', color: 'white' }}>
                {unread}
              </span>
            )}
          </div>
          <span className="text-sm font-extrabold text-black">Sofi IA</span>
          <div className="w-1.5 h-1.5 rounded-full bg-black/30 animate-pulse" />
        </button>
      )}

      {/* ── PANEL ───────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col"
          style={{
            width: 400,
            height: 600,
            background: 'rgba(7,9,22,0.98)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24,
            boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(248,163,3,0.1)',
            overflow: 'hidden',
            animation: 'scaleIn 0.2s ease',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
            style={{ background: 'linear-gradient(180deg, rgba(248,163,3,0.07) 0%, transparent 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-black flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', boxShadow: '0 0 16px rgba(248,163,3,0.4)' }}>
                <SparklesIcon size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-white leading-none">Sofi</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(248,163,3,0.15)', color: '#FDC347', border: '1px solid rgba(248,163,3,0.2)' }}>IA</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Online · Powered by Gemini + Groq</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isSpeaking && (
                <button onClick={stopSpeaking} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" title="Parar voz">
                  <span className="text-xs">⏹</span>
                </button>
              )}
              <button onClick={() => setVoiceEnabled(v => !v)} className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                title={voiceEnabled ? 'Desativar voz' : 'Ativar voz'}>
                {voiceEnabled
                  ? <SpeakerWaveIcon className="w-4 h-4" style={{ color: 'rgba(248,163,3,0.7)' }} />
                  : <SpeakerXMarkIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-black"
                    style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', minWidth: 24 }}>
                    <SparklesIcon size={12} />
                  </div>
                )}
                <div className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words"
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg,rgba(248,163,3,0.18),rgba(253,195,71,0.08))', border: '1px solid rgba(248,163,3,0.22)', color: 'rgba(255,255,255,0.92)', borderBottomRightRadius: 6 }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.83)', borderBottomLeftRadius: 6 }}>
                  {msg.content.startsWith('[IMAGE:') ? (
                    <img src={msg.content.replace('[IMAGE:', '').replace(']', '')} alt="gerado" className="rounded-lg max-w-full" />
                  ) : (
                    renderRichText(msg.display || msg.content)
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-black"
                  style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', minWidth: 24 }}>
                  <SparklesIcon size={12} />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderBottomLeftRadius: 6 }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => sendMessage(p.text)}
                  className="text-[11px] px-2.5 py-1.5 rounded-xl transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Attachment preview */}
          {attachedFile && (
            <div className="px-3 pb-1 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: 'rgba(248,163,3,0.1)', border: '1px solid rgba(248,163,3,0.2)', color: '#FDC347' }}>
                <span>{isAudioOrVideo(attachedFile) ? '🎙️ Áudio pronto para transcrição' : '📎 Arquivo anexado'} · {attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
              </div>
            </div>
          )}

          {(isRecording || errorText) && (
            <div className="px-3 pb-1 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{
                  background: isRecording ? 'rgba(255,71,87,0.1)' : 'rgba(255,71,87,0.08)',
                  border: '1px solid rgba(255,71,87,0.18)',
                  color: isRecording ? '#FF8A95' : '#FF6B78',
                }}>
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF4757' }} />
                    <span>Gravando áudio · {formatSeconds(recordingSeconds)}</span>
                  </>
                ) : (
                  <span>{errorText}</span>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.35)' }} title="Anexar arquivo">
                <PaperClipIcon className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,audio/*,.pdf,.txt,.doc,.docx,.csv"
                onChange={e => e.target.files?.[0] && setAttachedFile(e.target.files[0])} />
              <button
                onClick={toggleRecording}
                disabled={loading}
                className="flex-shrink-0 p-1.5 rounded-xl transition-all"
                style={{
                  color: isRecording ? '#FF4757' : 'rgba(255,255,255,0.35)',
                  background: isRecording ? 'rgba(255,71,87,0.15)' : 'transparent',
                  boxShadow: isRecording ? '0 0 0 1px rgba(255,71,87,0.25)' : 'none',
                }}
                title={isRecording ? 'Parar e transcrever áudio' : 'Gravar áudio para transcrever'}
              >
                {isRecording ? <StopCircleIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={isRecording ? 'Gravando áudio para transcrição...' : isListening ? '🎤 Ouvindo...' : 'Pergunte à Sofi...'}
                disabled={loading || isRecording}
                className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40 min-w-0"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              />
              <button
                onClick={toggleListening}
                className="flex-shrink-0 p-1.5 rounded-xl transition-all"
                style={{
                  color: isListening ? '#FF4757' : 'rgba(255,255,255,0.35)',
                  background: isListening ? 'rgba(255,71,87,0.15)' : 'transparent',
                  animation: isListening ? 'pulse 1s infinite' : undefined,
                }}
                title="Falar"
              >
                <MicrophoneIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={(!input.trim() && !attachedFile) || loading || isRecording}
                className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: (input.trim() || attachedFile) && !loading
                    ? 'linear-gradient(135deg, #F8A303, #FDC347)'
                    : 'rgba(255,255,255,0.07)',
                  color: (input.trim() || attachedFile) && !loading ? 'black' : 'rgba(255,255,255,0.3)',
                }}
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
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
}
