import { EventDetailsSection } from '@/features/events/sections/EventDetailsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/details')({
  component: EventDetailsSection,
})
