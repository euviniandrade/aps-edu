'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  BuildingLibraryIcon, UserIcon, DocumentArrowDownIcon,
  CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
  TrophyIcon, StarIcon, ChartBarIcon, UsersIcon,
  CalendarDaysIcon, PrinterIcon
} from '@heroicons/react/24/outline'
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts'

function ProgressRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  )
}

function StatBlock({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

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

  const handlePrint = () => window.print()

  const completionRate = report?.data?.tasks?.completionRate || 0
  const onTimeRate     = report?.data?.tasks?.onTimeRate || 0

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análise de desempenho por unidade ou colaborador</p>
        </div>
        {report && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <PrinterIcon className="w-4 h-4" />
            Imprimir
          </button>
        )}
      </div>

      {/* Selector card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 animate-fade-in-up">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          {(['unit', 'user'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setReport(null) }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'unit' ? <><BuildingLibraryIcon className="w-4 h-4" /> Por Unidade</> : <><UserIcon className="w-4 h-4" /> Por Colaborador</>}
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-end">
          {tab === 'unit' ? (
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Selecionar Unidade
              </label>
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
              >
                <option value="">Escolha uma unidade...</option>
                {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Selecionar Colaborador
              </label>
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
              >
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
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: '#1B3A6B' }}
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Gerando...</>
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
            className="rounded-2xl p-6 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2A5298 100%)' }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-32 opacity-5">
              <BuildingLibraryIcon className="w-full h-full" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest opacity-60 uppercase mb-1">
                  {report.type === 'unit' ? 'Relatório de Unidade' : 'Relatório Individual'}
                </p>
                <h2 className="text-2xl font-extrabold">
                  {report.type === 'unit' ? report.data.unit?.name : report.data.user?.name}
                </h2>
                {report.type === 'unit' && (
                  <p className="text-sm opacity-60 mt-0.5">{report.data.unit?.city}</p>
                )}
                {report.type === 'user' && (
                  <p className="text-sm opacity-60 mt-0.5">
                    {report.data.user?.role} · {report.data.user?.unit}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs opacity-50">Gerado em</p>
                <p className="text-sm font-semibold">
                  {new Date(report.data.generatedAt).toLocaleDateString('pt-BR', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
                <p className="text-xs opacity-50 mt-0.5">
                  {new Date(report.data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* ── UNIT REPORT ── */}
          {report.type === 'unit' && (
            <>
              {/* Stat blocks */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBlock label="Total de Tarefas"    value={report.data.tasks?.total}    icon={CheckCircleIcon}        color="bg-blue-50 text-blue-600" />
                <StatBlock label="Tarefas Concluídas" value={report.data.tasks?.completed} icon={CheckCircleIcon}        color="bg-emerald-50 text-emerald-600" />
                <StatBlock label="Em Atraso"           value={report.data.tasks?.overdue}  icon={ExclamationTriangleIcon} color="bg-red-50 text-red-500" />
                <StatBlock label="Colaboradores"       value={report.data.users?.total}    icon={UsersIcon}              color="bg-purple-50 text-purple-600" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatBlock label="Total de Eventos"    value={report.data.events?.total}      icon={CalendarDaysIcon} color="bg-yellow-50 text-yellow-600" />
                <StatBlock label="Eventos Concluídos" value={report.data.events?.completed}   icon={CalendarDaysIcon} color="bg-teal-50 text-teal-600" />
                <StatBlock label="Progresso Médio"    value={`${report.data.events?.avgProgress}%`} icon={ChartBarIcon} color="bg-indigo-50 text-indigo-600" />
              </div>

              {/* Completion rate ring */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-6">
                  <div className="relative flex-shrink-0">
                    <ProgressRing value={completionRate} color="#10B981" size={90} />
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-800">
                      {completionRate}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Taxa de Conclusão</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {report.data.tasks?.completed} de {report.data.tasks?.total} tarefas concluídas
                    </p>
                    <div className="mt-3 w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Top performers */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50">
                    <h3 className="font-semibold text-gray-700 text-sm">🏅 Top Colaboradores</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {(report.data.users?.topPerformers || []).slice(0, 5).map((u: any, i: number) => (
                      <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-base w-5 text-center">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#1B3A6B' }}
                        >
                          {u.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{u.name}</p>
                          <p className="text-[10px] text-gray-400">{u.role}</p>
                        </div>
                        <span className="text-xs font-bold text-blue-600">{u.points} pts</span>
                      </div>
                    ))}
                    {(!report.data.users?.topPerformers || report.data.users.topPerformers.length === 0) && (
                      <div className="text-center py-6 text-gray-400 text-xs">Sem dados de gamificação</div>
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
                <StatBlock label="Total de Tarefas"  value={report.data.tasks?.total}           icon={CheckCircleIcon}  color="bg-blue-50 text-blue-600" />
                <StatBlock label="Concluídas"        value={report.data.tasks?.completed}        icon={CheckCircleIcon}  color="bg-emerald-50 text-emerald-600" />
                <StatBlock label="Em Andamento"      value={report.data.tasks?.inProgress}       icon={ClockIcon}        color="bg-yellow-50 text-yellow-600" />
                <StatBlock label="Em Atraso"         value={report.data.tasks?.overdue}          icon={ExclamationTriangleIcon} color="bg-red-50 text-red-500" />
              </div>

              {/* Progress rings row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Completion ring */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3">
                  <div className="relative">
                    <ProgressRing value={completionRate} color="#10B981" size={100} />
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-gray-800">
                      {completionRate}%
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">Taxa de Conclusão</p>
                    <p className="text-xs text-gray-400 mt-0.5">{report.data.tasks?.completed} / {report.data.tasks?.total} tarefas</p>
                  </div>
                </div>

                {/* On-time ring */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3">
                  <div className="relative">
                    <ProgressRing value={onTimeRate} color="#F8A303" size={100} />
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-gray-800">
                      {onTimeRate}%
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">Entregas no Prazo</p>
                    <p className="text-xs text-gray-400 mt-0.5">Das tarefas concluídas</p>
                  </div>
                </div>

                {/* Gamification card */}
                <div
                  className="rounded-2xl p-6 text-white flex flex-col gap-3 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #1B3A6B, #2A5298)' }}
                >
                  <TrophyIcon className="absolute right-4 top-4 w-20 h-20 opacity-5" />
                  <div>
                    <p className="text-xs opacity-60 font-semibold uppercase tracking-wider mb-1">Gamificação</p>
                    <p className="text-3xl font-extrabold">{report.data.gamification?.points?.toLocaleString('pt-BR')} pts</p>
                    <p className="text-sm font-semibold opacity-80 mt-0.5">{report.data.gamification?.level?.name}</p>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <div>
                      <p className="text-xs opacity-50">Selos</p>
                      <p className="font-bold">{report.data.gamification?.badgesEarned}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Streak</p>
                      <p className="font-bold">{report.data.gamification?.loginStreak} dias</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Eventos</p>
                      <p className="font-bold">{report.data.events?.participated}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Last badges */}
              {report.data.gamification?.badges?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-700 mb-3">🏅 Últimos Selos Conquistados</h3>
                  <div className="flex flex-wrap gap-2">
                    {report.data.gamification.badges.map((ub: any) => (
                      <span
                        key={ub.badge?.id || ub.badgeId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200"
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

          {/* Generated footer */}
          <div className="text-center text-xs text-gray-400 pt-2 pb-6">
            Relatório gerado automaticamente pelo sistema APS EDU · Educação Adventista — Associação Paulista Sul
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
