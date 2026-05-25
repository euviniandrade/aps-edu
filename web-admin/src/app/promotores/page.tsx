'use client'
import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  ChartBarIcon, UserGroupIcon, ExclamationTriangleIcon,
  CheckCircleIcon, PlusIcon, XMarkIcon, MagnifyingGlassIcon,
  ArrowTrendingUpIcon, FireIcon,
} from '@heroicons/react/24/outline'

// ─── HISTORICAL DATA (from Relatório Executivo 2027) ──────────
const UNIDADES = [
  { sigla: 'CACLI I',  diretor: 'Acleto',    risco: 'Alto',  ativos: 0, manter: 0, substituir: 3, contratar: 3, radarMedia: 8.5 },
  { sigla: 'CAIS',     diretor: 'Allan',      risco: 'Alto',  ativos: 0, manter: 0, substituir: 3, contratar: 3, radarMedia: 4.7 },
  { sigla: 'CAP',      diretor: 'Washington', risco: 'Alto',  ativos: 1, manter: 0, substituir: 2, contratar: 2, radarMedia: 7.5 },
  { sigla: 'EACF',     diretor: 'Rafael',     risco: 'Alto',  ativos: 0, manter: 0, substituir: 0, contratar: 0, radarMedia: 4.6 },
  { sigla: 'EAP',      diretor: 'Josy',       risco: 'Alto',  ativos: 0, manter: 0, substituir: 0, contratar: 0, radarMedia: 0 },
  { sigla: 'EATW',     diretor: 'Ednaldo',    risco: 'Alto',  ativos: 0, manter: 0, substituir: 0, contratar: 0, radarMedia: 2.9 },
  { sigla: 'CACLI II', diretor: 'Uoston',     risco: 'Médio', ativos: 1, manter: 2, substituir: 0, contratar: 0, radarMedia: 6.8 },
  { sigla: 'CAEGW',    diretor: 'Anderson',   risco: 'Médio', ativos: 2, manter: 1, substituir: 1, contratar: 1, radarMedia: 6.4 },
  { sigla: 'EAA',      diretor: 'Tatiane',    risco: 'Médio', ativos: 1, manter: 1, substituir: 1, contratar: 1, radarMedia: 6.7 },
  { sigla: 'CAEA',     diretor: 'Roberto',    risco: 'Baixo', ativos: 2, manter: 1, substituir: 0, contratar: 0, radarMedia: 9.1 },
  { sigla: 'CAR',      diretor: 'Douglas',    risco: 'Baixo', ativos: 1, manter: 1, substituir: 0, contratar: 0, radarMedia: 8.5 },
  { sigla: 'CATS',     diretor: 'Albert',     risco: 'Baixo', ativos: 2, manter: 2, substituir: 0, contratar: 0, radarMedia: 8.9 },
  { sigla: 'EAJL',     diretor: 'Alessandro', risco: 'Baixo', ativos: 1, manter: 1, substituir: 0, contratar: 0, radarMedia: 7.3 },
  { sigla: 'EAVB',     diretor: 'Fábio',      risco: 'Baixo', ativos: 1, manter: 1, substituir: 0, contratar: 0, radarMedia: 7.8 },
]

