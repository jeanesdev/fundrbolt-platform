import { EventCheckinSection } from '@/features/events/sections/EventCheckinSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/checkin')({
  component: EventCheckinSection,
})
