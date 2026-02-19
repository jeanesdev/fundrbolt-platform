import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventHomePage } from '@/features/events/EventHomePage'
import { useEventBranding } from '@/hooks/use-event-branding'
import { getEventBySlug } from '@/lib/api/events'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Calendar, Loader2, MapPin } from 'lucide-react'
import { useEffect } from 'react'

export const Route = createFileRoute('/events/$slug/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const restoreUserFromRefreshToken = useAuthStore(
    (state) => state.restoreUserFromRefreshToken
  )
  const hasRefreshToken = hasValidRefreshToken()
  const { applyBranding } = useEventBranding()
  const { slug } = Route.useParams()

  // Rest of component for unauthenticated users...
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug && !isAuthenticated,
  })

  const { isLoading: isRestoringAuth } = useQuery({
    queryKey: ['auth', 'restore-user', 'events-slug'],
    queryFn: async () => restoreUserFromRefreshToken(),
    enabled: !isAuthenticated && hasRefreshToken,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  // Apply event branding colors when event loads
  useEffect(() => {
    if (event) {
      applyBranding({
        primary_color: event.primary_color || '#3B82F6',
        secondary_color: event.secondary_color || '#9333EA',
        background_color: '#FFFFFF',
      })
    }
  }, [event, applyBranding])

  // Authenticated users should stay on the canonical /events/:slug URL
  // and render the immersive donor event experience directly.
  if (isAuthenticated) {
    return <EventHomePage />
  }

  if (isRestoringAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Event Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We couldn't find the event you're looking for. It may have been removed or the link may be invalid.
            </p>
            {import.meta.env.DEV && error && (
              <div className="mt-4 p-3 bg-muted rounded text-xs font-mono break-words">
                <p className="font-semibold mb-1">Error Details (Dev Only):</p>
                <p>{String(error)}</p>
              </div>
            )}
            <Button onClick={() => navigate({ to: '/' })} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const eventDate = event.event_datetime ? new Date(event.event_datetime) : null
  const now = new Date()
  const isPast = eventDate && eventDate < now
  const isUpcoming =
    eventDate && !isPast && eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with back button */}
      <div className="sticky top-0 z-40 border-b bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/' })}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold flex-1 ml-4 truncate">{event.name}</h1>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Event image/thumbnail */}
        {event.logo_url && (
          <div className="rounded-lg overflow-hidden bg-muted">
            <img
              src={event.logo_url}
              alt={event.name}
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* Event header card */}
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl">{event.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                </div>
                <div className="flex gap-2">
                  {isPast && <Badge variant="secondary">Past Event</Badge>}
                  {isUpcoming && (
                    <Badge variant="default" className="bg-amber-600">
                      Coming Soon
                    </Badge>
                  )}
                  {!isPast && !isUpcoming && (
                    <Badge variant="default">On Now</Badge>
                  )}
                </div>
              </div>

              {/* Event details */}
              <div className="space-y-2 text-sm">
                {eventDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {eventDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {event.venue_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {event.venue_name}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Call to action */}
        <div className="space-y-4">
          {isPast ? (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  This event has already taken place. Thank you for your attendance!
                </p>
              </CardContent>
            </Card>
          ) : isAuthenticated ? (
            <Link to="/events/$slug/register" params={{ slug }} search={{ guest: undefined }}>
              <Button size="lg" className="w-full">
                Register for Event
              </Button>
            </Link>
          ) : (
            <div className="space-y-3">
              <Link to="/sign-in">
                <Button size="lg" className="w-full">
                  Login to Register
                </Button>
              </Link>
              <Link to="/sign-up">
                <Button size="lg" variant="outline" className="w-full">
                  Create Account
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Event description section */}
        {event.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About This Event</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
