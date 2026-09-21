'use client'

import { useEffect, useState } from 'react'
import { CpuChipIcon, ShieldCheckIcon, SparklesIcon } from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'
import AiAssistant from '@/components/ai/AiAssistant'

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
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end">
        <div><p className="text-xs font-bold uppercase text-violet-700">Inteligência operacional</p><h1 className="mt-1 text-3xl font-bold text-slate-950">IA da Educação</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Assistente executiva com memória, criação de tarefas, análise de documentos e roteamento automático entre provedores.</p></div>
        <div className="flex flex-wrap gap-2"><span className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-xs font-bold ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />{status === null ? 'Verificando provedores' : ready ? `${ready} provedor${ready > 1 ? 'es' : ''} operacional${ready > 1 ? 'ais' : ''}` : 'Provedor não configurado'}</span><span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"><ShieldCheckIcon className="h-4 w-4 text-teal-700" />Sessão protegida</span></div>
      </header>
      <div className="grid grid-cols-3 gap-3">
        <Info icon={SparklesIcon} label="Capacidade" value="Análise e execução" />
        <Info icon={CpuChipIcon} label="Roteamento" value="Fallback automático" />
        <Info icon={ShieldCheckIcon} label="Contexto" value="Memória persistente" />
      </div>
      <div className="h-[calc(100vh-16.5rem)] min-h-[620px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,42,74,0.10)]"><AiAssistant embedded /></div>
    </div>
  </AdminLayout>
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"><Icon className="h-5 w-5 text-violet-700" /><div><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="text-sm font-bold text-slate-900">{value}</p></div></div>
}
