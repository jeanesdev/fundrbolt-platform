import { createFileRoute } from '@tanstack/react-router'
import { EventPageSetupSection } from '@/features/events/sections/EventPageSetupSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/page-setup'
)({
  component: EventPageSetupSection,
})
