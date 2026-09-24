'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import AiIntelligenceCenter from '@/components/ai/AiIntelligenceCenter'

export default function InovacaoPage() {
  return <AdminLayout>
    <div className="sofi-workspace h-[calc(100vh-120px)] min-h-[620px] overflow-hidden rounded-lg border border-[#dce3dc] bg-white">
      <AiIntelligenceCenter />
    </div>
  </AdminLayout>
}
