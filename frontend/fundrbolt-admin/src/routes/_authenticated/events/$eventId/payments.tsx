import { createFileRoute } from '@tanstack/react-router'
import { EventPaymentsSection } from '@/features/events/sections/EventPaymentsSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/payments'
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <EventPaymentsSection />
}
