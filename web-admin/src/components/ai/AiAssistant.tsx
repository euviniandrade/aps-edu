'use client'
import { useState, useRef, useEffect } from 'react'
import api from '@/lib/api'
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  { label: '📊 Análise geral', text: 'Faça uma análise geral da plataforma e mostre os principais pontos de atenção' },
  { label: '📋 Tarefas atrasadas', text: 'Quais ações posso tomar para reduzir o número de tarefas atrasadas?' },
  { label: '👥 Engajamento', text: 'Como posso aumentar o engajamento dos colaboradores na plataforma?' },
  { label: '🚀 Próximos passos', text: 'Quais são as prioridades que devo focar essa semana na gestão da rede?' },
]

export default function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Olá! Sou o assistente de IA da APS EDU Sul.\n\nPosso te ajudar com análises, gerar textos para comunicados, tarefas e eventos, ou responder dúvidas sobre a gestão da rede. Como posso ajudar?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, messages])

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/chat', { messages: newMessages })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.content }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Não foi possível conectar ao assistente agora. Tente novamente em instantes.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* ── FLOATING BUTTON ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center
                   shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #F8A303, #FDC347)',
          boxShadow: '0 8px 32px rgba(248,163,3,0.45), 0 0 0 1px rgba(248,163,3,0.2)',
          display: open ? 'none' : 'flex',
        }}
        title="Assistente de IA"
      >
        <SparklesIcon />
      </button>

      {/* ── PANEL ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col animate-scale-in"
          style={{
            width: 380,
            height: 560,
            background: 'rgba(8,10,24,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(248,163,3,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)' }}
              >
                <SparklesIcon small />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">APS IA</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Powered by Gemini
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, rgba(248,163,3,0.2), rgba(253,195,71,0.1))', border: '1px solid rgba(248,163,3,0.2)' }}
                  >
                    <SparklesIcon tiny />
                  </div>
                )}
                <div
                  className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'linear-gradient(135deg, rgba(248,163,3,0.15), rgba(253,195,71,0.08))',
                          border: '1px solid rgba(248,163,3,0.2)',
                          color: 'rgba(255,255,255,0.9)',
                          borderBottomRightRadius: 6,
                        }
                      : {
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.8)',
                          borderBottomLeftRadius: 6,
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(248,163,3,0.1)', border: '1px solid rgba(248,163,3,0.15)' }}
                >
                  <SparklesIcon tiny />
                </div>
                <div
                  className="px-3.5 py-2.5 rounded-2xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderBottomLeftRadius: 6 }}
                >
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts (only when no user messages yet) */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.text)}
                  className="text-xs px-2.5 py-1.5 rounded-xl transition-all hover:scale-[1.03]"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.65)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte algo..."
              className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'white',
              }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                         disabled:opacity-40 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)' }}
            >
              <PaperAirplaneIcon className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── SVG Icons ────────────────────────────────────────────────────────────────
function SparklesIcon({ small, tiny }: { small?: boolean; tiny?: boolean }) {
  const size = tiny ? 12 : small ? 16 : 24
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z"
        fill={tiny || small ? '#F8A303' : '#000'}
        stroke={tiny || small ? 'none' : 'none'}
      />
      <path
        d="M5 17L5.545 19.545L8 20L5.545 20.455L5 23L4.455 20.455L2 20L4.455 19.545L5 17Z"
        fill={tiny || small ? 'rgba(248,163,3,0.6)' : '#000'}
      />
      <path
        d="M19 2L19.545 4.545L22 5L19.545 5.455L19 8L18.455 5.455L16 5L18.455 4.545L19 2Z"
        fill={tiny || small ? 'rgba(248,163,3,0.6)' : '#000'}
      />
    </svg>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{
            background: 'rgba(248,163,3,0.7)',
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </div>
  )
}
