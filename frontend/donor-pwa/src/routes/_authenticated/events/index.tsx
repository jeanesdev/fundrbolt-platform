import { useEventContext } from '@/hooks/use-event-context'
import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Events Index Route
 * Redirects to the selected event - no event list in donor PWA
 */
function EventsIndexPage() {
  const { selectedEventId, hasEvents } = useEventContext()

  // Redirect to selected event
  if (selectedEventId) {
    return <Navigate to="/events/$eventId" params={{ eventId: selectedEventId }} />
  }

  // No events - redirect to home
  if (!hasEvents) {
    return <Navigate to="/home" />
  }

  return null
}

export const Route = createFileRoute('/_authenticated/events/')({
  component: EventsIndexPage,
})
