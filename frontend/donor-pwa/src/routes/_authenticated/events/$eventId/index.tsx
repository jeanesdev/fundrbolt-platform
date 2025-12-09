import { EventHomePage } from '@/features/events/EventHomePage'
import { createFileRoute } from '@tanstack/react-router'

/**
 * Event Homepage Route
 * Immersive, event-branded homepage for donors
 */
export const Route = createFileRoute('/_authenticated/events/$eventId/')({
  component: EventHomePage,
})
