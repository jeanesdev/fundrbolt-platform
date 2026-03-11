import { createFileRoute } from '@tanstack/react-router'
import { EventRegistrationsSection } from '@/features/events/sections/EventRegistrationsSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/registrations'
)({
  component: EventRegistrationsSection,
})