const PROMOTORES_HISTORICO = [
  // Prioridade 1 — Decisões críticas
  { nome: 'Aline Dias',              unidade: 'CACLI I',  plano: 'Substituir',      radar: 8.0,  forca: 'NPS 8, Persuasão 8',             risco: 'NPS 8, Persuasão 8' },
  { nome: 'Lucas',                   unidade: 'CACLI I',  plano: 'Substituir',      radar: 8.0,  forca: 'NPS 8, Persuasão 8',             risco: 'NPS 8, Persuasão 8' },
  { nome: 'Demerval Júnior',         unidade: 'CACLI I',  plano: 'Substituir',      radar: 9.4,  forca: 'NPS 10, Comunicação 10',         risco: 'Política descontos 8' },
  { nome: 'ROBERTA',                 unidade: 'CACLI II', plano: 'Plano corretivo', radar: 5.0,  forca: 'NPS 5, Persuasão 5',             risco: 'NPS 5, Persuasão 5' },
  { nome: 'Milena',                  unidade: 'CAEA',     plano: 'Encerrar ciclo',  radar: 8.5,  forca: 'Postura c/ famílias 10',         risco: 'NPS 5, Integração 7' },
  { nome: 'Kayque',                  unidade: 'CAEA',     plano: 'Encerrar ciclo',  radar: 9.2,  forca: 'Comunicação 10, Cultura Adv. 10',risco: 'ACRM 8, NPS 9' },
  { nome: 'Graziele',                unidade: 'CAEGW',    plano: 'Substituir',      radar: 5.6,  forca: 'Postura ética 8',                risco: 'Persuasão 4, NPS 5' },
  { nome: 'Cíntia',                  unidade: 'CAIS',     plano: 'Substituir',      radar: 2.6,  forca: 'Persuasão 4, Comunicação 4',     risco: 'NPS 0, Indicação 0' },
  { nome: 'Suzana',                  unidade: 'CAIS',     plano: 'Substituir',      radar: 5.0,  forca: 'Cultura Adv. 8, Proatividade 7', risco: 'NPS 0, Pós-venda 2' },
  { nome: 'Shirley',                 unidade: 'CAIS',     plano: 'Substituir',      radar: 6.4,  forca: 'NPS 7, Persuasão 7',             risco: 'Indicação 4, ACRM 4' },
  { nome: 'Augusto',                 unidade: 'CAP',      plano: 'Substituir',      radar: 7.2,  forca: 'NPS 8, Política descontos 8',    risco: 'Objeções 6, Persuasão 7' },
  { nome: 'Maria Eduarda',           unidade: 'CAP',      plano: 'Substituir',      radar: 7.7,  forca: 'NPS 8, Persuasão 8',             risco: 'Objeções 7, Pós-venda 7' },
  { nome: 'Marnilo Gabriel',         unidade: 'CATS',     plano: 'Encerrar ciclo',  radar: 8.5,  forca: 'NPS 10, Persuasão 9',            risco: 'Foco conv. 8, Leads 8' },
  { nome: 'Raquel Carvalho',         unidade: 'CATS',     plano: 'Encerrar ciclo',  radar: 8.8,  forca: 'Cultura Adv. 10, Postura 10',    risco: 'NPS 8, Conversão 8' },
  { nome: 'Ana Carolina',            unidade: 'EAA',      plano: 'Substituir',      radar: 4.6,  forca: 'Integração 8, Postura 8',        risco: 'NPS 1, Proatividade 1' },
  { nome: 'Sara',                    unidade: 'EACF',     plano: 'Encerrar ciclo',  radar: 3.1,  forca: 'Objeções 5, Leads 5',            risco: 'NPS 0, Indicação 0' },
  { nome: 'Delcijane',               unidade: 'EACF',     plano: 'Encerrar ciclo',  radar: 6.1,  forca: 'Postura 10, Feedback 10',        risco: 'NPS 0, Persuasão 4' },
  { nome: 'Lindalva Barroso',        unidade: 'EAJL',     plano: 'Encerrar ciclo',  radar: 6.4,  forca: 'Persuasão 9, Conversão 8',       risco: 'Integração 3, Indicação 4' },
  { nome: 'Ana Beatriz',             unidade: 'EATW',     plano: 'Encerrar ciclo',  radar: 2.9,  forca: 'ACRM 7, Postura 6',             risco: 'Conversão 1, Objeções 1' },
  { nome: 'Victoria',                unidade: 'EAVB',     plano: 'Encerrar ciclo',  radar: 5.7,  forca: 'Cultura Adv. 10, Postura 10',    risco: 'NPS 0, Persuasão 4' },
  // Prioridade 2 — Continuidade
  { nome: 'CLEIDE',                  unidade: 'CACLI II', plano: 'Continuar',       radar: 8.5,  forca: 'NPS 10, Cultura Adv. 10',        risco: 'Descontos 7, Persuasão 8' },
  { nome: 'Luís Henrique',           unidade: 'CAEA',     plano: 'Continuar',       radar: 9.5,  forca: 'Persuasão 10, Objeções 10',      risco: 'Leads 8, NPS 9' },
  { nome: 'Sônia Michele',           unidade: 'CAEGW',    plano: 'Continuar',       radar: 7.2,  forca: 'Descontos 9, Cultura Adv. 9',    risco: 'NPS 1, Objeções 6' },
  { nome: 'Leo Otto Feliciano',      unidade: 'CAR',      plano: 'Continuar',       radar: 8.5,  forca: 'Conversão 10, Descontos 10',     risco: 'Leads 6, Pós-venda 6' },
  { nome: 'Ismael Matheus Kauffman', unidade: 'CATS',     plano: 'Continuar',       radar: 9.1,  forca: 'Postura 10, Cultura Adv. 10',    risco: 'Indicação 8, NPS 9' },
  { nome: 'Elaine Rodrigues',        unidade: 'CATS',     plano: 'Continuar',       radar: 9.1,  forca: 'Pós-venda 10, Comunicação 10',   risco: 'Indicação 8, Integração 8' },
  { nome: 'Rosemary',                unidade: 'EAA',      plano: 'Continuar',       radar: 8.8,  forca: 'Persuasão 10, Conversão 10',     risco: 'Integração 7, NPS 8' },
  { nome: 'Emily Santos',            unidade: 'EAJL',     plano: 'Continuar',       radar: 8.2,  forca: 'Integração 10, Postura 10',      risco: 'Descontos 4, Persuasão 6' },
  { nome: 'Nathalia',                unidade: 'EAVB',     plano: 'Continuar',       radar: 9.8,  forca: 'NPS 10, Leads 10',               risco: 'Persuasão 9, Conversão 9' },
]

