'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import WorldClassOperations from '@/components/ops/WorldClassOperations'

export default function PessoasWorkspacePage() {
  return (
    <AdminLayout>
      <WorldClassOperations forcedView="pessoas" />
    </AdminLayout>
  )
}
