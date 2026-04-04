import { createFileRoute } from '@tanstack/react-router'
import { EventChecklistPage } from '@/features/events/sections/EventChecklistPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/checklist'
)({
  component: EventChecklistPage,
})
