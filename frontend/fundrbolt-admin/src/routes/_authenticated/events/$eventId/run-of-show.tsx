import { createFileRoute } from '@tanstack/react-router'
import { EventRunOfShowPage } from '@/features/events/sections/EventRunOfShowPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/run-of-show'
)({
  component: EventRunOfShowPage,
})
