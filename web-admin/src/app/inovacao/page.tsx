'use client'

import { useEffect, useState } from 'react'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'
import AiIntelligenceCenter from '@/components/ai/AiIntelligenceCenter'

type AiStatus = { configured?: number; total?: number; providers?: { id: string; name: string; configured: boolean }[] }

export default function InovacaoPage() {
  const [status, setStatus] = useState<AiStatus | null>(null)

  useEffect(() => {
    fetch('/api/ai/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setStatus)
      .catch(() => setStatus({ configured: 0, total: 0, providers: [] }))
  }, [])

  const ready = Number(status?.configured || 0)

  return <AdminLayout>
    <div className="mx-auto max-w-[1600px] space-y-4 pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div><p className="text-[11px] font-bold uppercase text-teal-700">Espaço de trabalho</p><h1 className="text-2xl font-semibold text-slate-950">Sofi</h1></div>
        <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />{status === null ? 'Verificando IA' : ready ? `${ready} provedor${ready > 1 ? 'es' : ''} disponível${ready > 1 ? 'eis' : ''}` : 'IA não configurada'}</span><span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><ShieldCheckIcon className="h-4 w-4 text-teal-700" />Ações sob aprovação</span></div>
      </header>
      <div className="sofi-workspace h-[calc(100vh-12.5rem)] min-h-[620px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,42,74,0.10)]"><AiIntelligenceCenter /></div>
    </div>
  </AdminLayout>
}
