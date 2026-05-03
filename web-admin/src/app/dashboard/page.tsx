'use client'
import { useEffect, useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  UsersIcon, CheckCircleIcon, ExclamationTriangleIcon, CalendarDaysIcon,
  ArrowTrendingUpIcon, BellAlertIcon
} from '@heroicons/react/24/outline'

// Animated counter hook
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (!target) { setCount(0); return }
    start.current = null
    const step = (ts: number) => {
      if (!start.current) start.current = ts
      const p = Math.min((ts - start.current) / duration, 1)
      setCount(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
      else setCount(target)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

const COLORS = ['#1B3A6B', '#10B981', '#F8A303', '#EF4444']
const UNIT_COLORS = ['#1B3A6B', '#29ABE2', '#F9C234', '#E07B39', '#1B5FAD', '#10B981', '#8B5CF6']

function KpiCard({
  label, value, icon: Icon, color, sub, delay = '0s'
}: {
  label: string; value: number; icon: any; color: string; sub?: string; delay?: string
}) {
  const count = useCountUp(value)
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover animate-fade-in-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-extrabold text-gray-900 animate-count-up">{count.toLocaleString('pt-BR')}</p>
          <p className="text-sm text-gray-500 mt-1 font-medium">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill || p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [ranking, setRanking] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    Promise.all([
      api.get('/reports/dashboard'),
      api.get('/gamification/ranking?limit=5'),
    ])
      .then(([d, r]) => {
        setData(d.data)
        setRanking(r.data.ranking || [])
      })
      .catch(console.error)
  }, [])

  const totalTasks = data
    ? (data.tasks?.pending || 0) + (data.tasks?.in_progress || 0) +
      (data.tasks?.completed || 0) + (data.tasks?.overdue || 0)
    : 0

  const taskData = data
    ? [
        { name: 'Pendentes',     value: data.tasks?.pending     || 0 },
        { name: 'Em andamento',  value: data.tasks?.in_progress || 0 },
        { name: 'Concluídas',    value: data.tasks?.completed   || 0 },
        { name: 'Atrasadas',     value: data.tasks?.overdue     || 0 },
      ].filter(d => d.value > 0)
    : []

  const unitData = (data?.unitsRanking || []).slice(0, 6).map((u: any, i: number) => ({
    name: u.name.replace('Colégio Adventista de ', '').replace('Colégio Adventista do ', '').trim(),
    pontos: u.avgPoints,
    fill: UNIT_COLORS[i % UNIT_COLORS.length],
  }))

  const rankMedals = ['🥇', '🥈', '🥉']

  if (!mounted) return null

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Dashboard Geral</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visão em tempo real da rede APS Sul
          </p>
        </div>
        <div className="text-xs text-gray-400 bg-white rounded-xl px-3 py-2 border border-gray-100 shadow-sm">
          📅 {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Usuários Ativos" value={data?.totalActiveUsers || 0}
          icon={UsersIcon} color="bg-blue-50 text-blue-600" delay="0s"
        />
        <KpiCard
          label="Tarefas Ativas" value={(data?.tasks?.pending || 0) + (data?.tasks?.in_progress || 0)}
          icon={CheckCircleIcon} color="bg-emerald-50 text-emerald-600"
          sub={`${totalTasks} no total`} delay="0.1s"
        />
        <KpiCard
          label="Tarefas Atrasadas" value={data?.tasks?.overdue || 0}
          icon={ExclamationTriangleIcon} color="bg-red-50 text-red-600" delay="0.2s"
        />
        <KpiCard
          label="Eventos Ativos" value={(data?.events?.planned || 0) + (data?.events?.ongoing || 0)}
          icon={CalendarDaysIcon} color="bg-yellow-50 text-yellow-600"
          sub={`${data?.events?.completed || 0} concluídos`} delay="0.3s"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-fade-in-up delay-300">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Tarefas por Status</h2>
          <p className="text-xs text-gray-400 mb-4">{totalTasks} tarefas no sistema</p>
          {taskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={taskData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3}
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {taskData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-44 text-gray-300">
              <CheckCircleIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">Sem tarefas ainda</p>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-fade-in-up delay-400">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Pontuação Média por Unidade</h2>
          <p className="text-xs text-gray-400 mb-4">Engajamento médio da equipe (pts)</p>
          {unitData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={unitData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" fontSize={10} tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pontos" name="Média (pts)" radius={[6, 6, 0, 0]}>
                  {unitData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-44 text-gray-300">
              <ArrowTrendingUpIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">Sem dados de pontuação</p>
            </div>
          )}
        </div>
      </div>

      {/* Ranking + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top 5 Ranking */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up delay-500">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-700">🏆 Top 5 Ranking Geral</h2>
            <p className="text-xs text-gray-400 mt-0.5">Colaboradores com maior pontuação</p>
          </div>
          <div className="divide-y divide-gray-50">
            {ranking.length > 0 ? ranking.map((item: any, i: number) => (
              <div key={i} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${i === 0 ? 'bg-yellow-50/50' : ''}`}>
                <span className="text-xl w-8 text-center flex-shrink-0">
                  {i < 3 ? rankMedals[i] : <span className="text-sm font-bold text-gray-400">#{i + 1}</span>}
                </span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: '#1B3A6B' }}
                >
                  {(item.user?.name || 'U')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{item.user?.unit?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#1B3A6B' }}>
                    {item.points?.toLocaleString('pt-BR')} pts
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">Ranking carregando...</p>
              </div>
            )}
          </div>
        </div>

        {/* Smart Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up delay-600">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-700">⚡ Alertas Inteligentes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Situações que precisam de atenção</p>
          </div>
          <div className="p-4 space-y-3">
            {data?.alerts?.overdueTasksCount > 0 && (
              <div className="flex items-start gap-3 p-3.5 bg-red-50 rounded-xl border border-red-100">
                <span className="text-lg flex-shrink-0">🚨</span>
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {data.alerts.overdueTasksCount} tarefa{data.alerts.overdueTasksCount > 1 ? 's' : ''} em atraso
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">Requer atenção imediata da equipe</p>
                </div>
              </div>
            )}
            {(data?.alerts?.lowEngagementUnits || []).map((u: any) => (
              <div key={u.id} className="flex items-start gap-3 p-3.5 bg-yellow-50 rounded-xl border border-yellow-100">
                <span className="text-lg flex-shrink-0">📉</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    {u.name.replace('Colégio Adventista de ', '').replace('Sede APS — ', '')}
                  </p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    Baixo engajamento — Média: {u.avgPoints} pts
                  </p>
                </div>
              </div>
            ))}
            {data?.tasks?.completed > 0 && (
              <div className="flex items-start gap-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-lg flex-shrink-0">✅</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    {data.tasks.completed} tarefa{data.tasks.completed > 1 ? 's' : ''} concluída{data.tasks.completed > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">Ótimo progresso da equipe!</p>
                </div>
              </div>
            )}
            {!data?.alerts?.overdueTasksCount && !data?.alerts?.lowEngagementUnits?.length && !data?.tasks?.completed && (
              <div className="text-center py-8 text-gray-400">
                <BellAlertIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Carregando alertas...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
