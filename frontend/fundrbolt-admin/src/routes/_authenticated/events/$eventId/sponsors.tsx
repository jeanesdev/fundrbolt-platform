import { EventSponsorsSection } from '@/features/events/sections/EventSponsorsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/sponsors')({
  component: EventSponsorsSection,
})
