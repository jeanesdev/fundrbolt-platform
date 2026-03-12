import { createFileRoute } from '@tanstack/react-router'
import { QuickEntryPage } from '@/features/quick-entry'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/quick-entry'
)({
  component: QuickEntryPage,
})
