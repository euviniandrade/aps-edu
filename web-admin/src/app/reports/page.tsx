'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

export default function ReportsPage() {
  const [units, setUnits] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedUnit, setSelectedUnit] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/units'), api.get('/users?limit=200')]).then(([u, us]) => {
      setUnits(u.data || []); setUsers(us.data || [])
    })
  }, [])

  const generateUnitReport = async () => {
    if (!selectedUnit) return
    setLoading(true)
    try {
      const res = await api.get(`/reports/unit/${selectedUnit}`)
      setReport({ type: 'unit', data: res.data })
    } catch (_) {} finally { setLoading(false) }
  }

  const generateUserReport = async () => {
    if (!selectedUser) return
    setLoading(true)
    try {
      const res = await api.get(`/reports/user/${selectedUser}`)
      setReport({ type: 'user', data: res.data })
    } catch (_) {} finally { setLoading(false) }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatórios</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Relatório por unidade */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-4">📊 Relatório por Unidade</h2>
          <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecionar unidade...</option>
            {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={generateUnitReport} disabled={!selectedUnit || loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            Gerar Relatório
          </button>
        </div>

        {/* Relatório por usuário */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-4">👤 Relatório Individual</h2>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecionar usuário...</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.role?.name}</option>)}
          </select>
          <button onClick={generateUserReport} disabled={!selectedUser || loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            Gerar Relatório
          </button>
        </div>
      </div>

      {/* Resultado */}
      {loading && <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}

      {report && !loading && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">📄 Resultado</h2>
            <span className="text-xs text-gray-400">Gerado em {new Date(report.data.generatedAt).toLocaleString('pt-BR')}</span>
          </div>

          {report.type === 'unit' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Unidade', value: report.data.unit?.name },
                { label: 'Total Tarefas', value: report.data.tasks?.total },
                { label: 'Concluídas', value: `${report.data.tasks?.completed} (${report.data.tasks?.completionRate}%)` },
                { label: 'Usuários', value: report.data.users?.total },
                { label: 'Eventos', value: report.data.events?.total },
                { label: 'Eventos Concluídos', value: report.data.events?.completed },
                { label: 'Progresso Médio', value: `${report.data.events?.avgProgress}%` },
                { label: 'Atrasadas', value: report.data.tasks?.overdue },
              ].map(kpi => (
                <div key={kpi.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
                </div>
              ))}
            </div>
          )}

          {report.type === 'user' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Usuário', value: report.data.user?.name },
                { label: 'Função', value: report.data.user?.role },
                { label: 'Tarefas Total', value: report.data.tasks?.total },
                { label: 'Concluídas', value: `${report.data.tasks?.completed} (${report.data.tasks?.completionRate}%)` },
                { label: 'No Prazo', value: `${report.data.tasks?.onTimeRate}%` },
                { label: 'Pontos', value: report.data.gamification?.points },
                { label: 'Nível', value: report.data.gamification?.level?.name },
                { label: 'Selos', value: report.data.gamification?.badgesEarned },
              ].map(kpi => (
                <div key={kpi.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className="text-lg font-bold text-gray-900">{kpi.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
