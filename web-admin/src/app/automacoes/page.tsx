'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useToast } from '@/contexts/ToastContext'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const LS_KEY = 'apsedu_automations'

interface AutomationRule {
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

const TRIGGERS = [
  { id: 'task_overdue',       label: 'Tarefa fica em atraso',           icon: '⏰' },
  { id: 'task_created',       label: 'Nova tarefa criada',               icon: '📋' },
  { id: 'task_completed',     label: 'Tarefa marcada como concluída',    icon: '✅' },
  { id: 'event_tomorrow',     label: 'Evento começa amanhã',             icon: '📅' },
  { id: 'event_1h',           label: 'Evento em 1 hora',                 icon: '⏱️' },
  { id: 'user_low_points',    label: 'Usuário com pontuação baixa',      icon: '📉' },
  { id: 'announcement_new',   label: 'Novo comunicado publicado',        icon: '📣' },
  { id: 'daily_9am',          label: 'Todo dia às 9h',                   icon: '🌅' },
  { id: 'weekly_monday',      label: 'Toda segunda-feira',               icon: '📆' },
  { id: 'feedback_received',  label: 'Novo feedback recebido',           icon: '💬' },
]

const ACTIONS = [
  { id: 'notify_assignee',    label: 'Notificar responsável',            icon: '🔔' },
  { id: 'notify_admin',       label: 'Notificar administrador',          icon: '👤' },
  { id: 'notify_all',         label: 'Notificar toda a equipe',          icon: '📢' },
  { id: 'send_email',         label: 'Enviar e-mail automático',         icon: '📧' },
  { id: 'create_task',        label: 'Criar tarefa automaticamente',     icon: '📝' },
  { id: 'update_status',      label: 'Atualizar status da tarefa',       icon: '🔄' },
  { id: 'add_points',         label: 'Adicionar pontos de gamificação',  icon: '⭐' },
  { id: 'generate_report',    label: 'Gerar relatório PDF',              icon: '📊' },
  { id: 'sofi_summary',       label: 'Sofi gera resumo semanal',         icon: '🤖' },
  { id: 'webhook',            label: 'Chamar webhook externo',           icon: '🔗' },
]

const CONDITIONS = [
  { id: 'any',                label: 'Qualquer caso',                    icon: '✅' },
  { id: 'priority_high',      label: 'Apenas prioridade alta/crítica',   icon: '🔴' },
  { id: 'my_unit',            label: 'Apenas minha unidade',             icon: '🏫' },
  { id: 'overdue_3days',      label: 'Atraso maior que 3 dias',          icon: '⚠️' },
  { id: 'points_below_100',   label: 'Pontuação abaixo de 100',          icon: '📉' },
]

const PRESET_RULES: Omit<AutomationRule, 'id' | 'runs' | 'lastRun' | 'createdAt'>[] = [
  {
    name: '🚨 Alerta de tarefas atrasadas',
    trigger: 'task_overdue',
    condition: 'any',
    action: 'notify_assignee',
    active: true,
  },
  {
    name: '📅 Lembrete de evento próximo',
    trigger: 'event_1h',
    condition: 'any',
    action: 'notify_assignee',
    active: true,
  },
  {
    name: '🤖 Resumo semanal da Sofi',
    trigger: 'weekly_monday',
    condition: 'any',
    action: 'sofi_summary',
    active: false,
  },
  {
    name: '⭐ Pontuação por tarefa concluída',
    trigger: 'task_completed',
    condition: 'any',
    action: 'add_points',
    active: true,
  },
  {
    name: '📧 E-mail para baixo engajamento',
    trigger: 'user_low_points',
    condition: 'points_below_100',
    action: 'send_email',
    active: false,
  },
]

function makeId() { return Math.random().toString(36).slice(2) }

function loadRules(): AutomationRule[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    if (saved.length > 0) return saved
  } catch {}
  // Default presets
  return PRESET_RULES.map(r => ({
    ...r, id: makeId(), runs: Math.floor(Math.random() * 30),
    lastRun: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  }))
}

function saveRules(rules: AutomationRule[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rules))
}

