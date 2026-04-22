'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  BuildingLibraryIcon,
  MapPinIcon,
  UsersIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const TYPE_LABELS: Record<string, string> = {
  school: 'Colégio',
  department: 'Departamento',
  headquarters: 'Sede',
}

const TYPE_COLORS: Record<string, string> = {
  school: 'bg-blue-50 text-blue-700 border-blue-200',
  department: 'bg-teal-50 text-teal-700 border-teal-200',
  headquarters: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function UnitsPage() {
  const [units, setUnits] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', type: 'school', region: '' })

  const load = () => {
    setLoading(true)
    Promise.all([api.get('/units'), api.get('/users?limit=200')])
      .then(([u, usr]) => {
        setUnits(u.data)
        setUsers(usr.data.users || usr.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const countByUnit = (unitId: string) => users.filter((u: any) => u.unitId === unitId || u.unit?.id === unitId).length

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/units', form)
      setSaved(true)
      setShowForm(false)
      setForm({ name: '', city: '', type: 'school', region: '' })
      load()
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar unidade')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  const totalUsers = users.filter((u: any) => u.isActive !== false).length
  const schools = units.filter((u: any) => u.type === 'school').length

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades Educacionais</h1>
          <p className="text-sm text-gray-500 mt-1">
            {units.length} unidade{units.length !== 1 ? 's' : ''} cadastrada{units.length !== 1 ? 's' : ''} na rede APS Sul
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#1B3A6B' }}
        >
          <PlusIcon className="w-4 h-4" />
          Nova Unidade
        </button>
      </div>

      {/* Success toast */}
      {saved && (
        <div className="mb-4 flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          <CheckCircleIcon className="w-5 h-5" />
          Unidade criada com sucesso!
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Nova Unidade</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Nome da Unidade *
              </label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Colégio Adventista de São Paulo"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Cidade *
              </label>
              <input
                required
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Ex: São Paulo"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Tipo
              </label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                <option value="school">Colégio</option>
                <option value="department">Departamento</option>
                <option value="headquarters">Sede</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Região / Estado
              </label>
              <input
                value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                placeholder="Ex: SP"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#1B3A6B' }}
              >
                {saving ? 'Salvando...' : 'Criar Unidade'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total de Unidades', value: units.length, icon: BuildingLibraryIcon, color: 'bg-blue-50 text-blue-600' },
          { label: 'Colégios', value: schools, icon: BuildingLibraryIcon, color: 'bg-teal-50 text-teal-600' },
          { label: 'Colaboradores Ativos', value: totalUsers, icon: UsersIcon, color: 'bg-purple-50 text-purple-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Units grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {units.map((unit: any) => {
          const memberCount = countByUnit(unit.id)
          const unitUsers = users
            .filter((u: any) => u.unitId === unit.id || u.unit?.id === unit.id)
            .slice(0, 4)

          return (
            <div
              key={unit.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Card header */}
              <div className="p-5 border-b border-gray-50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#EEF3FA' }}
                  >
                    <BuildingLibraryIcon className="w-5 h-5" style={{ color: '#1B3A6B' }} />
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                      TYPE_COLORS[unit.type] || 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {TYPE_LABELS[unit.type] || unit.type}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{unit.name}</h3>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                  <MapPinIcon className="w-3.5 h-3.5" />
                  {unit.city}{unit.region ? `, ${unit.region}` : ''}
                </div>
              </div>

              {/* Card body */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <UsersIcon className="w-4 h-4" />
                    <span>{memberCount} colaborador{memberCount !== 1 ? 'es' : ''}</span>
                  </div>
                </div>

                {/* User avatars */}
                {unitUsers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {unitUsers.map((u: any) => (
                        <div
                          key={u.id}
                          title={u.name}
                          className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: '#1B3A6B' }}
                        >
                          {u.name.charAt(0)}
                        </div>
                      ))}
                      {memberCount > 4 && (
                        <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-600 text-[10px] font-bold">
                          +{memberCount - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 ml-1">
                      {unitUsers[0]?.name?.split(' ')[0]}
                      {memberCount > 1 ? ` e mais ${memberCount - 1}` : ''}
                    </span>
                  </div>
                )}

                {memberCount === 0 && (
                  <p className="text-xs text-gray-400 italic">Sem colaboradores cadastrados</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </AdminLayout>
  )
}
