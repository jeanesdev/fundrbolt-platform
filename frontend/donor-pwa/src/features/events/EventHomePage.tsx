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
import {
  AuctionGallery,
  CountdownTimer,
  EventDetails,
  EventSwitcher,
  MySeatingSection,
} from '@/components/event-home'
import { AuctionItemDetailModal } from '@/components/event-home/AuctionItemDetailModal'
import { SponsorsCarousel } from '@/components/event-home/SponsorsCarousel'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventBranding } from '@/hooks/use-event-branding'
import { useEventContext } from '@/hooks/use-event-context'
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
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
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

  const [selectedAuctionItemId, setSelectedAuctionItemId] = useState<
    string | null
  >(null)
  const [isItemWatching, setIsItemWatching] = useState(false)
  const [winningItemMap, setWinningItemMap] = useState<Record<string, boolean>>(
    {}
  )
  const [maxBidItemMap, setMaxBidItemMap] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!currentEvent?.id) {
      return
    }

    const storageKey = `fundrbolt-bid-flags:${currentEvent.id}:${watchlistScope}`
    const stored = localStorage.getItem(storageKey)
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWinningItemMap({})
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMaxBidItemMap({})
      return
    }

    try {
      const parsed = JSON.parse(stored) as {
        winning?: Record<string, boolean>
        maxBid?: Record<string, number>
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWinningItemMap(parsed.winning ?? {})
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMaxBidItemMap(parsed.maxBid ?? {})
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWinningItemMap({})
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMaxBidItemMap({})
    }
  }, [currentEvent?.id, watchlistScope])

  useEffect(() => {
    if (!currentEvent?.id) {
      return
    }

    const storageKey = `fundrbolt-bid-flags:${currentEvent.id}:${watchlistScope}`
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        winning: winningItemMap,
        maxBid: maxBidItemMap,
      })
    )
  }, [currentEvent?.id, watchlistScope, winningItemMap, maxBidItemMap])

  // Convert available events from event context to RegisteredEventWithBranding format
  const eventsForSwitcher = useMemo((): RegisteredEventWithBranding[] => {
    return availableEvents.map((event) => {
      // Check if event is past
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
        event_datetime: event.event_date || null,
        timezone: null,
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

  // Fetch seating information for current event (T080, T065)
  const {
    data: seatingInfo,
    error: seatingError,
    isLoading: seatingLoading,
  } = useQuery<SeatingInfoResponse>({
    queryKey: ['seating', 'my-info', currentEvent?.id, spoofedUserId ?? 'self'],
    queryFn: () => getMySeatingInfo(currentEvent!.id),
    enabled: !!currentEvent?.id,
    placeholderData: keepPreviousData,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 10 * 1000, // Poll every 10 seconds (T065)
    retry: (failureCount, error) => {
      const status = (error as AxiosError | undefined)?.response?.status
      if (status === 404) {
        return false
      }
      return failureCount < 1
    },
  })

  const seatingStatusCode = (seatingError as AxiosError | null)?.response
    ?.status
  const shouldShowSeatingError = !!seatingError && seatingStatusCode !== 404

  // Convert current event to RegisteredEventWithBranding for switcher
  const currentEventForSwitcher =
    useMemo((): RegisteredEventWithBranding | null => {
      if (!currentEvent) return null

      // Check if event is past
      const eventDate = new Date(currentEvent.event_datetime)
      const now = getEffectiveNow()
      const is_past = eventDate <= now
      const is_upcoming =
        !is_past &&
        eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Get thumbnail from media array or logo_url
      const thumbnail_url =
        ('banner_url' in currentEvent && currentEvent.banner_url) ||
        currentEvent.media?.[0]?.file_url ||
        currentEvent.logo_url ||
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

  // Handle event switch from dropdown
  const handleEventSelect = useCallback(
    (event: RegisteredEventWithBranding) => {
      navigate({ to: '/events/$eventSlug', params: { eventSlug: event.slug } })
    },
    [navigate]
  )

  // Load event data
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
  }, [currentEvent])

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
    const endDate = formatDateForICal(
      new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)
    )
    const now = formatDateForICal(new Date())

    // Build location
    const locationParts = []
    if (currentEvent.venue_name) locationParts.push(currentEvent.venue_name)
    if (currentEvent.venue_address)
      locationParts.push(currentEvent.venue_address)
    if (currentEvent.venue_city) locationParts.push(currentEvent.venue_city)
    if (currentEvent.venue_state) locationParts.push(currentEvent.venue_state)
    if (currentEvent.venue_zip) locationParts.push(currentEvent.venue_zip)
    const location = locationParts.join(', ')

    // Create ICS file content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Fundrbolt//Event Calendar//EN',
      'BEGIN:VEVENT',
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `DTSTAMP:${now}`,
      `SUMMARY:${currentEvent.name}`,
      `DESCRIPTION:${(currentEvent.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      `UID:${currentEvent.id}@fundrbolt.com`,
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

  // Query client for invalidation
  const queryClient = useQueryClient()

  // Fetch watch list to determine if selected item is being watched
  const { data: watchListData } = useQuery({
    queryKey: ['watchlist', currentEvent?.id, watchlistScope],
    queryFn: () => {
      if (!currentEvent?.id)
        return Promise.resolve({ watch_list: [], total: 0 })
      return watchListService.getWatchList(currentEvent.id)
    },
    enabled: !!currentEvent?.id,
    staleTime: 30000,
  })

  // Place bid mutation
  const { mutate: mutatePlaceBid, isPending: isPlacingBid } = useMutation({
    mutationFn: ({ itemId, amount }: { itemId: string; amount: number }) =>
      auctionItemService.placeBid(currentEvent!.id, itemId, amount),
    onSuccess: async (bid, variables) => {
      const spoofSuffix = spoofedUserId ? ' for spoofed user' : ''
      toast.success(
        `Bid placed at $${variables.amount.toLocaleString()}${spoofSuffix}`,
        {
          style: {
            backgroundColor: 'rgb(22, 163, 74)',
            color: '#FFFFFF',
            border: '1px solid rgb(21, 128, 61)',
          },
        }
      )

      if (typeof bid?.is_winning === 'boolean') {
        setWinningItemMap((prev) => ({
          ...prev,
          [variables.itemId]: bid.is_winning,
        }))
      }

      if (currentEvent?.id) {
        try {
          await watchListService.addToWatchList(currentEvent.id, variables.itemId)
        } catch (error: unknown) {
          const status = (error as AxiosError | undefined)?.response?.status
          if (status !== 409) {
            toast.error('Bid placed, but failed to add item to watch list')
          }
        }

        queryClient.setQueryData(
          ['watchlist', currentEvent.id, watchlistScope],
          (previous:
            | {
              watch_list?: Array<{
                id: string
                user_id: string
                auction_item_id: string
                added_at: string
              }>
              total?: number
            }
            | undefined) => {
            const existing = previous?.watch_list ?? []
            if (existing.some((entry) => entry.auction_item_id === variables.itemId)) {
              return previous
            }

            return {
              watch_list: [
                ...existing,
                {
                  id: variables.itemId,
                  user_id: '',
                  auction_item_id: variables.itemId,
                  added_at: new Date().toISOString(),
                },
              ],
              total: (previous?.total ?? existing.length) + 1,
            }
          }
        )
      }

      if (selectedAuctionItemId === variables.itemId) {
        setIsItemWatching(true)
      }

      queryClient.invalidateQueries({
        queryKey: ['auction-items', currentEvent?.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['auction-item-detail', currentEvent?.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['auction-item-bids', variables.itemId],
      })
      queryClient.invalidateQueries({
        queryKey: ['watchlist', currentEvent?.id, watchlistScope],
      })
    },
    onError: (error: unknown) => {
      const message =
        (error as AxiosError<{ detail?: string }> | undefined)?.response?.data
          ?.detail || 'Failed to place bid'
      toast.error(message)
    },
  })

  // Place max bid mutation
  const { mutate: mutatePlaceMaxBid, isPending: isSettingMaxBid } = useMutation(
    {
      mutationFn: ({
        itemId,
        maxAmount,
      }: {
        itemId: string
        maxAmount: number
      }) => auctionItemService.placeMaxBid(currentEvent!.id, itemId, maxAmount),
      onSuccess: async (bid, variables) => {
        const spoofSuffix = spoofedUserId ? ' for spoofed user' : ''
        toast.success(
          `Max bid set at $${variables.maxAmount.toLocaleString()}${spoofSuffix}`,
          {
            style: {
              backgroundColor: 'rgb(22, 163, 74)',
              color: '#FFFFFF',
              border: '1px solid rgb(21, 128, 61)',
            },
          }
        )

        if (typeof bid?.is_winning === 'boolean') {
          setWinningItemMap((prev) => ({
            ...prev,
            [variables.itemId]: bid.is_winning,
          }))
        }
        setMaxBidItemMap((prev) => ({
          ...prev,
          [variables.itemId]: variables.maxAmount,
        }))

        if (currentEvent?.id) {
          try {
            await watchListService.addToWatchList(currentEvent.id, variables.itemId)
          } catch (error: unknown) {
            const status = (error as AxiosError | undefined)?.response?.status
            if (status !== 409) {
              toast.error('Max bid set, but failed to add item to watch list')
            }
          }

          queryClient.setQueryData(
            ['watchlist', currentEvent.id, watchlistScope],
            (previous:
              | {
                watch_list?: Array<{
                  id: string
                  user_id: string
                  auction_item_id: string
                  added_at: string
                }>
                total?: number
              }
              | undefined) => {
              const existing = previous?.watch_list ?? []
              if (
                existing.some(
                  (entry) => entry.auction_item_id === variables.itemId
                )
              ) {
                return previous
              }

              return {
                watch_list: [
                  ...existing,
                  {
                    id: variables.itemId,
                    user_id: '',
                    auction_item_id: variables.itemId,
                    added_at: new Date().toISOString(),
                  },
                ],
                total: (previous?.total ?? existing.length) + 1,
              }
            }
          )
        }

        if (selectedAuctionItemId === variables.itemId) {
          setIsItemWatching(true)
        }

        queryClient.invalidateQueries({
          queryKey: ['auction-items', currentEvent?.id],
        })
        queryClient.invalidateQueries({
          queryKey: ['auction-item-detail', currentEvent?.id],
        })
        queryClient.invalidateQueries({
          queryKey: ['auction-item-bids', variables.itemId],
        })
        queryClient.invalidateQueries({
          queryKey: ['watchlist', currentEvent?.id, watchlistScope],
        })
      },
      onError: (error: unknown) => {
        const message =
          (error as AxiosError<{ detail?: string }> | undefined)?.response?.data
            ?.detail || 'Failed to set max bid'
        toast.error(message)
      },
    }
  )

  const { mutate: mutateBuyNow, isPending: isBuyingNow } = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      auctionItemService.buyNow(currentEvent!.id, itemId, 1),
    onSuccess: (_response, variables) => {
      toast.success('Successfully completed Buy Now')
      queryClient.invalidateQueries({
        queryKey: ['auction-items', currentEvent?.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['auction-item-detail', currentEvent?.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['watchlist', currentEvent?.id, watchlistScope],
      })
      if (selectedAuctionItemId === variables.itemId) {
        setSelectedAuctionItemId(null)
      }
    },
    onError: (error: unknown) => {
      const message =
        (error as AxiosError<{ detail?: string }> | undefined)?.response?.data
          ?.detail || 'Failed to complete Buy Now'
      toast.error(message)
    },
  })

  const handlePlaceBid = useCallback(
    (itemId: string, amount: number) => {
      mutatePlaceBid({ itemId, amount })
    },
    [mutatePlaceBid]
  )

  const handleSetMaxBid = useCallback(
    (itemId: string, amount: number) => {
      mutatePlaceMaxBid({ itemId, maxAmount: amount })
    },
    [mutatePlaceMaxBid]
  )

  const handleBuyNow = useCallback(
    (itemId: string) => {
      mutateBuyNow({ itemId })
    },
    [mutateBuyNow]
  )

  // Loading state
  if (eventsLoading) {
    return (
      <div
        className='flex min-h-screen items-center justify-center'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        }}
      >
        <div className='text-center'>
          <Loader2 className='mx-auto mb-4 h-12 w-12 animate-spin text-[rgb(var(--event-primary,59,130,246))]' />
          <p className='text-muted-foreground'>Loading event...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (eventsError || !currentEvent) {
    return (
      <div
        className='flex min-h-screen items-center justify-center p-4'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        }}
      >
        <Card className='w-full max-w-md'>
          <CardHeader>
            <div className='text-destructive flex items-center gap-2'>
              <AlertCircle className='h-5 w-5' />
              <CardTitle>Event Not Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground mb-4'>
              We couldn't find the event you're looking for. It may have been
              removed or you may not have access.
            </p>
            <button
              onClick={() => navigate({ to: '/home' })}
              className='w-full rounded-md px-4 py-2 text-white'
              style={{
                backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
              }}
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

  // Get banner image from media or logo_url
  const getBannerUrl = () => {
    // First check if there's a banner_url field (may not exist in current API)
    if ('banner_url' in currentEvent && currentEvent.banner_url) {
      return currentEvent.banner_url
    }

    // Check media array for banner image
    if (currentEvent.media && currentEvent.media.length > 0) {
      const banner = currentEvent.media.find(
        (m) => m.media_type === 'image' && m.display_order === 0
      )
      return banner?.file_url || currentEvent.media[0]?.file_url
    }

    // Fall back to logo_url if no media
    if (currentEvent.logo_url) {
      return currentEvent.logo_url
    }

    return null
  }

  const bannerUrl = getBannerUrl()
  const heroBackgroundImage = bannerUrl
    ? `url("${encodeURI(bannerUrl)}")`
    : undefined

  return (
    <div
      className='min-h-screen'
      style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
    >
      {/* Hero Section with Event Banner */}
      <div className='relative'>
        {bannerUrl ? (
          <div
            className='h-48 w-full bg-cover bg-center sm:h-64 md:h-80'
            style={{ backgroundImage: heroBackgroundImage }}
          >
            <div className='absolute inset-0 bg-gradient-to-b from-transparent to-black/60' />
          </div>
        ) : (
          <div
            className='h-48 w-full sm:h-64 md:h-80'
            style={{
              background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
            }}
          />
        )}

        {/* Event Switcher - Top Left */}
        {currentEventForSwitcher && eventsForSwitcher.length > 0 && (
          <div className='absolute top-4 left-4'>
            <div className='rounded-lg bg-white/90 shadow-lg backdrop-blur-sm'>
              <EventSwitcher
                currentEvent={currentEventForSwitcher}
                events={eventsForSwitcher}
                onEventSelect={handleEventSelect}
              />
            </div>
          </div>
        )}

        {/* Profile Dropdown - Top Right */}
        <div className='absolute top-4 right-4'>
          <div className='rounded-lg bg-white/90 p-1 shadow-lg backdrop-blur-sm'>
            <ProfileDropdown />
          </div>
        </div>

        {/* Event Title Overlay */}
        <div className='absolute right-0 bottom-0 left-0 p-4 sm:p-6'>
          <div className='container mx-auto'>
            {/* NPO Name */}
            {currentEvent.npo_name && (
              <p className='mb-1 text-sm text-white/80'>
                {currentEvent.npo_name}
              </p>
            )}
            {venueMapLink ? (
              <a
                href={venueMapLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-block transition-opacity hover:opacity-90'
              >
                <h1 className='text-2xl font-bold text-white drop-shadow-lg sm:text-3xl md:text-4xl'>
                  {currentEvent.name}
                </h1>
              </a>
            ) : (
              <h1 className='text-2xl font-bold text-white drop-shadow-lg sm:text-3xl md:text-4xl'>
                {currentEvent.name}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Event Quick Info */}
      <div
        className='border-b'
        style={{
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
          color: 'var(--event-text-on-background, #000000)',
        }}
      >
        <div className='container mx-auto px-4 py-4'>
          <div className='flex flex-wrap gap-4 text-sm'>
            <div className='flex items-center gap-2'>
              <Calendar
                className='h-4 w-4'
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              />
              {currentEvent.event_datetime ? (
                <button
                  onClick={generateICSFile}
                  className='cursor-pointer hover:underline'
                  style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                  title='Add to calendar'
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
              <div className='flex items-center gap-2'>
                <MapPin
                  className='h-4 w-4'
                  style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                />
                {venueMapLink ? (
                  <a
                    href={venueMapLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='hover:underline'
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
        className='container mx-auto px-4 py-6'
        style={{ color: 'var(--event-text-on-background, #000000)' }}
      >
        {/* Countdown Timer - show only for upcoming events */}
        {currentEvent.event_datetime && !currentEventForSwitcher?.is_past && (
          <div className='mb-6'>
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
          eventWebsite={
            currentEvent.links?.find((l) => l.link_type === 'website')?.url
          }
          isPast={currentEventForSwitcher?.is_past}
          isUpcoming={currentEventForSwitcher?.is_upcoming}
          className='mb-6'
        />

        {/* My Seating Information (T080, T070-T071) */}
        {seatingLoading && (
          <div className='mb-6'>
            <Card
              className='border'
              style={{
                backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                color: 'var(--event-card-text, #FFFFFF)',
              }}
            >
              <CardContent className='flex items-center justify-center py-8'>
                <Loader2
                  className='h-6 w-6 animate-spin'
                  style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                />
                <span
                  className='ml-2 text-sm'
                  style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                >
                  Loading seating information...
                </span>
              </CardContent>
            </Card>
          </div>
        )}

        {shouldShowSeatingError && (
          <div className='mb-6'>
            <Card className='border-destructive'>
              <CardContent className='text-destructive flex items-center gap-2 py-4'>
                <AlertCircle className='h-5 w-5' />
                <span className='text-sm'>
                  Unable to load seating information. Please try again later.
                </span>
              </CardContent>
            </Card>
          </div>
        )}

        {seatingInfo && !shouldShowSeatingError && !seatingLoading && (
          <div className='mb-6'>
            <MySeatingSection seatingInfo={seatingInfo} />
          </div>
        )}

        {!seatingLoading && !seatingInfo && !shouldShowSeatingError && (
          <div className='mb-6'>
            <Card
              className='border'
              style={{
                backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                color: 'var(--event-card-text, #FFFFFF)',
              }}
            >
              <CardContent className='py-6'>
                <span
                  className='text-sm'
                  style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                >
                  Seating information is not available yet.
                </span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Event Description */}
        {currentEvent.description && (
          <div
            className='mb-6 rounded-lg p-4 sm:p-6'
            style={{
              backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
            }}
          >
            <h3
              className='mb-3 text-lg font-semibold'
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
            className='mb-4 text-xl font-semibold'
            style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
          >
            Auction Items
          </h2>
          <AuctionGallery
            eventId={currentEvent?.id || ''}
            watchlistScope={watchlistScope}
            maxBidItemMap={maxBidItemMap}
            winningItemMap={winningItemMap}
            initialFilter='all'
            initialSort='highest_bid'
            eventStatus={currentEvent?.status}
            eventDateTime={currentEvent?.event_datetime}
            onItemClick={(item, isWinning) => {
              setSelectedAuctionItemId(item.id)
              setWinningItemMap((prev) => ({
                ...prev,
                [item.id]: isWinning,
              }))
              const isWatched =
                watchListData?.watch_list?.some(
                  (entry) => entry.auction_item_id === item.id
                ) ?? false
              setIsItemWatching(isWatched)
            }}
          />
        </section>

        {/* Sponsors Carousel */}
        <section className='mt-12 mb-8'>
          <SponsorsCarousel eventId={currentEvent?.id || ''} />
        </section>

        {/* Auction Item Detail Modal */}
        <AuctionItemDetailModal
          eventId={currentEvent?.id || ''}
          itemId={selectedAuctionItemId}
          eventStatus={currentEvent?.status}
          eventDateTime={currentEvent?.event_datetime}
          onClose={() => setSelectedAuctionItemId(null)}
          onPlaceBid={handlePlaceBid}
          onSetMaxBid={handleSetMaxBid}
          onBuyNow={handleBuyNow}
          isSubmittingBid={isPlacingBid || isSettingMaxBid || isBuyingNow}
          isWatching={isItemWatching}
          currentUserMaxBid={
            selectedAuctionItemId
              ? maxBidItemMap[selectedAuctionItemId] ?? null
              : null
          }
          isCurrentUserWinning={
            selectedAuctionItemId
              ? winningItemMap[selectedAuctionItemId]
              : undefined
          }
          onWatchToggle={(isWatching) => setIsItemWatching(isWatching)}
        />
      </div>
    </div>
  )
}
