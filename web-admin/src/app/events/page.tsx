'use client'
import { useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado', ongoing: 'Em andamento', completed: 'Concluído', cancelled: 'Cancelado',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  planned:   { bg: 'rgba(74,158,255,0.12)',  color: '#4A9EFF' },
  ongoing:   { bg: 'rgba(10,189,120,0.12)',  color: '#0ABD78' },
  completed: { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' },
  cancelled: { bg: 'rgba(255,71,87,0.12)',   color: '#FF4757' },
}
const EVENT_GRADIENTS = [
  'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(74,158,255,0.2))',
  'linear-gradient(135deg, rgba(248,163,3,0.25), rgba(224,123,57,0.2))',
  'linear-gradient(135deg, rgba(10,189,120,0.25), rgba(41,171,226,0.2))',
  'linear-gradient(135deg, rgba(255,71,87,0.2), rgba(139,92,246,0.2))',
]

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function EventsPage() {
  const [events, setEvents]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter]   = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetail, setEventDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab]     = useState<'info' | 'photos'>('info')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [users, setUsers]             = useState<any[]>([])
  const [units, setUnits]             = useState<any[]>([])
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', location: '', unitId: '', responsibleIds: [] as string[] })
  const [saving, setSaving]           = useState(false)
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
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/events/${selectedEvent.id}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setEventDetail((prev: any) => prev ? { ...prev, photos: [res.data, ...(prev.photos || [])] } : prev)
      load()
    } catch { setUploadError('Erro ao enviar foto. Tente novamente.')
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Eventos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {events.length} evento{events.length !== 1 ? 's' : ''} cadastrado{events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 20px rgba(248,163,3,0.3)' }}
        >
          + Novo Evento
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap animate-fade-in-up">
        {['', 'planned', 'ongoing', 'completed'].map(s => {
          const ss = STATUS_STYLE[s]
          const isActive = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={isActive
                ? { background: 'rgba(248,163,3,0.15)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.3)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {s === '' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
        </div>
      ) : events.length === 0 ? (
        <p className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Nenhum evento encontrado
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in-up delay-100">
          {events.map((event: any, idx: number) => {
            const ss = STATUS_STYLE[event.status] || STATUS_STYLE.completed
            return (
              <div
                key={event.id}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}
                onClick={() => openEvent(event)}
              >
                {/* Color header */}
                <div
                  className="h-24 flex items-center justify-center relative overflow-hidden"
                  style={{ background: EVENT_GRADIENTS[idx % EVENT_GRADIENTS.length] }}
                >
                  <span className="text-4xl">📅</span>
                  <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-white text-sm leading-tight">{event.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}30` }}
                    >
                      {STATUS_LABELS[event.status] || event.status}
                    </span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>📍 {event.location}</p>
                  <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    📅 {formatDate(event.startDate)} → {formatDate(event.endDate)}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${event.progressPercent || 0}%`, background: 'linear-gradient(90deg, #8B5CF6, #4A9EFF)' }}
                      />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: '#8B5CF6' }}>{event.progressPercent || 0}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(event.responsibles || []).slice(0, 3).map((r: any, i: number) => (
                      <div
                        key={i}
                        title={r.user?.name}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold -ml-1 first:ml-0"
                        style={{
                          background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                          color: '#000',
                          boxShadow: '0 0 0 2px rgba(6,7,15,0.9)',
                        }}
                      >
                        {(r.user?.name || 'U')[0]}
                      </div>
                    ))}
                    {(event.responsibles || []).length > 3 && (
                      <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        +{event.responsibles.length - 3}
                      </span>
                    )}
                    <div className="ml-auto flex gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span>📋 {event._count?.tasks || 0}</span>
                      <span>🖼 {event._count?.photos || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ EVENT DETAIL MODAL ══ */}
      {selectedEvent && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in"
            style={{
              background: 'rgba(8,10,24,0.99)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="p-6 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-base font-bold text-white">{selectedEvent.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>📍 {selectedEvent.location}</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-xl leading-none transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { key: 'info', label: 'ℹ️ Informações' },
                { key: 'photos', label: `🖼️ Fotos ${eventDetail?.photos?.length ? `(${eventDetail.photos.length})` : ''}` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className="px-6 py-3 text-sm font-medium transition-colors"
                  style={{
                    color: activeTab === tab.key ? '#F8A303' : 'rgba(255,255,255,0.4)',
                    borderBottom: activeTab === tab.key ? '2px solid #F8A303' : '2px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
                </div>
              ) : activeTab === 'info' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Status',    value: STATUS_LABELS[selectedEvent.status] },
                      { label: 'Progresso', value: `${selectedEvent.progressPercent || 0}%` },
                      { label: 'Início',    value: formatDate(selectedEvent.startDate) },
                      { label: 'Fim',       value: formatDate(selectedEvent.endDate) },
                      { label: 'Local',     value: selectedEvent.location },
                      { label: 'Unidade',   value: selectedEvent.unit?.name },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                        <p className="font-medium text-white">{item.value || '—'}</p>
                      </div>
                    ))}
                  </div>
                  {selectedEvent.description && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Descrição</p>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{selectedEvent.description}</p>
                    </div>
                  )}
                  {(eventDetail?.responsibles || []).length > 0 && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Responsáveis</p>
                      <div className="flex flex-wrap gap-2">
                        {eventDetail.responsibles.map((r: any) => (
                          <div
                            key={r.user.id}
                            className="flex items-center gap-2 rounded-full px-3 py-1"
                            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: 'rgba(139,92,246,0.3)', color: '#A78BFA' }}
                            >
                              {r.user.name[0]}
                            </div>
                            <span className="text-xs font-medium" style={{ color: '#A78BFA' }}>{r.user.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(eventDetail?.timeline || []).length > 0 && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Cronograma</p>
                      <div className="space-y-2">
                        {eventDetail.timeline.map((t: any) => (
                          <div
                            key={t.id}
                            className="flex items-start gap-3 p-3 rounded-xl"
                            style={{
                              background: t.completedAt ? 'rgba(10,189,120,0.08)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${t.completedAt ? 'rgba(10,189,120,0.18)' : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            <span className="text-lg">{t.completedAt ? '✅' : '⏳'}</span>
                            <div>
                              <p className="text-sm font-medium text-white">{t.title}</p>
                              {t.description && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.description}</p>}
                              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatDate(t.scheduledAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <div
                    onClick={() => !uploading && photoInput.current?.click()}
                    className="rounded-xl p-6 text-center mb-5 transition-all cursor-pointer"
                    style={{ border: `2px dashed ${uploading ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)'}`, background: uploading ? 'rgba(139,92,246,0.06)' : 'transparent' }}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#8B5CF6' }} />
                        <p className="text-sm font-medium" style={{ color: '#8B5CF6' }}>Enviando foto...</p>
                      </div>
                    ) : (
                      <>
                        <span className="text-3xl">📷</span>
                        <p className="text-sm font-medium text-white mt-2">Clique para adicionar foto</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>PNG, JPG, WEBP até 20MB</p>
                      </>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-xs mb-3 text-center" style={{ color: '#FF4757' }}>{uploadError}</p>
                  )}
                  {(eventDetail?.photos || []).length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <span className="text-5xl">🖼️</span>
                      <p className="text-sm mt-3">Nenhuma foto enviada ainda</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {(eventDetail?.photos || []).map((photo: any) => (
                        <a
                          key={photo.id}
                          href={API_BASE + photo.url}
                          target="_blank" rel="noopener noreferrer"
                          className="group relative aspect-square rounded-xl overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          <img
                            src={API_BASE + photo.url}
                            alt={photo.caption || 'Foto do evento'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
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

            <div className="p-4 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ NEW EVENT MODAL ══ */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
            style={{
              background: 'rgba(8,10,24,0.99)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-base font-bold text-white">Novo Evento</h2>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Nome do evento *', field: 'name', type: 'text', placeholder: 'Ex: Semana da Família' },
                { label: 'Local *', field: 'location', type: 'text', placeholder: 'Ex: Auditório Central' },
              ].map(item => (
                <div key={item.field}>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {item.label}
                  </label>
                  <input
                    type={item.type}
                    value={(form as any)[item.field]}
                    onChange={e => setForm({ ...form, [item.field]: e.target.value })}
                    placeholder={item.placeholder}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={darkField}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={darkField}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Data início *', field: 'startDate' },
                  { label: 'Data fim *',    field: 'endDate' },
                ].map(item => (
                  <div key={item.field}>
                    <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {item.label}
                    </label>
                    <input
                      type="datetime-local"
                      value={(form as any)[item.field]}
                      onChange={e => setForm({ ...form, [item.field]: e.target.value })}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={darkField}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Unidade
                </label>
                <select
                  value={form.unitId}
                  onChange={e => setForm({ ...form, unitId: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={darkField}
                >
                  <option value="">Selecionar unidade...</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Responsáveis
                </label>
                <div
                  className="rounded-xl p-2 max-h-32 overflow-y-auto space-y-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {users.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded p-1 transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <input
                        type="checkbox"
                        checked={form.responsibleIds.includes(u.id)}
                        onChange={e => setForm({ ...form, responsibleIds: e.target.checked ? [...form.responsibleIds, u.id] : form.responsibleIds.filter(id => id !== u.id) })}
                        className="rounded"
                      />
                      <span className="text-sm">{u.name} — {u.role?.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancelar
              </button>
              <button
                onClick={createEvent}
                disabled={saving || !form.name.trim() || !form.startDate || !form.endDate || !form.location.trim()}
                className="px-4 py-2 text-sm rounded-xl font-bold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 16px rgba(248,163,3,0.3)' }}
              >
                {saving ? 'Salvando...' : 'Criar Evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
