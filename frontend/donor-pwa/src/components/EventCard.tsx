/**
 * EventCard Component
 *
 * Displays event information in a card format with registration link.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { EventResponse } from '@/lib/api/events'
import { Link } from '@tanstack/react-router'
import { Calendar, MapPin, Users } from 'lucide-react'

interface EventCardProps {
  event: EventResponse
  showRegisterButton?: boolean
}

export function EventCard({ event, showRegisterButton = true }: EventCardProps) {
  const eventDate = new Date(event.event_datetime)
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const statusColors = {
    draft: 'bg-gray-500',
    active: 'bg-green-500',
    closed: 'bg-red-500',
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      {event.banner_url && (
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
          <img
            src={event.banner_url}
            alt={event.name}
            className="object-cover w-full h-full"
            onError={(e) => {
              ; (e.target as HTMLImageElement).src = '/placeholder-event.jpg'
            }}
          />
          <Badge
            className={`absolute top-2 right-2 ${statusColors[event.status]} text-white`}
          >
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </Badge>
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-2xl font-bold">{event.name}</CardTitle>
        {event.tagline && (
          <p className="text-sm text-muted-foreground">{event.tagline}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <span>
            {formattedDate} at {formattedTime}
          </span>
        </div>

        {event.location_name && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{event.location_name}</span>
          </div>
        )}

        {event.venue_capacity && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span>Capacity: {event.venue_capacity}</span>
          </div>
        )}
      </CardContent>

      {showRegisterButton && event.status === 'active' && (
        <CardFooter>
          <Button asChild className="w-full" size="lg">
            <Link to="/events/$slug/register" params={{ slug: event.slug }}>
              Register Now
            </Link>
          </Button>
        </CardFooter>
      )}

      {showRegisterButton && event.status === 'closed' && (
        <CardFooter>
          <Button disabled className="w-full" size="lg">
            Registration Closed
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
