import { EventPaymentsSection } from '@/features/events/sections/EventPaymentsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/payments')({
  component: RouteComponent,
})

function RouteComponent() {
  return <EventPaymentsSection />
}
