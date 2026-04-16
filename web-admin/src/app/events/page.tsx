'use client'
import { useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado', ongoing: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  ongoing: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
}

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetail, setEventDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'photos'>('info')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', location: '', unitId: '', responsibleIds: [] as string[] })
  const [saving, setSaving] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/events', { params })
      setEvents(res.data.events || [])
    } catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter])

  useEffect(() => {
    Promise.all([api.get('/users?limit=200'), api.get('/units')]).then(([u, un]) => {
      setUsers(u.data || []); setUnits(un.data || [])
    })
  }, [])

  const openEvent = async (event: any) => {
    setSelectedEvent(event)
    setActiveTab('info')
    setEventDetail(null)
    setDetailLoading(true)
    try {
      const res = await api.get(`/events/${event.id}`)
      setEventDetail(res.data)
    } catch (_) {} finally { setDetailLoading(false) }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedEvent) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/events/${selectedEvent.id}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setEventDetail((prev: any) => prev ? { ...prev, photos: [res.data, ...(prev.photos || [])] } : prev)
      load()
    } catch (err: any) {
      setUploadError('Erro ao enviar foto. Tente novamente.')
    } finally {
      setUploading(false)
      if (photoInput.current) photoInput.current.value = ''
    }
  }

  const createEvent = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate || !form.location.trim()) return
    setSaving(true)
    try {
      await api.post('/events', { ...form })
      setShowModal(false)
      setForm({ name: '', description: '', startDate: '', endDate: '', location: '', unitId: '', responsibleIds: [] })
      load()
    } catch (_) {} finally { setSaving(false) }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Novo Evento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        {['', 'planned', 'ongoing', 'completed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s === '' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : events.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Nenhum evento encontrado</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event: any) => (
            <div key={event.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openEvent(event)}>
              <div className="h-28 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <span className="text-4xl">📅</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{event.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[event.status] || ''}`}>
                    {STATUS_LABELS[event.status] || event.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">📍 {event.location}</p>
                <p className="text-xs text-gray-500 mb-3">
                  📅 {formatDate(event.startDate)} → {formatDate(event.endDate)}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${event.progressPercent || 0}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-blue-600">{event.progressPercent || 0}%</span>
                </div>
                <div className="flex items-center gap-1 mt-3">
                  {(event.responsibles || []).slice(0, 3).map((r: any, i: number) => (
                    <div key={i} title={r.user?.name} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs text-blue-700 font-bold -ml-1 first:ml-0">
                      {(r.user?.name || 'U')[0]}
                    </div>
                  ))}
                  {(event.responsibles || []).length > 3 && (
                    <span className="text-xs text-gray-400 ml-1">+{event.responsibles.length - 3}</span>
                  )}
                  <div className="ml-auto flex gap-2 text-xs text-gray-400">
                    <span>📋 {event._count?.tasks || 0}</span>
                    <span>🖼 {event._count?.photos || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalhe evento */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedEvent.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">📍 {selectedEvent.location}</p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {[
                { key: 'info', label: 'ℹ️ Informações' },
                { key: 'photos', label: `🖼️ Fotos ${eventDetail?.photos?.length ? `(${eventDetail.photos.length})` : ''}` },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
              ) : activeTab === 'info' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'Status', value: STATUS_LABELS[selectedEvent.status] },
                      { label: 'Progresso', value: `${selectedEvent.progressPercent || 0}%` },
                      { label: 'Início', value: formatDate(selectedEvent.startDate) },
                      { label: 'Fim', value: formatDate(selectedEvent.endDate) },
                      { label: 'Local', value: selectedEvent.location },
                      { label: 'Unidade', value: selectedEvent.unit?.name },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="font-medium text-gray-900">{item.value || '—'}</p>
                      </div>
                    ))}
                  </div>
                  {selectedEvent.description && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Descrição</p>
                      <p className="text-sm text-gray-700">{selectedEvent.description}</p>
                    </div>
                  )}
                  {/* Responsáveis */}
                  {(eventDetail?.responsibles || []).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Responsáveis</p>
                      <div className="flex flex-wrap gap-2">
                        {eventDetail.responsibles.map((r: any) => (
                          <div key={r.user.id} className="flex items-center gap-2 bg-blue-50 rounded-full px-3 py-1">
                            <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">
                              {r.user.name[0]}
                            </div>
                            <span className="text-xs text-blue-700 font-medium">{r.user.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Timeline */}
                  {(eventDetail?.timeline || []).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Cronograma</p>
                      <div className="space-y-2">
                        {eventDetail.timeline.map((t: any) => (
                          <div key={t.id} className={`flex items-start gap-3 p-3 rounded-lg ${t.completedAt ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <span className="text-lg">{t.completedAt ? '✅' : '⏳'}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{t.title}</p>
                              {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                              <p className="text-xs text-gray-400 mt-1">{formatDate(t.scheduledAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* PHOTOS TAB */
                <div>
                  {/* Upload area */}
                  <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <div
                    onClick={() => !uploading && photoInput.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-colors ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'}`}>
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <p className="text-sm text-blue-600 font-medium">Enviando foto...</p>
                      </div>
                    ) : (
                      <>
                        <span className="text-3xl">📷</span>
                        <p className="text-sm font-medium text-gray-700 mt-2">Clique para adicionar foto</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP até 20MB</p>
                      </>
                    )}
                  </div>
                  {uploadError && <p className="text-xs text-red-500 mb-3 text-center">{uploadError}</p>}

                  {/* Gallery */}
                  {(eventDetail?.photos || []).length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-5xl">🖼️</span>
                      <p className="text-gray-400 text-sm mt-3">Nenhuma foto enviada ainda</p>
                      <p className="text-gray-300 text-xs mt-1">Adicione fotos do evento clicando acima</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {(eventDetail?.photos || []).map((photo: any) => (
                        <a key={photo.id} href={API_BASE + photo.url} target="_blank" rel="noopener noreferrer"
                          className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition-shadow">
                          <img
                            src={API_BASE + photo.url}
                            alt={photo.caption || 'Foto do evento'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e: any) => { e.target.style.display='none' }}
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <p className="text-white text-xs truncate">{photo.caption}</p>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button onClick={() => { setSelectedEvent(null); window.location.href = `/events/${selectedEvent.id}/report` }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                📊 Ver Relatório
              </button>
              <button onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Evento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Novo Evento</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do evento *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data início *</label>
                  <input type="datetime-local" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data fim *</label>
                  <input type="datetime-local" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local *</label>
                <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                <select value={form.unitId} onChange={e => setForm({...form, unitId: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecionar unidade...</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsáveis</label>
                <div className="border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {users.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1">
                      <input type="checkbox" checked={form.responsibleIds.includes(u.id)}
                        onChange={e => setForm({...form, responsibleIds: e.target.checked ? [...form.responsibleIds, u.id] : form.responsibleIds.filter(id => id !== u.id)})}
                        className="rounded" />
                      <span className="text-sm text-gray-700">{u.name} — {u.role?.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={createEvent} disabled={saving || !form.name.trim() || !form.startDate || !form.endDate || !form.location.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Criar Evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
