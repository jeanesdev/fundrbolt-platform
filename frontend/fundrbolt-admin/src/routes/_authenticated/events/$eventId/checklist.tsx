import { EventChecklistPage } from '@/features/events/sections/EventChecklistPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/checklist',
)({
  component: EventChecklistPage,
})