const RISCO_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'Alto':  { color: '#FF4757', bg: 'rgba(255,71,87,0.1)',   border: 'rgba(255,71,87,0.25)' },
  'Médio': { color: '#F8A303', bg: 'rgba(248,163,3,0.1)',   border: 'rgba(248,163,3,0.25)' },
  'Baixo': { color: '#0ABD78', bg: 'rgba(10,189,120,0.1)',  border: 'rgba(10,189,120,0.25)' },
}
const PLANO_STYLE: Record<string, { color: string; bg: string }> = {
  'Continuar':       { color: '#0ABD78', bg: 'rgba(10,189,120,0.12)' },
  'Substituir':      { color: '#FF4757', bg: 'rgba(255,71,87,0.12)' },
  'Encerrar ciclo':  { color: '#F8A303', bg: 'rgba(248,163,3,0.12)' },
  'Plano corretivo': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
}

function RadarBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = value >= 8 ? '#0ABD78' : value >= 6 ? '#F8A303' : '#FF4757'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-6 text-right" style={{ color }}>{value}</span>
    </div>
  )
}

interface Avaliacao {
  id: string
  promotorNome: string
  unidade: string
  semana: string
  scores: Record<string, number>
  notas: string
  pontosFort: string
  pontosAjust: string
  recomendacao: string
  criadoEm: string
}

