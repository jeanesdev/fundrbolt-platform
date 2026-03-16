import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { getMyInventory } from '@/lib/api/ticket-purchases'
import { useEventContext } from '@/hooks/use-event-context'

/**
 * Donor PWA Home Page
 * Redirects to the selected event, or shows ticket inventory, or prompts to browse.
 */
function DonorHomePage() {
  const {
    selectedEventSlug,
    hasEvents,
    isLoading: eventsLoading,
  } = useEventContext()

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ['ticket-inventory'],
    queryFn: getMyInventory,
    // Only fetch if we know the user has no event registrations
    enabled: !eventsLoading && !hasEvents,
  })

  // If user has a selected event, redirect to it
  if (selectedEventSlug) {
    return (
      <Navigate
        to='/events/$eventSlug'
        params={{ eventSlug: selectedEventSlug }}
      />
    )
  }

  // Loading state while events are being fetched
  if (eventsLoading) {
    return (
      <div className='container mx-auto space-y-6 px-4 py-6'>
        <div className='py-12 text-center'>
          <div className='border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Loading your events...</p>
        </div>
      </div>
    )
  }

  // No event registrations — check ticket inventory
  if (!hasEvents) {
    if (inventoryLoading) {
      return (
        <div className='container mx-auto space-y-6 px-4 py-6'>
          <div className='py-12 text-center'>
            <div className='border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
            <p className='text-muted-foreground'>Loading your tickets...</p>
          </div>
        </div>
      )
    }

    // Has tickets but no registrations — redirect to ticket inventory
    if (inventory && inventory.total_tickets > 0) {
      return <Navigate to='/tickets' />
    }

    // No events and no tickets — show browse prompt
    return (
      <div className='container mx-auto space-y-6 px-4 py-6'>
        <div className='py-12 text-center'>
          <h1 className='mb-4 text-3xl font-bold'>Welcome to Fundrbolt</h1>
          <p className='text-muted-foreground mb-8'>
            You haven&apos;t registered for any events yet.
          </p>
          <Link
            to='/events'
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-6 py-2 text-sm font-medium shadow'
          >
            Browse Events
          </Link>
        </div>
      </div>
    )
  }

  // Loading state while events are being fetched (fallback)
  return (
    <div className='container mx-auto space-y-6 px-4 py-6'>
      <div className='py-12 text-center'>
        <div className='border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
        <p className='text-muted-foreground'>Loading your events...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/home')({
  component: DonorHomePage,
})
