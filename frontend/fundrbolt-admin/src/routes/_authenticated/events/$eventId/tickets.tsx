import { createFileRoute } from '@tanstack/react-router'
import { TicketManagementLayout } from '@/features/events/tickets/TicketManagementLayout'

export const Route = createFileRoute('/_authenticated/events/$eventId/tickets')(
  {
    component: TicketManagementLayout,
  }
)
