'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { KeyIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const PERM_LABELS: Record<string, string> = {
  canCreateTasks: 'Criar Tarefas',
  canCreateEvents: 'Criar Eventos',
  canPublishAnnouncements: 'Publicar Avisos',
  canViewAllData: 'Ver Todos os Dados',
  canManageUsers: 'Gerenciar Usuários',
  canViewReports: 'Ver Relatórios',
  canGrantBadges: 'Conceder Selos',
}

const ROLE_CHIP: Record<string, { bg: string; color: string }> = {
  admin:         { bg: 'rgba(167,139,250,0.15)', color: '#A78BFA' },
  director:      { bg: 'rgba(74,158,255,0.15)',  color: '#4A9EFF' },
  vice_director: { bg: 'rgba(56,189,248,0.15)',  color: '#38BDF8' },
  coordinator:   { bg: 'rgba(10,189,120,0.15)',  color: '#0ABD78' },
  chaplain:      { bg: 'rgba(52,211,153,0.15)',  color: '#34D399' },
  treasurer:     { bg: 'rgba(249,194,52,0.15)',  color: '#F9C234' },
  disciplinary:  { bg: 'rgba(224,123,57,0.15)',  color: '#E07B39' },
  counselor:     { bg: 'rgba(255,71,87,0.12)',   color: '#FF6B7A' },
  secretary:     { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' },
}
const AVATAR_POOL = ['#F8A303','#4A9EFF','#0ABD78','#8B5CF6','#FF4757','#29ABE2','#F9C234','#E07B39']

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
  const avatarColor = (name: string) => AVATAR_POOL[(name?.charCodeAt(0) || 0) % AVATAR_POOL.length]

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-extrabold text-white">Cargos e Permissões</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Visão geral de todos os cargos da rede e suas permissões no sistema
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-8 animate-fade-in-up">
        {roles.map((role: any) => {
          const chip = ROLE_CHIP[role.slug] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
          return (
            <div
              key={role.id}
              className="rounded-2xl p-4 text-center transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2"
                style={{ background: chip.bg, border: `1px solid ${chip.color}30` }}
              >
                <KeyIcon className="w-5 h-5" style={{ color: chip.color }} />
              </div>
              <p className="text-xl font-bold text-white">{countByRole(role.slug)}</p>
              <p className="text-xs mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>{role.name}</p>
            </div>
          )
        })}
      </div>

      {/* Permission matrix */}
      <div
        className="rounded-2xl overflow-hidden mb-6 animate-fade-in-up delay-100"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-semibold text-white text-sm">Matriz de Permissões</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>O que cada cargo pode fazer no sistema</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-5 py-3 w-44 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Cargo
                </th>
                {Object.values(PERM_LABELS).map((label) => (
                  <th
                    key={label}
                    className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {label}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Membros
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role: any, idx: number) => {
                const perms = role.permissions || {}
                const chip = ROLE_CHIP[role.slug] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
                return (
                  <tr
                    key={role.id}
                    style={{ borderBottom: idx < roles.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.color}30` }}
                      >
                        {role.name}
                      </span>
                    </td>
                    {Object.keys(PERM_LABELS).map((key) => (
                      <td key={key} className="text-center px-3 py-3.5">
                        {perms[key] ? (
                          <CheckCircleIcon className="w-5 h-5 mx-auto" style={{ color: '#0ABD78' }} />
                        ) : (
                          <XCircleIcon className="w-5 h-5 mx-auto" style={{ color: 'rgba(255,255,255,0.1)' }} />
                        )}
                      </td>
                    ))}
                    <td className="text-center px-4 py-3.5">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={{ background: chip.bg, color: chip.color }}
                      >
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

      {/* Per-role user lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up delay-200">
        {roles
          .filter((r: any) => countByRole(r.slug) > 0)
          .map((role: any) => {
            const roleUsers = users.filter((u: any) => u.role?.slug === role.slug)
            const chip = ROLE_CHIP[role.slug] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
            return (
              <div
                key={role.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.color}30` }}
                  >
                    {role.name}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {roleUsers.length} membro{roleUsers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div>
                  {roleUsers.map((u: any, i: number) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors"
                      style={{ borderBottom: i < roleUsers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: avatarColor(u.name) }}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name}</p>
                        <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{u.unit?.name || '—'}</p>
                      </div>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: u.isActive ? '#0ABD78' : 'rgba(255,255,255,0.2)' }}
                      />
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