export default function AutomacoesPage() {
  const { success, error: toastError, info } = useToast()
  const [rules, setRules]           = useState<AutomationRule[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [editing, setEditing]       = useState<AutomationRule | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [running, setRunning]       = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', trigger: '', condition: 'any', action: '',
  })

  useEffect(() => {
    setRules(loadRules())
  }, [])

  const openBuilder = (rule?: AutomationRule) => {
    if (rule) {
      setEditing(rule)
      setForm({ name: rule.name, trigger: rule.trigger, condition: rule.condition, action: rule.action })
    } else {
      setEditing(null)
      setForm({ name: '', trigger: '', condition: 'any', action: '' })
    }
    setShowBuilder(true)
  }

  const saveRule = () => {
    if (!form.name.trim() || !form.trigger || !form.action) {
      toastError('Preencha todos os campos', 'Nome, gatilho e ação são obrigatórios.')
      return
    }
    let updated: AutomationRule[]
    if (editing) {
      updated = rules.map(r => r.id === editing.id ? { ...r, ...form } : r)
      success('Automação atualizada!', form.name)
    } else {
      const newRule: AutomationRule = {
        id: makeId(), ...form, active: true,
        runs: 0, createdAt: new Date().toISOString(),
      }
      updated = [...rules, newRule]
      success('Automação criada!', `"${form.name}" está ativa.`)
    }
    setRules(updated)
    saveRules(updated)
    setShowBuilder(false)
  }

  const toggleActive = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, active: !r.active } : r)
    setRules(updated)
    saveRules(updated)
    const r = updated.find(r => r.id === id)!
    info(r.active ? 'Automação ativada' : 'Automação pausada', r.name)
  }

  const deleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id)
    setRules(updated)
    saveRules(updated)
    success('Automação excluída')
    setDeleteId(null)
  }

  const runNow = async (rule: AutomationRule) => {
    setRunning(rule.id)
    await new Promise(r => setTimeout(r, 1500)) // Simulate run
    const updated = rules.map(r => r.id === rule.id
      ? { ...r, runs: r.runs + 1, lastRun: new Date().toISOString() }
      : r
    )
    setRules(updated)
    saveRules(updated)
    setRunning(null)
    success('✅ Automação executada!', `"${rule.name}" rodou com sucesso.`)
  }

  const getTriggerLabel = (id: string) => TRIGGERS.find(t => t.id === id)?.label || id
  const getTriggerIcon  = (id: string) => TRIGGERS.find(t => t.id === id)?.icon || '⚡'
  const getActionLabel  = (id: string) => ACTIONS.find(a => a.id === id)?.label || id
  const getActionIcon   = (id: string) => ACTIONS.find(a => a.id === id)?.icon || '🔄'

  const activeCount = rules.filter(r => r.active).length
  const totalRuns   = rules.reduce((a, r) => a + r.runs, 0)

  const timeAgo = (iso?: string) => {
    if (!iso) return 'Nunca'
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 60) return `${min}min atrás`
    const h = Math.floor(min / 60)
    if (h < 24) return `${h}h atrás`
    return `${Math.floor(h / 24)}d atrás`
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Automações IA</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Regras inteligentes que executam ações automaticamente
          </p>
        </div>
        <button
          onClick={() => openBuilder()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 20px rgba(248,163,3,0.3)' }}
        >
          + Nova Automação
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Automações ativas', value: activeCount, icon: '⚡', color: '#0ABD78' },
          { label: 'Total de execuções', value: totalRuns,   icon: '🔄', color: '#4A9EFF' },
          { label: 'Total de regras',    value: rules.length, icon: '📋', color: '#F8A303' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-2xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.map(rule => (
          <div
            key={rule.id}
            className="rounded-2xl p-5 transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${rule.active ? 'rgba(10,189,120,0.2)' : 'rgba(255,255,255,0.07)'}`,
              opacity: rule.active ? 1 : 0.6,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-bold text-white">{rule.name}</p>
                  {rule.active ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(10,189,120,0.12)', color: '#0ABD78' }}>
                      ● Ativa
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                      ⏸ Pausada
                    </span>
                  )}
                </div>

                {/* If → Then flow */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                    style={{ background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)' }}
                  >
                    <span className="font-bold" style={{ color: '#4A9EFF' }}>SE</span>
                    <span>{getTriggerIcon(rule.trigger)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{getTriggerLabel(rule.trigger)}</span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>→</span>
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                    style={{ background: 'rgba(10,189,120,0.1)', border: '1px solid rgba(10,189,120,0.2)' }}
                  >
                    <span className="font-bold" style={{ color: '#0ABD78' }}>ENTÃO</span>
                    <span>{getActionIcon(rule.action)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{getActionLabel(rule.action)}</span>
                  </div>
                </div>

                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {rule.runs} execuções · Última: {timeAgo(rule.lastRun)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => runNow(rule)}
                  disabled={running === rule.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)', color: '#4A9EFF' }}
                >
                  {running === rule.id ? '⏳' : '▶ Executar'}
                </button>
                <button
                  onClick={() => openBuilder(rule)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                >
                  ✏️
                </button>
                {/* Toggle */}
                <button
                  onClick={() => toggleActive(rule.id)}
                  className="w-10 h-5.5 rounded-full transition-all relative"
                  style={{
                    background: rule.active ? 'linear-gradient(135deg, #0ABD78, #0dd68c)' : 'rgba(255,255,255,0.1)',
                    width: 40, height: 22,
                  }}
                >
                  <div
                    className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all"
                    style={{
                      width: 18, height: 18,
                      left: rule.active ? 20 : 2,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                </button>
                <button
                  onClick={() => setDeleteId(rule.id)}
                  className="px-2 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.15)', color: '#FF4757' }}
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="text-center py-16 rounded-2xl" style={{ border: '2px dashed rgba(255,255,255,0.08)' }}>
            <p className="text-4xl mb-3">⚡</p>
            <p className="text-sm font-semibold text-white">Nenhuma automação criada</p>
            <p className="text-xs mt-1 mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Crie regras inteligentes para automatizar sua gestão
            </p>
            <button
              onClick={() => openBuilder()}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000' }}
            >
              + Criar primeira automação
            </button>
          </div>
        )}
      </div>

      {/* ── BUILDER MODAL ── */}
      {showBuilder && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl w-full max-w-lg animate-scale-in"
            style={{ background: 'rgba(8,10,24,0.99)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
          >
            <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-base font-bold text-white">
                {editing ? '✏️ Editar Automação' : '⚡ Nova Automação'}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Configure o gatilho e a ação automática
              </p>
            </div>
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nome da automação
                </label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Alerta de atraso crítico..."
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  SE — Gatilho (quando acontece?)
                </label>
                <select
                  value={form.trigger}
                  onChange={e => setForm({ ...form, trigger: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(74,158,255,0.25)', color: 'white' }}
                >
                  <option value="">Selecionar gatilho...</option>
                  {TRIGGERS.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  QUANDO — Condição (filtro adicional)
                </label>
                <select
                  value={form.condition}
                  onChange={e => setForm({ ...form, condition: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(248,163,3,0.25)', color: 'white' }}
                >
                  {CONDITIONS.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>

              {/* Action */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  ENTÃO — Ação automática
                </label>
                <select
                  value={form.action}
                  onChange={e => setForm({ ...form, action: e.target.value })}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(10,189,120,0.25)', color: 'white' }}
                >
                  <option value="">Selecionar ação...</option>
                  {ACTIONS.map(a => (
                    <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              {form.trigger && form.action && (
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{ background: 'rgba(248,163,3,0.05)', border: '1px solid rgba(248,163,3,0.15)' }}
                >
                  <p className="text-xs font-semibold mb-2" style={{ color: '#F8A303' }}>✨ Pré-visualização</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-2 py-1 rounded-lg" style={{ background: 'rgba(74,158,255,0.1)', color: '#4A9EFF' }}>
                      SE {getTriggerLabel(form.trigger)}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                    <span className="px-2 py-1 rounded-lg" style={{ background: 'rgba(10,189,120,0.1)', color: '#0ABD78' }}>
                      ENTÃO {getActionLabel(form.action)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => setShowBuilder(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancelar
              </button>
              <button
                onClick={saveRule}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 16px rgba(248,163,3,0.3)' }}
              >
                {editing ? '💾 Salvar Alterações' : '⚡ Criar Automação'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        danger
        title="Excluir Automação"
        message="Tem certeza? Esta automação será removida permanentemente."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => deleteId && deleteRule(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </AdminLayout>
  )

  function getTriggerLabel(id: string) { return TRIGGERS.find(t => t.id === id)?.label || id }
  function getActionLabel(id: string)  { return ACTIONS.find(a => a.id === id)?.label  || id }
}
