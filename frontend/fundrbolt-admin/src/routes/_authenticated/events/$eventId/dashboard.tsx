import { createFileRoute } from '@tanstack/react-router'
import { EventDashboardPage } from '@/features/event-dashboard'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/dashboard'
)({
  component: EventDashboardPage,
})
