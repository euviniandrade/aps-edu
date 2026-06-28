'use client'

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
import {
  PROMOTER_QUESTIONS,
  computePromoterFormResult,
  type PromoterFormAnswers,
  type PromoterQuestion,
} from '@/lib/promoter-form'

const FIXED_PUBLIC_FORM_TOKENS = new Set(['público', 'geral', 'todos'])
const scaleLabels = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente']

type FieldKey = 'promoterName' | 'unit' | 'role' | 'phone' | 'email' | 'birthDate' | 'address'
type ProfileState = Record<FieldKey, string>

type FlowStep =
  | {
      kind: 'field'
      id: FieldKey
      question: string
      placeholder: string
      inputType?: string
      required?: boolean
    }
  | { kind: 'photo'; id: 'photo'; question: string }
  | { kind: 'question'; id: number; question: PromoterQuestion }
  | { kind: 'notes'; id: 'notes'; question: string }
  | { kind: 'review'; id: 'review'; question: string }

const initialProfile: ProfileState = {
  promoterName: '',
  unit: '',
  role: 'Promotor',
  phone: '',
  email: '',
  birthDate: '',
  address: '',
}

const profileSteps: FlowStep[] = [
  { kind: 'field', id: 'promoterName', question: 'Qual é o seu nome completo?', placeholder: 'Digite seu nome completo', required: true },
  { kind: 'field', id: 'unit', question: 'Qual é a sua unidade?', placeholder: 'Ex: CAP, CAEA, CATS...', required: true },
  { kind: 'field', id: 'role', question: 'Qual é seu cargo ou função?', placeholder: 'Ex: Promotor', required: true },
  { kind: 'field', id: 'phone', question: 'Qual é seu WhatsApp?', placeholder: '(00) 00000-0000', inputType: 'tel', required: true },
  { kind: 'field', id: 'email', question: 'Qual é seu e-mail?', placeholder: 'nome@exemplo.com', inputType: 'email', required: true },
  { kind: 'field', id: 'birthDate', question: 'Qual é sua data de aniversário?', placeholder: 'DD/MM/AAAA', required: true },
  { kind: 'field', id: 'address', question: 'Qual é seu endereço completo?', placeholder: 'Rua, número, bairro, cidade e UF', required: true },
  { kind: 'photo', id: 'photo', question: 'Quer adicionar uma foto agora?' },
]

function localDraftKey(token: string) {
  return `aps-edu-promoter-form-${token}`
}

function isFixedPublicFormToken(token: string) {
  return FIXED_PUBLIC_FORM_TOKENS.has(String(token || '').toLowerCase())
}

function normalizeAnswerPreview(value: string) {
  return value.length > 80 ? `${value.slice(0, 80)}...` : value
}

function getFirstName(value: string) {
  return String(value || '').trim().split(/\s+/)[0] || ''
}

function orderedQuestionOptions(question: PromoterQuestion) {
  const options = question.options || []
  if (options.length <= 1) return options.map((option, index) => ({ option, originalIndex: index }))
  const offset = question.id % options.length
  return options
    .map((option, index) => ({ option, originalIndex: index }))
    .slice(offset)
    .concat(options.map((option, index) => ({ option, originalIndex: index })).slice(0, offset))
}

