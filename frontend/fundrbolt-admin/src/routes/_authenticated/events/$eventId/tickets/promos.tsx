import { createFileRoute } from '@tanstack/react-router'
import { PromoCodesPage } from '@/features/events/tickets/PromoCodesPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/promos'
)({
  component: PromoCodesPage,
})
