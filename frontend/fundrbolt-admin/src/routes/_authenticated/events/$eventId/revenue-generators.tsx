import { createFileRoute } from '@tanstack/react-router'
import { EventRevenueGeneratorsSection } from '@/features/events/sections/EventRevenueGeneratorsSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/revenue-generators'
)({
  component: EventRevenueGeneratorsSection,
})
