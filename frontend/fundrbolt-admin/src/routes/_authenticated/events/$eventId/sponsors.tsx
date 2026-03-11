import { createFileRoute } from '@tanstack/react-router'
import { EventSponsorsSection } from '@/features/events/sections/EventSponsorsSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/sponsors'
)({
  component: EventSponsorsSection,
})
