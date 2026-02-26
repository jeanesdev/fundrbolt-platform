import { QuickEntryPage } from '@/features/quick-entry'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/quick-entry')({
  component: QuickEntryPage,
})
