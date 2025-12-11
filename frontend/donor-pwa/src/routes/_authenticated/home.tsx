import { useEventContext } from '@/hooks/use-event-context'
import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Donor PWA Home Page
 * Redirects to the selected event or shows a message if no events
 */
function DonorHomePage() {
  const { selectedEventId, hasEvents } = useEventContext()

  // If user has a selected event, redirect to it
  if (selectedEventId) {
    return <Navigate to="/events/$eventId" params={{ eventId: selectedEventId }} />
  }

  // No events registered - show helpful message
  if (!hasEvents) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-6">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Welcome to Augeo</h1>
          <p className="text-muted-foreground mb-8">
            You haven't registered for any events yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Browse events and register to get started.
          </p>
        </div>
      </div>
    )
  }

  // Loading state while events are being fetched
  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your events...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/home')({
  component: DonorHomePage,
})
