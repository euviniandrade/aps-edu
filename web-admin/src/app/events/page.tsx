'use client'
import { useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

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

function fileIcon(mimeType: string) {
  if (!mimeType) return '📎'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📄'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  return '📎'
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip data url prefix
      res(result.split(',')[1] || result)
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export default function EventsPage() {
  const [events, setEvents]               = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [statusFilter, setStatusFilter]   = useState('')
  const [showModal, setShowModal]         = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetail, setEventDetail]     = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab]         = useState<'info' | 'evidencias'>('info')
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState('')
  const [users, setUsers]                 = useState<any[]>([])
  const [units, setUnits]                 = useState<any[]>([])
  const [currentUser, setCurrentUser]     = useState<any>(null)

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', startDate: '', endDate: '',
    location: '', unitId: '', assignedUserIds: [] as string[],
    allowAttachments: true,
  })
  const [saving, setSaving] = useState(false)

  // Evidência submission form
  const [subFile, setSubFile]       = useState<File | null>(null)
  const [subComment, setSubComment] = useState('')
  const [subUploading, setSubUploading] = useState(false)
  const [subError, setSubError]     = useState('')

  const evidenceInput = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/events', { params })
      setEvents(res.data.events || res.data || [])
    } catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter])

  useEffect(() => {
    Promise.all([api.get('/users?limit=200'), api.get('/units')]).then(([u, un]) => {
      setUsers(u.data?.users || u.data || [])
      setUnits(un.data || [])
    })
    // Load current user from cookie/local storage via API
    try {
      const token = document.cookie.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1]
      if (token) {
        api.get('/users/me').then(r => setCurrentUser(r.data)).catch(() => {})
      }
    } catch (_) {}
  }, [])

  const openEvent = async (event: any) => {
    setSelectedEvent(event)
    setActiveTab('info')
    setEventDetail(null)
    setDetailLoading(true)
    setSubFile(null)
    setSubComment('')
    setSubError('')
    try {
      const res = await api.get(`/events/${event.id}`)
      setEventDetail(res.data)
    } catch (_) {} finally { setDetailLoading(false) }
  }

  const createEvent = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate || !form.location.trim()) return
    setSaving(true)
    try {
      await api.post('/events', {
        title: form.name,
        description: form.description,
        date: form.startDate,
        endDate: form.endDate,
        location: form.location,
        unitId: form.unitId,
        assignedUserIds: form.assignedUserIds,
        allowAttachments: form.allowAttachments,
      })
      setShowModal(false)
      setForm({ name: '', description: '', startDate: '', endDate: '', location: '', unitId: '', assignedUserIds: [], allowAttachments: true })
      load()
    } catch (_) {} finally { setSaving(false) }
  }

  const submitEvidencia = async () => {
    if (!subFile || !selectedEvent) return
    setSubUploading(true)
    setSubError('')
    try {
      const fileBase64 = await toBase64(subFile)
      const res = await api.post('/submissions', {
        eventId: selectedEvent.id,
        fileBase64,
        mimeType: subFile.type,
        fileName: subFile.name,
        comment: subComment,
        type: subFile.type.startsWith('image/') ? 'image'
            : subFile.type.startsWith('video/') ? 'video'
            : subFile.type.startsWith('audio/') ? 'audio'
            : 'file',
      })
      // Refresh event detail
      const detail = await api.get(`/events/${selectedEvent.id}`)
      setEventDetail(detail.data)
      setSubFile(null)
      setSubComment('')
      if (evidenceInput.current) evidenceInput.current.value = ''
    } catch (err: any) {
      setSubError(err?.response?.data?.error || 'Erro ao enviar evidência.')
    } finally {
      setSubUploading(false)
    }
  }

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  const toggleAssigned = (userId: string) => {
    setForm(prev => ({
      ...prev,
      assignedUserIds: prev.assignedUserIds.includes(userId)
        ? prev.assignedUserIds.filter(id => id !== userId)
        : [...prev.assignedUserIds, userId],
    }))
  }

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
            const assignedUsers = event.assignedUsers || []
            const subCount = event._count?.submissions || 0
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
                    <h3 className="font-semibold text-white text-sm leading-tight">{event.title || event.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}30` }}
                    >
                      {STATUS_LABELS[event.status] || event.status}
                    </span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>📍 {event.location}</p>
                  <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    📅 {formatDate(event.date || event.startDate)} → {formatDate(event.endDate)}
                  </p>
                  <div className="flex items-center gap-2">
                    {/* Assigned users avatars */}
                    <div className="flex items-center gap-1">
                      {assignedUsers.slice(0, 3).map((u: any, i: number) => (
                        <div
                          key={u?.id || i}
                          title={u?.name}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                            color: 'white',
                            boxShadow: '0 0 0 2px rgba(6,7,15,0.9)',
                            marginLeft: i > 0 ? -4 : 0,
                          }}
                        >
                          {(u?.name || 'U')[0]}
                        </div>
                      ))}
                      {assignedUsers.length > 3 && (
                        <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          +{assignedUsers.length - 3}
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {assignedUsers.length > 0 && (
                        <span title="Responsáveis">👥 {assignedUsers.length}</span>
                      )}
                      {subCount > 0 && (
                        <span title="Evidências">📎 {subCount}</span>
                      )}
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
                <h2 className="text-base font-bold text-white">{selectedEvent.title || selectedEvent.name}</h2>
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
                { key: 'evidencias', label: `📎 Evidências${eventDetail?.submissions?.length ? ` (${eventDetail.submissions.length})` : ''}` },
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
                      { label: 'Início',    value: formatDate(selectedEvent.date || selectedEvent.startDate) },
                      { label: 'Fim',       value: formatDate(selectedEvent.endDate) },
                      { label: 'Local',     value: selectedEvent.location },
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
                  {/* Assigned users */}
                  {(eventDetail?.assignedUsers || []).length > 0 && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Responsáveis</p>
                      <div className="flex flex-wrap gap-2">
                        {(eventDetail.assignedUsers || []).map((u: any) => (
                          <div
                            key={u?.id}
                            className="flex items-center gap-2 rounded-full px-3 py-1"
                            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: 'rgba(139,92,246,0.3)', color: '#A78BFA' }}
                            >
                              {(u?.name || 'U')[0]}
                            </div>
                            <span className="text-xs font-medium" style={{ color: '#A78BFA' }}>{u?.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── EVIDÊNCIAS TAB ── */
                <div className="space-y-4">
                  {/* Submissions list */}
                  {(eventDetail?.submissions || []).length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <span className="text-4xl">📎</span>
                      <p className="text-sm mt-3">Nenhuma evidência enviada ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(eventDetail.submissions || []).map((sub: any) => (
                        <div
                          key={sub.id}
                          className="rounded-xl p-3 flex items-start gap-3"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          {/* User avatar */}
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', color: 'white' }}
                          >
                            {(sub.user?.name || 'U')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">{sub.user?.name || 'Usuário'}</span>
                              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('pt-BR') : ''}
                              </span>
                            </div>
                            {/* File preview */}
                            {sub.fileUrl && (
                              <div className="mb-1">
                                {sub.type === 'image' ? (
                                  <a href={sub.fileUrl} target="_blank" rel="noreferrer">
                                    <img
                                      src={sub.fileUrl}
                                      alt={sub.fileName}
                                      className="rounded-lg max-h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={sub.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 transition-colors"
                                    style={{ background: 'rgba(74,158,255,0.08)', color: '#4A9EFF', border: '1px solid rgba(74,158,255,0.2)', display: 'inline-flex' }}
                                  >
                                    <span>{fileIcon(sub.mimeType)}</span>
                                    <span className="truncate max-w-[200px]">{sub.fileName || 'Arquivo'}</span>
                                    <span>↗</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {sub.comment && (
                              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{sub.comment}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload form */}
                  {(eventDetail?.allowAttachments !== false) && (
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}
                    >
                      <p className="text-xs font-bold text-white">Enviar Evidência</p>
                      <input
                        ref={evidenceInput}
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                        className="hidden"
                        onChange={e => setSubFile(e.target.files?.[0] || null)}
                      />
                      {subFile ? (
                        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                          <span>{fileIcon(subFile.type)}</span>
                          <span className="text-xs text-white flex-1 truncate">{subFile.name}</span>
                          <button onClick={() => { setSubFile(null); if (evidenceInput.current) evidenceInput.current.value = '' }}
                            className="text-xs" style={{ color: '#FF4757' }}>✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => evidenceInput.current?.click()}
                          className="w-full rounded-xl py-3 text-sm transition-all"
                          style={{ border: '2px dashed rgba(139,92,246,0.3)', color: 'rgba(139,92,246,0.7)', background: 'transparent' }}
                        >
                          📎 Selecionar arquivo
                        </button>
                      )}
                      <textarea
                        value={subComment}
                        onChange={e => setSubComment(e.target.value)}
                        placeholder="Comentário opcional..."
                        rows={2}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                        style={darkField}
                      />
                      {subError && <p className="text-xs" style={{ color: '#FF4757' }}>{subError}</p>}
                      <button
                        onClick={submitEvidencia}
                        disabled={!subFile || subUploading}
                        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', color: 'white' }}
                      >
                        {subUploading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin inline-block w-4 h-4 border-2 rounded-full" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                            Enviando...
                          </span>
                        ) : 'Enviar Evidência'}
                      </button>
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

              {/* Responsáveis multi-select */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Responsáveis pelo evento
                </label>
                {/* Selected chips */}
                {form.assignedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.assignedUserIds.map(uid => {
                      const u = users.find((x: any) => x.id === uid)
                      return (
                        <div
                          key={uid}
                          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA' }}
                        >
                          <span>{u?.name || uid}</span>
                          <button onClick={() => toggleAssigned(uid)} style={{ color: '#FF4757', lineHeight: 1 }}>×</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div
                  className="rounded-xl p-2 max-h-36 overflow-y-auto space-y-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {users.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded p-1 transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <input
                        type="checkbox"
                        checked={form.assignedUserIds.includes(u.id)}
                        onChange={() => toggleAssigned(u.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{u.name} — {u.role?.name || u.roleId}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permitir evidências toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, allowAttachments: !f.allowAttachments }))}
                    className="relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0"
                    style={{ background: form.allowAttachments ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)' : 'rgba(255,255,255,0.12)' }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: form.allowAttachments ? '22px' : '2px' }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Permitir envio de evidências
                  </span>
                </label>
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
