import { TicketManagementLayout } from '@/features/events/tickets/TicketManagementLayout'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/tickets')({
  component: TicketManagementLayout,
})
