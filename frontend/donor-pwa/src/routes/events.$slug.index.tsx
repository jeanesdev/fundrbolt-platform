import { CountdownTimer } from '@/components/event-home/CountdownTimer'
import { EventDetails } from '@/components/event-home/EventDetails'
import {
  EventHeroSection,
  type EventStatus,
  type HeroTransitionStyle,
} from '@/components/event-home/EventHeroSection'
import { SponsorsCarousel } from '@/components/event-home/SponsorsCarousel'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventHomePage } from '@/features/events/EventHomePage'
import { AttendeeSurveyModal } from '@/features/survey/AttendeeSurveyModal'
import { SurveyThankYouPopup } from '@/features/survey/SurveyThankYouPopup'
import { useEventBranding } from '@/hooks/use-event-branding'
import { useEventContext } from '@/hooks/use-event-context'
import { donateNowApi } from '@/lib/api/donateNow'
import { getEventBySlug, type EventMediaUsageTag } from '@/lib/api/events'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import {
  getDonorSurveyStatus,
  markSurveyDonateBack,
  submitDonorSurvey,
} from '@/lib/api/survey'
import { getMyInventory } from '@/lib/api/ticket-purchases'
import apiClient from '@/lib/axios'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import {
  useEventContextStore,
  type EventContextOption,
} from '@/stores/event-context-store'
import { renderMarkdownToSafeHtml } from '@fundrbolt/shared/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarPlus,
  Home,
  ImageOff,
  Loader2,
  Ticket,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

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

