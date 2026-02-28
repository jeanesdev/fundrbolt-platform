/**
 * EventHomePage — Premium, native-app-style event experience
 *
 * Architecture:
 * - Fixed compact header (event switcher + profile)
 * - Scrollable tab content area
 * - Fixed bottom tab navigation (Home | Bid | Watching | My Seat)
 *
 * Branding CSS variables (injected by useEventBranding):
 *   --event-primary, --event-secondary, --event-background, --event-accent
 */
import {
  AuctionGallery,
  EventDetails,
  EventSwitcher,
  MySeatingSection,
} from '@/components/event-home'
import { AuctionItemDetailModal } from '@/components/event-home/AuctionItemDetailModal'
import { BottomTabNav, type DonorTab } from '@/components/event-home/BottomTabNav'
import { CountdownTimer } from '@/components/event-home/CountdownTimer'
import { EventHeroSection, type EventStatus } from '@/components/event-home/EventHeroSection'
import { SponsorsCarousel } from '@/components/event-home/SponsorsCarousel'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventBranding } from '@/hooks/use-event-branding'
import { useEventContext } from '@/hooks/use-event-context'
import { cn } from '@/lib/utils'
import apiClient from '@/lib/axios'
import auctionItemService from '@/services/auctionItemService'
import {
  getMySeatingInfo,
  type SeatingInfoResponse,
} from '@/services/seating-service'
import watchListService from '@/services/watchlistService'
import { getEffectiveNow, useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventContextStore } from '@/stores/event-context-store'
import { useEventStore } from '@/stores/event-store'
import type { RegisteredEventWithBranding } from '@/types/event-branding'
import type { AuctionItemGalleryItem } from '@/types/auction-gallery'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function EventHomePage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as {
    eventSlug?: string
    slug?: string
  }
  const eventSlug = params.eventSlug ?? params.slug
  const { currentEvent, eventsLoading, eventsError, loadEventBySlug } =
    useEventStore()
  const { applyBranding, clearBranding } = useEventBranding()
  const { setSelectedEvent } = useEventContextStore()
  const { availableEvents } = useEventContext()
  const spoofedUserId = useDebugSpoofStore((state) => state.spoofedUser?.id)
  const watchlistScope = spoofedUserId ?? 'self'
  const timeBaseRealMs = useDebugSpoofStore((state) => state.timeBaseRealMs)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)

  const [userSelectedTab, setUserSelectedTab] = useState<DonorTab | null>(null)
  const [selectedAuctionItemId, setSelectedAuctionItemId] = useState<string | null>(null)
  const [isItemWatching, setIsItemWatching] = useState(false)
  const [winningItemMap, setWinningItemMap] = useState<Record<string, boolean>>({})
  const [maxBidItemMap, setMaxBidItemMap] = useState<Record<string, number>>({})

  // Restore bid flags from localStorage
  useEffect(() => {
    if (!currentEvent?.id) return
    const storageKey = `fundrbolt-bid-flags:${currentEvent.id}:${watchlistScope}`
    const stored = localStorage.getItem(storageKey)
    if (!stored) {
      setWinningItemMap({})
      setMaxBidItemMap({})
      return
    }
    try {
      const parsed = JSON.parse(stored) as {
        winning?: Record<string, boolean>
        maxBid?: Record<string, number>
      }
      setWinningItemMap(parsed.winning ?? {})
      setMaxBidItemMap(parsed.maxBid ?? {})
    } catch {
      setWinningItemMap({})
      setMaxBidItemMap({})
    }
  }, [currentEvent?.id, watchlistScope])

  // Persist bid flags to localStorage
  useEffect(() => {
    if (!currentEvent?.id) return
    const storageKey = `fundrbolt-bid-flags:${currentEvent.id}:${watchlistScope}`
    localStorage.setItem(
      storageKey,
      JSON.stringify({ winning: winningItemMap, maxBid: maxBidItemMap })
    )
  }, [currentEvent?.id, watchlistScope, winningItemMap, maxBidItemMap])

  // Derive active tab: auto-switch to auction when event goes live, unless user has navigated
  const activeTab = useMemo((): DonorTab => {
    if (userSelectedTab !== null) return userSelectedTab
    if (currentEvent?.status === 'active') {
      const eventDate = currentEvent.event_datetime
        ? new Date(currentEvent.event_datetime)
        : null
      if (eventDate && eventDate <= getEffectiveNow()) return 'auction'
    }
    return 'home'
  }, [userSelectedTab, currentEvent?.status, currentEvent?.event_datetime])

  const setActiveTab = (tab: DonorTab) => setUserSelectedTab(tab)

  // Events for switcher
  const eventsForSwitcher = useMemo((): RegisteredEventWithBranding[] => {
    return availableEvents.map((event) => {
      const eventDate = event.event_date ? new Date(event.event_date) : null
      const now = getEffectiveNow()
      const is_past = eventDate ? eventDate <= now : false
      const is_upcoming =
        eventDate && !is_past
          ? eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : false
      return {
        id: event.id,
        name: event.name,
        slug: event.slug,
        event_datetime: event.event_date || '',
        timezone: '',
        is_past,
        is_upcoming,
        thumbnail_url: event.logo_url || null,
        primary_color: '#3B82F6',
        secondary_color: '#9333EA',
        background_color: '#FFFFFF',
        accent_color: '#3B82F6',
        npo_name: event.npo_name || 'Organization',
        npo_logo_url: null,
      }
    })
  }, [availableEvents, timeBaseRealMs, timeBaseSpoofMs])

  // Seating query
  const {
    data: seatingInfo,
    error: seatingError,
    isLoading: seatingLoading,
  } = useQuery<SeatingInfoResponse>({
    queryKey: ['seating', 'my-info', currentEvent?.id, spoofedUserId ?? 'self'],
    queryFn: () => getMySeatingInfo(currentEvent!.id),
    enabled: !!currentEvent?.id,
    placeholderData: keepPreviousData,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
    retry: (failureCount, error) => {
      const status = (error as AxiosError | undefined)?.response?.status
      if (status === 404) return false
      return failureCount < 1
    },
  })

  const seatingStatusCode = (seatingError as AxiosError | null)?.response?.status
  const shouldShowSeatingError = !!seatingError && seatingStatusCode !== 404

  // Current event for switcher
  const currentEventForSwitcher = useMemo((): RegisteredEventWithBranding | null => {
    if (!currentEvent) return null
    const eventDate = new Date(currentEvent.event_datetime)
    const now = getEffectiveNow()
    const is_past = eventDate <= now
    const is_upcoming =
      !is_past &&
      eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const thumbnail_url: string | null =
      ('banner_url' in currentEvent ? (currentEvent as { banner_url?: string | null }).banner_url ?? null : null) ||
      currentEvent.media?.[0]?.file_url ||
      null
    return {
      id: currentEvent.id,
      name: currentEvent.name,
      slug: currentEvent.slug,
      event_datetime: currentEvent.event_datetime,
      timezone: currentEvent.timezone,
      is_past,
      is_upcoming,
      thumbnail_url,
      primary_color: currentEvent.primary_color || '#3B82F6',
      secondary_color: currentEvent.secondary_color || '#9333EA',
      background_color: currentEvent.background_color || '#FFFFFF',
      accent_color: currentEvent.accent_color || '#3B82F6',
      npo_name: currentEvent.npo_name || 'Organization',
      npo_logo_url: null,
    }
  }, [currentEvent, timeBaseRealMs, timeBaseSpoofMs])

  const handleEventSelect = useCallback(
    (event: RegisteredEventWithBranding) => {
      navigate({ to: '/events/$eventSlug', params: { eventSlug: event.slug } })
    },
    [navigate]
  )

  const loadEvent = useCallback(() => {
    if (eventSlug) {
      loadEventBySlug(eventSlug).catch(() => {
        toast.error('Failed to load event')
        setSelectedEvent(null, 'Select Event', null)
        navigate({ to: '/home' })
      })
    }
  }, [eventSlug, loadEventBySlug, navigate, setSelectedEvent])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  // Apply event branding
  useEffect(() => {
    if (currentEvent) {
      applyBranding({
        primary_color: currentEvent.primary_color,
        secondary_color: currentEvent.secondary_color,
        background_color: currentEvent.background_color,
        accent_color: currentEvent.accent_color,
      })
    }
    return () => { clearBranding() }
  }, [currentEvent, applyBranding, clearBranding])

  // Venue map link
  const venueMapLink = useMemo(() => {
    if (!currentEvent?.venue_address) return null
    const parts = [currentEvent.venue_address]
    if (currentEvent.venue_city) parts.push(currentEvent.venue_city)
    if (currentEvent.venue_state) parts.push(currentEvent.venue_state)
    if (currentEvent.venue_zip) parts.push(currentEvent.venue_zip)
    return `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
  }, [currentEvent])

  // Add to calendar
  const generateICSFile = useCallback(() => {
    if (!currentEvent?.event_datetime) return
    const eventDate = new Date(currentEvent.event_datetime)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const parts: string[] = []
    if (currentEvent.venue_name) parts.push(currentEvent.venue_name)
    if (currentEvent.venue_address) parts.push(currentEvent.venue_address)
    if (currentEvent.venue_city) parts.push(currentEvent.venue_city)
    if (currentEvent.venue_state) parts.push(currentEvent.venue_state)
    const icsContent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fundrbolt//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(eventDate)}`,
      `DTEND:${fmt(new Date(eventDate.getTime() + 3 * 3600000))}`,
      `DTSTAMP:${fmt(new Date())}`,
      `SUMMARY:${currentEvent.name}`,
      `DESCRIPTION:${(currentEvent.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${parts.join(', ')}`,
      `UID:${currentEvent.id}@fundrbolt.com`,
      'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${currentEvent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }, [currentEvent])

  const queryClient = useQueryClient()

  const { data: watchListData } = useQuery({
    queryKey: ['watchlist', currentEvent?.id, watchlistScope],
    queryFn: () => {
      if (!currentEvent?.id) return Promise.resolve({ watch_list: [], total: 0 })
      return watchListService.getWatchList(currentEvent.id)
    },
    enabled: !!currentEvent?.id,
    staleTime: 30000,
  })

  // Outbid count for badge
  const outbidCount = useMemo(() => {
    if (!watchListData?.watch_list) return 0
    return watchListData.watch_list.filter((entry) => {
      const itemId = entry.auction_item_id
      return maxBidItemMap[itemId] !== undefined && !winningItemMap[itemId]
    }).length
  }, [watchListData, maxBidItemMap, winningItemMap])

  // Preview items for home tab (top 6 by bid count)
  const { data: previewItemsData } = useQuery({
    queryKey: ['auction-items', currentEvent?.id, 'all', 'preview'],
    queryFn: async () => {
      const response = await apiClient.get<{ items: AuctionItemGalleryItem[] }>(
        `/events/${currentEvent!.id}/auction-items`,
        { params: { auction_type: 'all', page: 1, limit: 20 } }
      )
      return response.data
    },
    enabled: !!currentEvent?.id,
    staleTime: 30000,
  })

  // Sorted preview items (must be before any early returns)
  const previewItems: AuctionItemGalleryItem[] = useMemo(() => {
    const items = previewItemsData?.items ?? []
    return [...items]
      .sort((a, b) => (b.bid_count ?? 0) - (a.bid_count ?? 0))
      .slice(0, 6)
  }, [previewItemsData])

  // Place bid mutation
  const { mutate: mutatePlaceBid, isPending: isPlacingBid } = useMutation({
    mutationFn: ({ itemId, amount }: { itemId: string; amount: number }) =>
      auctionItemService.placeBid(currentEvent!.id, itemId, amount),
    onSuccess: async (bid, variables) => {
      const spoofSuffix = spoofedUserId ? ' for spoofed user' : ''
      toast.success(`Bid placed at $${variables.amount.toLocaleString()}${spoofSuffix}`, {
        style: { backgroundColor: 'rgb(22, 163, 74)', color: '#FFFFFF', border: '1px solid rgb(21, 128, 61)' },
      })
      if (typeof bid?.is_winning === 'boolean') {
        setWinningItemMap((prev) => ({ ...prev, [variables.itemId]: bid.is_winning }))
      }
      if (currentEvent?.id) {
        try {
          await watchListService.addToWatchList(currentEvent.id, variables.itemId)
        } catch (error: unknown) {
          const status = (error as AxiosError | undefined)?.response?.status
          if (status !== 409) toast.error('Bid placed, but failed to add item to watch list')
        }
        queryClient.setQueryData(
          ['watchlist', currentEvent.id, watchlistScope],
          (previous: { watch_list?: Array<{ id: string; user_id: string; auction_item_id: string; added_at: string }>; total?: number } | undefined) => {
            const existing = previous?.watch_list ?? []
            if (existing.some((entry) => entry.auction_item_id === variables.itemId)) return previous
            return {
              watch_list: [...existing, { id: variables.itemId, user_id: '', auction_item_id: variables.itemId, added_at: new Date().toISOString() }],
              total: (previous?.total ?? existing.length) + 1,
            }
          }
        )
      }
      if (selectedAuctionItemId === variables.itemId) setIsItemWatching(true)
      queryClient.invalidateQueries({ queryKey: ['auction-items', currentEvent?.id] })
      queryClient.invalidateQueries({ queryKey: ['auction-item-detail', currentEvent?.id] })
      queryClient.invalidateQueries({ queryKey: ['auction-item-bids', variables.itemId] })
      queryClient.invalidateQueries({ queryKey: ['watchlist', currentEvent?.id, watchlistScope] })
    },
    onError: (error: unknown) => {
      const message = (error as AxiosError<{ detail?: string }> | undefined)?.response?.data?.detail || 'Failed to place bid'
      toast.error(message)
    },
  })

  // Max bid mutation
  const { mutate: mutatePlaceMaxBid, isPending: isSettingMaxBid } = useMutation({
    mutationFn: ({ itemId, maxAmount }: { itemId: string; maxAmount: number }) =>
      auctionItemService.placeMaxBid(currentEvent!.id, itemId, maxAmount),
    onSuccess: async (bid, variables) => {
      const spoofSuffix = spoofedUserId ? ' for spoofed user' : ''
      toast.success(`Max bid set at $${variables.maxAmount.toLocaleString()}${spoofSuffix}`, {
        style: { backgroundColor: 'rgb(22, 163, 74)', color: '#FFFFFF', border: '1px solid rgb(21, 128, 61)' },
      })
      if (typeof bid?.is_winning === 'boolean') {
        setWinningItemMap((prev) => ({ ...prev, [variables.itemId]: bid.is_winning }))
      }
      setMaxBidItemMap((prev) => ({ ...prev, [variables.itemId]: variables.maxAmount }))
      if (currentEvent?.id) {
        try {
          await watchListService.addToWatchList(currentEvent.id, variables.itemId)
        } catch (error: unknown) {
          const status = (error as AxiosError | undefined)?.response?.status
          if (status !== 409) toast.error('Max bid set, but failed to add item to watch list')
        }
        queryClient.setQueryData(
          ['watchlist', currentEvent.id, watchlistScope],
          (previous: { watch_list?: Array<{ id: string; user_id: string; auction_item_id: string; added_at: string }>; total?: number } | undefined) => {
            const existing = previous?.watch_list ?? []
            if (existing.some((entry) => entry.auction_item_id === variables.itemId)) return previous
            return {
              watch_list: [...existing, { id: variables.itemId, user_id: '', auction_item_id: variables.itemId, added_at: new Date().toISOString() }],
              total: (previous?.total ?? existing.length) + 1,
            }
          }
        )
      }
      if (selectedAuctionItemId === variables.itemId) setIsItemWatching(true)
      queryClient.invalidateQueries({ queryKey: ['auction-items', currentEvent?.id] })
      queryClient.invalidateQueries({ queryKey: ['auction-item-detail', currentEvent?.id] })
      queryClient.invalidateQueries({ queryKey: ['auction-item-bids', variables.itemId] })
      queryClient.invalidateQueries({ queryKey: ['watchlist', currentEvent?.id, watchlistScope] })
    },
    onError: (error: unknown) => {
      const message = (error as AxiosError<{ detail?: string }> | undefined)?.response?.data?.detail || 'Failed to set max bid'
      toast.error(message)
    },
  })

  const { mutate: mutateBuyNow, isPending: isBuyingNow } = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      auctionItemService.buyNow(currentEvent!.id, itemId, 1),
    onSuccess: (_response, variables) => {
      toast.success('Successfully completed Buy Now')
      queryClient.invalidateQueries({ queryKey: ['auction-items', currentEvent?.id] })
      queryClient.invalidateQueries({ queryKey: ['auction-item-detail', currentEvent?.id] })
      queryClient.invalidateQueries({ queryKey: ['watchlist', currentEvent?.id, watchlistScope] })
      if (selectedAuctionItemId === variables.itemId) setSelectedAuctionItemId(null)
    },
    onError: (error: unknown) => {
      const message = (error as AxiosError<{ detail?: string }> | undefined)?.response?.data?.detail || 'Failed to complete Buy Now'
      toast.error(message)
    },
  })

  const handlePlaceBid = useCallback(
    (itemId: string, amount: number) => { mutatePlaceBid({ itemId, amount }) },
    [mutatePlaceBid]
  )
  const handleSetMaxBid = useCallback(
    (itemId: string, amount: number) => { mutatePlaceMaxBid({ itemId, maxAmount: amount }) },
    [mutatePlaceMaxBid]
  )
  const handleBuyNow = useCallback(
    (itemId: string) => { mutateBuyNow({ itemId }) },
    [mutateBuyNow]
  )

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (eventsLoading) {
    return (
      <div
        className='flex min-h-screen items-center justify-center'
        style={{ background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246) / 0.15) 0%, rgb(var(--event-secondary, 147, 51, 234) / 0.15) 100%)` }}
      >
        <div className='text-center'>
          <div
            className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'
            style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)' }}
          >
            <Loader2
              className='h-8 w-8 animate-spin'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            />
          </div>
          <p className='text-sm font-medium' style={{ color: 'var(--event-text-on-background, #6B7280)' }}>
            Loading event…
          </p>
        </div>
      </div>
    )
  }

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (eventsError || !currentEvent) {
    return (
      <div className='flex min-h-screen items-center justify-center p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <div className='text-destructive flex items-center gap-2'>
              <AlertCircle className='h-5 w-5' />
              <CardTitle>Event Not Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground mb-4'>
              We couldn't find this event. It may have been removed or you may not have access.
            </p>
            <button
              onClick={() => navigate({ to: '/home' })}
              className='w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white'
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
            >
              Return to Home
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Derived values ──────────────────────────────────────────────────────────
  const getBannerUrl = () => {
    if ('banner_url' in currentEvent && currentEvent.banner_url) return currentEvent.banner_url as string
    if (currentEvent.media?.length) {
      // Prefer a non-logo, non-map image as banner
      const banner = currentEvent.media.find(
        (m) =>
          m.media_type === 'image' &&
          !m.file_name.toLowerCase().includes('logo') &&
          !m.file_name.toLowerCase().includes('map')
      )
      return banner?.file_url || currentEvent.media[0]?.file_url || null
    }
    return null
  }
  const bannerUrl = getBannerUrl()

  const getLogoUrl = () => {
    if (!currentEvent.media?.length) return null
    // Prefer image with "logo" in name, else first image
    const logo = currentEvent.media.find(
      (m) => m.media_type === 'image' && m.file_name.toLowerCase().includes('logo')
    )
    return logo?.file_url || null
  }

  const getEventStatus = (): EventStatus => {
    if (!currentEventForSwitcher) return 'upcoming'
    if (currentEventForSwitcher.is_past) return 'past'
    if (currentEvent.status === 'active') {
      const eventDate = currentEvent.event_datetime ? new Date(currentEvent.event_datetime) : null
      if (eventDate && eventDate <= getEffectiveNow()) return 'live'
    }
    return 'upcoming'
  }
  const eventStatus = getEventStatus()

  // ─── Tab content ─────────────────────────────────────────────────────────────

  const sharedAuctionProps = {
    onItemClick: (item: AuctionItemGalleryItem, isWinning: boolean) => {
      setSelectedAuctionItemId(item.id)
      setWinningItemMap((prev) => ({ ...prev, [item.id]: isWinning }))
      const isWatched =
        watchListData?.watch_list?.some((e) => e.auction_item_id === item.id) ?? false
      setIsItemWatching(isWatched)
    },
  }

  const heroAndNav = (
    <EventHeroSection
      eventName={currentEvent.name}
      npoName={currentEvent.npo_name}
      logoUrl={getLogoUrl()}
      bannerUrl={bannerUrl}
      eventDate={currentEvent.event_datetime}
      venueName={currentEvent.venue_name}
      status={eventStatus}
      onAddToCalendar={generateICSFile}
      venueMapLink={venueMapLink}
      switcherSlot={
        currentEventForSwitcher && eventsForSwitcher.length > 0 ? (
          <EventSwitcher
            currentEvent={currentEventForSwitcher}
            events={eventsForSwitcher}
            onEventSelect={handleEventSelect}
          />
        ) : undefined
      }
      profileSlot={<ProfileDropdown />}
    />
  )

  const homeTabContent = (
    <>
      {heroAndNav}

      <div className='px-4 py-4 space-y-5'>
        {/* Countdown — show if event is in the future */}
        {currentEvent.event_datetime && (
          <div className='animate-card-enter stagger-1'>
            <CountdownTimer
              targetDate={currentEvent.event_datetime}
              eventName={currentEvent.name}
              hideOnExpire={false}
            />
          </div>
        )}

        {/* Auction Preview Strip */}
        {previewItems.length > 0 && (
          <div className='animate-card-enter stagger-2'>
            <div className='mb-3 flex items-center justify-between'>
              <h2
                className='text-base font-bold'
                style={{ color: 'var(--event-text-on-background, #111827)' }}
              >
                {eventStatus === 'live' ? '🔥 Live Auction' : '🎁 Auction Items'}
              </h2>
              <button
                onClick={() => setActiveTab('auction')}
                className='text-xs font-semibold'
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              >
                See All →
              </button>
            </div>
            <div className='flex gap-3 overflow-x-auto pb-1 -mx-1 px-1' style={{ scrollSnapType: 'x mandatory' }}>
              {previewItems.map((item, i) => (
                <div
                  key={item.id}
                  className={cn('flex-none w-44 animate-card-enter', `stagger-${Math.min(i + 1, 6)}`)}
                  style={{ scrollSnapAlign: 'start' }}
                  onClick={() => {
                    setSelectedAuctionItemId(item.id)
                    const isWatched = watchListData?.watch_list?.some((e) => e.auction_item_id === item.id) ?? false
                    setIsItemWatching(isWatched)
                  }}
                >
                  <div
                    className='group relative overflow-hidden rounded-2xl border cursor-pointer transition-all active:scale-95 hover:shadow-lg'
                    style={{
                      backgroundColor: 'rgb(var(--event-card-bg, 255, 255, 255))',
                      borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
                    }}
                  >
                    {/* Image */}
                    <div className='relative overflow-hidden' style={{ paddingTop: '80%' }}>
                      <div className='absolute inset-0'>
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                            loading='lazy'
                          />
                        ) : (
                          <div
                            className='flex h-full w-full flex-col items-center justify-center gap-1'
                            style={{ background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246) / 0.35) 0%, rgb(var(--event-secondary, 147, 51, 234) / 0.45) 100%)` }}
                          >
                            <span className='text-3xl'>🎁</span>
                          </div>
                        )}
                        <div className='absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent' />
                      </div>
                      {(item.bid_count ?? 0) >= 3 && (
                        <div className='absolute top-1.5 right-1.5 text-sm'>🔥</div>
                      )}
                    </div>
                    {/* Info */}
                    <div className='p-2.5'>
                      <p
                        className='text-xs font-semibold truncate leading-tight mb-1'
                        style={{ color: 'var(--event-text-on-background, #111827)' }}
                      >
                        {item.title}
                      </p>
                      <p
                        className='text-sm font-black'
                        style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                      >
                        {item.current_bid
                          ? `$${item.current_bid.toLocaleString()}`
                          : item.starting_bid
                            ? `From $${item.starting_bid.toLocaleString()}`
                            : 'No bids yet'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {/* "Browse All" card */}
              <div
                className='flex-none w-40 animate-card-enter stagger-6 cursor-pointer'
                style={{ scrollSnapAlign: 'start' }}
                onClick={() => setActiveTab('auction')}
              >
                <div
                  className='flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed'
                  style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)' }}
                >
                  <span className='text-3xl'>🔨</span>
                  <p
                    className='text-xs font-bold text-center leading-tight'
                    style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  >
                    Browse All Items
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA for bidding (when no items yet) */}
        {previewItems.length === 0 && eventStatus !== 'past' && (
          <div className='animate-card-enter stagger-2'>
            <button
              onClick={() => setActiveTab('auction')}
              className='w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] hover:shadow-md'
              style={{
                background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
              }}
            >
              <p className='text-lg font-black text-white'>Browse Auction Items</p>
              <p className='text-sm text-white/80'>Place bids and win amazing items →</p>
            </button>
          </div>
        )}

        {/* Event Details */}
        <div className='animate-card-enter stagger-3'>
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
          />
        </div>

        {/* About */}
        {currentEvent.description && (
          <div
            className='rounded-2xl border p-4 animate-card-enter stagger-4'
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
            <p className='text-sm leading-relaxed' style={{ color: 'var(--event-text-on-background, #374151)' }}>
              {currentEvent.description}
            </p>
          </div>
        )}

        {/* Sponsors */}
        <div className='animate-card-enter stagger-5'>
          <SponsorsCarousel eventId={currentEvent.id} />
        </div>
      </div>
    </>
  )

  const auctionTabContent = (
    <>
      {/* Sticky header */}
      <div
        className='sticky top-0 z-20 px-4 py-3 border-b backdrop-blur-md'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255) / 0.92)',
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
        }}
      >
        <div className='flex items-center justify-between'>
          <h2
            className='text-base font-bold'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            Auction Items
          </h2>
          <div className='flex items-center gap-2'>
            {eventStatus === 'live' && (
              <span className='flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white animate-live-glow'>
                <span className='h-1.5 w-1.5 rounded-full bg-white animate-pulse' />
                LIVE
              </span>
            )}
            <ProfileDropdown />
          </div>
        </div>
      </div>

      <div className='px-3 py-3'>
        <AuctionGallery
          eventId={currentEvent.id}
          watchlistScope={watchlistScope}
          maxBidItemMap={maxBidItemMap}
          winningItemMap={winningItemMap}
          initialFilter='all'
          initialSort='highest_bid'
          eventStatus={currentEvent.status}
          eventDateTime={currentEvent.event_datetime}
          onItemClick={(item, isWinning) => sharedAuctionProps.onItemClick(item, isWinning)}
        />
      </div>
    </>
  )

  const watchlistTabContent = (
    <>
      <div
        className='sticky top-0 z-20 px-4 py-3 border-b backdrop-blur-md'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255) / 0.92)',
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
        }}
      >
        <div className='flex items-center justify-between'>
          <div>
            <h2
              className='text-base font-bold'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              Watching
            </h2>
            {outbidCount > 0 && (
              <p className='text-xs text-amber-500 font-medium mt-0.5'>
                ⚡ You've been outbid on {outbidCount} item{outbidCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <ProfileDropdown />
        </div>
      </div>

      <div className='px-3 py-3'>
        {!watchListData?.watch_list?.length ? (
          <div className='flex flex-col items-center justify-center py-20 text-center'>
            <div
              className='mb-4 flex h-20 w-20 items-center justify-center rounded-full'
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}
            >
              <span className='text-4xl'>👁️</span>
            </div>
            <p
              className='mb-1 text-base font-bold'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              Nothing here yet
            </p>
            <p
              className='text-sm mb-4'
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              Tap the ♥ on any item in the Bid tab to watch it
            </p>
            <button
              onClick={() => setActiveTab('auction')}
              className='rounded-2xl px-6 py-3 text-sm font-bold text-white transition-all active:scale-95 hover:shadow-lg'
              style={{ background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)), rgb(var(--event-secondary, 147, 51, 234)))` }}
            >
              🔨 Browse Auction Items
            </button>
          </div>
        ) : (
          <AuctionGallery
            eventId={currentEvent.id}
            watchlistScope={watchlistScope}
            maxBidItemMap={maxBidItemMap}
            winningItemMap={winningItemMap}
            initialFilter='all'
            initialSort='highest_bid'
            eventStatus={currentEvent.status}
            eventDateTime={currentEvent.event_datetime}
            onItemClick={(item, isWinning) => sharedAuctionProps.onItemClick(item, isWinning)}
          />
        )}
      </div>
    </>
  )

  const myitemsTabContent = (
    <>
      {/* Sticky header */}
      <div
        className='sticky top-0 z-20 px-4 py-3 border-b backdrop-blur-md'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255) / 0.92)',
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
        }}
      >
        <div className='flex items-center justify-between'>
          <h2
            className='text-base font-bold'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            My Items
          </h2>
          <ProfileDropdown />
        </div>
      </div>

      <div className='px-3 py-3'>
        <AuctionGallery
          eventId={currentEvent.id}
          watchlistScope={watchlistScope}
          maxBidItemMap={maxBidItemMap}
          winningItemMap={winningItemMap}
          initialFilter='all'
          initialSort='highest_bid'
          eventStatus={currentEvent.status}
          eventDateTime={currentEvent.event_datetime}
          onItemClick={(item, isWinning) => sharedAuctionProps.onItemClick(item, isWinning)}
          showOnlyMyItems={true}
        />
      </div>
    </>
  )

  const seatTabContent = (
    <>
      <div
        className='sticky top-0 z-20 px-4 py-3 border-b backdrop-blur-md'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255) / 0.92)',
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
        }}
      >
        <div className='flex items-center justify-between'>
          <h2
            className='text-base font-bold'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            My Info
          </h2>
          <ProfileDropdown />
        </div>
      </div>

      <div className='px-4 py-4'>
        {seatingLoading && (
          <div className='flex items-center justify-center py-16'>
            <Loader2
              className='h-8 w-8 animate-spin'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            />
          </div>
        )}

        {shouldShowSeatingError && (
          <div
            className='flex items-center gap-3 rounded-2xl border p-4 animate-card-enter'
            style={{
              borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.06)',
            }}
          >
            <AlertCircle className='h-5 w-5 text-destructive flex-shrink-0' />
            <p className='text-sm' style={{ color: 'var(--event-text-on-background, #374151)' }}>
              Unable to load seating information. Please try again later.
            </p>
          </div>
        )}

        {seatingInfo && !shouldShowSeatingError && !seatingLoading && (
          <div className='animate-card-enter'>
            <MySeatingSection seatingInfo={seatingInfo} />
          </div>
        )}

        {!seatingLoading && !seatingInfo && !shouldShowSeatingError && (
          <div className='flex flex-col items-center justify-center py-20 text-center'>
            <div
              className='mb-5 flex h-24 w-24 items-center justify-center rounded-full animate-float'
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}
            >
              <span className='text-5xl'>🪑</span>
            </div>
            <p
              className='mb-2 text-lg font-bold'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              No Seat Assigned Yet
            </p>
            <p
              className='text-sm max-w-xs'
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              Your table assignment will appear here once the event coordinator assigns seating.
              Check back closer to the event!
            </p>
          </div>
        )}
      </div>
    </>
  )

  // Tab badge: seat tab gets badge if user hasn't checked in
  const needsCheckIn =
    seatingInfo &&
    !seatingInfo.myInfo?.checkedIn &&
    !(seatingInfo as { my_info?: { checked_in?: boolean } }).my_info?.checked_in

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <div
      className='flex h-svh flex-col overflow-hidden'
      style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
    >
      {/* Tab content — scrollable, key triggers re-animation on tab switch */}
      <main
        className='flex-1 overflow-y-auto overflow-x-hidden pb-20'
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div key={activeTab} className='animate-tab-page min-h-full'>
          {activeTab === 'home' && homeTabContent}
          {activeTab === 'auction' && auctionTabContent}
          {activeTab === 'watchlist' && watchlistTabContent}
          {activeTab === 'myitems' && myitemsTabContent}
          {activeTab === 'seat' && seatTabContent}
        </div>
      </main>

      {/* Fixed bottom navigation */}
      <BottomTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        badges={{
          watchlist: outbidCount > 0 ? outbidCount : undefined,
          seat: needsCheckIn ? 1 : undefined,
        }}
      />

      {/* Auction Item Detail Modal */}
      <AuctionItemDetailModal
        eventId={currentEvent.id}
        itemId={selectedAuctionItemId}
        eventStatus={currentEvent.status}
        eventDateTime={currentEvent.event_datetime}
        onClose={() => setSelectedAuctionItemId(null)}
        onPlaceBid={handlePlaceBid}
        onSetMaxBid={handleSetMaxBid}
        onBuyNow={handleBuyNow}
        isSubmittingBid={isPlacingBid || isSettingMaxBid || isBuyingNow}
        isWatching={isItemWatching}
        currentUserMaxBid={
          selectedAuctionItemId ? maxBidItemMap[selectedAuctionItemId] ?? null : null
        }
        isCurrentUserWinning={
          selectedAuctionItemId ? winningItemMap[selectedAuctionItemId] : undefined
        }
        onWatchToggle={(isWatching) => setIsItemWatching(isWatching)}
      />
    </div>
  )
}
