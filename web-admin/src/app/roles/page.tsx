'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  director: 'Diretor',
  vice_director: 'Vice-Diretor',
  coordinator: 'Coordenador',
  chaplain: 'Capelão',
  treasurer: 'Tesoureiro',
  disciplinary: 'Disciplinar',
  counselor: 'Orientador',
  secretary: 'Secretária',
}

const PERM_LABELS: Record<string, string> = {
  canCreateTasks: 'Criar Tarefas',
  canCreateEvents: 'Criar Eventos',
  canPublishAnnouncements: 'Publicar Avisos',
  canViewAllData: 'Ver Todos os Dados',
  canManageUsers: 'Gerenciar Usuários',
  canViewReports: 'Ver Relatórios',
  canGrantBadges: 'Conceder Selos',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  director: 'bg-blue-100 text-blue-800 border-blue-200',
  vice_director: 'bg-sky-100 text-sky-800 border-sky-200',
  coordinator: 'bg-teal-100 text-teal-800 border-teal-200',
  chaplain: 'bg-green-100 text-green-800 border-green-200',
  treasurer: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  disciplinary: 'bg-orange-100 text-orange-800 border-orange-200',
  counselor: 'bg-pink-100 text-pink-800 border-pink-200',
  secretary: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/users?limit=200')])
      .then(([r, u]) => {
        setRoles(r.data)
        setUsers(u.data.users || u.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const countByRole = (slug: string) => users.filter((u: any) => u.role?.slug === slug).length

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cargos e Permissões</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visão geral de todos os cargos da rede e suas permissões no sistema
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {roles.map((role: any) => (
          <div
            key={role.id}
            className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center"
          >
            <div
              className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2 border ${
                ROLE_COLORS[role.slug] || 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              <KeyIcon className="w-5 h-5" />
            </div>
            <p className="text-xl font-bold text-gray-900">{countByRole(role.slug)}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{role.name}</p>
          </div>
        ))}
      </div>

      {/* Roles table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Matriz de Permissões</h2>
          <p className="text-xs text-gray-400 mt-0.5">O que cada cargo pode fazer no sistema</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-44">Cargo</th>
                {Object.values(PERM_LABELS).map((label) => (
                  <th key={label} className="text-center px-3 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">
                    {label}
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Membros</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role: any, idx: number) => {
                const perms = role.permissions || {}
                return (
                  <tr
                    key={role.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-gray-50/40'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          ROLE_COLORS[role.slug] || 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {role.name}
                      </span>
                    </td>
                    {Object.keys(PERM_LABELS).map((key) => (
                      <td key={key} className="text-center px-3 py-3.5">
                        {perms[key] ? (
                          <CheckCircleIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-gray-200 mx-auto" />
                        )}
                      </td>
                    ))}
                    <td className="text-center px-4 py-3.5">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        {countByRole(role.slug)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-role user list */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {roles
          .filter((r: any) => countByRole(r.slug) > 0)
          .map((role: any) => {
            const roleUsers = users.filter((u: any) => u.role?.slug === role.slug)
            return (
              <div key={role.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      ROLE_COLORS[role.slug] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {role.name}
                  </span>
                  <span className="text-xs text-gray-400">{roleUsers.length} membro{roleUsers.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {roleUsers.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: '#1B3A6B' }}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.unit?.name || '—'}</p>
                      </div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </AdminLayout>
  )
}
