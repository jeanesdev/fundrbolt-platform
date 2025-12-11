/**
 * EventDetails Component
 *
 * Displays event information: date/time, venue, description, and registration CTA.
 * Uses event primary color for buttons and accents.
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EventDetailResponse } from '@/lib/api/events'
import { Link } from '@tanstack/react-router'
import { Calendar, Clock, MapPin } from 'lucide-react'

interface EventDetailsProps {
  event: EventDetailResponse
}

export function EventDetails({ event }: EventDetailsProps) {
  const eventDate = new Date(event.event_datetime)
  const isEventPast = eventDate < new Date()
  const isClosed = event.status === 'closed'
  const canRegister = !isEventPast && !isClosed && event.status === 'active'

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Event Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>When and where</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date and Time */}
          <div className="flex items-start gap-3">
            <Calendar className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {eventDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                <Clock className="mr-1 inline h-4 w-4" />
                {eventDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </p>
            </div>
          </div>

          {/* Venue */}
          {event.venue_name && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{event.venue_name}</p>
                {event.location_address && (
                  <p className="text-sm text-muted-foreground">{event.location_address}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle>About This Event</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-muted-foreground">{event.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration CTA */}
      <div className="flex justify-center pt-4">
        {canRegister ? (
          <Button
            asChild
            size="lg"
            className="text-lg"
            style={{
              backgroundColor: `rgb(var(--event-primary))`,
              color: 'white',
            }}
          >
            <Link to="/events/$slug/register" params={{ slug: event.slug }} search={{ guest: undefined }}>
              Register for This Event
            </Link>
          </Button>
        ) : (
          <div className="text-center">
            <p className="text-lg font-semibold text-muted-foreground">
              {isEventPast
                ? 'This event has already passed'
                : isClosed
                  ? 'Registration is closed'
                  : 'Registration is not yet open'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
