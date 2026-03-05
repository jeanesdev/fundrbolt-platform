import { PromoCodesPage } from '@/features/events/tickets/PromoCodesPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/promos'
)({
  component: PromoCodesPage,
})
