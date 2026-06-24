'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import AiAssistant from '@/components/ai/AiAssistant'

export default function InovacaoPage() {
  return (
    <AdminLayout>
      <div className="h-[calc(100vh-7.5rem)] overflow-hidden rounded-[2rem]">
        <AiAssistant embedded />
      </div>
    </AdminLayout>
  )
}
