import { createFileRoute } from '@tanstack/react-router'
import { EventSeatingSection } from '@/features/events/sections/EventSeatingSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/seating')(
  {
    component: EventSeatingSection,
  }
)
