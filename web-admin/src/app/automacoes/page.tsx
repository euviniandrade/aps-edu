'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'

const LS_KEY = 'apsedu_automations'
const LOG_KEY = 'apsedu_automation_runs_v2'

type Rule = {
  id: string
  name: string
  trigger: string
  condition: string
  action: string
  active: boolean
  runs: number
  lastRun?: string
  createdAt: string
}

type RunLog = { id: string; ruleId: string; name: string; status: 'success' | 'error'; detail: string; createdAt: string }

const triggers = [
  ['task_overdue', 'Tarefa entrou em atraso'],
  ['task_completed', 'Tarefa foi concluída'],
  ['event_1h', 'Evento começa em uma hora'],
  ['weekly_monday', 'Toda segunda-feira'],
  ['daily_9am', 'Todos os dias às 9h'],
  ['user_low_points', 'Pontuação ficou abaixo da meta'],
]

const conditions = [
  ['any', 'Qualquer ocorrência'],
  ['priority_high', 'Somente prioridade alta'],
  ['my_unit', 'Somente minha unidade'],
  ['overdue_3days', 'Atraso superior a três dias'],
]

const actions = [
  ['notify_assignee', 'Notificar responsável'],
  ['create_task', 'Criar tarefa de acompanhamento'],
  ['send_email', 'Preparar comunicação por e-mail'],
  ['generate_report', 'Gerar resumo executivo com IA'],
  ['sofi_summary', 'Criar análise semanal com IA'],
  ['sofi_risk_radar', 'Atualizar radar de riscos com IA'],
]

const defaults: Rule[] = [
  { id: 'preset-overdue', name: 'Alerta de tarefas atrasadas', trigger: 'task_overdue', condition: 'any', action: 'notify_assignee', active: true, runs: 0, createdAt: new Date().toISOString() },
  { id: 'preset-event', name: 'Lembrete de evento próximo', trigger: 'event_1h', condition: 'any', action: 'notify_assignee', active: true, runs: 0, createdAt: new Date().toISOString() },
  { id: 'preset-weekly', name: 'Resumo executivo semanal', trigger: 'weekly_monday', condition: 'any', action: 'sofi_summary', active: false, runs: 0, createdAt: new Date().toISOString() },
]

function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function label(list: string[][], value: string) { return list.find(item => item[0] === value)?.[1] || value }

