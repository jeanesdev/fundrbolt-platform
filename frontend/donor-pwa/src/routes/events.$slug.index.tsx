import { CountdownTimer } from '@/components/event-home/CountdownTimer'
import { EventDetails } from '@/components/event-home/EventDetails'
import { EventHeroSection, type EventStatus, type HeroTransitionStyle } from '@/components/event-home/EventHeroSection'
import { SponsorsCarousel } from '@/components/event-home/SponsorsCarousel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventHomePage } from '@/features/events/EventHomePage'
import { useEventBranding } from '@/hooks/use-event-branding'
import { getEventBySlug, type EventMediaUsageTag } from '@/lib/api/events'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
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

  return (
    <div className='min-h-screen' style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}>
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
          <div>
            <CountdownTimer
              targetDate={countdownTargetDate}
              eventName={event.name}
              hideOnExpire={false}
            />
          </div>
        )}

        {/* CTA — Login / Register buttons */}
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
        ) : (
          <div className='space-y-3'>
            <Link to='/sign-in'>
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
            <Link to='/sign-up'>
              <button
                className='w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] hover:shadow-md'
                style={{
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246))',
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)',
                }}
              >
                <p
                  className='text-lg font-black'
                  style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                >
                  Create Account
                </p>
                <p
                  className='text-sm'
                  style={{ color: 'rgb(var(--event-primary, 59, 130, 246) / 0.7)' }}
                >
                  New here? Create a free account to register →
                </p>
              </button>
            </Link>
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

// ─── Markdown utilities (shared with EventHomePage) ──────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMarkdownToSafeHtml(markdown: string): string {
  if (!markdown.trim()) return ''
  let html = escapeHtml(markdown)
  html = html
    .replace(/^###\s+(.+)$/gim, '<h3 class="mt-4 mb-2 text-base font-semibold">$1</h3>')
    .replace(/^##\s+(.+)$/gim, '<h2 class="mt-4 mb-2 text-lg font-semibold">$1</h2>')
    .replace(/^#\s+(.+)$/gim, '<h1 class="mt-4 mb-2 text-xl font-bold">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline">$1</a>',
    )
    .replace(/^(?:- |\* )(.+)$/gim, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/gims, '<ul class="my-2 list-disc pl-5 space-y-1">$1</ul>')
  const blocks = html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  return blocks
    .map((block) => {
      if (
        block.startsWith('<h1') ||
        block.startsWith('<h2') ||
        block.startsWith('<h3') ||
        block.startsWith('<ul')
      )
        return block
      return `<p>${block}</p>`
    })
    .join('\n')
}
