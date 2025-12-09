import { EventViewPage } from '@/features/events/EventViewPage'
import { createFileRoute } from '@tanstack/react-router'

/**
 * Event View Route
 * Read-only event view for donors - no editing
 */
export const Route = createFileRoute('/_authenticated/events/$eventId/')({
  component: EventViewPage,
})