export default function PromotoresPage() {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<'painel'|'promotores'|'avaliacoes'|'ia'>('painel')
  const [search, setSearch] = useState('')
  const [filterRisco, setFilterRisco] = useState('all')
  const [filterPlano, setFilterPlano] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [loadingAval, setLoadingAval] = useState(false)
  const [aiMessages, setAiMessages] = useState<{role:'user'|'assistant';content:string}[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    loadAvaliacoes()
  }, [])

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  const loadAvaliacoes = async () => {
    setLoadingAval(true)
    try {
      const r = await api.get('/promotores')
      setAvaliacoes(r.data || [])
    } catch { setAvaliacoes([]) }
    finally { setLoadingAval(false) }
  }

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return
    const userMsg = { role: 'user' as const, content: aiInput.trim() }
    const newMsgs = [...aiMessages, userMsg]
    setAiMessages(newMsgs)
    setAiInput('')
    setAiLoading(true)
    try {
      const promotoresCtx = PROMOTORES_HISTORICO.map(p => `${p.nome} (${p.unidade}): radar ${p.radar}, plano: ${p.plano}`).join('; ')
      const unidadesCtx = UNIDADES.map(u => `${u.sigla} risco ${u.risco}`).join(', ')
      const r = await api.post('/ai/chat', {
        messages: newMsgs,
        context: {
          systemExtra: `Você é consultor especialista em avaliação de promotores de matrículas escolares adventistas. Dados: UNIDADES: ${unidadesCtx}. PROMOTORES: ${promotoresCtx}`,
        }
      })
      setAiMessages(p => [...p, { role: 'assistant', content: r.data.content }])
    } catch {
      setAiMessages(p => [...p, { role: 'assistant', content: 'Erro ao consultar IA. Tente novamente.' }])
    }
    setAiLoading(false)
  }

  if (!mounted) return null

  const filteredPromotores = PROMOTORES_HISTORICO
    .filter(p => filterRisco === 'all' || UNIDADES.find(u => u.sigla === p.unidade)?.risco === filterRisco)
    .filter(p => filterPlano === 'all' || p.plano === filterPlano)
    .filter(p => !search || p.nome.toLowerCase().includes(search.toLowerCase()) || p.unidade.toLowerCase().includes(search.toLowerCase()))

  const totalAtivos = UNIDADES.reduce((a, u) => a + u.ativos, 0)
  const totalSubstituir = UNIDADES.reduce((a, u) => a + u.substituir, 0)
  const totalAlto = UNIDADES.filter(u => u.risco === 'Alto').length

  const TABS = [
    { id: 'painel',      label: '📊 Painel' },
    { id: 'promotores',  label: '👥 Promotores' },
    { id: 'avaliacoes',  label: '📋 Avaliações' },
    { id: 'ia',          label: '🤖 IA Consultiva' },
  ]

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Gestão de Promotores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Campanha de Matrículas 2027 · APS · 14 unidades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(248,163,3,0.08)', border: '1px solid rgba(248,163,3,0.2)' }}>
            <span className="text-xs font-bold" style={{ color: '#F8A303' }}>Meta 2027: 17.000 alunos</span>
          </div>
          <button onClick={() => { setTab('avaliacoes'); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-black"
            style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
            <PlusIcon className="w-4 h-4" /> Avaliar
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 animate-fade-in-up">
        {[
          { label: 'Promotores Ativos', value: totalAtivos,      icon: '✅', color: '#0ABD78' },
          { label: 'A Substituir',      value: totalSubstituir,  icon: '⚠️', color: '#FF4757' },
          { label: 'Unidades Risco Alto',value: totalAlto,       icon: '🔴', color: '#FF4757' },
          { label: 'Avaliações Salvas', value: avaliacoes.length, icon: '📋', color: '#4A9EFF' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg,rgba(248,163,3,0.2),rgba(253,195,71,0.1))' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${tab === t.id ? 'rgba(248,163,3,0.35)' : 'rgba(255,255,255,0.07)'}`,
              color: tab === t.id ? '#F8A303' : 'rgba(255,255,255,0.5)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PAINEL ──────────────────────────────────────── */}
      {tab === 'painel' && (
        <div className="animate-fade-in-up space-y-4">
          <h2 className="text-sm font-bold text-white">Termômetro por Unidade</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {UNIDADES.map(u => {
              const rs = RISCO_STYLE[u.risco]
              return (
                <div key={u.sigla} className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${rs.border}` }}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-extrabold text-white">{u.sigla}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Dir. {u.diretor}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}>
                      {u.risco}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    {[
                      { label: 'Ativos', value: u.ativos, color: '#4A9EFF' },
                      { label: 'Manter', value: u.manter, color: '#0ABD78' },
                      { label: 'Subst.', value: u.substituir, color: '#FF4757' },
                      { label: 'Contratar', value: u.contratar, color: '#F8A303' },
                    ].map(s => (
                      <div key={s.label} className="rounded-lg p-2"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-base font-extrabold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {u.radarMedia > 0 && (
                    <div>
                      <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Radar médio</p>
                      <RadarBar value={u.radarMedia} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB: PROMOTORES ──────────────────────────────────── */}
      {tab === 'promotores' && (
        <div className="animate-fade-in-up">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input type="text" placeholder="Buscar promotor ou unidade..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }} />
            </div>
            <select value={filterRisco} onChange={e => setFilterRisco(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <option value="all">Todos os riscos</option>
              <option value="Alto">Risco Alto</option>
              <option value="Médio">Risco Médio</option>
              <option value="Baixo">Risco Baixo</option>
            </select>
            <select value={filterPlano} onChange={e => setFilterPlano(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <option value="all">Todos os planos</option>
              <option value="Continuar">Continuar</option>
              <option value="Substituir">Substituir</option>
              <option value="Encerrar ciclo">Encerrar ciclo</option>
              <option value="Plano corretivo">Plano corretivo</option>
            </select>
          </div>

          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>{filteredPromotores.length} promotor(es)</p>

          <div className="space-y-2">
            {filteredPromotores.map((p, i) => {
              const plano = PLANO_STYLE[p.plano] || PLANO_STYLE['Continuar']
              const unidade = UNIDADES.find(u => u.sigla === p.unidade)
              const risco = unidade ? RISCO_STYLE[unidade.risco] : RISCO_STYLE['Médio']
              const radarColor = p.radar >= 8 ? '#0ABD78' : p.radar >= 6 ? '#F8A303' : '#FF4757'
              return (
                <div key={i} className="rounded-xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-black"
                      style={{ background: `linear-gradient(135deg, ${radarColor}, ${radarColor}99)` }}>
                      {p.nome.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{p.nome}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(74,158,255,0.12)', color: '#4A9EFF', border: '1px solid rgba(74,158,255,0.2)' }}>
                          {p.unidade}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: plano.bg, color: plano.color }}>
                          {p.plano}
                        </span>
                        {unidade && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: risco.bg, color: risco.color }}>
                            {unidade.risco}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1">
                          <RadarBar value={p.radar} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="text-[10px] px-2 py-1.5 rounded-lg"
                          style={{ background: 'rgba(10,189,120,0.07)', color: 'rgba(10,189,120,0.7)', border: '1px solid rgba(10,189,120,0.12)' }}>
                          <span className="font-semibold">✅ Força:</span> {p.forca}
                        </div>
                        <div className="text-[10px] px-2 py-1.5 rounded-lg"
                          style={{ background: 'rgba(255,71,87,0.07)', color: 'rgba(255,100,110,0.7)', border: '1px solid rgba(255,71,87,0.12)' }}>
                          <span className="font-semibold">⚠️ Ajustar:</span> {p.risco}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TAB: AVALIAÇÕES ──────────────────────────────────── */}
      {tab === 'avaliacoes' && (
        <div className="animate-fade-in-up">
          {showForm && (
            <AvaliacaoForm
              onSave={async (data) => {
                try { await api.post('/promotores', data); await loadAvaliacoes(); setShowForm(false) } catch {}
              }}
              onClose={() => setShowForm(false)}
            />
          )}
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 w-full py-3 rounded-xl mb-4 text-sm font-semibold text-black"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
              <PlusIcon className="w-4 h-4 mx-auto" />
              <span>Nova Avaliação Semanal</span>
            </button>
          )}
          {loadingAval ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
            </div>
          ) : avaliacoes.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma avaliação salva ainda</p>
              <p className="text-xs mt-1">Avalie promotores semanalmente para acompanhar a evolução</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...avaliacoes].reverse().map((a: any) => (
                <div key={a.id} className="rounded-xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-white">{a.promotorNome}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{a.unidade} · Semana {a.semana}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(74,158,255,0.12)', color: '#4A9EFF' }}>
                      {new Date(a.criadoEm).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {[
                      { k: 'nps', l: 'NPS' }, { k: 'persuasao', l: 'Persuasão' },
                      { k: 'comunicacao', l: 'Comunicação' }, { k: 'acrm', l: 'ACRM' },
                    ].map(({ k, l }) => (
                      <div key={k} className="text-center rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-base font-extrabold" style={{ color: (a as any)[k] >= 8 ? '#0ABD78' : (a as any)[k] >= 6 ? '#F8A303' : '#FF4757' }}>
                          {(a as any)[k] || 0}
                        </p>
                        <p className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>{l}</p>
                      </div>
                    ))}
                  </div>
                  {a.notas && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{a.notas}</p>}
                  {a.recomendacao && (
                    <p className="text-[10px] mt-1.5 px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(248,163,3,0.08)', color: 'rgba(253,195,71,0.7)', border: '1px solid rgba(248,163,3,0.15)' }}>
                      💡 {a.recomendacao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: IA CONSULTIVA ───────────────────────────────── */}
      {tab === 'ia' && (
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)', boxShadow: '0 0 14px rgba(248,163,3,0.3)' }}>
              🤖
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">IA Consultiva de Promotores</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Análise 360° · Comparações · Recomendações estratégicas
              </p>
            </div>
          </div>

          {/* Quick prompts */}
          {aiMessages.length === 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                'Quais promotores têm o melhor desempenho?',
                'Quais unidades precisam de contratação urgente?',
                'Analise os promotores com plano de substituição',
                'Recomende estratégias para unidades de risco alto',
              ].map(q => (
                <button key={q} onClick={() => { setAiInput(q); setTimeout(sendAiMessage, 0) }}
                  className="text-xs px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{ background: 'rgba(248,163,3,0.06)', color: 'rgba(248,163,3,0.7)', border: '1px solid rgba(248,163,3,0.15)' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Chat */}
          <div className="flex flex-col" style={{ height: 'calc(100vh - 460px)', minHeight: 360 }}>
            <div className="flex-1 overflow-y-auto space-y-3 p-4 rounded-2xl mb-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm mb-0.5"
                      style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>🤖</div>
                  )}
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={m.role === 'user' ? {
                      background: 'linear-gradient(135deg,rgba(248,163,3,0.18),rgba(253,195,71,0.08))',
                      border: '1px solid rgba(248,163,3,0.25)', color: '#FDC347', borderBottomRightRadius: 4,
                    } : {
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.85)', borderBottomLeftRadius: 4,
                    }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                    style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>🤖</div>
                  <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#F8A303', animationDelay: `${i*0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={aiBottomRef} />
            </div>
            <div className="flex gap-2">
              <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAiMessage()}
                placeholder="Ex: Compare CAEA e CATS. Qual tem melhor equipe?"
                className="flex-1 px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}
                className="px-5 py-3 rounded-xl font-bold text-black disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

// ─── AVALIAÇÃO FORM ───────────────────────────────────────────
function AvaliacaoForm({ onSave, onClose }: { onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    promotorNome: '', unidade: UNIDADES[0].sigla, semana: new Date().toISOString().slice(0,10),
    notas: '', pontosFort: '', pontosAjust: '', recomendacao: '',
    scores: { nps: 5, persuasao: 5, comunicacao: 5, acrm: 5, indicacao: 5, posVenda: 5, postura: 5 }
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const setScore = (k: string, v: number) => setForm(p => ({ ...p, scores: { ...p.scores, [k]: v } }))

  const CRITERIOS = [
    { k: 'nps', l: 'NPS do Promotor' }, { k: 'persuasao', l: 'Técnicas de Persuasão' },
    { k: 'comunicacao', l: 'Comunicação Clara' }, { k: 'acrm', l: 'Uso do ACRM' },
    { k: 'indicacao', l: 'Sistema de Indicação' }, { k: 'posVenda', l: 'Pós-venda' },
    { k: 'postura', l: 'Postura Profissional' },
  ]

  const radarMedia = Object.values(form.scores).reduce((a,v)=>a+v,0) / Object.values(form.scores).length

  return (
    <div className="rounded-2xl p-5 mb-4"
      style={{ background: 'rgba(248,163,3,0.05)', border: '1px solid rgba(248,163,3,0.2)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white">Nova Avaliação</h3>
        <button onClick={onClose}><XMarkIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Nome do Promotor</p>
          <input type="text" value={form.promotorNome} onChange={e => set('promotorNome', e.target.value)}
            placeholder="Nome completo..." list="promotores-list"
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <datalist id="promotores-list">
            {PROMOTORES_HISTORICO.map(p => <option key={p.nome} value={p.nome} />)}
          </datalist>
        </div>
        <div>
          <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Unidade</p>
          <select value={form.unidade} onChange={e => set('unidade', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {UNIDADES.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.diretor}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-white">Critérios de Avaliação</p>
          <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg"
            style={{ background: 'rgba(248,163,3,0.15)', color: '#F8A303' }}>
            Média: {radarMedia.toFixed(1)}
          </span>
        </div>
        <div className="space-y-3">
          {CRITERIOS.map(({ k, l }) => (
            <div key={k} className="flex items-center gap-3">
              <span className="text-xs w-36 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }}>{l}</span>
              <input type="range" min={0} max={10} step={0.5}
                value={(form.scores as any)[k]}
                onChange={e => setScore(k, parseFloat(e.target.value))}
                className="flex-1 accent-yellow-400" />
              <span className="text-xs font-bold w-6 text-right tabular-nums"
                style={{ color: (form.scores as any)[k] >= 8 ? '#0ABD78' : (form.scores as any)[k] >= 6 ? '#F8A303' : '#FF4757' }}>
                {(form.scores as any)[k]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Pontos Fortes</p>
          <textarea value={form.pontosFort} onChange={e => set('pontosFort', e.target.value)} rows={2}
            placeholder="O que está indo bem..."
            className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>
        <div>
          <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Pontos a Ajustar</p>
          <textarea value={form.pontosAjust} onChange={e => set('pontosAjust', e.target.value)} rows={2}
            placeholder="O que precisa melhorar..."
            className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>
      </div>
      <div className="mb-3">
        <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Recomendação</p>
        <input type="text" value={form.recomendacao} onChange={e => set('recomendacao', e.target.value)}
          placeholder="Ação recomendada para próxima semana..."
          className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
      </div>
      <div className="mb-4">
        <p className="text-[10px] text-white/40 mb-1 uppercase tracking-widest">Notas livres</p>
        <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
          placeholder="Observações gerais..."
          className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
      </div>
      <button
        disabled={saving || !form.promotorNome.trim()}
        onClick={async () => { setSaving(true); await onSave({ ...form, scores: form.scores }); setSaving(false) }}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#F8A303,#FDC347)' }}>
        {saving ? 'Salvando...' : 'Salvar Avaliação'}
      </button>
    </div>
  )
}
