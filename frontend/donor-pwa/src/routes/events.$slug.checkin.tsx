/**
 * Event Self Check-In Route
 * Allows donors to check themselves in by scanning a QR code or entering their confirmation code
 */
import { CheckInLookup } from '@/components/checkin/CheckInLookup'
import { GuestCheckInList } from '@/components/checkin/GuestCheckInList'
import { RegistrationDetails } from '@/components/checkin/RegistrationDetails'
import { Button } from '@/components/ui/button'
import { useEventBranding } from '@/hooks/use-event-branding'
import type { CheckInLookupResponse } from '@/lib/api/checkin'
import { getEventBySlug } from '@/lib/api/events'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/events/$slug/checkin')({
  component: RouteComponent,
})

function RouteComponent() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const [lookupData, setLookupData] = useState<CheckInLookupResponse | null>(
    null
  )

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Apply event branding
  const { applyBranding } = useEventBranding()

  const handleRegistrationFound = (data: CheckInLookupResponse) => {
    setLookupData(data)
  }

  const handleBack = () => {
    setLookupData(null)
  }

  return (
    <div className='container mx-auto max-w-4xl space-y-6 py-8'>
      {/* Header */}
      <div className='mb-6'>
        <Button
          variant='ghost'
          onClick={() => navigate({ to: `/events/${slug}` })}
          className='mb-4'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Event
        </Button>

        {event && (
          <div className='mb-4'>
            <h1 className='text-3xl font-bold'>{event.name}</h1>
            <p className='text-muted-foreground mt-1'>Event Check-In</p>
          </div>
        )}
      </div>

      {/* Check-in lookup or details */}
      {!lookupData ? (
        <CheckInLookup onRegistrationFound={handleRegistrationFound} />
      ) : (
        <div className='space-y-6'>
          <Button variant='outline' onClick={handleBack}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Look Up Another Registration
          </Button>

          {lookupData.registrations.map((registration) => (
            <div key={registration.id} className='space-y-4'>
              <RegistrationDetails registration={registration} />
              <GuestCheckInList
                guests={registration.guests}
                onGuestUpdated={() => {
                  // Refresh lookup data after guest check-in
                  // In a real implementation, you'd want to re-fetch or update the local state
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
