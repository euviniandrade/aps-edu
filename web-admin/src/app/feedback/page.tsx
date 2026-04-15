'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

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

  const catColors: Record<string, string> = {
    suggestion: 'bg-yellow-100 text-yellow-700',
    problem: 'bg-red-100 text-red-700',
    idea: 'bg-blue-100 text-blue-700',
    praise: 'bg-green-100 text-green-700',
  }

  const catLabels: Record<string, string> = {
    suggestion: '💡 Sugestão', problem: '🐛 Problema',
    idea: '🧠 Ideia', praise: '❤️ Elogio',
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-600',
    read: 'bg-blue-50 text-blue-600',
    resolved: 'bg-green-50 text-green-600',
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="read">Lidos</option>
          <option value="resolved">Resolvidos</option>
        </select>
      </div>

      <div className="space-y-4">
        {feedbacks.length === 0 && <p className="text-center text-gray-400 py-12">Nenhum feedback encontrado</p>}
        {feedbacks.map((f: any) => (
          <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${catColors[f.category] || ''}`}>
                    {catLabels[f.category] || f.category}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[f.status] || ''}`}>
                    {f.status}
                  </span>
                  {f.isAnonymous && <span className="text-xs text-gray-400">🕵️ Anônimo</span>}
                  {!f.isAnonymous && f.user && <span className="text-xs text-gray-500">{f.user.name} — {f.user.role?.name}</span>}
                </div>
                <p className="text-gray-700 text-sm">{f.content}</p>
                <p className="text-xs text-gray-400 mt-2">{new Date(f.createdAt).toLocaleString('pt-BR')}</p>
              </div>
              <div className="flex gap-2">
                {f.status === 'pending' && (
                  <button onClick={() => updateStatus(f.id, 'read')}
                    className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                    Marcar como lido
                  </button>
                )}
                {f.status !== 'resolved' && (
                  <button onClick={() => updateStatus(f.id, 'resolved')}
                    className="text-xs bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100">
                    Resolver
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
