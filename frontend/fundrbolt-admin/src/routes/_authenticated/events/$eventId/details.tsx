import { createFileRoute } from '@tanstack/react-router'
import { EventDetailsSection } from '@/features/events/sections/EventDetailsSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/details')(
  {
    component: EventDetailsSection,
  }
)
