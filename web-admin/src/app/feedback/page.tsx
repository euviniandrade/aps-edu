'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const CAT_STYLE: Record<string, { bg: string; color: string }> = {
  suggestion: { bg: 'rgba(249,194,52,0.1)',  color: '#F9C234' },
  problem:    { bg: 'rgba(255,71,87,0.1)',   color: '#FF4757' },
  idea:       { bg: 'rgba(74,158,255,0.1)',  color: '#4A9EFF' },
  praise:     { bg: 'rgba(10,189,120,0.1)',  color: '#0ABD78' },
}
const CAT_LABELS: Record<string, string> = {
  suggestion: '💡 Sugestão', problem: '🐛 Problema',
  idea: '🧠 Ideia', praise: '❤️ Elogio',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: 'rgba(249,194,52,0.1)',  color: '#F9C234' },
  read:     { bg: 'rgba(74,158,255,0.1)',  color: '#4A9EFF' },
  resolved: { bg: 'rgba(10,189,120,0.1)', color: '#0ABD78' },
}

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [filter, setFilter] = useState('')

  const load = async () => {
    try {
      const res = await api.get('/feedback', { params: { status: filter || undefined, limit: 50 } })
      setFeedbacks(res.data.feedbacks || [])
    } catch (_) {}
  }

  useEffect(() => { load() }, [filter])

  const updateStatus = async (id: string, status: string) => {
    await api.put(`/feedback/${id}`, { status })
    load()
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Feedback</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''} recebido{feedbacks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="rounded-xl px-4 py-2.5 text-sm outline-none"
          style={darkField}
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="read">Lidos</option>
          <option value="resolved">Resolvidos</option>
        </select>
      </div>

      <div className="space-y-4 animate-fade-in-up">
        {feedbacks.length === 0 && (
          <p className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Nenhum feedback encontrado
          </p>
        )}
        {feedbacks.map((f: any) => {
          const cs = CAT_STYLE[f.category] || CAT_STYLE.idea
          const ss = STATUS_STYLE[f.status] || STATUS_STYLE.pending
          return (
            <div
              key={f.id}
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.color}30` }}
                    >
                      {CAT_LABELS[f.category] || f.category}
                    </span>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}30` }}
                    >
                      {f.status === 'pending' ? 'Pendente' : f.status === 'read' ? 'Lido' : 'Resolvido'}
                    </span>
                    {f.isAnonymous && (
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>🕵️ Anônimo</span>
                    )}
                    {!f.isAnonymous && f.user && (
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {f.user.name} — {f.user.role?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {f.content}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {new Date(f.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {f.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(f.id, 'read')}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={{ background: 'rgba(74,158,255,0.1)', color: '#4A9EFF', border: '1px solid rgba(74,158,255,0.2)' }}
                    >
                      Marcar como lido
                    </button>
                  )}
                  {f.status !== 'resolved' && (
                    <button
                      onClick={() => updateStatus(f.id, 'resolved')}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={{ background: 'rgba(10,189,120,0.1)', color: '#0ABD78', border: '1px solid rgba(10,189,120,0.2)' }}
                    >
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </AdminLayout>
  )
}
