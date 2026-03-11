import { createFileRoute } from '@tanstack/react-router'
import { TicketPackagesIndexPage } from '@/features/events/tickets/TicketPackagesIndexPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/'
)({
  component: TicketPackagesIndexPage,
})
