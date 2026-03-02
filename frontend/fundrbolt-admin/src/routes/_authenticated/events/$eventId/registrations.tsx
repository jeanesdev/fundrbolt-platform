import { EventRegistrationsSection } from '@/features/events/sections/EventRegistrationsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/registrations')({
  component: EventRegistrationsSection,
})
