'use client'
import { useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', overdue: 'Atrasada',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:     { bg: 'rgba(255,255,255,0.07)',  color: 'rgba(255,255,255,0.5)' },
  in_progress: { bg: 'rgba(249,194,52,0.12)',   color: '#F9C234' },
  completed:   { bg: 'rgba(10,189,120,0.12)',   color: '#0ABD78' },
  overdue:     { bg: 'rgba(255,71,87,0.12)',    color: '#FF4757' },
}
const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  low:      { bg: 'rgba(74,158,255,0.1)',   color: '#4A9EFF' },
  medium:   { bg: 'rgba(249,194,52,0.1)',   color: '#F9C234' },
  high:     { bg: 'rgba(224,123,57,0.12)',  color: '#E07B39' },
  critical: { bg: 'rgba(255,71,87,0.12)',   color: '#FF4757' },
}
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica',
}

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

export default function TasksPage() {
  const [tasks, setTasks]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter]   = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch]           = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [users, setUsers]             = useState<any[]>([])
  const [units, setUnits]             = useState<any[]>([])
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', assignedToId: '', unitId: '' })
  const [saving, setSaving]           = useState(false)

  const { success, error: toastError } = useToast()
  const [drawer, setDrawer]           = useState<any>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef                  = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ taskId: string; title: string } | null>(null)

  const exportCSV = () => {
    const filtered = tasks.filter(t => !search || t.title?.toLowerCase().includes(search.toLowerCase()))
    const header = ['Título', 'Status', 'Prioridade', 'Unidade', 'Responsável', 'Vencimento', 'Criação']
    const rows = filtered.map(t => [
      t.title || '',
      STATUS_LABELS[t.status] || t.status || '',
      PRIORITY_LABELS[t.priority] || t.priority || '',
      t.unit?.name || t.unitId || '',
      t.assignedTo?.name || t.assignedToId || '',
      t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '',
      t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '',
    ])
    const csv = [header, ...rows].map(r => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `tarefas_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    success('CSV exportado com sucesso!')
  }

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
      success('Tarefa criada!', `"${form.title}" foi adicionada com sucesso.`)
      load()
    } catch (e: any) {
      toastError('Erro ao criar tarefa', e?.response?.data?.error || e.message)
    } finally { setSaving(false) }
  }

  const deleteTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      if (drawer?.id === taskId) setDrawer(null)
      success('Tarefa excluída', 'A tarefa foi removida permanentemente.')
    } catch (e: any) {
      toastError('Erro ao excluir', e?.response?.data?.error || e.message)
    }
    setConfirmDelete(null)
  }

  const filtered = tasks.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.assignedTo?.name?.toLowerCase().includes(search.toLowerCase())
  )
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Tarefas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
            title="Exportar CSV"
          >
            ↓ CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #F8A303, #FDC347)',
              color: '#000',
              boxShadow: '0 4px 20px rgba(248,163,3,0.3)',
            }}
          >
            + Nova Tarefa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 mb-4 flex flex-wrap gap-3 animate-fade-in-up"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <input
          type="search" placeholder="Buscar tarefa ou responsável..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm w-64 outline-none"
          style={darkField}
        />
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={darkField}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={darkField}
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="ml-auto text-sm flex items-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden animate-fade-in-up delay-100"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="animate-spin rounded-full h-8 w-8 border-2"
              style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Nenhuma tarefa encontrada
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Tarefa', 'Status', 'Prioridade', 'Responsável', 'Vencimento', 'Progresso', 'Arquivos'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task: any, idx: number) => {
                const ss = STATUS_STYLE[task.status] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
                const ps = PRIORITY_STYLE[task.priority] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
                return (
                  <tr
                    key={task.id}
                    onClick={() => openDrawer(task)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white max-w-xs truncate">{task.title}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{task.unit?.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}30` }}
                      >
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}30` }}
                      >
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'rgba(74,158,255,0.2)', color: '#4A9EFF' }}
                          >
                            {(task.assignedTo.name || 'U')[0]}
                          </div>
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{task.assignedTo.name}</span>
                        </div>
                      ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: task.status === 'overdue' ? '#FF4757' : 'rgba(255,255,255,0.5)' }}>
                        {formatDate(task.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 w-28">
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.08)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${task.progressPercent || 0}%`,
                              background: 'linear-gradient(90deg, #0ABD78, #4A9EFF)',
                            }}
                          />
                        </div>
                        <span className="text-xs w-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {task.progressPercent || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        📎 {task._count?.evidences || 0}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══ DRAWER ══ */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setDrawer(null)}
          />
          <div
            className="w-full max-w-xl h-full overflow-y-auto flex flex-col"
            style={{
              background: 'rgba(8,10,24,0.99)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-24px 0 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Drawer header */}
            <div
              className="flex items-start justify-between p-6 sticky top-0 z-10"
              style={{
                background: 'rgba(8,10,24,0.99)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex-1 pr-4">
                <h2 className="text-base font-bold text-white leading-tight">{drawer.title}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {(() => {
                    const ss = STATUS_STYLE[drawer.status] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
                    const ps = PRIORITY_STYLE[drawer.priority] || { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
                    return (
                      <>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: ss.bg, color: ss.color }}>
                          {STATUS_LABELS[drawer.status] || drawer.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: ps.bg, color: ps.color }}>
                          {PRIORITY_LABELS[drawer.priority] || drawer.priority}
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete({ taskId: drawer.id, title: drawer.title })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', color: '#FF4757' }}
                  title="Excluir tarefa"
                >
                  🗑 Excluir
                </button>
                <button
                  onClick={() => setDrawer(null)}
                  className="text-xl leading-none transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {drawerLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
              </div>
            ) : (
              <div className="flex-1 p-6 space-y-6">

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Responsável', value: drawer.assignedTo?.name || '—' },
                    { label: 'Vencimento',  value: formatDate(drawer.dueDate) },
                    { label: 'Unidade',     value: drawer.unit?.name || '—' },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="rounded-xl p-3"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                      <p className="font-medium text-white">{item.value}</p>
                    </div>
                  ))}
                  <div
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Progresso</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${drawer.progressPercent || 0}%`,
                            background: 'linear-gradient(90deg, #0ABD78, #4A9EFF)',
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: '#0ABD78' }}>
                        {drawer.progressPercent || 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {drawer.description && (
                  <div
                    className="rounded-xl p-3 text-sm"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    <p className="text-xs mb-1 font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Descrição</p>
                    {drawer.description}
                  </div>
                )}

                {/* Checklist */}
                {(drawer.checklists || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-white mb-2">
                      Checklist ({(drawer.checklists || []).filter((c: any) => c.isCompleted).length}/{(drawer.checklists || []).length})
                    </p>
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      {(drawer.checklists || []).map((item: any, i: number) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2.5"
                          style={{ borderBottom: i < (drawer.checklists.length - 1) ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                            style={item.isCompleted
                              ? { background: '#0ABD78' }
                              : { border: '1.5px solid rgba(255,255,255,0.2)' }
                            }
                          >
                            {item.isCompleted && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span
                            className="text-sm"
                            style={{ color: item.isCompleted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)', textDecoration: item.isCompleted ? 'line-through' : 'none' }}
                          >
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">
                      📎 Arquivos e Fotos ({(drawer.evidences || []).length})
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-60"
                      style={{
                        background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                        color: '#000',
                        boxShadow: '0 2px 12px rgba(248,163,3,0.3)',
                      }}
                    >
                      {uploading ? <><span className="animate-spin">⏳</span> Enviando...</> : <>+ Enviar arquivo</>}
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
                    <p
                      className="text-xs rounded-lg px-3 py-2 mb-3"
                      style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', color: '#FF4757' }}
                    >
                      {uploadError}
                    </p>
                  )}

                  {(drawer.evidences || []).length === 0 ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-xl py-8 flex flex-col items-center gap-2 transition-colors"
                      style={{ border: '2px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.25)' }}
                    >
                      <span className="text-3xl">📂</span>
                      <p className="text-sm font-medium">Clique para enviar fotos ou arquivos</p>
                      <p className="text-xs">Imagens, PDF, Word, Excel — até 20MB</p>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {(drawer.evidences || []).filter((e: any) => e.fileType === 'image').length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {(drawer.evidences || []).filter((e: any) => e.fileType === 'image').map((ev: any) => (
                            <a
                              key={ev.id}
                              href={`${API_BASE}${ev.fileUrl}`}
                              target="_blank" rel="noreferrer"
                              className="relative group aspect-square rounded-xl overflow-hidden block"
                              style={{ background: 'rgba(255,255,255,0.05)' }}
                            >
                              <img
                                src={`${API_BASE}${ev.fileUrl}`}
                                alt={ev.fileName}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium">Abrir</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                      {(drawer.evidences || []).filter((e: any) => e.fileType === 'document').map((ev: any) => (
                        <a
                          key={ev.id}
                          href={`${API_BASE}${ev.fileUrl}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl transition-colors group"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                            style={{ background: 'rgba(74,158,255,0.1)' }}
                          >
                            {ev.fileName?.endsWith('.pdf') ? '📄' : ev.fileName?.match(/\.(doc|docx)$/) ? '📝' : ev.fileName?.match(/\.(xls|xlsx)$/) ? '📊' : '📎'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{ev.fileName}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>por {ev.user?.name || '—'}</p>
                          </div>
                          <span className="text-xs flex-shrink-0" style={{ color: '#4A9EFF' }}>Baixar ↓</span>
                        </a>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full rounded-xl py-3 text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                        style={{ border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}
                      >
                        + Adicionar mais arquivos
                      </button>
                    </div>
                  )}
                </div>

                {/* Comments */}
                {(drawer.comments || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-white mb-2">
                      💬 Comentários ({(drawer.comments || []).length})
                    </p>
                    <div className="space-y-2">
                      {(drawer.comments || []).map((c: any) => (
                        <div
                          key={c.id}
                          className="flex gap-3 p-3 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000' }}
                          >
                            {(c.user?.name || 'U')[0]}
                          </div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{c.user?.name}</p>
                            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.content}</p>
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

      {/* ══ NEW TASK MODAL ══ */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="rounded-2xl w-full max-w-lg animate-scale-in"
            style={{
              background: 'rgba(8,10,24,0.99)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-base font-bold text-white">Nova Tarefa</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Título *
                </label>
                <input
                  type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={darkField} placeholder="Título da tarefa"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={darkField} placeholder="Descrição detalhada..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Prioridade
                  </label>
                  <select
                    value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={darkField}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Data limite
                  </label>
                  <input
                    type="date" value={form.dueDate}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={darkField}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Responsável
                </label>
                <select
                  value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={darkField}
                >
                  <option value="">Selecionar responsável...</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.role?.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Unidade
                </label>
                <select
                  value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={darkField}
                >
                  <option value="">Selecionar unidade...</option>
                  {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div
              className="p-6 flex justify-end gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancelar
              </button>
              <button
                onClick={createTask}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm rounded-xl font-bold transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                  color: '#000',
                  boxShadow: '0 4px 16px rgba(248,163,3,0.3)',
                }}
              >
                {saving ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title="Excluir Tarefa"
        message={`Tem certeza que deseja excluir "${confirmDelete?.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => confirmDelete && deleteTask(confirmDelete.taskId)}
        onCancel={() => setConfirmDelete(null)}
      />
    </AdminLayout>
  )
}
