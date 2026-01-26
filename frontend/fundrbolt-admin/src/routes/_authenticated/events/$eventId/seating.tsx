import { EventSeatingSection } from '@/features/events/sections/EventSeatingSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/seating')({
  component: EventSeatingSection,
})
