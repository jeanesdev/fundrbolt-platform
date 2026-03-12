import { createFileRoute } from '@tanstack/react-router'
import { TicketPackageCreatePage } from '@/features/events/tickets/TicketPackageCreatePage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/create'
)({
  component: TicketPackageCreatePage,
})