const hexToRgba = (hex: string, alpha: number): string | null => {
  const normalized = hex.trim()
  const match = /^#([0-9A-Fa-f]{6})$/.exec(normalized)
  if (!match) return null

  const [, value] = match
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const Route = createFileRoute('/events/$slug/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)
  const restoreUserFromRefreshToken = useAuthStore(
    (state) => state.restoreUserFromRefreshToken
  )
  const hasRefreshToken = hasValidRefreshToken()
  const { applyBranding } = useEventBranding()
  const { slug } = Route.useParams()
  const {
    availableEvents,
    isLoading: eventsLoading,
    setAvailableEvents,
  } = useEventContext()

  // Always fetch public event data — needed for both unauthenticated and
  // the "not registered" authenticated view.
  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['event', slug],
    queryFn: () => getEventBySlug(slug),
    enabled: !!slug,
  })

  // Restore the access token on page load if the user appears authenticated
  // (cached user in localStorage) but the in-memory access token is missing.
  // This handles the page-reload case where isAuthenticated=true but accessToken=''.
  const { isLoading: isRestoringAuth } = useQuery({
    queryKey: ['auth', 'restore-user', 'events-slug'],
    queryFn: async () => restoreUserFromRefreshToken(),
    enabled: (!isAuthenticated || !accessToken) && hasRefreshToken,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const { data: donateNowPageConfig } = useQuery({
    queryKey: ['donate-now-page', event?.npo_slug],
    queryFn: () => donateNowApi.getPage(event!.npo_slug!).then((r) => r.data),
    enabled: Boolean(event?.npo_slug),
    retry: false,
  })

  const { data: registrationsData, isLoading: isLoadingRegistrations } =
    useQuery({
      queryKey: ['registrations', 'events-with-branding'],
      queryFn: getRegisteredEventsWithBranding,
      staleTime: 5 * 60 * 1000,
      enabled: isAuthenticated && !isRestoringAuth,
    })

  const { data: ticketInventoryData, isLoading: isLoadingTicketInventory } =
    useQuery({
      queryKey: ['ticket-inventory', 'event-context'],
      queryFn: getMyInventory,
      staleTime: 5 * 60 * 1000,
      enabled: isAuthenticated && !isRestoringAuth,
    })

  const queryClient = useQueryClient()
  const isRegisteredInContext = availableEvents.some(
    (eventOption) => eventOption.slug === slug && eventOption.is_registered
  )
  const npoName = availableEvents.find((e) => e.slug === slug)?.npo_name ?? null
  const isRegisteredFromQuery =
    registrationsData?.events?.some(
      (registeredEvent) => registeredEvent.slug === slug
    ) ?? false
  const hasTicketAccessFromQuery =
    ticketInventoryData?.events?.some(
      (inventoryEvent) => inventoryEvent.event_slug === slug
    ) ?? false
  const isRegistered = isRegisteredInContext || isRegisteredFromQuery

  const surveyStatusQuery = useQuery({
    queryKey: ['donor-survey-status', event?.id],
    queryFn: () => getDonorSurveyStatus(event!.id),
    enabled: isAuthenticated && isRegistered && Boolean(event?.id),
    staleTime: 60_000,
  })
  // Use slug (available synchronously from route params) so the initial state
  // is correct on first render — avoids a race where cached `should_show:true`
  // triggers the overlay before the async event.id is known.
  const [surveyDismissed, setSurveyDismissed] = useState(
    () => localStorage.getItem(`survey_dismissed_${slug}`) === 'true'
  )
  // surveyModalOpen is set to true the first time the query resolves with
  // should_show=true, and is only ever cleared by explicit user action (exit /
  // skip / complete). This prevents query refetches from closing the modal
  // while the user is interacting with it.
  const [surveyModalOpen, setSurveyModalOpen] = useState(false)
  const surveyModalOpenedRef = useRef(false)
  useEffect(() => {
    if (
      surveyStatusQuery.data?.should_show &&
      surveyStatusQuery.data.survey &&
      !surveyDismissed &&
      !surveyModalOpenedRef.current
    ) {
      surveyModalOpenedRef.current = true
      queueMicrotask(() => {
        setSurveyModalOpen(true)
      })
    }
  }, [surveyStatusQuery.data, surveyDismissed])

  const [surveyThankYou, setSurveyThankYou] = useState<{
    discountCents: number
  } | null>(null)

  const dismissSurvey = () => {
    localStorage.setItem(`survey_dismissed_${slug}`, 'true')
    setSurveyDismissed(true)
    setSurveyModalOpen(false)
  }

  const submitSurveyMutation = useMutation({
    mutationFn: (payload: Parameters<typeof submitDonorSurvey>[1]) =>
      submitDonorSurvey(event!.id, payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ['donor-survey-status', event?.id],
      })
      dismissSurvey()
      if (
        response.status === 'completed' &&
        response.discount_cents_applied > 0
      ) {
        setSurveyThankYou({ discountCents: response.discount_cents_applied })
      } else if (response.status === 'completed') {
        toast.success('Thanks for sharing your preferences!')
      } else {
        toast.success('You can complete the survey later from this event page.')
      }
    },
    onError: () => {
      toast.error('Unable to save your survey response. Please try again.')
    },
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
      applyBranding(event)
    }
  }, [event, applyBranding])

  // Populate the event context store from registration/ticket data when this
  // route is rendered outside the authenticated layout (e.g. direct URL
  // navigation). This ensures EventHomePage and ProfileDropdown have access
  // to the full available events list.
  useEffect(() => {
    if (!isAuthenticated) return
    if (!registrationsData?.events && !ticketInventoryData?.events) return

    // Always merge into the latest store snapshot to avoid clobbering the
    // full event list when this route loads with stale hook state.
    const currentAvailableEvents =
      useEventContextStore.getState().availableEvents

    const eventMap = new Map<string, EventContextOption>()

    // Preserve existing entries (e.g. admin-access data from authenticated layout)
    currentAvailableEvents.forEach((ev) => eventMap.set(ev.id, { ...ev }))

    if (registrationsData?.events) {
      registrationsData.events.forEach(
        (ev: {
          id: string
          name: string
          slug: string
          event_datetime: string
          npo_name?: string
          thumbnail_url?: string | null
        }) => {
          const existing = eventMap.get(ev.id)
          if (existing) {
            existing.is_registered = true
          } else {
            eventMap.set(ev.id, {
              id: ev.id,
              name: ev.name,
              slug: ev.slug,
              event_date: ev.event_datetime,
              npo_name: ev.npo_name,
              logo_url: ev.thumbnail_url,
              is_registered: true,
              has_ticket_access: false,
              has_admin_access: false,
            })
          }
        }
      )
    }

    if (ticketInventoryData?.events) {
      ticketInventoryData.events.forEach(
        (ev: {
          event_id: string
          event_name: string
          event_slug: string
          event_date?: string
        }) => {
          const existing = eventMap.get(ev.event_id)
          if (existing) {
            existing.has_ticket_access = true
          } else {
            eventMap.set(ev.event_id, {
              id: ev.event_id,
              name: ev.event_name,
              slug: ev.event_slug,
              event_date: ev.event_date,
              is_registered: false,
              has_ticket_access: true,
              has_admin_access: false,
            })
          }
        }
      )
    }

    const events = Array.from(eventMap.values()).sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0
      if (!a.event_date) return 1
      if (!b.event_date) return -1
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    })

    setAvailableEvents(events)
  }, [
    isAuthenticated,
    registrationsData,
    ticketInventoryData,
    slug,
    setAvailableEvents,
  ])

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
    const locationParts = [
      event.venue_name,
      event.venue_address,
      event.venue_city,
      event.venue_state,
      event.venue_zip,
    ].filter(Boolean)
    const location = locationParts.join(', ')
    const description = (event.description ?? '')
      .replace(/[#*_~`>\-|]/g, '')
      .slice(0, 500)
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
  if (isAuthenticated) {
    if (eventsLoading || isLoadingRegistrations || isLoadingTicketInventory) {
      return (
        <div className='flex min-h-screen items-center justify-center'>
          <Loader2 className='text-primary h-8 w-8 animate-spin' />
        </div>
      )
    }

    if (isRegistered) {
      return (
        <>
          <EventHomePage />
          {surveyModalOpen && surveyStatusQuery.data?.survey ? (
            <AttendeeSurveyModal
              open
              survey={surveyStatusQuery.data.survey}
              isSubmitting={submitSurveyMutation.isPending}
              onClose={() => dismissSurvey()}
              onSkip={() => submitSurveyMutation.mutate({ action: 'skip' })}
              onComplete={(answers) =>
                submitSurveyMutation.mutate({ action: 'complete', answers })
              }
            />
          ) : null}
          <SurveyThankYouPopup
            key={surveyThankYou !== null ? 'popup-open' : 'popup-closed'}
            open={surveyThankYou !== null}
            discountCents={surveyThankYou?.discountCents ?? 0}
            npoName={npoName}
            onDonateBack={() => {
              if (event?.id) markSurveyDonateBack(event.id).catch(() => null)
            }}
            onApply={() => setSurveyThankYou(null)}
          />
        </>
      )
    }
    // Fall through to render the public event page for authenticated but
    // unregistered donors, including ticket holders coming from My Tickets.
  }

  if (isRestoringAuth) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2 className='text-primary h-8 w-8 animate-spin' />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2 className='text-primary h-8 w-8 animate-spin' />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center p-4'>
        {isAuthenticated && (
          <div className='fixed top-3 right-3 z-50'>
            <ProfileDropdown />
          </div>
        )}
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle className='text-destructive'>Event Not Found</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-muted-foreground text-sm'>
              We couldn't find the event you're looking for. It may have been
              removed or the link may be invalid.
            </p>
            {import.meta.env.DEV && error && (
              <div className='bg-muted mt-4 rounded p-3 font-mono text-xs break-words'>
                <p className='mb-1 font-semibold'>Error Details (Dev Only):</p>
                <p>{String(error)}</p>
              </div>
            )}
            <Button onClick={() => navigate({ to: '/' })} className='w-full'>
              <ArrowLeft className='mr-2 h-4 w-4' />
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
      .filter(
        (m) => m.media_type === 'image' && m.usage_tag === tag && !!m.file_url
      )
      .map((m) => m.file_url)
  }

  const getTaggedImageUrl = (tag: EventMediaUsageTag) =>
    getTaggedImageUrls(tag)[0] ?? null

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
      (m) =>
        m.media_type === 'image' && m.file_name.toLowerCase().includes('logo')
    )
    return logo?.file_url || null
  }

  const eventDate = event.event_datetime ? new Date(event.event_datetime) : null
  const now = new Date()
  const isPast = eventDate ? eventDate < now : false

  const getEventStatus = (): EventStatus => {
    if (isPast) return 'past'
    if (event.status === 'active' && eventDate && eventDate <= now)
      return 'live'
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
  const donateNowSlug =
    Boolean(event.npo_slug) && donateNowPageConfig?.is_enabled === true
      ? (event.npo_slug as string)
      : null
  const externalDonateNowUrl = donateNowSlug
    ? null
    : (event.external_donate_now_url ?? null)
  const pageBackground = (() => {
    const style = event.page_background_style || 'solid'
    const backgroundColor =
      event.background_color?.trim() ||
      'rgb(var(--event-background, 255, 255, 255))'
    const gradientStart =
      event.page_background_gradient_start_color?.trim() || backgroundColor
    const gradientEnd =
      event.page_background_gradient_end_color?.trim() ||
      event.secondary_color?.trim() ||
      event.primary_color?.trim() ||
      '#9333EA'

    if (style === 'image' && event.page_background_image_url?.trim()) {
      return {
        backgroundImage: `url(${event.page_background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor,
      }
    }

    if (style === 'gradient') {
      return {
        background: `linear-gradient(160deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
      }
    }

    return {
      backgroundColor,
    }
  })()
  const actionCardBackground = (() => {
    const style = event.action_card_background_style || 'gradient'
    const opacity = Math.max(
      0,
      Math.min(1, event.action_card_background_opacity ?? 1)
    )
    const gradientStart =
      event.action_card_gradient_start_color?.trim() ||
      event.primary_color?.trim() ||
      '#3B82F6'
    const gradientEnd =
      event.action_card_gradient_end_color?.trim() ||
      event.secondary_color?.trim() ||
      '#9333EA'

    if (style === 'solid') {
      return {
        background: `${hexToRgba(gradientStart, opacity) || `rgba(59, 130, 246, ${opacity})`}`,
      }
    }

    return {
      background: `linear-gradient(135deg, ${hexToRgba(gradientStart, opacity) || `rgba(59, 130, 246, ${opacity})`} 0%, ${hexToRgba(gradientEnd, opacity) || `rgba(147, 51, 234, ${opacity})`} 100%)`,
    }
  })()

  return (
    <div className='min-h-screen overflow-x-hidden' style={pageBackground}>
      {/* Profile menu overlay for authenticated users; Home button for anonymous visitors */}
      {isAuthenticated ? (
        <div className='fixed top-3 right-3 z-50'>
          <ProfileDropdown />
        </div>
      ) : (
        <Link
          to='/'
          className='fixed top-3 right-3 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md'
        >
          <Home className='size-4' />
        </Link>
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

      <div className='space-y-5 px-4 py-4'>
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
              className='flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md active:scale-[0.98]'
            >
              <CalendarPlus className='h-4 w-4' />
              Add to Calendar
            </button>
          </div>
        )}

        {/* CTA — Purchase Tickets (authenticated, not registered) or Login / Register (unauthenticated) */}
        {isPast ? (
          <div
            className='space-y-3 rounded-2xl border p-5 text-center'
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
            {(donateNowSlug || externalDonateNowUrl) &&
              (donateNowSlug ? (
                <Link
                  to='/npo/$slug/donate-now'
                  params={{ slug: donateNowSlug }}
                  className='block'
                >
                  <button
                    className='flex w-full justify-center rounded-2xl p-4 text-center transition-all hover:shadow-md active:scale-[0.98]'
                    style={actionCardBackground}
                  >
                    <div>
                      <p className='text-lg font-black text-white'>
                        Donate Now
                      </p>
                      <p className='text-sm text-white/80'>
                        Support this cause with a direct donation →
                      </p>
                    </div>
                  </button>
                </Link>
              ) : (
                <a
                  href={externalDonateNowUrl ?? '#'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block'
                >
                  <button
                    className='flex w-full justify-center rounded-2xl p-4 text-center transition-all hover:shadow-md active:scale-[0.98]'
                    style={actionCardBackground}
                  >
                    <div>
                      <p className='text-lg font-black text-white'>
                        Donate Now
                      </p>
                      <p className='text-sm text-white/80'>
                        Support this cause with a direct donation →
                      </p>
                    </div>
                  </button>
                </a>
              ))}
          </div>
        ) : isAuthenticated ? (
          // Authenticated but not registered — show ticket purchase CTA
          <div
            className='space-y-3 rounded-2xl p-5 text-center'
            style={{
              background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246) / 0.08) 0%, rgb(var(--event-secondary, 147, 51, 234) / 0.08) 100%)`,
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
            }}
          >
            {(donateNowSlug || externalDonateNowUrl) &&
              (donateNowSlug ? (
                <Link
                  to='/npo/$slug/donate-now'
                  params={{ slug: donateNowSlug }}
                  className='block'
                >
                  <button
                    className='flex w-full justify-center rounded-2xl p-4 text-center transition-all hover:shadow-md active:scale-[0.98]'
                    style={actionCardBackground}
                  >
                    <div>
                      <p className='text-lg font-black text-white'>
                        Donate Now
                      </p>
                      <p className='text-sm text-white/80'>
                        Support this cause with a direct donation →
                      </p>
                    </div>
                  </button>
                </Link>
              ) : (
                <a
                  href={externalDonateNowUrl ?? '#'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block'
                >
                  <button
                    className='flex w-full justify-center rounded-2xl p-4 text-center transition-all hover:shadow-md active:scale-[0.98]'
                    style={actionCardBackground}
                  >
                    <div>
                      <p className='text-lg font-black text-white'>
                        Donate Now
                      </p>
                      <p className='text-sm text-white/80'>
                        Support this cause with a direct donation →
                      </p>
                    </div>
                  </button>
                </a>
              ))}
            {/* Link to ticket purchase page */}
            <Link to='/events/$slug/tickets' params={{ slug }}>
              <button
                className='flex w-full items-center justify-center gap-3 rounded-2xl p-4 transition-all hover:shadow-md active:scale-[0.98]'
                style={actionCardBackground}
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
            {(donateNowSlug || externalDonateNowUrl) &&
              (donateNowSlug ? (
                <Link
                  to='/npo/$slug/donate-now'
                  params={{ slug: donateNowSlug }}
                  className='block'
                >
                  <button
                    className='flex w-full justify-center rounded-2xl p-4 text-center transition-all hover:shadow-md active:scale-[0.98]'
                    style={actionCardBackground}
                  >
                    <div>
                      <p className='text-lg font-black text-white'>
                        Donate Now
                      </p>
                      <p className='text-sm text-white/80'>
                        Support this cause with a direct donation →
                      </p>
                    </div>
                  </button>
                </Link>
              ) : (
                <a
                  href={externalDonateNowUrl ?? '#'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block'
                >
                  <button
                    className='flex w-full justify-center rounded-2xl p-4 text-center transition-all hover:shadow-md active:scale-[0.98]'
                    style={actionCardBackground}
                  >
                    <div>
                      <p className='text-lg font-black text-white'>
                        Donate Now
                      </p>
                      <p className='text-sm text-white/80'>
                        Support this cause with a direct donation →
                      </p>
                    </div>
                  </button>
                </a>
              ))}

            <Link to='/sign-in' className='block'>
              <button
                className='w-full rounded-2xl p-4 text-left transition-all hover:shadow-md active:scale-[0.98]'
                style={actionCardBackground}
              >
                <p className='text-lg font-black text-white'>
                  Login to Register
                </p>
                <p className='text-sm text-white/80'>
                  Already have an account? Sign in to register →
                </p>
              </button>
            </Link>
            <Link to='/sign-up' className='block'>
              <button className='w-full rounded-2xl border-2 border-gray-300 bg-white p-4 text-left transition-all hover:shadow-md active:scale-[0.98]'>
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
                className='text-xs font-bold tracking-widest uppercase'
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              >
                {isPast ? 'Auction Review' : 'Auction Preview'}
              </h3>
              <p
                className='mt-1 text-sm'
                style={{ color: 'var(--event-text-on-background, #374151)' }}
              >
                {isPast
                  ? 'A look back at items from this event.'
                  : 'Preview a few items available at this event.'}
              </p>
            </div>

            <div className='-mx-1 flex gap-3 overflow-x-auto px-1 pb-1'>
              {auctionPreviewItems.map((item) => (
                <div
                  key={item.id}
                  className='w-44 shrink-0 overflow-hidden rounded-2xl border bg-white/90 shadow-sm'
                  style={{
                    borderColor:
                      'rgb(var(--event-primary, 59, 130, 246) / 0.16)',
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
                      style={{
                        color: 'var(--event-text-on-background, #111827)',
                      }}
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
            eventWebsite={
              event.links?.find((l) => l.link_type === 'website')?.url
            }
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
              className='mb-2 text-xs font-bold tracking-widest uppercase'
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
