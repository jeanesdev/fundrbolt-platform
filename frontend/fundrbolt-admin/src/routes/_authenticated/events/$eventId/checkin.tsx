import { createFileRoute } from '@tanstack/react-router'
import { EventCheckInSection } from '@/features/events/sections/EventCheckInSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/checkin')(
  {
    component: EventCheckInSection,
  }
)
