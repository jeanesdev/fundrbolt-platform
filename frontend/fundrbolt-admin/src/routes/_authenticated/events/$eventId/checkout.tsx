import { createFileRoute } from '@tanstack/react-router'
import { EventCheckoutSection } from '@/features/events/sections/EventCheckoutSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/checkout'
)({
  component: EventCheckoutSection,
})
