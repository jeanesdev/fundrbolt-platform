import { useEventContextStore } from '@/stores/event-context-store'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Donor PWA Home Page
 * Redirects to the selected event or shows a message if no events.
 *
 * Uses the same query key as the authenticated layout so TanStack Query
 * deduplicates the request and uses the cache. We wait for this to resolve
 * before redirecting so that a stale persisted slug never causes a 404 —
 * we look up the current slug via the stable event UUID in the fresh API data.
 */
function DonorHomePage() {
  // Read the persisted selected event UUID (stable, never changes when slug changes)
  const selectedEventId = useEventContextStore((state) => state.selectedEventId)
  const user = useAuthStore((state) => state.user)

  // Use the same query key as authenticated-layout — TanStack Query deduplicates
  // the request so there is no extra network call.
  const { data: registrationsData, isLoading } = useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })

  // Wait for fresh data before deciding where to redirect so a stale persisted
  // slug never causes a 404 (e.g. admin renamed the event).
  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your events...</p>
        </div>
      </div>
    )
  }

  // Use the query result directly (not the Zustand store) to avoid the timing
  // gap between the query returning and the store being populated.
  const events = registrationsData?.events ?? []

  // Resolve the redirect target using the stable event UUID so that a slug
  // change (e.g. admin renames the event) never results in a stale redirect.
  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : null
  const targetSlug = selectedEvent?.slug ?? events[0]?.slug ?? null

  if (targetSlug) {
    return <Navigate to="/events/$eventSlug" params={{ eventSlug: targetSlug }} />
  }

  // No events registered - show helpful message
  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="text-center py-12">
        <h1 className="text-3xl font-bold mb-4">Welcome to FundrBolt</h1>
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

export const Route = createFileRoute('/_authenticated/home')({
  component: DonorHomePage,
})
