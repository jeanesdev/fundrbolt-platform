import { EventDashboardPage } from '@/features/event-dashboard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/dashboard')({
  component: EventDashboardPage,
})
