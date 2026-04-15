'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#1B5E8C', '#27AE60', '#F39C12', '#E74C3C']

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [ranking, setRanking] = useState<any[]>([])

  useEffect(() => {
    Promise.all([api.get('/reports/dashboard'), api.get('/gamification/ranking?limit=5')])
      .then(([d, r]) => { setData(d.data); setRanking(r.data.ranking || []) })
      .catch(console.error)
  }, [])

  const taskData = data ? [
    { name: 'Pendentes', value: data.tasks.pending || 0 },
    { name: 'Em andamento', value: data.tasks.in_progress || 0 },
    { name: 'Concluídas', value: data.tasks.completed || 0 },
    { name: 'Atrasadas', value: data.tasks.overdue || 0 },
  ] : []

  const unitData = (data?.unitsRanking || []).slice(0, 6).map((u: any) => ({
    name: u.name.length > 15 ? u.name.substring(0, 15) + '...' : u.name,
    pontos: u.avgPoints
  }))

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Geral</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Usuários Ativos', value: data?.totalActiveUsers || 0, icon: '👥', color: 'bg-blue-50 text-blue-600' },
          { label: 'Tarefas Ativas', value: (data?.tasks?.pending || 0) + (data?.tasks?.in_progress || 0), icon: '✅', color: 'bg-green-50 text-green-600' },
          { label: 'Tarefas Atrasadas', value: data?.tasks?.overdue || 0, icon: '⚠️', color: 'bg-red-50 text-red-600' },
          { label: 'Eventos Ativos', value: (data?.events?.planned || 0) + (data?.events?.ongoing || 0), icon: '📅', color: 'bg-yellow-50 text-yellow-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <span className="text-xl">{kpi.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tarefas por status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Tarefas por Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={taskData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({name, value}) => `${name}: ${value}`} labelLine={false}>
                {taskData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking de unidades */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Pontuação Média por Unidade</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={unitData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="pontos" fill="#1B5E8C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Ranking */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-4">🏆 Top 5 Ranking Geral</h2>
          <div className="space-y-3">
            {ranking.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xl w-8">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {(item.user?.name || 'U')[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.user?.name}</p>
                  <p className="text-xs text-gray-400">{item.user?.unit?.name}</p>
                </div>
                <span className="text-sm font-bold text-blue-600">{item.points} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-4">⚠️ Alertas Inteligentes</h2>
          <div className="space-y-3">
            {data?.alerts?.overdueTasksCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <span className="text-lg">🚨</span>
                <div>
                  <p className="text-sm font-medium text-red-700">{data.alerts.overdueTasksCount} tarefas atrasadas</p>
                  <p className="text-xs text-red-500">Requer atenção imediata</p>
                </div>
              </div>
            )}
            {(data?.alerts?.lowEngagementUnits || []).map((u: any) => (
              <div key={u.id} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <span className="text-lg">📉</span>
                <div>
                  <p className="text-sm font-medium text-yellow-700">{u.name}</p>
                  <p className="text-xs text-yellow-500">Baixo engajamento — Média: {u.avgPoints} pts</p>
                </div>
              </div>
            ))}
            {!data?.alerts?.overdueTasksCount && !data?.alerts?.lowEngagementUnits?.length && (
              <div className="text-center text-gray-400 py-8">
                <span className="text-4xl">✅</span>
                <p className="mt-2 text-sm">Tudo em ordem!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
