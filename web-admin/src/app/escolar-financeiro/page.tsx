'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import WorldClassOperations from '@/components/ops/WorldClassOperations'

export default function EscolarFinanceiroPage() {
  return (
    <AdminLayout>
      <WorldClassOperations forcedView="escolar" />
    </AdminLayout>
  )
}
