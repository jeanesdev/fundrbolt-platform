import { EventCheckInSection } from '@/features/events/sections/EventCheckInSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/checkin')({
  component: EventCheckInSection,
})
