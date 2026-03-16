import { createFileRoute } from '@tanstack/react-router'
import { EventNotificationsSection } from '@/features/events/sections/EventNotificationsSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/notifications'
)({
  component: EventNotificationsSection,
})
