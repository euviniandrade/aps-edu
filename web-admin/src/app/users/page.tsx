'use client'
import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  MagnifyingGlassIcon, PlusIcon, XMarkIcon, UserIcon,
  CheckCircleIcon, EnvelopeIcon, PhoneIcon
} from '@heroicons/react/24/outline'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  director: 'bg-blue-100 text-blue-700 border-blue-200',
  vice_director: 'bg-sky-100 text-sky-700 border-sky-200',
  coordinator: 'bg-teal-100 text-teal-700 border-teal-200',
  chaplain: 'bg-green-100 text-green-700 border-green-200',
  treasurer: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  disciplinary: 'bg-orange-100 text-orange-700 border-orange-200',
  counselor: 'bg-pink-100 text-pink-700 border-pink-200',
  secretary: 'bg-gray-100 text-gray-700 border-gray-200',
}

const AVATAR_COLORS = [
  '#1B3A6B','#29ABE2','#E07B39','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4'
]

export default function UsersPage() {
  const [users, setUsers]       = useState<any[]>([])
  const [roles, setRoles]       = useState<any[]>([])
  const [units, setUnits]       = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [savedUser, setSavedUser] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: 'Teste@123', phone: '', roleId: '', unitId: ''
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, r, un] = await Promise.all([
        api.get('/users', { params: { search: search || undefined, limit: 200 } }),
        api.get('/roles'),
        api.get('/units'),
      ])
      const raw = u.data?.users || u.data || []
      setUsers(raw)
      setRoles(r.data || [])
      setUnits(un.data || [])
    } catch (_) {}
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const filtered = filterRole
    ? users.filter((u: any) => u.role?.slug === filterRole)
    : users

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/users', form)
      setSavedUser(res.data?.name || form.name)
      setShowModal(false)
      setForm({ name: '', email: '', password: 'Teste@123', phone: '', roleId: '', unitId: '' })
      await load()
      setTimeout(() => setSavedUser(''), 4000)
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erro ao criar usuário')
    } finally {
      setSaving(false)
    }
  }

  const avatarColor = (name: string) =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} colaborador{users.length !== 1 ? 'es' : ''} cadastrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: '#1B3A6B' }}
        >
          <PlusIcon className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Success toast */}
      {savedUser && (
        <div className="mb-4 flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium animate-scale-in">
          <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
          Usuário <strong className="mx-1">{savedUser}</strong> criado com sucesso!
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 animate-fade-in-up">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm w-72 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white"
        >
          <option value="">Todos os cargos</option>
          {roles.map((r: any) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-400 self-center">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up delay-100">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum usuário encontrado</p>
            <p className="text-xs mt-1">Tente ajustar o filtro de busca</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Usuário</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600 hidden md:table-cell">Cargo</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600 hidden lg:table-cell">Unidade</th>
                <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Pontos</th>
                <th className="text-center px-4 py-3.5 font-semibold text-gray-600 hidden md:table-cell">Tarefas</th>
                <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((user: any) => (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ring-2 ring-white"
                        style={{ backgroundColor: avatarColor(user.name) }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <EnvelopeIcon className="w-3 h-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        ROLE_COLORS[user.role?.slug] || 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {user.role?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-xs hidden lg:table-cell max-w-[180px]">
                    <p className="truncate">{user.unit?.name || '—'}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="font-bold text-blue-600">
                      {(user.userPoints?.points || 0).toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center hidden md:table-cell">
                    <span className="text-gray-700 font-medium">
                      {user.userPoints?.tasksCompleted || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.isActive !== false
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {user.isActive !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CREATE USER MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
              style={{ background: 'linear-gradient(135deg, #1B3A6B, #2A5298)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-white font-bold">Novo Colaborador</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Nome Completo *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: João da Silva"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    E-mail *
                  </label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@aps.edu.br"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Cargo *
                  </label>
                  <select
                    required
                    value={form.roleId}
                    onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="">Selecionar...</option>
                    {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Unidade *
                  </label>
                  <select
                    required
                    value={form.unitId}
                    onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="">Selecionar...</option>
                    {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Telefone
                  </label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Senha Inicial
                  </label>
                  <input
                    required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#1B3A6B' }}
                >
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Criando...</>
                  ) : (
                    <><CheckCircleIcon className="w-4 h-4" /> Criar Usuário</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