export default function AutomacoesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [logs, setLogs] = useState<RunLog[]>([])
  const [builder, setBuilder] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [running, setRunning] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', trigger: 'task_overdue', condition: 'any', action: 'notify_assignee' })

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Rule[]
      setRules(stored.length ? stored.map(rule => ({ ...rule, name: cleanName(rule.name) })) : defaults)
    } catch { setRules(defaults) }
    try { setLogs(JSON.parse(localStorage.getItem(LOG_KEY) || '[]')) } catch {}
  }, [])

  function persist(next: Rule[]) {
    setRules(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  function persistLogs(next: RunLog[]) {
    setLogs(next)
    localStorage.setItem(LOG_KEY, JSON.stringify(next.slice(0, 30)))
  }

  function openBuilder(rule?: Rule) {
    setMessage('')
    setEditingId(rule?.id || '')
    setForm(rule ? { name: cleanName(rule.name), trigger: rule.trigger, condition: rule.condition, action: rule.action } : { name: '', trigger: 'task_overdue', condition: 'any', action: 'notify_assignee' })
    setBuilder(true)
  }

  function save() {
    if (!form.name.trim()) { setMessage('Dê um nome claro para a automação.'); return }
    if (editingId) persist(rules.map(rule => rule.id === editingId ? { ...rule, ...form } : rule))
    else persist([{ ...form, id: id(), active: true, runs: 0, createdAt: new Date().toISOString() }, ...rules])
    setBuilder(false)
  }

  async function run(rule: Rule) {
    setRunning(rule.id)
    setMessage('')
    let status: RunLog['status'] = 'success'
    let detail = 'Regra validada e executada.'
    try {
      if (rule.action === 'notify_assignee') {
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
        if ('Notification' in window && Notification.permission === 'granted') new Notification('APS EDU', { body: rule.name })
        detail = 'Notificação processada neste dispositivo.'
      } else {
        const prompt = `Atue como IA executiva da APS EDU. Execute uma simulação operacional segura desta automação e entregue o resultado pronto para revisão. Nome: ${rule.name}. Gatilho: ${label(triggers, rule.trigger)}. Condição: ${label(conditions, rule.condition)}. Ação: ${label(actions, rule.action)}.`
        const response = await fetch('/api/gemini', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'A IA não respondeu.')
        detail = String(data.content || 'Execução concluída.').slice(0, 500)
      }
      persist(rules.map(item => item.id === rule.id ? { ...item, runs: item.runs + 1, lastRun: new Date().toISOString() } : item))
    } catch (error) {
      status = 'error'
      detail = error instanceof Error ? error.message : 'Falha ao executar.'
    }
    persistLogs([{ id: id(), ruleId: rule.id, name: rule.name, status, detail, createdAt: new Date().toISOString() }, ...logs])
    setMessage(status === 'success' ? 'Automação executada e registrada no histórico.' : `Falha: ${detail}`)
    setRunning('')
  }

  const active = rules.filter(rule => rule.active).length
  const runs = rules.reduce((total, rule) => total + Number(rule.runs || 0), 0)
  const health = useMemo(() => rules.length ? Math.round((active / rules.length) * 100) : 0, [active, rules.length])

  return <AdminLayout>
    <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase text-violet-700">Orquestração</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Automações</h1><p className="mt-2 text-sm text-slate-500">Regras claras, execução verificável e histórico de cada ação.</p></div><button onClick={() => openBuilder()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-bold text-white"><PlusIcon className="h-4 w-4" />Nova automação</button></header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BoltIcon} label="Ativas" value={active} detail={`${rules.length} regras configuradas`} tone="emerald" />
        <Metric icon={PlayIcon} label="Execuções" value={runs} detail="registradas no navegador" tone="sky" />
        <Metric icon={CheckCircleIcon} label="Saúde" value={`${health}%`} detail="regras habilitadas" tone="violet" />
        <Metric icon={ClockIcon} label="Última execução" value={logs[0] ? new Date(logs[0].createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--'} detail={logs[0]?.status === 'error' ? 'com falha' : 'sem pendências'} tone="amber" />
      </div>

      {message && <div className={`rounded-md border px-4 py-3 text-sm ${message.startsWith('Falha') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-lg font-bold text-slate-950">Fluxos configurados</h2><p className="text-sm text-slate-500">Ative, pause, edite ou execute manualmente.</p></div><Cog6ToothIcon className="h-5 w-5 text-slate-400" /></header><div className="divide-y divide-slate-100">{rules.map(rule => <article key={rule.id} className={`p-5 ${rule.active ? '' : 'bg-slate-50 opacity-70'}`}><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><button onClick={() => persist(rules.map(item => item.id === rule.id ? { ...item, active: !item.active } : item))} className={`grid h-10 w-10 flex-none place-items-center rounded-md ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`} title={rule.active ? 'Pausar' : 'Ativar'}>{rule.active ? <CheckCircleIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-950">{cleanName(rule.name)}</h3><span className={`rounded px-2 py-1 text-[10px] font-bold ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rule.active ? 'ATIVA' : 'PAUSADA'}</span></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-md bg-sky-50 px-3 py-2 font-semibold text-sky-800">SE {label(triggers, rule.trigger)}</span><span className="font-bold text-slate-300">→</span><span className="rounded-md bg-violet-50 px-3 py-2 font-semibold text-violet-800">ENTÃO {label(actions, rule.action)}</span></div><p className="mt-3 text-xs text-slate-400">{rule.runs || 0} execuções{rule.lastRun ? ` · última em ${new Date(rule.lastRun).toLocaleString('pt-BR')}` : ''}</p></div><div className="flex flex-none gap-2"><button onClick={() => run(rule)} disabled={running === rule.id} className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-bold text-white disabled:opacity-50"><ArrowPathIcon className={`h-4 w-4 ${running === rule.id ? 'animate-spin' : ''}`} />Executar</button><button onClick={() => openBuilder(rule)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600">Editar</button><button onClick={() => persist(rules.filter(item => item.id !== rule.id))} className="grid h-9 w-9 place-items-center rounded-md border border-rose-100 text-rose-500" title="Excluir"><TrashIcon className="h-4 w-4" /></button></div></div></article>)}</div></section>

        <aside className="space-y-5"><section className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-md bg-violet-500/20 text-violet-300"><SparklesIcon className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase text-violet-300">IA operacional</p><h2 className="text-lg font-bold text-white">Ações inteligentes</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-300">Resumos, relatórios e radares usam o roteador de IA configurado na plataforma e deixam o resultado registrado para conferência.</p></section><section className="rounded-lg border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 p-5"><h2 className="text-base font-bold text-slate-950">Histórico recente</h2></header><div className="divide-y divide-slate-100">{logs.slice(0, 6).map(log => <div key={log.id} className="p-4"><div className="flex items-start gap-3">{log.status === 'success' ? <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-none text-emerald-600" /> : <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-rose-600" />}<div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{cleanName(log.name)}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{log.detail}</p><p className="mt-2 text-[10px] font-semibold text-slate-400">{new Date(log.createdAt).toLocaleString('pt-BR')}</p></div></div></div>)}{!logs.length && <p className="p-6 text-center text-sm text-slate-500">Nenhuma execução registrada ainda.</p>}</div></section></aside>
      </div>

      {builder && <Builder form={form} setForm={setForm} editing={Boolean(editingId)} message={message} onClose={() => setBuilder(false)} onSave={save} />}
    </div>
  </AdminLayout>
}

function cleanName(value = '') { return value.replace(/^(?:x[a-zA-Z0-9&}" ]*|[⭐⏰⏱️]+)\s*/, '').trim() || 'Automação sem nome' }

function Metric({ icon: Icon, label, value, detail, tone }: { icon: React.ElementType; label: string; value: string | number; detail: string; tone: string }) {
  const colors: Record<string, string> = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' }
  return <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-md ${colors[tone]}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="text-2xl font-bold text-slate-950">{value}</p><p className="text-xs text-slate-500">{detail}</p></div></div>
}

function Builder({ form, setForm, editing, message, onClose, onSave }: { form: { name: string; trigger: string; condition: string; action: string }; setForm: (value: any) => void; editing: boolean; message: string; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-bold uppercase text-violet-700">Construtor visual</p><h2 className="text-xl font-bold text-slate-950">{editing ? 'Editar automação' : 'Nova automação'}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500"><XMarkIcon className="h-4 w-4" /></button></header><div className="space-y-4 p-5"><Field label="Nome"><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Alerta de atraso crítico" className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" /></Field><Field label="Quando isso acontecer"><Select value={form.trigger} onChange={(value: string) => setForm({ ...form, trigger: value })} items={triggers} /></Field><Field label="Se esta condição for atendida"><Select value={form.condition} onChange={(value: string) => setForm({ ...form, condition: value })} items={conditions} /></Field><Field label="Execute esta ação"><Select value={form.action} onChange={(value: string) => setForm({ ...form, action: value })} items={actions} /></Field><div className="flex items-center gap-2 rounded-md border border-violet-100 bg-violet-50 p-4 text-xs font-semibold text-violet-900"><BoltIcon className="h-4 w-4" />SE {label(triggers, form.trigger)} → ENTÃO {label(actions, form.action)}</div>{message && <p className="text-sm text-rose-600">{message}</p>}</div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4"><button onClick={onClose} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">Cancelar</button><button onClick={onSave} className="h-10 rounded-md bg-slate-900 px-5 text-sm font-bold text-white">{editing ? 'Salvar alterações' : 'Criar automação'}</button></footer></div></div>
}

function Field({ label: fieldLabel, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{fieldLabel}</span>{children}</label> }
function Select({ value, onChange, items }: { value: string; onChange: (value: string) => void; items: string[][] }) { return <select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500">{items.map(item => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select> }
