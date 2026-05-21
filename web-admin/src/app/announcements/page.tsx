'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const TYPE_LABELS: Record<string, string> = {
  info: 'Informativo', warning: 'Atenção', urgent: 'Urgente', celebration: 'Celebração',
}
const TYPE_STYLE: Record<string, { bg: string; color: string; accent: string }> = {
  info:        { bg: 'rgba(74,158,255,0.08)',  color: '#4A9EFF',  accent: '#4A9EFF' },
  warning:     { bg: 'rgba(249,194,52,0.08)',  color: '#F9C234',  accent: '#F9C234' },
  urgent:      { bg: 'rgba(255,71,87,0.08)',   color: '#FF4757',  accent: '#FF4757' },
  celebration: { bg: 'rgba(10,189,120,0.08)',  color: '#0ABD78',  accent: '#0ABD78' },
}
const TYPE_ICONS: Record<string, string> = {
  info: '📋', warning: '⚠️', urgent: '🚨', celebration: '🎉',
}

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [roles, setRoles]       = useState<any[]>([])
  const [units, setUnits]       = useState<any[]>([])
  const [form, setForm] = useState({ title: '', content: '', type: 'info', targetRoleIds: [] as string[], targetUnitIds: [] as string[], expiresAt: '' })
  const [saving, setSaving]     = useState(false)
  const [aiTopic, setAiTopic]   = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)

  const generateWithAI = async () => {
    if (!aiTopic.trim()) return
    setAiGenerating(true)
    try {
      const res = await api.post('/ai/generate-text', { type: 'announcement', context: aiTopic })
      if (res.data.title)   setForm(f => ({ ...f, title: res.data.title }))
      if (res.data.content) setForm(f => ({ ...f, content: res.data.content }))
      setAiTopic('')
    } catch { alert('Erro ao gerar com IA') }
    finally { setAiGenerating(false) }
  }

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
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Mural de Avisos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {announcements.length} aviso{announcements.length !== 1 ? 's' : ''} publicado{announcements.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 20px rgba(248,163,3,0.3)' }}
        >
          + Publicar Aviso
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>Nenhum aviso publicado</p>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {announcements.map((a: any) => {
            const ts = TYPE_STYLE[a.type] || TYPE_STYLE.info
            return (
              <div
                key={a.id}
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(255,255,255,0.07)`,
                  borderLeft: `3px solid ${ts.accent}`,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                }}
              >
                {/* Subtle bg tint */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `${ts.bg}` }}
                />
                <div className="flex items-start justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: `${ts.color}18`, color: ts.color, border: `1px solid ${ts.color}30` }}
                      >
                        {TYPE_ICONS[a.type]} {TYPE_LABELS[a.type]}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        por {a.author?.name} · {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        👁 {a.totalReads || a._count?.reads || 0} leituras
                      </span>
                    </div>
                    <h3 className="font-semibold text-white mb-1">{a.title}</h3>
                    <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {a.content}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(a.targetRoles || []).map((r: any) => (
                        <span
                          key={r.roleId}
                          className="px-2 py-0.5 text-xs rounded-full"
                          style={{ background: 'rgba(74,158,255,0.1)', color: '#4A9EFF', border: '1px solid rgba(74,158,255,0.2)' }}
                        >
                          {r.role?.name || 'Função'}
                        </span>
                      ))}
                      {(a.targetUnits || []).map((u: any) => (
                        <span
                          key={u.unitId}
                          className="px-2 py-0.5 text-xs rounded-full"
                          style={{ background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}
                        >
                          {u.unit?.name || 'Unidade'}
                        </span>
                      ))}
                      {!(a.targetRoles?.length) && !(a.targetUnits?.length) && (
                        <span
                          className="px-2 py-0.5 text-xs rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                        >
                          Para todos
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    className="text-sm transition-colors flex-shrink-0"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF4757')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ PUBLISH MODAL ══ */}
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
              <h2 className="text-base font-bold text-white">Publicar Aviso</h2>
            </div>
            <div className="p-6 space-y-4">

              {/* AI Generator */}
              <div
                className="rounded-xl p-3"
                style={{ background: 'rgba(248,163,3,0.06)', border: '1px solid rgba(248,163,3,0.15)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'rgba(248,163,3,0.7)' }}>
                  ✨ Gerar com Gemini IA
                </p>
                <div className="flex gap-2">
                  <input
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generateWithAI()}
                    placeholder="Ex: Reunião pedagógica sexta-feira às 18h..."
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(248,163,3,0.2)', color: 'white' }}
                  />
                  <button
                    onClick={generateWithAI}
                    disabled={aiGenerating || !aiTopic.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 hover:scale-[1.03]"
                    style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000' }}
                  >
                    {aiGenerating ? '⏳' : '✨'}
                  </button>
                </div>
              </div>

              {/* Type selector */}
              <div>
                <label className="block text-[10px] font-semibold mb-2 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Tipo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => {
                    const ts = TYPE_STYLE[k]
                    const isActive = form.type === k
                    return (
                      <button
                        key={k}
                        onClick={() => setForm({ ...form, type: k })}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                        style={isActive
                          ? { background: `${ts.color}15`, color: ts.color, border: `1px solid ${ts.color}35` }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
                        }
                      >
                        <span>{TYPE_ICONS[k]}</span> {v}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Título *
                </label>
                <input
                  type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={darkField}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Conteúdo *
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={darkField}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Segmentar por função (opcional)
                </label>
                <div
                  className="rounded-xl p-2 space-y-1 max-h-28 overflow-y-auto"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {roles.map((r: any) => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer rounded p-1 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <input
                        type="checkbox" checked={form.targetRoleIds.includes(r.id)}
                        onChange={e => setForm({ ...form, targetRoleIds: e.target.checked ? [...form.targetRoleIds, r.id] : form.targetRoleIds.filter(id => id !== r.id) })}
                        className="rounded"
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Deixe em branco para enviar a todos</p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Segmentar por unidade (opcional)
                </label>
                <div
                  className="rounded-xl p-2 space-y-1 max-h-28 overflow-y-auto"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {units.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded p-1 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <input
                        type="checkbox" checked={form.targetUnitIds.includes(u.id)}
                        onChange={e => setForm({ ...form, targetUnitIds: e.target.checked ? [...form.targetUnitIds, u.id] : form.targetUnitIds.filter(id => id !== u.id) })}
                        className="rounded"
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Data de expiração (opcional)
                </label>
                <input
                  type="datetime-local" value={form.expiresAt}
                  onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={darkField}
                />
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
                onClick={publish}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="px-4 py-2 text-sm rounded-xl font-bold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 4px 16px rgba(248,163,3,0.3)' }}
              >
                {saving ? 'Publicando...' : 'Publicar Agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
