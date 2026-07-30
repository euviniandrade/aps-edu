'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface Command {
  id: string
  label: string
  description?: string
  icon: string
  category: 'navigate' | 'action' | 'ai' | 'search'
  action: () => void
  keywords?: string[]
}

const NAV_COMMANDS = [
  { id: 'go-gestão',        label: 'Ir para Sistema APS30', icon: 'G', path: '/gestao',        keywords: ['gestão', 'suite', 'plataforma', 'cockpit', 'operação', 'educação', 'central', 'sofi'] },
  { id: 'go-suite-tools',   label: 'Ferramentas do Centro', icon: 'F', path: '/gestao',        keywords: ['crm', 'matricula', 'financeiro', 'aprovação', 'aprovações', 'formulario', 'okr', 'meta', 'documento', 'patrimonio', 'qr code', 'contrato', 'lead', 'funil', 'tarefas', 'projetos'] },
  { id: 'go-meu-dia',       label: 'Ir para Meu Dia',       icon: 'D', path: '/meu-dia',       keywords: ['hoje', 'foco', 'habitos'] },
  { id: 'go-tasks',         label: 'Ir para Central de Tarefas', icon: 'T', path: '/tasks',     keywords: ['task', 'tarefa', 'projeto', 'kanban'] },
  { id: 'go-academico',     label: 'Ir para Acadêmico',     icon: 'A', path: '/academico',     keywords: ['faculdade', 'academico', 'acadêmico', 'semestre', 'materias', 'matérias', 'provas', 'atividades', 'portal do aluno'] },
  { id: 'go-estoque',       label: 'Ir para Estoque',       icon: '??', path: '/estoque',       keywords: ['estoque', 'almoxarifado', 'patrimonio', 'inventario', 'compras'] },
  { id: 'go-reports',       label: 'Ir para Relatórios',    icon: 'R', path: '/reports',       keywords: ['relatorio', 'grafico'] },
  { id: 'go-users',         label: 'Ir para Pessoas',       icon: 'P', path: '/pessoas',       keywords: ['usuario', 'pessoa', 'membro', 'equipe', 'relatorios', 'relatórios'] },
  { id: 'go-units',         label: 'Ir para Unidades',      icon: 'U', path: '/units',         keywords: ['colegio', 'unidade', 'rede', 'escola'] },
  { id: 'go-analytics',     label: 'Analytics IA',          icon: 'A', path: '/analytics',     keywords: ['predicao', 'forecast', 'tendencia', 'indicador'] },
  { id: 'go-automações',    label: 'Automações IA',         icon: 'Z', path: '/automações',    keywords: ['automation', 'regra', 'fluxo'] },
  { id: 'go-dashboard',     label: 'Dashboard antigo',      icon: 'D', path: '/dashboard',     keywords: ['home', 'inicio', 'dashboard antigo'] },
  { id: 'go-events',        label: 'Eventos',               icon: 'E', path: '/events',        keywords: ['evento', 'agenda', 'calendario'] },
  { id: 'go-announcements', label: 'Ir para Mural',         icon: 'M', path: '/announcements', keywords: ['mural', 'aviso', 'comunicado'] },
  { id: 'go-notif',         label: 'Notificações',          icon: 'N', path: '/notificações',  keywords: ['notif', 'alerta'] },
  { id: 'go-sofi',          label: 'Ferramentas pessoais',  icon: 'S', path: '/minha-area',    keywords: ['ia', 'ai', 'assistente', 'chat', 'cofre', 'notas', 'caderno'] },
  { id: 'go-inovação',      label: 'IA da Educação',             icon: 'I', path: '/inovação',      keywords: ['inovação', 'ia', 'agentes', 'scanner', 'gpt', 'gemini', 'claude', 'grok', 'perplexity', 'dados'] },
  { id: 'go-config',        label: 'Configurações',         icon: 'C', path: '/configurações', keywords: ['config', 'perfil', 'senha'] },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(0)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [results, setResults]   = useState<Command[]>([])
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const aiTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build static commands
  const buildCommands = useCallback((): Command[] => {
    return NAV_COMMANDS.map(nc => ({
      id: nc.id,
      label: nc.label,
      icon: nc.icon,
      category: 'navigate' as const,
      keywords: nc.keywords,
      action: () => { router.push(nc.path); onClose() },
    }))
  }, [router, onClose])

  // Filter commands by query
  useEffect(() => {
    const cmds = buildCommands()
    if (!query.trim()) {
      setResults(cmds.slice(0, 8))
      setSelected(0)
      setAiAnswer(null)
      return
    }
    const q = query.toLowerCase()
    const filtered = cmds.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.keywords?.some(k => k.includes(q))
    )
    setResults(filtered.slice(0, 6))
    setSelected(0)
  }, [query, buildCommands])

  // AI answer for free-text questions
  useEffect(() => {
    if (!query.trim() || query.length < 6) { setAiAnswer(null); return }
    if (aiTimer.current) clearTimeout(aiTimer.current)
    aiTimer.current = setTimeout(async () => {
      // Only call AI if no good navigation match
      const hasGoodMatch = results.some(r =>
        r.label.toLowerCase().includes(query.toLowerCase())
      )
      if (hasGoodMatch && results.length > 0) return
      setAiLoading(true)
      try {
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Você é um assistente rápido da plataforma APS EDU (Educação Adventista).
Responda em 1-2 frases curtas e objetivas em português.
Pergunta: ${query}`,
          }),
        })
        const data = await res.json()
        setAiAnswer(data.content || null)
      } catch { setAiAnswer(null) }
      finally { setAiLoading(false) }
    }, 600)
  }, [query, results])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selected]) results[selected].action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selected, onClose])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setAiAnswer(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  const categoryLabel: Record<string, string> = {
    navigate: 'Navegar',
    action: 'Ações',
    ai: 'IA',
    search: 'Busca',
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'rgba(8,10,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(248,163,3,0.05)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar, navegar, perguntar à IA..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'white' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>x</button>
          )}
          <kbd
            className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            <>
              {!query && (
                <div className="px-4 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Navegação rápida
                  </p>
                </div>
              )}
              {results.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left transition-all"
                  style={{
                    background: i === selected ? 'rgba(248,163,3,0.1)' : 'transparent',
                    borderLeft: i === selected ? '3px solid #F8A303' : '3px solid transparent',
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className="text-lg w-7 text-center flex-shrink-0">{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: i === selected ? '#FDC347' : 'rgba(255,255,255,0.8)' }}>
                      {cmd.label}
                    </p>
                    {cmd.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {cmd.description}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}
                  >
                    {categoryLabel[cmd.category] || cmd.category}
                  </span>
                </button>
              ))}
            </>
          ) : query ? (
            <div className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <p className="text-sm">Nenhum resultado para "{query}"</p>
            </div>
          ) : null}

          {/* AI Answer box */}
          {(aiLoading || aiAnswer) && (
            <div
              className="mx-4 mb-4 mt-2 rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(248,163,3,0.06), rgba(74,158,255,0.04))',
                border: '1px solid rgba(248,163,3,0.15)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-black">IA</span>
                <p className="text-xs font-semibold" style={{ color: '#F8A303' }}>IA da Educação</p>
                {aiLoading && (
                  <div className="flex gap-1 ml-1">
                    {[0,1,2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: '#F8A303', animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {aiAnswer && (
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {aiAnswer}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div
          className="flex items-center gap-4 px-4 py-2.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        >
          {[
            ['Setas', 'Navegar'],
            ['Enter', 'Selecionar'],
            ['ESC', 'Fechar'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd
                className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {key}
              </kbd>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{label}</span>
            </div>
          ))}
          <div className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
            Powered by IA da Educação
          </div>
        </div>
      </div>
    </div>
  )
}

