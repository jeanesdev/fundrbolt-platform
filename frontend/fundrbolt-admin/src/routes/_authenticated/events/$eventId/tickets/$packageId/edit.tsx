import { TicketPackageEditPage } from '@/features/events/tickets/TicketPackageEditPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/$packageId/edit',
)({
  component: TicketPackageEditPage,
})
