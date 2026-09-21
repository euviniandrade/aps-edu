'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

type InventoryItem = {
  id: string
  name: string
  category: string
  location: string
  unit: string
  quantity: number
  min: number
  owner: string
  updatedAt: string
}

const STORAGE_KEY = 'aps_edu_inventory_v1'

const seedItems: InventoryItem[] = [
  { id: 'EST-001', name: 'Notebooks pedagógicos', category: 'Tecnologia', location: 'Almoxarifado Central', unit: 'APS', quantity: 18, min: 10, owner: 'Tecnologia Educacional', updatedAt: '2026-09-01' },
  { id: 'EST-002', name: 'Projetores multimídia', category: 'Tecnologia', location: 'Sala de Recursos', unit: 'CAEA', quantity: 4, min: 5, owner: 'Coordenação', updatedAt: '2026-09-01' },
  { id: 'EST-003', name: 'Kits de matrícula', category: 'Secretaria', location: 'Secretaria APS', unit: 'APS', quantity: 42, min: 60, owner: 'Secretaria', updatedAt: '2026-09-01' },
  { id: 'EST-004', name: 'Bíblias para eventos', category: 'Pedagógico', location: 'Depósito Eventos', unit: 'Rede', quantity: 120, min: 80, owner: 'Pastoral Escolar', updatedAt: '2026-09-01' },
  { id: 'EST-005', name: 'Materiais de limpeza', category: 'Operação', location: 'Almoxarifado Central', unit: 'CAIS', quantity: 22, min: 25, owner: 'Serviços Gerais', updatedAt: '2026-09-01' },
  { id: 'EST-006', name: 'Uniformes de promotores', category: 'Marketing', location: 'Marketing APS', unit: 'APS', quantity: 9, min: 12, owner: 'Marketing', updatedAt: '2026-09-01' },
]

const emptyDraft: InventoryItem = {
  id: '',
  name: '',
  category: '',
  location: '',
  unit: '',
  quantity: 0,
  min: 0,
  owner: '',
  updatedAt: '',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function statusOf(item: InventoryItem) {
  if (item.quantity <= Math.max(0, Math.floor(item.min * 0.5))) return 'critical'
  if (item.quantity < item.min) return 'low'
  return 'ok'
}

const statusStyle = {
  ok: { label: 'Saudável', color: '#047857', bg: '#ecfdf5' },
  low: { label: 'Atenção', color: '#b45309', bg: '#fffbeb' },
  critical: { label: 'Crítico', color: '#be123c', bg: '#fff1f2' },
}

function readInventory() {
  if (typeof window === 'undefined') return seedItems
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedItems
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : seedItems
  } catch {
    return seedItems
  }
}

