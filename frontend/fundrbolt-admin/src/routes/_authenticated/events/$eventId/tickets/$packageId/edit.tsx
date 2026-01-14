import { createFileRoute } from '@tanstack/react-router'
import { TicketPackageEditPage } from '@/features/events/tickets/TicketPackageEditPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/$packageId/edit',
)({
  component: TicketPackageEditPage,
})
