import { useEventContext } from '@/hooks/use-event-context'
import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Events Index Route
 * Redirects to the selected event - no event list in donor PWA
 */
function EventsIndexPage() {
  const { selectedEventSlug, hasEvents } = useEventContext()

  // Redirect to selected event
  if (selectedEventSlug) {
    return <Navigate to="/events/$eventSlug" params={{ eventSlug: selectedEventSlug }} />
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