function saveInventory(items: InventoryItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function exportCsv(items: InventoryItem[]) {
  const rows = [
    ['ID', 'Item', 'Categoria', 'Local', 'Unidade', 'Quantidade', 'Mínimo', 'Status', 'Responsável', 'Atualizado em'],
    ...items.map(item => [item.id, item.name, item.category, item.location, item.unit, String(item.quantity), String(item.min), statusStyle[statusOf(item)].label, item.owner, item.updatedAt]),
  ]
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aps-edu-estoque-${todayIso()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function EstoquePage() {
  const [items, setItems] = useState<InventoryItem[]>(seedItems)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('todos')
  const [draft, setDraft] = useState<InventoryItem | null>(null)

  useEffect(() => {
    setItems(readInventory())
  }, [])

  function persist(next: InventoryItem[]) {
    setItems(next)
    saveInventory(next)
  }

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchesQuery = `${item.name} ${item.category} ${item.location} ${item.unit} ${item.owner}`.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = status === 'todos' || statusOf(item) === status
      return matchesQuery && matchesStatus
    })
  }, [items, query, status])

  const lowItems = items.filter(item => statusOf(item) !== 'ok')
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const locations = new Set(items.map(item => item.location).filter(Boolean)).size
  const categories = new Set(items.map(item => item.category).filter(Boolean)).size

  function openNew() {
    setDraft({ ...emptyDraft, id: `EST-${String(items.length + 1).padStart(3, '0')}`, updatedAt: todayIso() })
  }

  function saveDraft() {
    if (!draft?.name.trim()) return
    const clean = {
      ...draft,
      id: draft.id.trim() || `EST-${Date.now()}`,
      name: draft.name.trim(),
      category: draft.category.trim() || 'Sem categoria',
      location: draft.location.trim() || 'Sem local',
      unit: draft.unit.trim() || 'Rede',
      owner: draft.owner.trim() || 'Sem responsável',
      quantity: Math.max(0, Number(draft.quantity) || 0),
      min: Math.max(0, Number(draft.min) || 0),
      updatedAt: todayIso(),
    }
    const next = items.some(item => item.id === clean.id)
      ? items.map(item => item.id === clean.id ? clean : item)
      : [clean, ...items]
    persist(next)
    setDraft(null)
  }

  function removeItem(id: string) {
    persist(items.filter(item => item.id !== id))
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <header className="rounded-lg border border-[#dbe6ef] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Operação e patrimônio</p>
              <h1 className="mt-2 text-4xl font-black leading-none text-[#0f172a]">Estoque e ativos</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#64748b]">
                Controle de materiais por unidade, local, nível mínimo e responsável. Os registros ficam preservados no navegador até existir backend dedicado de inventário.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => persist(seedItems)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dbe6ef] bg-white px-4 text-sm font-black text-[#334155]">
                <ArrowPathIcon className="h-4 w-4" /> Restaurar base
              </button>
              <button onClick={() => exportCsv(items)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dbe6ef] bg-white px-4 text-sm font-black text-[#334155]">
                <ArrowDownTrayIcon className="h-4 w-4" /> Exportar CSV
              </button>
              <button onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f8a303] px-4 text-sm font-black text-[#0f172a]">
                <PlusIcon className="h-4 w-4" /> Novo item
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Itens monitorados" value={items.length} sub={`${totalQuantity} unidades físicas`} icon={ArchiveBoxIcon} color="#006b7a" />
          <StatCard label="Abaixo do mínimo" value={lowItems.length} sub="precisam de ação" icon={ExclamationTriangleIcon} color="#be123c" />
          <StatCard label="Locais" value={locations} sub="almoxarifados e salas" icon={MapPinIcon} color="#047857" />
          <StatCard label="Categorias" value={categories} sub="tipos de materiais" icon={ShoppingCartIcon} color="#b45309" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-[#dbe6ef] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-black text-[#0f172a]">Itens de estoque</h2>
                <p className="text-xs font-bold text-[#64748b]">Busca, edição e reposição por unidade.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar item..." className="h-10 w-full rounded-lg border border-[#dbe6ef] bg-white pl-9 pr-3 text-sm font-bold text-[#172033] outline-none md:w-64" />
                </label>
                <select value={status} onChange={event => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#dbe6ef] bg-white px-3 text-sm font-bold text-[#172033] outline-none">
                  <option value="todos">Todos</option>
                  <option value="ok">Saudáveis</option>
                  <option value="low">Atenção</option>
                  <option value="critical">Críticos</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-left text-xs uppercase text-[#718096]">
                    {['Item', 'Local', 'Unidade', 'Qtd.', 'Mínimo', 'Status', 'Responsável', ''].map(header => <th key={header} className="px-4 py-3 font-black">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const currentStatus = statusOf(item)
                    return (
                      <tr key={item.id} className="border-t border-[#edf2f7]">
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-[#172033]">{item.name}</p>
                          <p className="text-xs font-bold text-[#64748b]">{item.id} · {item.category}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#475569]">{item.location}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#475569]">{item.unit}</td>
                        <td className="px-4 py-3 text-sm font-black text-[#0f172a]">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#475569]">{item.min}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: statusStyle[currentStatus].bg, color: statusStyle[currentStatus].color }}>{statusStyle[currentStatus].label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-[#475569]">{item.owner}</p>
                          <p className="text-xs font-bold text-[#94a3b8]">Atualizado: {item.updatedAt}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => setDraft(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe6ef] bg-white text-[#006b7a]" aria-label={`Editar ${item.name}`}><PencilSquareIcon className="h-4 w-4" /></button>
                            <button onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#fde2e7] bg-[#fff8fa] text-[#be123c]" aria-label={`Excluir ${item.name}`}><TrashIcon className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-[#dbe6ef] bg-white p-5">
              <h2 className="text-base font-black text-[#0f172a]">Reposição sugerida</h2>
              <div className="mt-4 space-y-3">
                {lowItems.map(item => {
                  const currentStatus = statusOf(item)
                  return (
                    <button key={item.id} onClick={() => setDraft(item)} className="w-full rounded-lg border border-[#dbe6ef] bg-[#fbfdff] p-3 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[#172033]">{item.name}</p>
                          <p className="mt-1 text-xs font-bold text-[#64748b]">{item.unit} · comprar {Math.max(item.min - item.quantity, 1)} un.</p>
                        </div>
                        <span className="rounded-md px-2 py-1 text-xs font-black" style={{ color: statusStyle[currentStatus].color, background: statusStyle[currentStatus].bg }}>
                          {item.quantity}/{item.min}
                        </span>
                      </div>
                    </button>
                  )
                })}
                {!lowItems.length && <p className="rounded-lg bg-[#ecfdf5] p-4 text-sm font-bold text-[#047857]">Tudo acima do mínimo.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-[#dbe6ef] bg-[#f9fcff] p-5">
              <h2 className="text-base font-black text-[#0f172a]">Ferramentas ativas</h2>
              <div className="mt-4 grid gap-2 text-sm font-bold text-[#64748b]">
                <p>Cadastro e edição de itens</p>
                <p>Reposição automática por mínimo</p>
                <p>Exportação CSV</p>
                <p>Persistência local preservada</p>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {draft && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-[#0f172a]/45 p-4 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <div className="w-full max-w-2xl rounded-lg border border-[#dbe6ef] bg-white p-5 shadow-[0_30px_100px_rgba(15,23,42,0.25)]" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Ficha de estoque</p>
                <h2 className="mt-1 text-2xl font-black text-[#0f172a]">{items.some(item => item.id === draft.id) ? 'Editar item' : 'Novo item'}</h2>
              </div>
              <button onClick={() => setDraft(null)} className="h-9 rounded-lg border border-[#dbe6ef] px-3 text-sm font-black text-[#475569]">Fechar</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="ID" value={draft.id} onChange={value => setDraft({ ...draft, id: value })} />
              <Field label="Item" value={draft.name} onChange={value => setDraft({ ...draft, name: value })} />
              <Field label="Categoria" value={draft.category} onChange={value => setDraft({ ...draft, category: value })} />
              <Field label="Local" value={draft.location} onChange={value => setDraft({ ...draft, location: value })} />
              <Field label="Unidade" value={draft.unit} onChange={value => setDraft({ ...draft, unit: value })} />
              <Field label="Responsável" value={draft.owner} onChange={value => setDraft({ ...draft, owner: value })} />
              <Field label="Quantidade" type="number" value={String(draft.quantity)} onChange={value => setDraft({ ...draft, quantity: Number(value) })} />
              <Field label="Mínimo" type="number" value={String(draft.min)} onChange={value => setDraft({ ...draft, min: Number(value) })} />
            </div>
            <button onClick={saveDraft} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#006b7a] px-4 text-sm font-black text-white">
              Salvar item
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub: string; icon: any; color: string }) {
  return (
    <div className="rounded-lg border border-[#dbe6ef] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-[#718096]">{label}</p>
          <p className="mt-2 text-3xl font-black" style={{ color }}>{value}</p>
          <p className="mt-1 text-sm font-semibold text-[#64748b]">{sub}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: `${color}12`, border: `1px solid ${color}28` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-black uppercase text-[#718096]">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} className="h-11 rounded-lg border border-[#dbe6ef] bg-white px-3 text-sm font-bold text-[#172033] outline-none" />
    </label>
  )
}
