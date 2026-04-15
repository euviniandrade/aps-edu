'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await api.get('/users', { params: { search: search || undefined, limit: 100 } })
      setUsers(res.data)
    } catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    director: 'bg-blue-100 text-blue-700',
    vice_director: 'bg-cyan-100 text-cyan-700',
    coordinator: 'bg-green-100 text-green-700',
    chaplain: 'bg-orange-100 text-orange-700',
    treasurer: 'bg-yellow-100 text-yellow-700',
    disciplinary: 'bg-red-100 text-red-700',
    counselor: 'bg-pink-100 text-pink-700',
    secretary: 'bg-gray-100 text-gray-700',
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Novo Usuário</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <input type="search" placeholder="Buscar por nome..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuário</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Função</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Unidade</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Pontos</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Tarefas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {(user.name || 'U')[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role?.slug] || 'bg-gray-100 text-gray-600'}`}>
                      {user.role?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.unit?.name}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{user.userPoints?.points || 0}</td>
                  <td className="px-4 py-3 text-gray-600">{user.userPoints?.tasksCompleted || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  )
}