export default function PromoterFormPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitStatus, setSubmitStatus] = useState('')
  const [error, setError] = useState('')
  const [linkInfo, setLinkInfo] = useState<any>(null)
  const [profile, setProfile] = useState<ProfileState>(initialProfile)
  const [currentInput, setCurrentInput] = useState('')
  const [notes, setNotes] = useState('')
  const [answers, setAnswers] = useState<PromoterFormAnswers>({})
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoBase64, setPhotoBase64] = useState('')
  const [photoMimeType, setPhotoMimeType] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [resumePrompt, setResumePrompt] = useState(false)

  const flow = useMemo<FlowStep[]>(() => [
    ...profileSteps,
    ...PROMOTER_QUESTIONS.map(question => ({ kind: 'question' as const, id: question.id, question })),
    { kind: 'notes', id: 'notes', question: 'Deseja deixar alguma observação final?' },
    { kind: 'review', id: 'review', question: 'Tudo certo. Posso enviar suas respostas?' },
  ], [])

  const currentStep = flow[stepIndex] || flow[0]
  const result = useMemo(() => computePromoterFormResult(answers), [answers])
  const progress = Math.round(((stepIndex + 1) / flow.length) * 100)

  useEffect(() => {
    const load = async () => {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        if (isFixedPublicFormToken(token)) {
          setLinkInfo({ token, role: 'Promotor' })
        } else {
          const { data } = await api.get(`/promoter-forms/public/${token}`)
          setLinkInfo(data.link || null)
          setProfile(prev => ({
            ...prev,
            promoterName: data.link?.promoterName || prev.promoterName,
            unit: data.link?.unit || prev.unit,
            role: data.link?.role || prev.role,
          }))
        }

        const draft = window.localStorage.getItem(localDraftKey(token))
        if (draft) {
          const parsed = JSON.parse(draft)
          if (parsed?.profile) setProfile({ ...initialProfile, ...parsed.profile })
          if (parsed?.notes) setNotes(parsed.notes)
          if (parsed?.answers) setAnswers(parsed.answers)
          if (parsed?.photoPreview) setPhotoPreview(parsed.photoPreview)
          if (parsed?.photoBase64) setPhotoBase64(parsed.photoBase64)
          if (parsed?.photoMimeType) setPhotoMimeType(parsed.photoMimeType)
          if (parsed?.photoName) setPhotoName(parsed.photoName)
          if (Number.isFinite(parsed?.stepIndex)) setStepIndex(Math.max(0, Math.min(flow.length - 1, parsed.stepIndex)))
          setResumePrompt(true)
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Não foi possível carregar o formulário.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, flow.length])

  useEffect(() => {
    if (!token || loading || submitted) return
    window.localStorage.setItem(localDraftKey(token), JSON.stringify({
      profile,
      notes,
      answers,
      photoPreview,
      photoBase64,
      photoMimeType,
      photoName,
      stepIndex,
      savedAt: new Date().toISOString(),
    }))
  }, [token, profile, notes, answers, photoPreview, photoBase64, photoMimeType, photoName, stepIndex, loading, submitted])

  useEffect(() => {
    if (currentStep.kind === 'field') setCurrentInput(profile[currentStep.id] || '')
    if (currentStep.kind === 'notes') setCurrentInput(notes || '')
    if (currentStep.kind !== 'field' && currentStep.kind !== 'notes') setCurrentInput('')
  }, [currentStep, profile, notes])

  const handlePhotoChange = async (file?: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result || '')
      const image = new Image()
      image.onload = () => {
        const maxSize = 900
        const ratio = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * ratio))
        const height = Math.max(1, Math.round(image.height * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        context?.drawImage(image, 0, 0, width, height)
        const optimized = canvas.toDataURL('image/jpeg', 0.82)
        setPhotoPreview(optimized)
        setPhotoBase64(optimized.includes(',') ? optimized.split(',')[1] : optimized)
        setPhotoMimeType('image/jpeg')
        setPhotoName((file.name || 'foto.jpg').replace(/\.[^.]+$/, '.jpg'))
      }
      image.onerror = () => {
        setPhotoPreview(content)
        setPhotoBase64(content.includes(',') ? content.split(',')[1] : content)
        setPhotoMimeType(file.type || 'image/jpeg')
        setPhotoName(file.name || 'foto.jpg')
      }
      image.src = content
    }
    reader.readAsDataURL(file)
  }

  const goBack = () => {
    setError('')
    setStepIndex(index => Math.max(0, index - 1))
  }

  const persistDraft = (nextDraft: Partial<{
    profile: ProfileState
    notes: string
    answers: PromoterFormAnswers
    photoPreview: string
    photoBase64: string
    photoMimeType: string
    photoName: string
    stepIndex: number
  }>) => {
    if (!token) return
    window.localStorage.setItem(localDraftKey(token), JSON.stringify({
      profile,
      notes,
      answers,
      photoPreview,
      photoBase64,
      photoMimeType,
      photoName,
      stepIndex,
      ...nextDraft,
    }))
  }

  const goNext = () => {
    setError('')
    let nextProfile = profile
    let nextNotes = notes

    if (currentStep.kind === 'field') {
      if (currentStep.required && !currentInput.trim()) return setError('Responda esta pergunta para continuar.')
      nextProfile = { ...profile, [currentStep.id]: currentInput.trim() }
      setProfile(nextProfile)
    }

    if (currentStep.kind === 'notes') {
      nextNotes = currentInput.trim()
      setNotes(nextNotes)
    }

    const nextStepIndex = Math.min(flow.length - 1, stepIndex + 1)
    persistDraft({ profile: nextProfile, notes: nextNotes, stepIndex: nextStepIndex })
    setStepIndex(nextStepIndex)
  }

  const setQuestionAnswer = (question: PromoterQuestion, value: number) => {
    setError('')
    const nextAnswers = { ...answers, [question.id]: value }
    setAnswers(nextAnswers)
    window.setTimeout(() => {
      setStepIndex(index => {
        const nextStepIndex = Math.min(flow.length - 1, index + 1)
        persistDraft({ answers: nextAnswers, stepIndex: nextStepIndex })
        return nextStepIndex
      })
    }, 120)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      goNext()
    }
  }

  const canSubmit = Boolean(
    profile.promoterName.trim() &&
    profile.unit.trim() &&
    profile.role.trim() &&
    profile.phone.trim() &&
    profile.email.trim() &&
    profile.birthDate.trim() &&
    profile.address.trim() &&
    !saving
  )

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Revise os dados obrigatorios antes de enviar.')
      return
    }
    setSaving(true)
    setError('')
    setSubmitStatus('Enviando suas respostas ao APS30...')
    try {
      await api.post(`/promoter-forms/public/${token}`, {
        promoterName: profile.promoterName.trim(),
        unit: profile.unit.trim(),
        role: profile.role.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        birthDate: profile.birthDate.trim(),
        address: profile.address.trim(),
        notes: notes.trim(),
        answers,
        computed: result,
        photoBase64,
        photoMimeType,
        photoName,
      })
      setSubmitStatus('Formulário enviado com sucesso.')
      window.localStorage.removeItem(localDraftKey(token))
      setSubmitted(true)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 503) {
        setError(err?.response?.data?.error || 'Google Drive ainda não configurado na Vercel.')
      } else if ([404, 500, 502].includes(status)) {
        setError(err?.response?.data?.error || 'Não foi possível salvar o formulário agora.')
      } else {
        setError(err?.response?.data?.error || 'Não foi possível salvar o formulário agora.')
      }
      setSubmitStatus('')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    window.localStorage.removeItem(localDraftKey(token))
    setProfile(initialProfile)
    setCurrentInput('')
    setNotes('')
    setAnswers({})
    setPhotoPreview('')
    setPhotoBase64('')
    setPhotoMimeType('')
    setPhotoName('')
    setStepIndex(0)
    setError('')
    setSubmitStatus('')
    setResumePrompt(false)
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center px-5">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/70">
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
            Carregando...
          </div>
        </div>
      </PageShell>
    )
  }

  if (error && !linkInfo) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center px-5">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm text-white/45">Formulário de promotor</p>
            <h1 className="mt-3 text-2xl font-semibold">Link indisponível</h1>
            <p className="mt-2 text-sm text-white/60">{error}</p>
          </div>
        </div>
      </PageShell>
    )
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="mx-auto flex min-h-screen max-w-2xl items-center px-5">
          <div className="w-full rounded-[2rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),rgba(17,17,17,0.96)_44%)] p-8 shadow-2xl shadow-emerald-950/30">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10">
              <CheckCircleIcon className="h-8 w-8 text-emerald-200" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100/50">
              Formulário APS30
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-white">
              Obrigado, {getFirstName(profile.promoterName) || 'promotor'}.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/68">
              Suas respostas foram recebidas com sucesso.
            </p>
            <p className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-5 text-lg font-medium leading-relaxed text-white/86">
              Planejar bem e transformar intenção em direção: é assim que grandes resultados começam antes mesmo da primeira ação.
            </p>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
        {resumePrompt && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-[2rem] border border-white/12 bg-[#171717] p-6 shadow-2xl shadow-black/50">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/35">Rascunho encontrado</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                Quer continuar de onde parou?
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                O APS30 salvou seu progresso neste aparelho. Você pode continuar o preenchimento ou apagar este rascunho para começar novamente.
              </p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">{profile.promoterName || 'Cadastro em andamento'}</p>
                <p className="mt-1 text-xs text-white/45">{Math.max(1, stepIndex + 1)} de {flow.length} etapas preenchidas neste aparelho.</p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setResumePrompt(false)} className="h-12 rounded-2xl bg-white text-sm font-semibold text-black">
                  Continuar
                </button>
                <button onClick={resetForm} className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white/80">
                  Recomeçar
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111111]/95 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">APS30</p>
              <p className="text-xs text-white/45">Formulário de promotor</p>
            </div>
            <p className="text-xs text-white/45">{progress}%</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/38">
            <span>Progresso salvo automaticamente neste aparelho.</span>
            <button type="button" onClick={resetForm} className="font-semibold text-white/65 underline-offset-4 hover:underline">
              Recomeçar
            </button>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <main className="flex-1 py-7">
          <div className="space-y-6">
            <AssistantBubble step={currentStep} profile={profile} />

            {currentStep.kind === 'field' && (
              <ComposerBox
                value={currentInput}
                placeholder={currentStep.placeholder}
                inputType={currentStep.inputType}
                onChange={setCurrentInput}
                onKeyDown={handleKeyDown}
                onSubmit={goNext}
              />
            )}

            {currentStep.kind === 'photo' && (
              <PhotoStep
                photoPreview={photoPreview}
                onPhoto={handlePhotoChange}
                onNext={goNext}
              />
            )}

            {currentStep.kind === 'question' && (
              <QuestionStep
                question={currentStep.question}
                value={answers[currentStep.question.id]}
                onAnswer={setQuestionAnswer}
              />
            )}

            {currentStep.kind === 'notes' && (
              <ComposerBox
                value={currentInput}
                placeholder="Opcional. Escreva se quiser."
                multiline
                onChange={setCurrentInput}
                onKeyDown={handleKeyDown}
                onSubmit={goNext}
                submitLabel="Continuar"
              />
            )}

            {currentStep.kind === 'review' && (
              <ReviewStep
                profile={profile}
                photoPreview={photoPreview}
                saving={saving}
                canSubmit={canSubmit}
                submitStatus={submitStatus}
                onSubmit={handleSubmit}
              />
            )}

            {error && linkInfo && (
              <p className="rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-100/80">
                {error}
              </p>
            )}
          </div>
        </main>

        <footer className="sticky bottom-0 border-t border-white/10 bg-[#111111]/95 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 || saving}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 transition hover:bg-white/5 disabled:opacity-30"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar
            </button>
            <span className="text-xs text-white/35">
              {stepIndex + 1} de {flow.length}
            </span>
          </div>
        </footer>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#111111] text-white">{children}</div>
}

