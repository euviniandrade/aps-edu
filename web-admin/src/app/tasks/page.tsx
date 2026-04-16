'use client'
import { useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', overdue: 'Atrasada',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-50 text-blue-500',
  medium: 'bg-yellow-50 text-yellow-600',
  high: 'bg-orange-50 text-orange-600',
  critical: 'bg-red-50 text-red-700',
}
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', assignedToId: '', unitId: '' })
  const [saving, setSaving] = useState(false)

  // Drawer de detalhes
  const [drawer, setDrawer] = useState<any>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      const res = await api.get('/tasks', { params })
      setTasks(res.data.tasks || [])
    } catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, priorityFilter])
  useEffect(() => {
    Promise.all([api.get('/users?limit=200'), api.get('/units')]).then(([u, un]) => {
      setUsers(u.data || []); setUnits(un.data || [])
    })
  }, [])

  const openDrawer = async (task: any) => {
    setDrawer(task)
    setDrawerLoading(true)
    try {
      const res = await api.get(`/tasks/${task.id}`)
      setDrawer(res.data)
    } catch (_) {} finally { setDrawerLoading(false) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !drawer) return
    setUploadError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(`/tasks/${drawer.id}/evidences`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Recarregar drawer com evidências atualizadas
      const res = await api.get(`/tasks/${drawer.id}`)
      setDrawer(res.data)
    } catch (_) {
      setUploadError('Erro ao enviar arquivo. Tente novamente.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const createTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await api.post('/tasks', { ...form, dueDate: form.dueDate || undefined, assignedToId: form.assignedToId || undefined })
      setShowModal(false)
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', assignedToId: '', unitId: '' })
      load()
    } catch (_) {} finally { setSaving(false) }
  }

  const filtered = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.assignedTo?.name?.toLowerCase().includes(search.toLowerCase())
  )
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tarefas</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Nova Tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 shadow-sm flex flex-wrap gap-3">
        <input type="search" placeholder="Buscar tarefa ou responsável..." value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="ml-auto text-sm text-gray-400 flex items-center">{filtered.length} tarefa(s)</div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12">Nenhuma tarefa encontrada</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Tarefa</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Prioridade</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Responsável</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Vencimento</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Progresso</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Arquivos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((task: any) => (
                <tr key={task.id} onClick={() => openDrawer(task)}
                  className="hover:bg-blue-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 max-w-xs truncate">{task.title}</p>
                    <p className="text-xs text-gray-400">{task.unit?.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || ''}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] || ''}`}>
                      {PRIORITY_LABELS[task.priority] || task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {task.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                          {(task.assignedTo.name || 'U')[0]}
                        </div>
                        <span className="text-gray-700">{task.assignedTo.name}</span>
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={task.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {formatDate(task.dueDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 w-28">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${task.progressPercent || 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{task.progressPercent || 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      📎 {task._count?.evidences || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== DRAWER DE DETALHE COM UPLOAD ===== */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="flex-1 bg-black/40" onClick={() => setDrawer(null)} />
          {/* Painel lateral */}
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex-1 pr-4">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{drawer.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[drawer.status] || ''}`}>
                    {STATUS_LABELS[drawer.status] || drawer.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[drawer.priority] || ''}`}>
                    {PRIORITY_LABELS[drawer.priority] || drawer.priority}
                  </span>
                </div>
              </div>
              <button onClick={() => setDrawer(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>

            {drawerLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="flex-1 p-6 space-y-6">

                {/* Informações */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Responsável</p>
                    <p className="font-medium text-gray-800">{drawer.assignedTo?.name || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Vencimento</p>
                    <p className="font-medium text-gray-800">{formatDate(drawer.dueDate)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Unidade</p>
                    <p className="font-medium text-gray-800">{drawer.unit?.name || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Progresso</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${drawer.progressPercent || 0}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-blue-600">{drawer.progressPercent || 0}%</span>
                    </div>
                  </div>
                </div>

                {drawer.description && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                    <p className="text-xs text-gray-500 mb-1 font-medium">Descrição</p>
                    {drawer.description}
                  </div>
                )}

                {/* Checklist */}
                {(drawer.checklists || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Checklist ({(drawer.checklists || []).filter((c: any) => c.isCompleted).length}/{(drawer.checklists || []).length})
                    </p>
                    <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                      {(drawer.checklists || []).map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${item.isCompleted ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                            {item.isCompleted && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className={`text-sm ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== SEÇÃO DE ARQUIVOS E FOTOS ===== */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">
                      📎 Arquivos e Fotos ({(drawer.evidences || []).length})
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {uploading ? (
                        <><span className="animate-spin">⏳</span> Enviando...</>
                      ) : (
                        <><span>+</span> Enviar arquivo</>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {uploadError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{uploadError}</p>
                  )}

                  {(drawer.evidences || []).length === 0 ? (
                    /* Área de drop visual quando vazio */
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                      <span className="text-3xl">📂</span>
                      <p className="text-sm font-medium">Clique para enviar fotos ou arquivos</p>
                      <p className="text-xs">Imagens, PDF, Word, Excel — até 20MB</p>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {/* Grid de imagens */}
                      {(drawer.evidences || []).filter((e: any) => e.fileType === 'image').length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {(drawer.evidences || []).filter((e: any) => e.fileType === 'image').map((ev: any) => (
                            <a key={ev.id} href={`${API_BASE}${ev.fileUrl}`} target="_blank" rel="noreferrer"
                              className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                              <img
                                src={`${API_BASE}${ev.fileUrl}`}
                                alt={ev.fileName}
                                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23e5e7eb" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236b7280" font-size="28">🖼</text></svg>' }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">Abrir</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Lista de documentos */}
                      {(drawer.evidences || []).filter((e: any) => e.fileType === 'document').map((ev: any) => (
                        <a key={ev.id} href={`${API_BASE}${ev.fileUrl}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 text-lg">
                            {ev.fileName?.endsWith('.pdf') ? '📄' : ev.fileName?.match(/\.(doc|docx)$/) ? '📝' : ev.fileName?.match(/\.(xls|xlsx)$/) ? '📊' : '📎'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{ev.fileName}</p>
                            <p className="text-xs text-gray-400">Enviado por {ev.user?.name || '—'}</p>
                          </div>
                          <span className="text-xs text-blue-500 group-hover:text-blue-700 flex-shrink-0">Baixar ↓</span>
                        </a>
                      ))}

                      {/* Botão para adicionar mais */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full border border-dashed border-gray-200 rounded-lg py-3 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                      >
                        <span>+</span> Adicionar mais arquivos
                      </button>
                    </div>
                  )}
                </div>

                {/* Comentários */}
                {(drawer.comments || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      💬 Comentários ({(drawer.comments || []).length})
                    </p>
                    <div className="space-y-2">
                      {(drawer.comments || []).map((c: any) => (
                        <div key={c.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(c.user?.name || 'U')[0]}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{c.user?.name}</p>
                            <p className="text-sm text-gray-600 mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Nova Tarefa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nova Tarefa</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Título da tarefa" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrição detalhada..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data limite</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                <select value={form.assignedToId} onChange={e => setForm({...form, assignedToId: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecionar responsável...</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.role?.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                <select value={form.unitId} onChange={e => setForm({...form, unitId: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecionar unidade...</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={createTask} disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
