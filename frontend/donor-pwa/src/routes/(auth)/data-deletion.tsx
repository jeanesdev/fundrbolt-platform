import { createFileRoute } from '@tanstack/react-router'
import { DataDeletionPage } from '@/pages/legal'

export const Route = createFileRoute('/(auth)/data-deletion')({
  component: DataDeletionPage,
})
