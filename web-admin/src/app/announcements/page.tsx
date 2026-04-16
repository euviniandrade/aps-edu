'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const TYPE_LABELS: Record<string, string> = {
  info: 'Informativo', warning: 'Atenção', urgent: 'Urgente', celebration: 'Celebração',
}
const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
  celebration: 'bg-green-100 text-green-700 border-green-200',
}
const TYPE_ICONS: Record<string, string> = {
  info: '📋', warning: '⚠️', urgent: '🚨', celebration: '🎉',
}
const TYPE_BORDER: Record<string, string> = {
  info: 'border-l-blue-500', warning: 'border-l-yellow-500', urgent: 'border-l-red-500', celebration: 'border-l-green-500',
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [roles, setRoles] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', content: '', type: 'info', targetRoleIds: [] as string[], targetUnitIds: [] as string[], expiresAt: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/announcements', { params: { limit: 50 } })
      setAnnouncements(res.data || [])
    } catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/units')]).then(([r, u]) => {
      setRoles(r.data || []); setUnits(u.data || [])
    })
  }, [])

  const publish = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      await api.post('/announcements', {
        ...form,
        expiresAt: form.expiresAt || undefined,
        targetRoleIds: form.targetRoleIds.length ? form.targetRoleIds : undefined,
        targetUnitIds: form.targetUnitIds.length ? form.targetUnitIds : undefined,
      })
      setShowModal(false)
      setForm({ title: '', content: '', type: 'info', targetRoleIds: [], targetUnitIds: [], expiresAt: '' })
      load()
    } catch (_) {} finally { setSaving(false) }
  }

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Excluir este aviso?')) return
    await api.delete(`/announcements/${id}`)
    load()
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mural de Avisos</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Publicar Aviso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : announcements.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Nenhum aviso publicado</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((a: any) => (
            <div key={a.id} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${TYPE_BORDER[a.type] || 'border-l-gray-300'} shadow-sm p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${TYPE_COLORS[a.type] || ''}`}>
                      {TYPE_ICONS[a.type]} {TYPE_LABELS[a.type]}
                    </span>
                    <span className="text-xs text-gray-400">
                      por {a.author?.name} · {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      👁 {a.totalReads || a._count?.reads || 0} leituras
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{a.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">{a.content}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(a.targetRoles || []).map((r: any) => (
                      <span key={r.roleId} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                        {r.role?.name || 'Função'}
                      </span>
                    ))}
                    {(a.targetUnits || []).map((u: any) => (
                      <span key={u.unitId} className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">
                        {u.unit?.name || 'Unidade'}
                      </span>
                    ))}
                    {!(a.targetRoles?.length) && !(a.targetUnits?.length) && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Para todos</span>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteAnnouncement(a.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Publicar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Publicar Aviso</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => setForm({...form, type: k})}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${form.type === k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <span>{TYPE_ICONS[k]}</span> {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo *</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segmentar por função (opcional)</label>
                <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-28 overflow-y-auto">
                  {roles.map((r: any) => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1">
                      <input type="checkbox" checked={form.targetRoleIds.includes(r.id)}
                        onChange={e => setForm({...form, targetRoleIds: e.target.checked ? [...form.targetRoleIds, r.id] : form.targetRoleIds.filter(id => id !== r.id)})} />
                      <span className="text-sm">{r.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">Deixe em branco para enviar a todos</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segmentar por unidade (opcional)</label>
                <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-28 overflow-y-auto">
                  {units.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1">
                      <input type="checkbox" checked={form.targetUnitIds.includes(u.id)}
                        onChange={e => setForm({...form, targetUnitIds: e.target.checked ? [...form.targetUnitIds, u.id] : form.targetUnitIds.filter(id => id !== u.id)})} />
                      <span className="text-sm">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de expiração (opcional)</label>
                <input type="datetime-local" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={publish} disabled={saving || !form.title.trim() || !form.content.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Publicando...' : 'Publicar Agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
