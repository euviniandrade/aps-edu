'use client'

import AdminLayout from '@/components/layout/AdminLayout'
import WorldClassOperations from '@/components/ops/WorldClassOperations'

export default function KanbanPage() {
  return (
    <AdminLayout>
      <WorldClassOperations forcedView="kanban" />
    </AdminLayout>
  )
}
