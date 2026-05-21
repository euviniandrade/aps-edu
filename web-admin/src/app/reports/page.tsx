'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  BuildingLibraryIcon, UserIcon,
  CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
  TrophyIcon, StarIcon, ChartBarIcon, UsersIcon,
  CalendarDaysIcon, PrinterIcon
} from '@heroicons/react/24/outline'

function ProgressRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  )
}

function StatBlock({ label, value, icon: Icon, accentColor }: { label: string; value: any; icon: any; accentColor: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3 transition-all hover:scale-[1.02]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25` }}
      >
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color: accentColor }}>{value ?? '—'}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      </div>
    </div>
  )
}

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function ReportsPage() {
  const [units, setUnits]             = useState<any[]>([])
  const [users, setUsers]             = useState<any[]>([])
  const [selectedUnit, setSelectedUnit] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [report, setReport]           = useState<any>(null)
  const [loading, setLoading]         = useState(false)
  const [tab, setTab]                 = useState<'unit' | 'user'>('unit')

  useEffect(() => {
    Promise.all([api.get('/units'), api.get('/users?limit=200')]).then(([u, us]) => {
      setUnits(u.data || [])
      const rawUsers = us.data?.users || us.data || []
      setUsers(rawUsers)
    }).catch(console.error)
  }, [])

  const generate = async () => {
    const id = tab === 'unit' ? selectedUnit : selectedUser
    if (!id) return
    setLoading(true)
    setReport(null)
    try {
      const res = await api.get(tab === 'unit' ? `/reports/unit/${id}` : `/reports/user/${id}`)
      setReport({ type: tab, data: res.data })
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erro ao gerar relatório')
    } finally { setLoading(false) }
  }

  const completionRate = report?.data?.tasks?.completionRate || 0
  const onTimeRate     = report?.data?.tasks?.onTimeRate || 0

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Relatórios</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Análise de desempenho por unidade ou colaborador
          </p>
        </div>
        {report && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
          >
            <PrinterIcon className="w-4 h-4" />
            Imprimir
          </button>
        )}
      </div>

      {/* Selector card */}
      <div
        className="rounded-2xl p-6 mb-6 animate-fade-in-up"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Tabs */}
        <div
          className="flex gap-1 rounded-xl p-1 mb-5 w-fit"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {(['unit', 'user'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setReport(null) }}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === t
                ? { background: 'rgba(248,163,3,0.15)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.25)' }
                : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }
              }
            >
              {t === 'unit'
                ? <><BuildingLibraryIcon className="w-4 h-4" /> Por Unidade</>
                : <><UserIcon className="w-4 h-4" /> Por Colaborador</>
              }
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-end">
          {tab === 'unit' ? (
            <div className="flex-1">
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Selecionar Unidade
              </label>
              <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={darkField}>
                <option value="">Escolha uma unidade...</option>
                {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex-1">
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Selecionar Colaborador
              </label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={darkField}>
                <option value="">Escolha um colaborador...</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role?.name} ({u.unit?.name})</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading || (tab === 'unit' ? !selectedUnit : !selectedUser)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 20px rgba(248,163,3,0.3)' }}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" /> Gerando...</>
            ) : (
              <><ChartBarIcon className="w-4 h-4" /> Gerar Relatório</>
            )}
          </button>
        </div>
      </div>

      {/* Report output */}
      {report && !loading && (
        <div className="space-y-5 animate-fade-in-up" id="report-content">

          {/* Report header */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(27,58,107,0.9) 0%, rgba(139,92,246,0.4) 100%)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 8px 40px rgba(27,58,107,0.4)',
            }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-32 opacity-5">
              <BuildingLibraryIcon className="w-full h-full" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {report.type === 'unit' ? 'Relatório de Unidade' : 'Relatório Individual'}
                </p>
                <h2 className="text-2xl font-extrabold text-white">
                  {report.type === 'unit' ? report.data.unit?.name : report.data.user?.name}
                </h2>
                {report.type === 'unit' && (
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{report.data.unit?.city}</p>
                )}
                {report.type === 'user' && (
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {report.data.user?.role} · {report.data.user?.unit}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Gerado em</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(report.data.generatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(report.data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* ── UNIT REPORT ── */}
          {report.type === 'unit' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBlock label="Total de Tarefas"    value={report.data.tasks?.total}    icon={CheckCircleIcon}        accentColor="#4A9EFF" />
                <StatBlock label="Tarefas Concluídas" value={report.data.tasks?.completed} icon={CheckCircleIcon}        accentColor="#0ABD78" />
                <StatBlock label="Em Atraso"           value={report.data.tasks?.overdue}  icon={ExclamationTriangleIcon} accentColor="#FF4757" />
                <StatBlock label="Colaboradores"       value={report.data.users?.total}    icon={UsersIcon}              accentColor="#A78BFA" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatBlock label="Total de Eventos"    value={report.data.events?.total}                icon={CalendarDaysIcon} accentColor="#F9C234" />
                <StatBlock label="Eventos Concluídos" value={report.data.events?.completed}             icon={CalendarDaysIcon} accentColor="#0ABD78" />
                <StatBlock label="Progresso Médio"    value={`${report.data.events?.avgProgress}%`}    icon={ChartBarIcon}    accentColor="#29ABE2" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Completion ring */}
                <div
                  className="rounded-2xl p-6 flex items-center gap-6"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="relative flex-shrink-0">
                    <ProgressRing value={completionRate} color="#0ABD78" size={90} />
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                      {completionRate}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Taxa de Conclusão</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {report.data.tasks?.completed} de {report.data.tasks?.total} tarefas concluídas
                    </p>
                    <div
                      className="mt-3 w-48 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${completionRate}%`, background: '#0ABD78' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Top performers */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 className="font-semibold text-white text-sm">🏅 Top Colaboradores</h3>
                  </div>
                  <div>
                    {(report.data.users?.topPerformers || []).slice(0, 5).map((u: any, i: number) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-5 py-3"
                        style={{ borderBottom: i < Math.min(4, (report.data.users?.topPerformers?.length || 0) - 1) ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      >
                        <span className="text-base w-5 text-center">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000' }}
                        >
                          {u.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{u.role}</p>
                        </div>
                        <span className="text-xs font-bold" style={{ color: '#F8A303' }}>{u.points} pts</span>
                      </div>
                    ))}
                    {(!report.data.users?.topPerformers || report.data.users.topPerformers.length === 0) && (
                      <div className="text-center py-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        Sem dados de gamificação
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── USER REPORT ── */}
          {report.type === 'user' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBlock label="Total de Tarefas" value={report.data.tasks?.total}     icon={CheckCircleIcon}        accentColor="#4A9EFF" />
                <StatBlock label="Concluídas"       value={report.data.tasks?.completed} icon={CheckCircleIcon}        accentColor="#0ABD78" />
                <StatBlock label="Em Andamento"     value={report.data.tasks?.inProgress} icon={ClockIcon}             accentColor="#F9C234" />
                <StatBlock label="Em Atraso"        value={report.data.tasks?.overdue}   icon={ExclamationTriangleIcon} accentColor="#FF4757" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Completion ring */}
                <div
                  className="rounded-2xl p-6 flex flex-col items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="relative">
                    <ProgressRing value={completionRate} color="#0ABD78" size={100} />
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">
                      {completionRate}%
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">Taxa de Conclusão</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {report.data.tasks?.completed} / {report.data.tasks?.total} tarefas
                    </p>
                  </div>
                </div>

                {/* On-time ring */}
                <div
                  className="rounded-2xl p-6 flex flex-col items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="relative">
                    <ProgressRing value={onTimeRate} color="#F8A303" size={100} />
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">
                      {onTimeRate}%
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">Entregas no Prazo</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Das tarefas concluídas</p>
                  </div>
                </div>

                {/* Gamification card */}
                <div
                  className="rounded-2xl p-6 text-white flex flex-col gap-3 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(74,158,255,0.3))',
                    border: '1px solid rgba(139,92,246,0.3)',
                  }}
                >
                  <TrophyIcon className="absolute right-4 top-4 w-20 h-20 opacity-5" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Gamificação
                    </p>
                    <p className="text-3xl font-extrabold" style={{ color: '#F8A303' }}>
                      {report.data.gamification?.points?.toLocaleString('pt-BR')} pts
                    </p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {report.data.gamification?.level?.name}
                    </p>
                  </div>
                  <div className="flex gap-4 mt-1">
                    {[
                      { label: 'Selos',   value: report.data.gamification?.badgesEarned },
                      { label: 'Streak',  value: `${report.data.gamification?.loginStreak} dias` },
                      { label: 'Eventos', value: report.data.events?.participated },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
                        <p className="font-bold text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {report.data.gamification?.badges?.length > 0 && (
                <div
                  className="rounded-2xl p-5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <h3 className="font-semibold text-white mb-3 text-sm">🏅 Últimos Selos Conquistados</h3>
                  <div className="flex flex-wrap gap-2">
                    {report.data.gamification.badges.map((ub: any) => (
                      <span
                        key={ub.badge?.id || ub.badgeId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(248,163,3,0.12)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.25)' }}
                      >
                        <StarIcon className="w-3.5 h-3.5" />
                        {ub.badge?.name || 'Selo'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="text-center text-xs pb-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Relatório gerado automaticamente pelo sistema APS EDU · Educação Adventista — Associação Paulista Sul
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
