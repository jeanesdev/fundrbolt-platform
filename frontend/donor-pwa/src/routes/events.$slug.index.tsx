import { CountdownTimer } from '@/components/event-home/CountdownTimer'
import { EventDetails } from '@/components/event-home/EventDetails'
import { EventHeroSection, type EventStatus, type HeroTransitionStyle } from '@/components/event-home/EventHeroSection'
import { SponsorsCarousel } from '@/components/event-home/SponsorsCarousel'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventHomePage } from '@/features/events/EventHomePage'
import { useEventBranding } from '@/hooks/use-event-branding'
import { useEventContext } from '@/hooks/use-event-context'
import { getEventBySlug, type EventMediaUsageTag } from '@/lib/api/events'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { getMyInventory } from '@/lib/api/ticket-purchases'
import apiClient from '@/lib/axios'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { renderMarkdownToSafeHtml } from '@fundrbolt/shared/utils'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CalendarPlus, ImageOff, Loader2, Ticket } from 'lucide-react'
import { useCallback, useEffect } from 'react'

interface PublicAuctionPreviewItem {
  id: string
  title: string
  primary_image_url?: string | null
}

interface PublicAuctionPreviewResponse {
  items: PublicAuctionPreviewItem[]
  pagination?: {
    page?: number
    total_pages?: number
    pages?: number
    has_more?: boolean
  }
}

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
  const { availableEvents, isLoading: eventsLoading } = useEventContext()

  // Always fetch public event data — needed for both unauthenticated and
  // the "not registered" authenticated view.
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug,
  })

  const { isLoading: isRestoringAuth } = useQuery({
    queryKey: ['auth', 'restore-user', 'events-slug'],
    queryFn: async () => restoreUserFromRefreshToken(),
    enabled: !isAuthenticated && hasRefreshToken,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const { data: registrationsData, isLoading: isLoadingRegistrations } = useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && !isRestoringAuth,
  })

  const { data: ticketInventoryData, isLoading: isLoadingTicketInventory } = useQuery({
    queryKey: ['ticket-inventory', 'event-context'],
    queryFn: getMyInventory,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && !isRestoringAuth,
  })

  const { data: auctionPreviewItems } = useQuery({
    queryKey: ['event', event?.id, 'auction-preview'],
    queryFn: async () => {
      const collectedItems: PublicAuctionPreviewItem[] = []
      let page = 1
      let totalPages = 1

      do {
        const response = await apiClient.get<PublicAuctionPreviewResponse>(
          `/events/${event!.id}/auction-items`,
          {
            params: { page, limit: 24 },
          }
        )

        collectedItems.push(...response.data.items)
        totalPages =
          response.data.pagination?.total_pages ??
          response.data.pagination?.pages ??
          page
        page += 1
      } while (page <= totalPages)

      return collectedItems
    },
    enabled: Boolean(event?.id),
    staleTime: 5 * 60 * 1000,
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

  // Must be declared before any conditional returns to satisfy Rules of Hooks.
  // Uses optional chaining on `event` since it may be undefined during loading.
  const handleAddToCalendar = useCallback(() => {
    if (!event?.event_datetime) return
    const start = new Date(event.event_datetime)
    // Default to 3-hour event duration
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
    const locationParts = [event.venue_name, event.venue_address, event.venue_city, event.venue_state, event.venue_zip].filter(Boolean)
    const location = locationParts.join(', ')
    const description = (event.description ?? '').replace(/[#*_~`>\-|]/g, '').slice(0, 500)
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FundrBolt//Event//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${event.name}`,
      location ? `LOCATION:${location}` : '',
      description ? `DESCRIPTION:${description}` : '',
      `URL:${window.location.href}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [event])

  // Authenticated users should stay on the canonical /events/:slug URL.
  // Only registered donors should enter the immersive donor event experience.
  // Ticket holders who have not completed registration should remain on the
  // public event page so the page is still reachable without protected-event access.
  const isRegisteredInContext = availableEvents.some(
    (eventOption) => eventOption.slug === slug && eventOption.is_registered
  )
  const isRegisteredFromQuery =
    registrationsData?.events?.some((registeredEvent) => registeredEvent.slug === slug) ??
    false
  const hasTicketAccessFromQuery =
    ticketInventoryData?.events?.some((inventoryEvent) => inventoryEvent.event_slug === slug) ??
    false

  if (isAuthenticated) {
    if (eventsLoading || isLoadingRegistrations || isLoadingTicketInventory) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )
    }

    const isRegistered = isRegisteredInContext || isRegisteredFromQuery

    if (isRegistered) {
      return <EventHomePage />
    }
    // Fall through to render the public event page for authenticated but
    // unregistered donors, including ticket holders coming from My Tickets.
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

  // ─── Derived values for public page ──────────────────────────────────────────
  const getTaggedImageUrls = (tag: EventMediaUsageTag) => {
    if (!event.media?.length) return []
    return event.media
      .filter((m) => m.media_type === 'image' && m.usage_tag === tag && !!m.file_url)
      .map((m) => m.file_url)
  }

  const getTaggedImageUrl = (tag: EventMediaUsageTag) => getTaggedImageUrls(tag)[0] ?? null

  const getHeroImageUrls = () => {
    const tagged = getTaggedImageUrls('main_event_page_hero')
    if (tagged.length > 0) return tagged
    const urls = new Set<string>()
    if (event.media?.length) {
      const imageMedia = event.media
        .filter((m) => m.media_type === 'image' && !!m.file_url)
        .sort((a, b) => {
          const aIsLogo = a.file_name?.toLowerCase().includes('logo') ?? false
          const bIsLogo = b.file_name?.toLowerCase().includes('logo') ?? false
          if (aIsLogo === bIsLogo) return 0
          return aIsLogo ? 1 : -1
        })
      for (const m of imageMedia) {
        if (m.file_url) urls.add(m.file_url)
      }
    }
    return Array.from(urls)
  }

  const heroImageUrls = getHeroImageUrls()
  const bannerUrl = heroImageUrls[0] ?? null

  const getLogoUrl = () => {
    const taggedEvent = getTaggedImageUrl('event_logo')
    if (taggedEvent) return taggedEvent
    const taggedNpo = getTaggedImageUrl('npo_logo')
    if (taggedNpo) return taggedNpo
    if (!event.media?.length) return null
    const logo = event.media.find(
      (m) => m.media_type === 'image' && m.file_name.toLowerCase().includes('logo')
    )
    return logo?.file_url || null
  }

  const eventDate = event.event_datetime ? new Date(event.event_datetime) : null
  const now = new Date()
  const isPast = eventDate ? eventDate < now : false

  const getEventStatus = (): EventStatus => {
    if (isPast) return 'past'
    if (event.status === 'active' && eventDate && eventDate <= now) return 'live'
    return 'upcoming'
  }
  const eventStatus = getEventStatus()

  const countdownTargetDate = event.event_datetime || null

  const venueMapLink = (() => {
    const layoutMap = getTaggedImageUrl('event_layout_map')
    if (layoutMap) return layoutMap
    if (!event.venue_address) return null
    const parts = [event.venue_address]
    if (event.venue_city) parts.push(event.venue_city)
    if (event.venue_state) parts.push(event.venue_state)
    if (event.venue_zip) parts.push(event.venue_zip)
    return `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
  })()

  const aboutEventHtml = renderMarkdownToSafeHtml(event.description ?? '')
  const matchingEventAccess = availableEvents.find(
    (eventOption) => eventOption.slug === slug
  )
  const canPurchaseAdditionalTickets = Boolean(
    matchingEventAccess?.is_registered ||
    matchingEventAccess?.has_ticket_access ||
    isRegisteredFromQuery ||
    hasTicketAccessFromQuery
  )

  return (
    <div className='min-h-screen' style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}>
      {/* Profile menu overlay for authenticated users (not registered for this event) */}
      {isAuthenticated && (
        <div className='fixed top-3 right-3 z-50'>
          <ProfileDropdown />
        </div>
      )}
      <EventHeroSection
        eventName={event.name}
        npoName={event.npo_name}
        logoUrl={getLogoUrl()}
        bannerUrl={bannerUrl}
        bannerImages={heroImageUrls}
        transitionStyle={event.hero_transition_style as HeroTransitionStyle}
        eventDate={event.event_datetime}
        venueName={event.venue_name}
        status={eventStatus}
        venueMapLink={venueMapLink}
      />

      <div className='px-4 py-4 space-y-5'>
        {/* Countdown — show if event is in the future */}
        {countdownTargetDate && !isPast && (
          <div className='space-y-3'>
            <CountdownTimer
              targetDate={countdownTargetDate}
              eventName={event.name}
              hideOnExpire={false}
            />
            <button
              onClick={handleAddToCalendar}
              className='flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all active:scale-[0.98] hover:bg-white hover:shadow-md'
            >
              <CalendarPlus className='h-4 w-4' />
              Add to Calendar
            </button>
          </div>
        )}

        {/* CTA — Purchase Tickets (authenticated, not registered) or Login / Register (unauthenticated) */}
        {isPast ? (
          <div
            className='rounded-2xl border p-5 text-center'
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.06)',
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
            }}
          >
            <p
              className='text-sm'
              style={{ color: 'var(--event-text-on-background, #374151)' }}
            >
              This event has already taken place. Thank you for your interest!
            </p>
          </div>
        ) : isAuthenticated ? (
          // Authenticated but not registered — show ticket purchase CTA
          <div
            className='rounded-2xl p-5 text-center space-y-3'
            style={{
              background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246) / 0.08) 0%, rgb(var(--event-secondary, 147, 51, 234) / 0.08) 100%)`,
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
            }}
          >
            <p className='text-sm font-medium' style={{ color: 'var(--event-text-on-background, #374151)' }}>
              {canPurchaseAdditionalTickets
                ? 'You can purchase more tickets for this event.'
                : 'You are not yet registered for this event.'}
            </p>
            {/* Link to ticket purchase page */}
            <Link to='/events/$slug/tickets' params={{ slug }}>
              <button
                className='w-full rounded-2xl p-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:shadow-md'
                style={{
                  background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
                }}
              >
                <Ticket className='h-5 w-5 text-white' />
                <span className='text-lg font-black text-white'>
                  {canPurchaseAdditionalTickets
                    ? 'Purchase Additional Tickets'
                    : 'Purchase Tickets'}
                </span>
              </button>
            </Link>
          </div>
        ) : (
          <div className='space-y-4'>
            <Link to='/sign-in' className='block'>
              <button
                className='w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] hover:shadow-md'
                style={{
                  background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
                }}
              >
                <p className='text-lg font-black text-white'>Login to Register</p>
                <p className='text-sm text-white/80'>Already have an account? Sign in to register →</p>
              </button>
            </Link>
            <Link to='/sign-up' className='block'>
              <button
                className='w-full rounded-2xl border-2 border-gray-300 bg-white p-4 text-left transition-all active:scale-[0.98] hover:shadow-md'
              >
                <p className='text-lg font-black text-gray-900'>
                  Create Account
                </p>
                <p className='text-sm text-gray-500'>
                  New here? Create a free account to register →
                </p>
              </button>
            </Link>
          </div>
        )}

        {auctionPreviewItems && auctionPreviewItems.length > 0 && (
          <div
            className='rounded-2xl border p-4'
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)',
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
            }}
          >
            <div className='mb-3'>
              <h3
                className='text-xs font-bold uppercase tracking-widest'
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              >
                Auction Preview
              </h3>
              <p
                className='mt-1 text-sm'
                style={{ color: 'var(--event-text-on-background, #374151)' }}
              >
                Preview a few items available at this event.
              </p>
            </div>

            <div className='-mx-1 flex gap-3 overflow-x-auto px-1 pb-1'>
              {auctionPreviewItems.map((item) => (
                <div
                  key={item.id}
                  className='w-44 shrink-0 overflow-hidden rounded-2xl border bg-white/90 shadow-sm'
                  style={{
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.16)',
                  }}
                >
                  <div className='bg-muted relative aspect-[4/3] overflow-hidden'>
                    {item.primary_image_url ? (
                      <img
                        src={item.primary_image_url}
                        alt={item.title}
                        className='h-full w-full object-cover'
                        loading='lazy'
                      />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center'>
                        <ImageOff className='text-muted-foreground h-6 w-6' />
                      </div>
                    )}
                  </div>
                  <div className='p-3'>
                    <p
                      className='line-clamp-2 text-sm font-semibold'
                      style={{ color: 'var(--event-text-on-background, #111827)' }}
                    >
                      {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Details */}
        <div>
          <EventDetails
            eventDatetime={event.event_datetime ?? ''}
            timezone={event.timezone}
            venueName={event.venue_name}
            venueAddress={event.venue_address}
            venueCity={event.venue_city}
            venueState={event.venue_state}
            venueZip={event.venue_zip}
            attire={event.attire}
            contactEmail={event.primary_contact_email}
            contactPhone={event.primary_contact_phone}
            eventWebsite={event.links?.find((l) => l.link_type === 'website')?.url}
            isPast={isPast}
            isUpcoming={!isPast}
          />
        </div>

        {/* About */}
        {event.description && (
          <div
            className='rounded-2xl border p-4'
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)',
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
            }}
          >
            <h3
              className='mb-2 text-xs font-bold uppercase tracking-widest'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            >
              About This Event
            </h3>
            <div
              className='text-sm leading-relaxed [&_a]:font-medium'
              style={{ color: 'var(--event-text-on-background, #374151)' }}
              dangerouslySetInnerHTML={{ __html: aboutEventHtml }}
            />
          </div>
        )}

        {/* Sponsors */}
        <div>
          <SponsorsCarousel publicSlug={slug} />
        </div>
      </div>
    </div>
  )
}
