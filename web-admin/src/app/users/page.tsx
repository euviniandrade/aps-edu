'use client'
import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  MagnifyingGlassIcon, PlusIcon, XMarkIcon, UserIcon,
  CheckCircleIcon, EnvelopeIcon, PhoneIcon
} from '@heroicons/react/24/outline'

const ROLE_CHIP: Record<string, { bg: string; color: string }> = {
  admin:         { bg: 'rgba(167,139,250,0.12)', color: '#A78BFA' },
  director:      { bg: 'rgba(74,158,255,0.12)',  color: '#4A9EFF' },
  vice_director: { bg: 'rgba(56,189,248,0.12)',  color: '#38BDF8' },
  coordinator:   { bg: 'rgba(10,189,120,0.12)',  color: '#0ABD78' },
  chaplain:      { bg: 'rgba(52,211,153,0.12)',  color: '#34D399' },
  treasurer:     { bg: 'rgba(249,194,52,0.12)',  color: '#F9C234' },
  disciplinary:  { bg: 'rgba(224,123,57,0.12)',  color: '#E07B39' },
  counselor:     { bg: 'rgba(255,71,87,0.12)',   color: '#FF6B7A' },
  secretary:     { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' },
}

const AVATAR_COLORS = [
  '#F8A303','#4A9EFF','#E07B39','#0ABD78','#8B5CF6','#F9C234','#FF4757','#29ABE2'
]

// shared dark field style
const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function UsersPage() {
  const [users, setUsers]             = useState<any[]>([])
  const [roles, setRoles]             = useState<any[]>([])
  const [units, setUnits]             = useState<any[]>([])
  const [search, setSearch]           = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [savedUser, setSavedUser]     = useState('')
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
          <h1 className="text-2xl font-extrabold text-white">Usuários</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {users.length} colaborador{users.length !== 1 ? 'es' : ''} cadastrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #F8A303, #FDC347)',
            color: '#000',
            boxShadow: '0 4px 20px rgba(248,163,3,0.3)',
          }}
        >
          <PlusIcon className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Success toast */}
      {savedUser && (
        <div
          className="mb-4 flex items-center gap-2 p-3.5 rounded-xl text-sm font-medium animate-scale-in"
          style={{ background: 'rgba(10,189,120,0.12)', border: '1px solid rgba(10,189,120,0.2)', color: '#0ABD78' }}
        >
          <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
          Usuário <strong className="mx-1">{savedUser}</strong> criado com sucesso!
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 animate-fade-in-up">
        <div className="relative">
          <MagnifyingGlassIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          />
          <input
            type="search"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl text-sm w-72 outline-none transition-all"
            style={darkField}
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm outline-none"
          style={darkField}
        >
          <option value="">Todos os cargos</option>
          {roles.map((r: any) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
        <span
          className="ml-auto text-xs self-center"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden animate-fade-in-up delay-100"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-12 rounded-xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <UserIcon className="w-12 h-12 mb-3" />
            <p className="font-medium">Nenhum usuário encontrado</p>
            <p className="text-xs mt-1">Tente ajustar o filtro de busca</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Usuário</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.35)' }}>Cargo</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: 'rgba(255,255,255,0.35)' }}>Unidade</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Pontos</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.35)' }}>Tarefas</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user: any, idx: number) => {
                const chip = ROLE_CHIP[user.role?.slug] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
                return (
                  <tr
                    key={user.id}
                    className="transition-colors group"
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: avatarColor(user.name), boxShadow: '0 0 0 2px rgba(255,255,255,0.08)' }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{user.name}</p>
                          <p className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            <EnvelopeIcon className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.color}30` }}
                      >
                        {user.role?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell max-w-[180px]">
                      <p className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {user.unit?.name || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-bold" style={{ color: '#F8A303' }}>
                        {(user.userPoints?.points || 0).toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center hidden md:table-cell">
                      <span className="font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {user.userPoints?.tasksCompleted || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={
                          user.isActive !== false
                            ? { background: 'rgba(10,189,120,0.1)', color: '#0ABD78', border: '1px solid rgba(10,189,120,0.2)' }
                            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: user.isActive !== false ? '#0ABD78' : 'rgba(255,255,255,0.3)' }}
                        />
                        {user.isActive !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CREATE USER MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowModal(false)}
          />
          <div
            className="relative rounded-2xl w-full max-w-lg animate-scale-in"
            style={{
              background: 'rgba(10,12,28,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(248,163,3,0.15)', border: '1px solid rgba(248,163,3,0.2)' }}
                >
                  <UserIcon className="w-4 h-4" style={{ color: '#F8A303' }} />
                </div>
                <h2 className="text-white font-bold">Novo Colaborador</h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'rgba(255,255,255,0.4)' }}>
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Nome Completo *
                  </label>
                  <input
                    required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: João da Silva"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={darkField}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    E-mail *
                  </label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <input
                      required type="email" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@aps.edu.br"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                      style={darkField}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Cargo *
                  </label>
                  <select
                    required value={form.roleId}
                    onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={darkField}
                  >
                    <option value="">Selecionar...</option>
                    {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Unidade *
                  </label>
                  <select
                    required value={form.unitId}
                    onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={darkField}
                  >
                    <option value="">Selecionar...</option>
                    {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Telefone
                  </label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                      style={darkField}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Senha Inicial
                  </label>
                  <input
                    required value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={darkField}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                  style={{
                    background: saving ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #F8A303, #FDC347)',
                    color: saving ? 'rgba(255,255,255,0.4)' : '#000',
                    boxShadow: saving ? 'none' : '0 4px 16px rgba(248,163,3,0.3)',
                  }}
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
