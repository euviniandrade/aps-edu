'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  SparklesIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import {
  PROMOTER_FORM_SECTIONS,
  PROMOTER_QUESTIONS,
  createEmptyPromoterFormAnswers,
  computePromoterFormResult,
  type PromoterQuestion,
  type PromoterFormAnswers,
} from '@/lib/promoter-form'

const scaleLabels = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente']

function localDraftKey(token: string) {
  return `aps-edu-promoter-form-${token}`
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`
}

function getBandColor(value: number) {
  if (value >= 90) return '#0ABD78'
  if (value >= 80) return '#4A9EFF'
  if (value >= 70) return '#F8A303'
  if (value >= 60) return '#FF8C42'
  return '#FF4757'
}

export default function PromoterFormPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [linkInfo, setLinkInfo] = useState<any>(null)
  const [promoterName, setPromoterName] = useState('')
  const [unit, setUnit] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [answers, setAnswers] = useState<PromoterFormAnswers>(() => createEmptyPromoterFormAnswers())
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoBase64, setPhotoBase64] = useState('')
  const [photoMimeType, setPhotoMimeType] = useState('')
  const [photoName, setPhotoName] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get(`/promoter-forms/public/${token}`)
        setLinkInfo(data.link || null)
        if (data.link?.promoterName) setPromoterName(data.link.promoterName)
        if (data.link?.unit) setUnit(data.link.unit)
        if (data.link?.role) setRole(data.link.role)
        const draft = window.localStorage.getItem(localDraftKey(token))
        if (draft) {
          const parsed = JSON.parse(draft)
          if (parsed?.promoterName) setPromoterName(parsed.promoterName)
          if (parsed?.unit) setUnit(parsed.unit)
          if (parsed?.role) setRole(parsed.role)
          if (parsed?.email) setEmail(parsed.email)
          if (parsed?.phone) setPhone(parsed.phone)
          if (parsed?.notes) setNotes(parsed.notes)
          if (parsed?.answers) setAnswers({ ...createEmptyPromoterFormAnswers(), ...parsed.answers })
          if (parsed?.photoPreview) setPhotoPreview(parsed.photoPreview)
          if (parsed?.photoBase64) setPhotoBase64(parsed.photoBase64)
          if (parsed?.photoMimeType) setPhotoMimeType(parsed.photoMimeType)
          if (parsed?.photoName) setPhotoName(parsed.photoName)
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Nao foi possivel carregar o formulario.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const result = useMemo(() => computePromoterFormResult(answers), [answers])
  const progress = useMemo(() => Math.round((result.answeredCount / result.totalQuestions) * 100), [result])

  useEffect(() => {
    if (!token || loading || submitted) return
    const payload = {
      promoterName,
      unit,
      role,
      email,
      phone,
      notes,
      answers,
      photoPreview,
      photoBase64,
      photoMimeType,
      photoName,
    }
    window.localStorage.setItem(localDraftKey(token), JSON.stringify(payload))
  }, [token, promoterName, unit, role, email, phone, notes, answers, photoPreview, photoBase64, photoMimeType, photoName, loading, submitted])

  const handlePhotoChange = async (file?: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result || '')
      setPhotoPreview(content)
      const base64 = content.includes(',') ? content.split(',')[1] : content
      setPhotoBase64(base64)
      setPhotoMimeType(file.type || 'image/jpeg')
      setPhotoName(file.name || 'foto.jpg')
    }
    reader.readAsDataURL(file)
  }

  const setScaleAnswer = (id: number, value: number) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const setSingleAnswer = (id: number, value: number) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const canSubmit = Boolean(promoterName.trim() && unit.trim() && token && !saving)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/promoter-forms/public/${token}`, {
        promoterName: promoterName.trim(),
        unit: unit.trim(),
        role: role.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        answers,
        computed: result,
        photoBase64,
        photoMimeType,
        photoName,
      })
      window.localStorage.removeItem(localDraftKey(token))
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Nao foi possivel salvar o formulario.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090f] text-white flex items-center justify-center px-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-white/70">
          Carregando formulario...
        </div>
      </div>
    )
  }

  if (error && !linkInfo) {
    return (
      <div className="min-h-screen bg-[#07090f] text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-white/30 mb-3">Formulario de promotor</p>
          <h1 className="text-2xl font-semibold mb-2">Link indisponivel</h1>
          <p className="text-sm text-white/60">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#07090f] text-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-8">
            <CheckCircleIcon className="w-10 h-10 text-emerald-400 mb-4" />
            <p className="text-xs uppercase tracking-[0.35em] text-white/40 mb-2">Enviado com sucesso</p>
            <h1 className="text-3xl font-semibold mb-3">Formulario salvo na plataforma e preparado para Drive</h1>
            <p className="text-white/70 max-w-2xl">
              Recebemos as respostas, registramos a foto e gravamos o pacote completo. Nenhum dado ficou fora do fluxo.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Lideranca', value: result.indices.leadershipPotential.score },
                { label: 'Produtividade', value: result.productivity.index },
                { label: 'Consistencia', value: result.alerts.consistency.score },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/35">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold" style={{ color: getBandColor(item.value) }}>
                    {item.value}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090f] text-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/30">APS EDU · Promotores</p>
              <h1 className="mt-2 text-3xl font-semibold">Formulario inteligente de avaliação</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/60">
                Responda uma vez e a plataforma já consolida liderança, temperamento, relacionamento e produtividade.
              </p>
              {linkInfo?.notes && (
                <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  {linkInfo.notes}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/30">Progresso</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-3xl font-semibold">{progress}%</p>
                  <p className="text-xs text-white/40">{result.answeredCount}/{result.totalQuestions}</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/30">Status</p>
                <div className="mt-3 flex items-center gap-3">
                  <ArrowPathIcon className={`w-5 h-5 ${saving ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
                  <p className="text-sm text-white/70">
                    {saving ? 'Salvando...' : 'Rascunho salvo automaticamente'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Foto do promotor" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <UserCircleIcon className="w-12 h-12" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/30">Identificação</p>
                  <p className="mt-1 text-xl font-semibold">{promoterName || 'Nome do promotor'}</p>
                  <p className="text-sm text-white/50">{unit || 'Unidade / setor'}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/30">Nome completo</span>
                  <input
                    value={promoterName}
                    onChange={e => setPromoterName(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25"
                    placeholder="Ex: Marina Costa"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/30">Unidade</span>
                  <input
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25"
                    placeholder="Ex: CAP"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/30">Cargo / função</span>
                  <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25"
                    placeholder="Ex: Coordenação pedagógica"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/30">E-mail</span>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25"
                    placeholder="email@aps.edu.br"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/30">Telefone</span>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25"
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.3em] text-white/30">Foto</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-3">
                    <ArrowUpTrayIcon className="w-5 h-5 text-white/40" />
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-sm text-white/50 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                      onChange={e => handlePhotoChange(e.target.files?.[0] || null)}
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.35em] text-white/30">Resumo executivo</p>
                <SparklesIcon className="w-5 h-5 text-amber-400" />
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  { label: 'Lideranca', value: result.indices.leadershipPotential.score, tone: '#8B5CF6', detail: `${result.finalProfile.title}` },
                  { label: 'Temperamento', value: result.temperament.primaryPercent, tone: '#F8A303', detail: `${result.temperament.primary} / ${result.temperament.secondary}` },
                  { label: 'Relacionamento', value: result.indices.interpersonalRelationship.score, tone: '#4A9EFF', detail: result.behavioralProfile.profile },
                  { label: 'Produtividade', value: result.productivity.index, tone: '#0ABD78', detail: result.productivity.diagnosis },
                ].map(card => (
                  <div key={card.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/30">{card.label}</p>
                        <p className="mt-1 text-lg font-semibold">{card.detail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold" style={{ color: card.tone }}>{card.value}%</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full" style={{ width: `${card.value}%`, background: card.tone }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-white/30">Leitura automática</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Perfil final</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-300">{result.finalProfile.title}</p>
                  <p className="mt-2 text-sm text-white/60">{result.finalProfile.description}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Temperamento predominante</p>
                  <p className="mt-2 text-2xl font-semibold text-violet-300">
                    {result.temperament.primary} <span className="text-white/30">·</span> {result.temperament.primaryPercent}%
                  </p>
                  <p className="mt-2 text-sm text-white/60">{result.temperament.reason}</p>
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-5">
            {PROMOTER_FORM_SECTIONS.map(section => (
              <section key={section.id} className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/30">Bloco</p>
                    <h2 className="mt-2 text-2xl font-semibold">{section.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm text-white/55">{section.subtitle}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs text-white/50">
                    {section.range[0]} - {section.range[1]}
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  {PROMOTER_QUESTIONS.filter(question => question.sectionId === section.id).map(question => {
                    const value = answers[question.id]
                    const current = typeof value === 'number' ? value : Number(value || 0)
                    return (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        value={current}
                        onScaleChange={setScaleAnswer}
                        onSingleChange={setSingleAnswer}
                      />
                    )
                  })}
                </div>
              </section>
            ))}

            <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-white/30">Análises automáticas</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[
                    { title: 'Potencial de Liderança', data: result.indices.leadershipPotential },
                    { title: 'Potencial para Promoção', data: result.indices.promotionPotential },
                    { title: 'Inteligência Emocional', data: result.indices.emotionalIntelligence },
                    { title: 'Maturidade Profissional', data: result.indices.professionalMaturity },
                    { title: 'Produtividade', data: result.indices.productivity },
                    { title: 'Relacionamento Interpessoal', data: result.indices.interpersonalRelationship },
                  ].map(item => (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/30">{item.title}</p>
                      <p className="mt-2 text-3xl font-semibold" style={{ color: getBandColor(item.data.score) }}>
                        {item.data.score}%
                      </p>
                      <p className="mt-2 text-sm text-white/65">{item.data.summary}</p>
                      <p className="mt-3 text-xs text-white/35">{item.data.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/30">Alertas e validação</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'Centralização', value: result.alerts.centralization.level, message: result.alerts.centralization.message, color: '#F8A303' },
                      { label: 'Procrastinação', value: result.alerts.procrastination.level, message: result.alerts.procrastination.message, color: '#FF8C42' },
                      { label: 'Risco de Conflito', value: result.alerts.conflictRisk.level, message: result.alerts.conflictRisk.message, color: '#FF4757' },
                      { label: 'Resistência à Mudança', value: result.alerts.changeResistance.level, message: result.alerts.changeResistance.message, color: '#4A9EFF' },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs" style={{ color: item.color }}>
                            {item.value}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-white/60">{item.message}</p>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Consistência das respostas</p>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs" style={{ color: getBandColor(result.alerts.consistency.score) }}>
                          {formatPercent(result.alerts.consistency.score)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/60">{result.alerts.consistency.message}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/30">Observações finais</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={6}
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/25"
                    placeholder="Registre observações complementares, contexto da avaliação ou instruções da promotoria."
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/30">Finalizar envio</p>
                  <h3 className="mt-2 text-2xl font-semibold">Salvar na plataforma e no Drive</h3>
                  <p className="mt-2 text-sm text-white/60">
                    Quando você enviar, o pacote completo vai junto: respostas, foto, resumo e classificação automática.
                  </p>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
                >
                  <ClipboardDocumentIcon className="w-5 h-5" />
                  Salvar e enviar
                </button>
              </div>
            </section>
          </main>
        </section>
      </div>
    </div>
  )
}

function QuestionCard({
  question,
  value,
  onScaleChange,
  onSingleChange,
}: {
  question: PromoterQuestion
  value: number
  onScaleChange: (id: number, value: number) => void
  onSingleChange: (id: number, value: number) => void
}) {
  const current = Number.isFinite(value) ? value : 0

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/25">Questão {question.id}</p>
          <h3 className="text-base font-medium leading-relaxed text-white/90">{question.prompt}</h3>
          {question.help && <p className="text-xs text-white/40">{question.help}</p>}
        </div>
      </div>

      {question.type === 'scale' ? (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(level => {
            const active = current === level
            return (
              <button
                key={level}
                type="button"
                onClick={() => onScaleChange(question.id, level)}
                className="rounded-2xl border px-3 py-3 text-left transition-all"
                style={{
                  borderColor: active ? 'rgba(248,163,3,0.55)' : 'rgba(255,255,255,0.08)',
                  background: active ? 'rgba(248,163,3,0.14)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{level}</span>
                  <span className="text-[10px] text-white/35">●</span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-white/50">{scaleLabels[level - 1]}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {question.options?.map((option, index) => {
            const active = current === index
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onSingleChange(question.id, index)}
                className="rounded-2xl border px-4 py-3 text-left transition-all"
                style={{
                  borderColor: active ? 'rgba(74,158,255,0.6)' : 'rgba(255,255,255,0.08)',
                  background: active ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-white/20 text-[10px] text-white/70">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div>
                    <p className="text-sm leading-relaxed text-white/90">{option.label}</p>
                    <p className="mt-1 text-xs text-white/35">Pontuação {option.score}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
