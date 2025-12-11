/**
 * EventHomePage
 *
 * Immersive, event-branded homepage for donors in the PWA.
 * This is the primary landing page after login, showing:
 * - Event branding (colors, logo)
 * - Countdown timer (for upcoming events)
 * - Collapsible event details
 * - Auction items gallery with filtering
 *
 * Branding colors are applied via CSS variables:
 * - --event-primary: Primary brand color
 * - --event-secondary: Secondary brand color
 * - --event-background: Page background color
 * - --event-accent: Accent/highlight color
 */

import { AuctionGallery, CountdownTimer, EventDetails, EventSwitcher } from '@/components/event-home'
import { AuctionItemDetailModal } from '@/components/event-home/AuctionItemDetailModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventBranding } from '@/hooks/use-event-branding'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { useEventStore } from '@/stores/event-store'
import type { RegisteredEventWithBranding } from '@/types/event-branding'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { AlertCircle, Calendar, Loader2, MapPin } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

/**
 * EventHomePage Component
 *
 * Shows an immersive, event-branded homepage for donors.
 * Handles loading states, error states, and empty states.
 */
export function EventHomePage() {
  const navigate = useNavigate()
  const { eventId } = useParams({ strict: false }) as { eventId: string }
  const { currentEvent, eventsLoading, eventsError, loadEventById } = useEventStore()
  const { applyBranding, clearBranding } = useEventBranding()
  const [selectedAuctionItemId, setSelectedAuctionItemId] = useState<string | null>(null)

  // Fetch all registered events for event switcher
  const { data: registeredEventsData } = useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Convert current event to RegisteredEventWithBranding for switcher
  const currentEventForSwitcher = useMemo((): RegisteredEventWithBranding | null => {
    if (!currentEvent) return null

    // Check if event is past
    const eventDate = new Date(currentEvent.event_datetime)
    const now = new Date()
    const is_past = eventDate < now
    const is_upcoming = !is_past && eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return {
      id: currentEvent.id,
      name: currentEvent.name,
      slug: currentEvent.slug,
      event_datetime: currentEvent.event_datetime,
      timezone: currentEvent.timezone,
      is_past,
      is_upcoming,
      thumbnail_url: currentEvent.media?.[0]?.file_url || null,
      primary_color: currentEvent.primary_color || '#3B82F6',
      secondary_color: currentEvent.secondary_color || '#9333EA',
      background_color: currentEvent.background_color || '#FFFFFF',
      accent_color: currentEvent.accent_color || '#3B82F6',
      npo_name: currentEvent.npo_name || 'Organization',
      npo_logo_url: null,
    }
  }, [currentEvent])

  // Handle event switch from dropdown
  const handleEventSelect = useCallback(
    (event: RegisteredEventWithBranding) => {
      navigate({ to: '/events/$eventId', params: { eventId: event.id } })
    },
    [navigate]
  )

  // Load event data
  const loadEvent = useCallback(() => {
    if (eventId) {
      loadEventById(eventId).catch(() => {
        toast.error('Failed to load event')
        navigate({ to: '/home' })
      })
    }
  }, [eventId, loadEventById, navigate])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  // Apply event branding when event loads
  useEffect(() => {
    if (currentEvent) {
      applyBranding({
        primary_color: currentEvent.primary_color,
        secondary_color: currentEvent.secondary_color,
        background_color: currentEvent.background_color,
        accent_color: currentEvent.accent_color,
      })
    }

    // Cleanup branding on unmount
    return () => {
      clearBranding()
    }
  }, [currentEvent, applyBranding, clearBranding])

  // Build Google Maps link for venue
  const venueMapLink = useMemo(() => {
    if (!currentEvent?.venue_address) return null

    const addressParts = [currentEvent.venue_address]
    if (currentEvent.venue_city) addressParts.push(currentEvent.venue_city)
    if (currentEvent.venue_state) addressParts.push(currentEvent.venue_state)
    if (currentEvent.venue_zip) addressParts.push(currentEvent.venue_zip)

    const fullAddress = addressParts.join(', ')
    const query = encodeURIComponent(fullAddress)
    return `https://maps.google.com/?q=${query}`
  }, [currentEvent?.venue_address, currentEvent?.venue_city, currentEvent?.venue_state, currentEvent?.venue_zip])

  // Generate Add to Calendar ICS file
  const generateICSFile = useCallback(() => {
    if (!currentEvent?.event_datetime) return

    const eventDate = new Date(currentEvent.event_datetime)
    // Format dates for iCal format (YYYYMMDDTHHMMSSZ)
    const formatDateForICal = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const startDate = formatDateForICal(eventDate)
    // Assume 3 hour event duration
    const endDate = formatDateForICal(new Date(eventDate.getTime() + 3 * 60 * 60 * 1000))
    const now = formatDateForICal(new Date())

    // Build location
    const locationParts = []
    if (currentEvent.venue_name) locationParts.push(currentEvent.venue_name)
    if (currentEvent.venue_address) locationParts.push(currentEvent.venue_address)
    if (currentEvent.venue_city) locationParts.push(currentEvent.venue_city)
    if (currentEvent.venue_state) locationParts.push(currentEvent.venue_state)
    if (currentEvent.venue_zip) locationParts.push(currentEvent.venue_zip)
    const location = locationParts.join(', ')

    // Create ICS file content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Augeo//Event Calendar//EN',
      'BEGIN:VEVENT',
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `DTSTAMP:${now}`,
      `SUMMARY:${currentEvent.name}`,
      `DESCRIPTION:${(currentEvent.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      `UID:${currentEvent.id}@augeo.app`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    // Create blob and download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${currentEvent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }, [currentEvent])

  // Loading state
  if (eventsLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[rgb(var(--event-primary,59,130,246))]" />
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (eventsError || !currentEvent) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Event Not Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              We couldn't find the event you're looking for. It may have been removed or you may not have access.
            </p>
            <button
              onClick={() => navigate({ to: '/home' })}
              className="w-full py-2 px-4 rounded-md text-white"
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
            >
              Return to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Format datetime for display
  const formatDateTime = () => {
    if (!currentEvent.event_datetime) return { date: 'TBD', time: '' }
    const dt = new Date(currentEvent.event_datetime)
    return {
      date: dt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }
  }

  const { date, time } = formatDateTime()

  // Get banner image from media
  const getBannerUrl = () => {
    if (!currentEvent.media) return null
    const banner = currentEvent.media.find(
      (m) => m.media_type === 'image' && m.display_order === 0
    )
    return banner?.file_url || currentEvent.media[0]?.file_url
  }

  const bannerUrl = getBannerUrl()

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
    >
      {/* Hero Section with Event Banner */}
      <div className="relative">
        {bannerUrl ? (
          <div
            className="w-full h-48 sm:h-64 md:h-80 bg-cover bg-center"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
          </div>
        ) : (
          <div
            className="w-full h-48 sm:h-64 md:h-80"
            style={{
              background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
            }}
          />
        )}

        {/* Event Switcher - Top Left */}
        {currentEventForSwitcher && registeredEventsData?.events && (
          <div className="absolute top-4 left-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
              <EventSwitcher
                currentEvent={currentEventForSwitcher}
                events={registeredEventsData.events}
                onEventSelect={handleEventSelect}
              />
            </div>
          </div>
        )}

        {/* Event Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="container mx-auto">
            {/* NPO Name */}
            {currentEvent.npo_name && (
              <p className="text-white/80 text-sm mb-1">{currentEvent.npo_name}</p>
            )}
            {venueMapLink ? (
              <a
                href={venueMapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block hover:opacity-90 transition-opacity"
              >
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {currentEvent.name}
                </h1>
              </a>
            ) : (
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                {currentEvent.name}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Event Quick Info */}
      <div
        className="border-b"
        style={{
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
          color: 'var(--event-text-on-background, #000000)',
        }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar
                className="h-4 w-4"
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              />
              {currentEvent.event_datetime ? (
                <button
                  onClick={generateICSFile}
                  className="hover:underline cursor-pointer"
                  style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  title="Add to calendar"
                >
                  {date} {time && `at ${time}`}
                </button>
              ) : (
                <span>
                  {date} {time && `at ${time}`}
                </span>
              )}
            </div>
            {currentEvent.venue_name && (
              <div className="flex items-center gap-2">
                <MapPin
                  className="h-4 w-4"
                  style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                />
                {venueMapLink ? (
                  <a
                    href={venueMapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  >
                    {currentEvent.venue_name}
                  </a>
                ) : (
                  <span>{currentEvent.venue_name}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="container mx-auto px-4 py-6"
        style={{ color: 'var(--event-text-on-background, #000000)' }}
      >
        {/* Countdown Timer - show only for upcoming events */}
        {currentEvent.event_datetime && !currentEventForSwitcher?.is_past && (
          <div className="mb-6">
            <CountdownTimer
              targetDate={currentEvent.event_datetime}
              eventName={currentEvent.name}
              hideOnExpire={true}
            />
          </div>
        )}

        {/* Event Details - Collapsible section */}
        <EventDetails
          eventDatetime={currentEvent.event_datetime}
          timezone={currentEvent.timezone}
          venueName={currentEvent.venue_name}
          venueAddress={currentEvent.venue_address}
          venueCity={currentEvent.venue_city}
          venueState={currentEvent.venue_state}
          venueZip={currentEvent.venue_zip}
          attire={currentEvent.attire}
          contactEmail={currentEvent.primary_contact_email}
          contactPhone={currentEvent.primary_contact_phone}
          eventWebsite={currentEvent.links?.find((l) => l.link_type === 'website')?.url}
          isPast={currentEventForSwitcher?.is_past}
          isUpcoming={currentEventForSwitcher?.is_upcoming}
          className="mb-6"
        />

        {/* Event Description */}
        {currentEvent.description && (
          <div
            className="mb-6 rounded-lg p-4 sm:p-6"
            style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))' }}
          >
            <h3
              className="font-semibold text-lg mb-3"
              style={{ color: 'var(--event-card-text, #000000)' }}
            >
              About This Event
            </h3>
            <p style={{ color: 'var(--event-card-text-muted, #6B7280)' }}>
              {currentEvent.description}
            </p>
          </div>
        )}

        {/* Auction Gallery */}
        <section>
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
          >
            Auction Items
          </h2>
          <AuctionGallery
            eventId={eventId}
            initialFilter="all"
            initialSort="highest_bid"
            eventStatus={currentEvent?.status}
            eventDateTime={currentEvent?.event_datetime}
            onItemClick={(item) => {
              setSelectedAuctionItemId(item.id)
            }}
          />
        </section>

        {/* Auction Item Detail Modal */}
        <AuctionItemDetailModal
          eventId={eventId}
          itemId={selectedAuctionItemId}
          eventStatus={currentEvent?.status}
          eventDateTime={currentEvent?.event_datetime}
          onClose={() => setSelectedAuctionItemId(null)}
          onBid={(item) => {
            // TODO: Navigate to bid page when bidding is implemented
            toast.info(`Place bid on "${item.title}"`)
          }}
        />
      </div>
    </div>
  )
}
