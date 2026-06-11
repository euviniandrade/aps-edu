'use client'

import { useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PlusIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'

type InventoryItem = {
  id: string
  name: string
  category: string
  location: string
  unit: string
  quantity: number
  min: number
  status: 'ok' | 'low' | 'critical'
  owner: string
  updatedAt: string
}

const items: InventoryItem[] = [
  { id: 'EST-001', name: 'Notebooks pedagógicos', category: 'Tecnologia', location: 'Almoxarifado Central', unit: 'APS', quantity: 18, min: 10, status: 'ok', owner: 'Tecnologia Educacional', updatedAt: 'Hoje' },
  { id: 'EST-002', name: 'Projetores multimídia', category: 'Tecnologia', location: 'Sala de Recursos', unit: 'CAEA', quantity: 4, min: 5, status: 'low', owner: 'Coordenação', updatedAt: 'Ontem' },
  { id: 'EST-003', name: 'Kits de matrícula', category: 'Secretaria', location: 'Secretaria APS', unit: 'APS', quantity: 42, min: 60, status: 'critical', owner: 'Secretaria', updatedAt: '2 dias' },
  { id: 'EST-004', name: 'Bíblias para eventos', category: 'Pedagógico', location: 'Depósito Eventos', unit: 'Rede', quantity: 120, min: 80, status: 'ok', owner: 'Pastoral Escolar', updatedAt: 'Hoje' },
  { id: 'EST-005', name: 'Materiais de limpeza', category: 'Operação', location: 'Almoxarifado Central', unit: 'CAIS', quantity: 22, min: 25, status: 'low', owner: 'Serviços Gerais', updatedAt: 'Hoje' },
  { id: 'EST-006', name: 'Uniformes de promotores', category: 'Marketing', location: 'Marketing APS', unit: 'APS', quantity: 9, min: 12, status: 'low', owner: 'Marketing', updatedAt: '3 dias' },
]

const statusStyle = {
  ok: { label: 'Saudável', color: '#0ABD78', bg: 'rgba(10,189,120,0.10)' },
  low: { label: 'Atenção', color: '#F8A303', bg: 'rgba(248,163,3,0.12)' },
  critical: { label: 'Crítico', color: '#FF4757', bg: 'rgba(255,71,87,0.12)' },
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub: string; icon: any; color: string }) {
  return (
    <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
          <p className="mt-2 text-3xl font-black" style={{ color }}>{value}</p>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

export default function EstoquePage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('todos')

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchesQuery = `${item.name} ${item.category} ${item.location} ${item.unit}`.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = status === 'todos' || item.status === status
      return matchesQuery && matchesStatus
    })
  }, [query, status])

  const lowCount = items.filter(item => item.status !== 'ok').length
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const locations = new Set(items.map(item => item.location)).size
  const categories = new Set(items.map(item => item.category)).size

  return (
    <AdminLayout>
      <div className="min-h-full p-4 lg:p-8 space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Educação Adventista <span>/</span> Operação
            </div>
            <h1 className="mt-4 text-3xl font-black text-white">Estoque e Ativos</h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: 'rgba(255,255,255,0.48)' }}>
              Controle de materiais, patrimônio, almoxarifado e reposição por unidade.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <ArrowPathIcon className="h-4 w-4" /> Inventário
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-black" style={{ background: '#F8A303' }}>
              <PlusIcon className="h-4 w-4" /> Novo item
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Itens monitorados" value={items.length} sub={`${totalQuantity} unidades físicas`} icon={ArchiveBoxIcon} color="#4A9EFF" />
          <StatCard label="Abaixo do mínimo" value={lowCount} sub="precisam de ação" icon={ExclamationTriangleIcon} color="#FF4757" />
          <StatCard label="Locais" value={locations} sub="almoxarifados e salas" icon={MapPinIcon} color="#0ABD78" />
          <StatCard label="Categorias" value={categories} sub="tipos de materiais" icon={ShoppingCartIcon} color="#F8A303" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-lg" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-base font-bold text-white">Itens de estoque</h2>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>Visão consolidada por unidade, local e nível mínimo.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar item..."
                    className="h-10 w-full rounded-lg pl-9 pr-3 text-sm outline-none md:w-56"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'white' }}
                  />
                </div>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="h-10 rounded-lg px-3 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'white' }}
                >
                  <option value="todos">Todos</option>
                  <option value="ok">Saudáveis</option>
                  <option value="low">Atenção</option>
                  <option value="critical">Críticos</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Local</th>
                    <th className="px-4 py-3 font-semibold">Unidade</th>
                    <th className="px-4 py-3 font-semibold">Qtd.</th>
                    <th className="px-4 py-3 font-semibold">Mínimo</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.id} · {item.category}</p>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.location}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.unit}</td>
                      <td className="px-4 py-3 text-sm font-bold text-white">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.min}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: statusStyle[item.status].bg, color: statusStyle[item.status].color }}>
                          {statusStyle[item.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.owner}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>Atualizado: {item.updatedAt}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-base font-bold text-white">Reposição sugerida</h2>
              <div className="mt-4 space-y-3">
                {items.filter(item => item.status !== 'ok').map(item => (
                  <div key={item.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>{item.unit} · comprar {Math.max(item.min - item.quantity, 1)} un.</p>
                      </div>
                      <span className="rounded-md px-2 py-1 text-xs font-bold" style={{ color: statusStyle[item.status].color, background: statusStyle[item.status].bg }}>
                        {item.quantity}/{item.min}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-5" style={{ background: 'linear-gradient(135deg, rgba(248,163,3,0.16), rgba(74,158,255,0.08))', border: '1px solid rgba(248,163,3,0.18)' }}>
              <h2 className="text-base font-bold text-white">Próximos módulos</h2>
              <div className="mt-4 space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.62)' }}>
                <p>Compras e solicitações por unidade</p>
                <p>Patrimônio com QR Code</p>
                <p>Transferência entre colégios</p>
                <p>Histórico de baixas e auditoria</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AdminLayout>
  )
}
