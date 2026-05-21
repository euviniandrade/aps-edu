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
function useCountUp(target: number, duration = 1400) {
  const [count, setCount] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (!target) { setCount(0); return }
    start.current = null
    const step = (ts: number) => {
      if (!start.current) start.current = ts
      const p = Math.min((ts - start.current) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(eased * target))
      if (p < 1) requestAnimationFrame(step)
      else setCount(target)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

const CHART_COLORS = ['#4A9EFF', '#0ABD78', '#F8A303', '#FF4757']
const UNIT_COLORS  = ['#F8A303', '#4A9EFF', '#0ABD78', '#8B5CF6', '#29ABE2', '#F9C234', '#E07B39']

function KpiCard({
  label, value, icon: Icon, accentColor, sub, delay = '0s'
}: {
  label: string; value: number; icon: any
  accentColor: string; sub?: string; delay?: string
}) {
  const count = useCountUp(value)
  return (
    <div
      className="rounded-2xl p-5 animate-fade-in-up relative overflow-hidden group transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        animationDelay: delay,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Glow accent */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)` }}
      />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p
            className="text-3xl font-extrabold leading-none"
            style={{ color: accentColor }}
          >
            {count.toLocaleString('pt-BR')}
          </p>
          <p className="text-sm mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {label}
          </p>
          {sub && (
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {sub}
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  )
}

const DarkTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-xl p-3 text-sm"
        style={{
          background: 'rgba(10,12,28,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <p className="font-semibold text-white mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-xs" style={{ color: p.fill || p.color }}>
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
        { name: 'Pendentes',    value: data.tasks?.pending     || 0 },
        { name: 'Em andamento', value: data.tasks?.in_progress || 0 },
        { name: 'Concluídas',   value: data.tasks?.completed   || 0 },
        { name: 'Atrasadas',    value: data.tasks?.overdue     || 0 },
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
          <h1 className="text-2xl font-extrabold text-white">Dashboard Geral</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Visão em tempo real da rede APS Sul
          </p>
        </div>
        <div
          className="text-xs px-3 py-2 rounded-xl hidden sm:block"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          📅 {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Usuários Ativos" value={data?.totalActiveUsers || 0}
          icon={UsersIcon} accentColor="#4A9EFF" delay="0s"
        />
        <KpiCard
          label="Tarefas Ativas" value={(data?.tasks?.pending || 0) + (data?.tasks?.in_progress || 0)}
          icon={CheckCircleIcon} accentColor="#0ABD78"
          sub={`${totalTasks} no total`} delay="0.1s"
        />
        <KpiCard
          label="Tarefas Atrasadas" value={data?.tasks?.overdue || 0}
          icon={ExclamationTriangleIcon} accentColor="#FF4757" delay="0.2s"
        />
        <KpiCard
          label="Eventos Ativos" value={(data?.events?.planned || 0) + (data?.events?.ongoing || 0)}
          icon={CalendarDaysIcon} accentColor="#F8A303"
          sub={`${data?.events?.completed || 0} concluídos`} delay="0.3s"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Pie chart */}
        <div
          className="rounded-2xl p-5 animate-fade-in-up delay-300"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <h2 className="text-sm font-semibold text-white mb-0.5">Tarefas por Status</h2>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {totalTasks} tarefas no sistema
          </p>
          {taskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={taskData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={4}
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {taskData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  iconType="circle" iconSize={7}
                  formatter={(value) => (
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-44" style={{ color: 'rgba(255,255,255,0.15)' }}>
              <CheckCircleIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">Sem tarefas ainda</p>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div
          className="rounded-2xl p-5 animate-fade-in-up delay-400"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <h2 className="text-sm font-semibold text-white mb-0.5">Pontuação Média por Unidade</h2>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Engajamento médio da equipe (pts)
          </p>
          {unitData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={unitData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name" fontSize={10}
                  tick={{ fill: 'rgba(255,255,255,0.3)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  fontSize={10}
                  tick={{ fill: 'rgba(255,255,255,0.3)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="pontos" name="Média (pts)" radius={[6, 6, 0, 0]}>
                  {unitData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-44" style={{ color: 'rgba(255,255,255,0.15)' }}>
              <ArrowTrendingUpIcon className="w-12 h-12 mb-2" />
              <p className="text-sm">Sem dados de pontuação</p>
            </div>
          )}
        </div>
      </div>

      {/* Ranking + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top 5 Ranking */}
        <div
          className="rounded-2xl overflow-hidden animate-fade-in-up delay-500"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="font-semibold text-white text-sm">🏆 Top 5 Ranking Geral</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Colaboradores com maior pontuação
            </p>
          </div>
          <div>
            {ranking.length > 0 ? ranking.map((item: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-3.5 transition-all duration-200"
                style={{
                  borderBottom: i < ranking.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: i === 0 ? 'rgba(248,163,3,0.05)' : 'transparent',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = i === 0 ? 'rgba(248,163,3,0.05)' : 'transparent' }}
              >
                <span className="text-xl w-8 text-center flex-shrink-0">
                  {i < 3
                    ? rankMedals[i]
                    : <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>#{i + 1}</span>
                  }
                </span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                    color: '#000',
                    boxShadow: '0 0 8px rgba(248,163,3,0.3)',
                  }}
                >
                  {(item.user?.name || 'U')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.user?.name}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {item.user?.unit?.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#F8A303' }}>
                    {item.points?.toLocaleString('pt-BR')} pts
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <p className="text-sm">Carregando ranking...</p>
              </div>
            )}
          </div>
        </div>

        {/* Smart Alerts */}
        <div
          className="rounded-2xl overflow-hidden animate-fade-in-up delay-600"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="font-semibold text-white text-sm">⚡ Alertas Inteligentes</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Situações que precisam de atenção
            </p>
          </div>
          <div className="p-4 space-y-3">
            {data?.alerts?.overdueTasksCount > 0 && (
              <div
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{
                  background: 'rgba(255,71,87,0.08)',
                  border: '1px solid rgba(255,71,87,0.18)',
                }}
              >
                <span className="text-lg flex-shrink-0">🚨</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#FF4757' }}>
                    {data.alerts.overdueTasksCount} tarefa{data.alerts.overdueTasksCount > 1 ? 's' : ''} em atraso
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,71,87,0.65)' }}>
                    Requer atenção imediata da equipe
                  </p>
                </div>
              </div>
            )}
            {(data?.alerts?.lowEngagementUnits || []).map((u: any) => (
              <div
                key={u.id}
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{
                  background: 'rgba(249,194,52,0.07)',
                  border: '1px solid rgba(249,194,52,0.16)',
                }}
              >
                <span className="text-lg flex-shrink-0">📉</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F9C234' }}>
                    {u.name.replace('Colégio Adventista de ', '').replace('Sede APS — ', '')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(249,194,52,0.6)' }}>
                    Baixo engajamento — Média: {u.avgPoints} pts
                  </p>
                </div>
              </div>
            ))}
            {data?.tasks?.completed > 0 && (
              <div
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{
                  background: 'rgba(10,189,120,0.08)',
                  border: '1px solid rgba(10,189,120,0.18)',
                }}
              >
                <span className="text-lg flex-shrink-0">✅</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#0ABD78' }}>
                    {data.tasks.completed} tarefa{data.tasks.completed > 1 ? 's' : ''} concluída{data.tasks.completed > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(10,189,120,0.6)' }}>
                    Ótimo progresso da equipe!
                  </p>
                </div>
              </div>
            )}
            {!data && (
              <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
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