function AssistantBubble({ step, profile }: { step: FlowStep; profile: ProfileState }) {
  const name = profile.promoterName.trim().split(' ')[0]
  const text = step.kind === 'question' ? step.question.prompt : step.question
  const shouldUseName = Boolean(name) && !(step.kind === 'field' && step.id === 'promoterName')
  const displayText = shouldUseName ? `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text
  const hint =
    step.kind === 'question'
      ? 'Sem resposta certa. Escolha o caminho mais parecido com o que você faria de verdade.'
      : step.kind === 'field'
        ? 'Vou salvar seu progresso enquanto você responde.'
        : step.kind === 'photo'
          ? 'Pode pular se preferir. Da para completar sem foto.'
          : ''

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-sm font-bold text-black">
        S
      </div>
      <div className="max-w-[88%] rounded-3xl rounded-tl-md bg-white/[0.08] px-5 py-4">
        <p className="text-base leading-relaxed text-white/90">
          {displayText}
        </p>
        {hint && (
          <p className="mt-2 text-xs text-white/40">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

function ComposerBox({
  value,
  placeholder,
  inputType = 'text',
  multiline = false,
  submitLabel = 'Enviar',
  onChange,
  onKeyDown,
  onSubmit,
}: {
  value: string
  placeholder: string
  inputType?: string
  multiline?: boolean
  submitLabel?: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSubmit: () => void
}) {
  return (
    <div className="ml-11 rounded-3xl border border-white/10 bg-black/20 p-2">
      {multiline ? (
        <textarea
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={4}
          autoFocus
          placeholder={placeholder}
          className="min-h-[120px] w-full resize-none bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/35"
        />
      ) : (
        <input
          type={inputType}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          placeholder={placeholder}
          className="w-full bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/35"
        />
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          {submitLabel}
          <PaperAirplaneIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function PhotoStep({
  photoPreview,
  onPhoto,
  onNext,
}: {
  photoPreview: string
  onPhoto: (file?: File | null) => void
  onNext: () => void
}) {
  return (
    <div className="ml-11 space-y-3">
      <label className="flex cursor-pointer items-center gap-4 rounded-3xl border border-dashed border-white/15 bg-white/[0.04] p-4 transition hover:bg-white/[0.06]">
        <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl bg-black/30">
          {photoPreview ? (
            <img src={photoPreview} alt="Foto selecionada" className="h-full w-full object-cover" />
          ) : (
            <PhotoIcon className="h-7 w-7 text-white/45" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{photoPreview ? 'Foto selecionada' : 'Enviar foto'}</p>
          <p className="mt-1 text-xs text-white/45">Opcional, mas ajuda a identificar seu cadastro.</p>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={event => onPhoto(event.target.files?.[0] || null)} />
      </label>
      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black"
      >
        Continuar
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

function QuestionStep({
  question,
  value,
  onAnswer,
}: {
  question: PromoterQuestion
  value: number | string | undefined
  onAnswer: (question: PromoterQuestion, value: number) => void
}) {
  if (question.type === 'scale') {
    return (
      <div className="ml-11 grid gap-2 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map(level => {
          const active = Number(value) === level
          return (
            <button
              key={level}
              type="button"
              onClick={() => onAnswer(question, level)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]'}`}
            >
              <p className="text-sm font-bold">{level}</p>
              <p className={`mt-1 text-xs leading-snug ${active ? 'text-black/70' : 'text-white/50'}`}>
                {scaleLabels[level - 1]}
              </p>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="ml-11 space-y-2">
      {orderedQuestionOptions(question).map(({ option, originalIndex }) => {
        const active = Number(value) === originalIndex
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onAnswer(question, originalIndex)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition ${active ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ReviewStep({
  profile,
  photoPreview,
  saving,
  canSubmit,
  submitStatus,
  onSubmit,
}: {
  profile: ProfileState
  photoPreview: string
  saving: boolean
  canSubmit: boolean
  submitStatus: string
  onSubmit: () => void
}) {
  const items = [
    ['Nome', profile.promoterName],
    ['Unidade', profile.unit],
    ['Cargo', profile.role],
    ['WhatsApp', profile.phone],
    ['E-mail', profile.email],
    ['Aniversário', profile.birthDate],
    ['Endereço', profile.address],
  ]

  return (
    <div className="ml-11 space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          {photoPreview && <img src={photoPreview} alt="Foto" className="h-12 w-12 rounded-2xl object-cover" />}
          <div>
            <p className="font-semibold">{profile.promoterName || 'Promotor'}</p>
            <p className="text-sm text-white/45">{profile.unit || 'Unidade'}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {items.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <span className="text-white/42">{label}</span>
              <span className="max-w-[65%] text-right text-white/80">{normalizeAnswerPreview(value)}</span>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
      >
        {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
        {saving ? 'Enviando...' : 'Enviar respostas'}
      </button>
      {submitStatus && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65">
          {submitStatus}
        </p>
      )}
    </div>
  )
}


