'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  BuildingLibraryIcon, MapPinIcon, UsersIcon,
  PlusIcon, XMarkIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'

const TYPE_LABELS: Record<string, string> = {
  school: 'Colégio', department: 'Departamento', headquarters: 'Sede',
}
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  school:       { bg: 'rgba(74,158,255,0.12)',  color: '#4A9EFF' },
  department:   { bg: 'rgba(10,189,120,0.12)',  color: '#0ABD78' },
  headquarters: { bg: 'rgba(139,92,246,0.12)',  color: '#A78BFA' },
}
const UNIT_GRADIENT_BG = [
  'linear-gradient(135deg, rgba(74,158,255,0.15), rgba(139,92,246,0.08))',
  'linear-gradient(135deg, rgba(248,163,3,0.12), rgba(224,123,57,0.08))',
  'linear-gradient(135deg, rgba(10,189,120,0.12), rgba(41,171,226,0.08))',
  'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(255,71,87,0.08))',
]
const AVATAR_POOL = ['#F8A303','#4A9EFF','#0ABD78','#8B5CF6','#FF4757','#29ABE2','#F9C234','#E07B39']

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function UnitsPage() {
  const [units, setUnits]   = useState<any[]>([])
  const [users, setUsers]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
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

  const countByUnit = (unitId: string) =>
    users.filter((u: any) => u.unitId === unitId || u.unit?.id === unitId).length

  const avatarColor = (name: string) => AVATAR_POOL[(name?.charCodeAt(0) || 0) % AVATAR_POOL.length]

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
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
        </div>
      </AdminLayout>
    )
  }

  const totalUsers = users.filter((u: any) => u.isActive !== false).length
  const schools    = units.filter((u: any) => u.type === 'school').length

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Unidades Educacionais</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {units.length} unidade{units.length !== 1 ? 's' : ''} cadastrada{units.length !== 1 ? 's' : ''} na rede — Associação Paulista Sul
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 20px rgba(248,163,3,0.3)' }}
        >
          <PlusIcon className="w-4 h-4" />
          Nova Unidade
        </button>
      </div>

      {/* Success toast */}
      {saved && (
        <div
          className="mb-4 flex items-center gap-2 p-3.5 rounded-xl text-sm font-medium animate-scale-in"
          style={{ background: 'rgba(10,189,120,0.12)', border: '1px solid rgba(10,189,120,0.2)', color: '#0ABD78' }}
        >
          <CheckCircleIcon className="w-5 h-5" />
          Unidade criada com sucesso!
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div
          className="rounded-2xl p-6 mb-6 animate-scale-in"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Nova Unidade</h2>
            <button onClick={() => setShowForm(false)} style={{ color: 'rgba(255,255,255,0.35)' }}>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Nome da Unidade *
              </label>
              <input
                required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Colégio Adventista de São Paulo"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={darkField}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Cidade *
              </label>
              <input
                required value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Ex: São Paulo"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={darkField}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Tipo
              </label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={darkField}
              >
                <option value="school">Colégio</option>
                <option value="department">Departamento</option>
                <option value="headquarters">Sede</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Região / Estado
              </label>
              <input
                value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                placeholder="Ex: SP"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={darkField}
              />
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 16px rgba(248,163,3,0.3)' }}
              >
                {saving ? 'Salvando...' : 'Criar Unidade'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6 animate-fade-in-up">
        {[
          { label: 'Total de Unidades',     value: units.length, icon: BuildingLibraryIcon, accent: '#4A9EFF' },
          { label: 'Colégios',              value: schools,      icon: BuildingLibraryIcon, accent: '#0ABD78' },
          { label: 'Colaboradores Ativos',  value: totalUsers,   icon: UsersIcon,           accent: '#A78BFA' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl p-4 transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${kpi.accent}15`, border: `1px solid ${kpi.accent}25` }}
              >
                <kpi.icon className="w-5 h-5" style={{ color: kpi.accent }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: kpi.accent }}>{kpi.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Units grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 animate-fade-in-up delay-100">
        {units.map((unit: any, idx: number) => {
          const memberCount = countByUnit(unit.id)
          const unitUsers = users.filter((u: any) => u.unitId === unit.id || u.unit?.id === unit.id).slice(0, 4)
          const ts = TYPE_STYLE[unit.type] || TYPE_STYLE.school

          return (
            <div
              key={unit.id}
              className="rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
            >
              {/* Card header */}
              <div
                className="p-5 relative"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: UNIT_GRADIENT_BG[idx % UNIT_GRADIENT_BG.length] }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: ts.bg, border: `1px solid ${ts.color}30` }}
                  >
                    <BuildingLibraryIcon className="w-5 h-5" style={{ color: ts.color }} />
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}30` }}
                  >
                    {TYPE_LABELS[unit.type] || unit.type}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-sm leading-snug">{unit.name}</h3>
                <div className="flex items-center gap-1 mt-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <MapPinIcon className="w-3.5 h-3.5" />
                  {unit.city}{unit.region ? `, ${unit.region}` : ''}
                </div>
              </div>

              {/* Card body */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <UsersIcon className="w-4 h-4" />
                    <span>{memberCount} colaborador{memberCount !== 1 ? 'es' : ''}</span>
                  </div>
                </div>

                {unitUsers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {unitUsers.map((u: any) => (
                        <div
                          key={u.id}
                          title={u.name}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{
                            backgroundColor: avatarColor(u.name),
                            boxShadow: '0 0 0 2px rgba(6,7,15,0.9)',
                          }}
                        >
                          {u.name.charAt(0)}
                        </div>
                      ))}
                      {memberCount > 4 && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.6)',
                            boxShadow: '0 0 0 2px rgba(6,7,15,0.9)',
                          }}
                        >
                          +{memberCount - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {unitUsers[0]?.name?.split(' ')[0]}
                      {memberCount > 1 ? ` e mais ${memberCount - 1}` : ''}
                    </span>
                  </div>
                )}

                {memberCount === 0 && (
                  <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.2)' }}>Sem colaboradores cadastrados</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </AdminLayout>
  )
}
