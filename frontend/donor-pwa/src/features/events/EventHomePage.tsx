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
import type { AuctionItemGalleryItem } from '@/types/auction-gallery'
import type { EventMediaUsageTag } from '@/types/event'
import type { RegisteredEventWithBranding } from '@/types/event-branding'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMarkdownToSafeHtml(markdown: string): string {
  if (!markdown.trim()) {
    return ''
  }

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
      ) {
        return block
      }

      return `<p class="mb-2 leading-relaxed">${block.replace(/\n/g, '<br />')}</p>`
    })
    .join('')
}

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
  const [displayedTab, setDisplayedTab] = useState<DonorTab>('home')
  const prefetchedAuctionImagesRef = useRef<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const tabOrder: DonorTab[] = ['home', 'auction', 'seat']

  const getTaggedImageUrls = useCallback(
    (tag: EventMediaUsageTag) => {
      if (!currentEvent?.media?.length) return []

      return currentEvent.media
        .filter((media) => media.media_type === 'image' && media.usage_tag === tag && !!media.file_url)
        .map((media) => media.file_url)
    },
    [currentEvent]
  )

  const getTaggedImageUrl = useCallback(
    (tag: EventMediaUsageTag) => getTaggedImageUrls(tag)[0] ?? null,
    [getTaggedImageUrls]
  )

  const resolveEventDateTime = useCallback((event: typeof currentEvent): string | null => {
    if (!event) return null

    const eventRecord = event as unknown as Record<string, unknown>
    const candidates = [
      event.event_datetime,
      eventRecord.eventDateTime,
      eventRecord.event_date,
      eventRecord.eventDate,
      eventRecord.start_datetime,
      eventRecord.startDateTime,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate
      }
    }

    return null
  }, [])
  // Restore bid flags from localStorage
  useEffect(() => {
    if (!currentEvent?.id) return

    const applyBidFlags = (
      winning: Record<string, boolean>,
      maxBid: Record<string, number>
    ) => {
      const timeoutId = window.setTimeout(() => {
        setWinningItemMap(winning)
        setMaxBidItemMap(maxBid)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    const storageKey = `fundrbolt-bid-flags:${currentEvent.id}:${watchlistScope}`
    const stored = localStorage.getItem(storageKey)
    if (!stored) {
      return applyBidFlags({}, {})
    }
    try {
      const parsed = JSON.parse(stored) as {
        winning?: Record<string, boolean>
        maxBid?: Record<string, number>
      }
      return applyBidFlags(parsed.winning ?? {}, parsed.maxBid ?? {})
    } catch {
      return applyBidFlags({}, {})
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
      const resolvedDateTime = resolveEventDateTime(currentEvent)
      const eventDate = resolvedDateTime
        ? new Date(resolvedDateTime)
        : null
      if (eventDate && eventDate <= getEffectiveNow()) return 'auction'
    }
    return 'home'
  }, [userSelectedTab, currentEvent, resolveEventDateTime])

  const prefetchAuctionTabData = useCallback(async () => {
    if (!currentEvent?.id) {
      return
    }

    const response = await apiClient.get(`/events/${currentEvent.id}/auction-items`, {
      params: {
        page: 1,
        limit: 24,
      },
      timeout: 12000,
    })

    const payload = response.data as {
      items?: Array<{
        id: string
        title: string
        description?: string | null
        auction_type: 'silent' | 'live'
        bid_number: number
        primary_image_url?: string | null
        starting_bid: number | string
        current_bid_amount?: number | string | null
        bid_count?: number
        bidding_open?: boolean
        watcher_count?: number
        promotion_badge?: string | null
        promotion_notice?: string | null
        min_next_bid_amount?: number | string | null
        category?: string | null
        category_name?: string | null
      }>
      pagination?: {
        page: number
        limit: number
        total: number
        total_pages?: number
        pages?: number
      }
    }

    const items = Array.isArray(payload.items) ? payload.items : []

    queryClient.setQueryData(
      ['auction-items', currentEvent.id, 'all'],
      {
        pages: [
          {
            items: items.map((item) => {
              const toNumber = (value: number | string | null | undefined): number | null => {
                if (value === null || value === undefined) return null
                const parsed = typeof value === 'string' ? Number(value) : value
                return Number.isFinite(parsed) ? parsed : null
              }

              return {
                id: item.id,
                title: item.title,
                description: item.description ?? null,
                auction_type: item.auction_type,
                bid_number: item.bid_number,
                thumbnail_url: item.primary_image_url ?? null,
                starting_bid: toNumber(item.starting_bid) ?? 0,
                current_bid: toNumber(item.current_bid_amount),
                bid_count: item.bid_count ?? 0,
                bidding_open: item.bidding_open,
                watcher_count: item.watcher_count,
                promotion_badge: item.promotion_badge ?? null,
                promotion_notice: item.promotion_notice ?? null,
                min_next_bid_amount: toNumber(item.min_next_bid_amount) ?? undefined,
                category: item.category_name ?? item.category ?? null,
              }
            }),
            pagination: {
              page: payload.pagination?.page ?? 1,
              limit: payload.pagination?.limit ?? 24,
              total: payload.pagination?.total ?? items.length,
              total_pages: payload.pagination?.total_pages ?? payload.pagination?.pages ?? 1,
              has_more:
                (payload.pagination?.page ?? 1) <
                (payload.pagination?.total_pages ?? payload.pagination?.pages ?? 1),
            },
          },
        ],
        pageParams: [1],
      }
    )

    items
      .map((item) => item.primary_image_url)
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .forEach((url) => {
        if (prefetchedAuctionImagesRef.current.has(url)) {
          return
        }

        prefetchedAuctionImagesRef.current.add(url)
        const image = new Image()
        image.src = url
      })
  }, [currentEvent, queryClient])

  const setActiveTab = (tab: DonorTab) => {
    const visibleTab = userSelectedTab === null ? activeTab : displayedTab

    if (visibleTab === tab) {
      setUserSelectedTab(tab)
      return
    }

    const performSwitch = () => {
      setDisplayedTab(tab)
      setUserSelectedTab(tab)
    }

    if (tab === 'auction') {
      void Promise.race([
        prefetchAuctionTabData().catch(() => undefined),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 650)
        }),
      ]).finally(() => {
        performSwitch()
      })
      return
    }

    performSwitch()
  }

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
    const resolvedDateTime = resolveEventDateTime(currentEvent)
    const eventDate = resolvedDateTime ? new Date(resolvedDateTime) : new Date()
    const now = getEffectiveNow()
    const is_past = eventDate <= now
    const is_upcoming =
      !is_past &&
      eventDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const taggedHeroThumbnail = getTaggedImageUrl('main_event_page_hero')
    const taggedEventLogo = getTaggedImageUrl('event_logo')
    const taggedNpoLogo = getTaggedImageUrl('npo_logo')
    const thumbnail_url: string | null =
      taggedHeroThumbnail ||
      taggedEventLogo ||
      taggedNpoLogo ||
      ('banner_url' in currentEvent ? (currentEvent as { banner_url?: string | null }).banner_url ?? null : null) ||
      currentEvent.media?.[0]?.file_url ||
      null
    return {
      id: currentEvent.id,
      name: currentEvent.name,
      slug: currentEvent.slug,
      event_datetime: resolvedDateTime ?? '',
      timezone: currentEvent.timezone,
      is_past,
      is_upcoming,
      thumbnail_url,
      primary_color: currentEvent.primary_color || '#3B82F6',
      secondary_color: currentEvent.secondary_color || '#9333EA',
      background_color: currentEvent.background_color || '#FFFFFF',
      accent_color: currentEvent.accent_color || '#3B82F6',
      npo_name: currentEvent.npo_name || 'Organization',
      npo_logo_url: taggedNpoLogo,
    }
  }, [
    currentEvent,
    timeBaseRealMs,
    timeBaseSpoofMs,
    resolveEventDateTime,
    getTaggedImageUrl,
  ])

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
    const taggedLayoutMap = getTaggedImageUrl('event_layout_map')
    if (taggedLayoutMap) return taggedLayoutMap
    if (!currentEvent?.venue_address) return null
    const parts = [currentEvent.venue_address]
    if (currentEvent.venue_city) parts.push(currentEvent.venue_city)
    if (currentEvent.venue_state) parts.push(currentEvent.venue_state)
    if (currentEvent.venue_zip) parts.push(currentEvent.venue_zip)
    return `https://maps.google.com/?q=${encodeURIComponent(parts.join(', '))}`
  }, [currentEvent, getTaggedImageUrl])

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

  useEffect(() => {
    if (!currentEvent?.id) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void prefetchAuctionTabData().catch(() => undefined)
    }, 200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [currentEvent?.id, prefetchAuctionTabData])

  const { data: watchListData } = useQuery({
    queryKey: ['watchlist', currentEvent?.id, watchlistScope],
    queryFn: () => {
      if (!currentEvent?.id) return Promise.resolve({ watch_list: [], total: 0 })
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
  const getHeroImageUrls = () => {
    const taggedHeroImages = getTaggedImageUrls('main_event_page_hero')
    if (taggedHeroImages.length > 0) {
      return taggedHeroImages
    }

    const urls = new Set<string>()

    if (currentEvent.media?.length) {
      const imageMedia = currentEvent.media
        .filter((media) => media.media_type === 'image' && !!media.file_url)
        .sort((a, b) => {
          const aIsLogo = a.file_name?.toLowerCase().includes('logo') ?? false
          const bIsLogo = b.file_name?.toLowerCase().includes('logo') ?? false
          if (aIsLogo === bIsLogo) return 0
          return aIsLogo ? 1 : -1
        })

      for (const media of imageMedia) {
        if (media.file_url) {
          urls.add(media.file_url)
        }
      }
    }

    return Array.from(urls)
  }
  const heroImageUrls = getHeroImageUrls()
  const bannerUrl = heroImageUrls[0] ?? null
  const taggedEventLogo = getTaggedImageUrl('event_logo')
  const taggedNpoLogo = getTaggedImageUrl('npo_logo')
  const countdownTargetDate =
    currentEvent.event_datetime ||
    ('event_date' in currentEvent
      ? ((currentEvent as { event_date?: string | null }).event_date ?? null)
      : null)

  const getLogoUrl = () => {
    if (taggedEventLogo) return taggedEventLogo
    if (taggedNpoLogo) return taggedNpoLogo
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
      const resolvedDateTime = resolveEventDateTime(currentEvent)
      const eventDate = resolvedDateTime ? new Date(resolvedDateTime) : null
      if (eventDate && eventDate <= getEffectiveNow()) return 'live'
    }
    return 'upcoming'
  }
  const eventStatus = getEventStatus()
  const aboutEventHtml = renderMarkdownToSafeHtml(currentEvent.description ?? '')

  // ─── Tab content ─────────────────────────────────────────────────────────────

  const sharedAuctionProps = {
    onItemClick: async (item: AuctionItemGalleryItem, isWinning: boolean) => {
      setWinningItemMap((prev) => ({ ...prev, [item.id]: isWinning }))
      const isWatched =
        watchListData?.watch_list?.some((e) => e.auction_item_id === item.id) ?? false
      setIsItemWatching(isWatched)

      try {
        const detail = await queryClient.fetchQuery({
          queryKey: ['auction-item-detail', currentEvent.id, item.id],
          queryFn: () => auctionItemService.getAuctionItem(currentEvent.id, item.id),
          staleTime: 15000,
          retry: 1,
        })

        const primaryImageUrl =
          detail.primary_image_url ??
          detail.media?.find((media) => media.media_type === 'image')?.file_path ??
          null

        if (primaryImageUrl) {
          await Promise.race([
            new Promise<void>((resolve) => {
              const image = new Image()
              image.onload = () => resolve()
              image.onerror = () => resolve()
              image.src = primaryImageUrl
            }),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 900)
            }),
          ])
        }
      } catch {
        // Modal will still open and display its own fallback state.
      }

      setSelectedAuctionItemId(item.id)
    },
  }

  const heroAndNav = (
    <EventHeroSection
      eventName={currentEvent.name}
      npoName={currentEvent.npo_name}
      logoUrl={getLogoUrl()}
      bannerUrl={bannerUrl}
      bannerImages={heroImageUrls}
      transitionStyle={currentEvent.hero_transition_style}
      eventDate={resolveEventDateTime(currentEvent)}
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
        {countdownTargetDate && (
          <div>
            <CountdownTimer
              targetDate={countdownTargetDate}
              eventName={currentEvent.name}
              hideOnExpire={false}
            />
          </div>
        )}

        {/* CTA for bidding */}
        {eventStatus !== 'past' && (
          <div>
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
        <div>
          <EventDetails
            eventDatetime={resolveEventDateTime(currentEvent) ?? ''}
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
          <div className='flex items-center gap-3'>
            <h2
              className='text-base font-bold'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              Auction Items
            </h2>
          </div>
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
          eventDateTime={resolveEventDateTime(currentEvent) ?? undefined}
          onItemClick={(item, isWinning) => sharedAuctionProps.onItemClick(item, isWinning)}
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

  const renderTabContent = (tab: DonorTab) => {
    if (tab === 'home') return homeTabContent
    if (tab === 'auction') return auctionTabContent
    return seatTabContent
  }

  const renderTabPage = (tab: DonorTab) => {
    return (
      <div
        className='min-h-full pb-20'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        }}
      >
        {renderTabContent(tab)}
      </div>
    )
  }

  const visibleTab = userSelectedTab === null ? activeTab : displayedTab
  const displayedTabIndex = tabOrder.indexOf(visibleTab)

  const getTabPanelPositionClass = (tab: DonorTab) => {
    const tabIndex = tabOrder.indexOf(tab)
    if (tabIndex === displayedTabIndex) {
      return 'translate-x-0'
    }

    return tabIndex < displayedTabIndex ? '-translate-x-full' : 'translate-x-full'
  }

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <div
      className='flex h-svh flex-col overflow-hidden'
      style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
    >
      {/* Tab content — scrollable, key triggers re-animation on tab switch */}
      <main
        className='relative flex-1 overflow-hidden'
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className='absolute inset-0'>
          {tabOrder.map((tab) => (
            <section
              key={tab}
              className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${getTabPanelPositionClass(tab)}`}
              style={{
                WebkitOverflowScrolling: 'touch',
                pointerEvents: tab === visibleTab ? 'auto' : 'none',
              }}
              aria-hidden={tab !== visibleTab}
            >
              {renderTabPage(tab)}
            </section>
          ))}
        </div>
      </main>

      {/* Fixed bottom navigation */}
      <BottomTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Auction Item Detail Modal */}
      <AuctionItemDetailModal
        eventId={currentEvent.id}
        itemId={selectedAuctionItemId}
        eventStatus={currentEvent.status}
        eventDateTime={resolveEventDateTime(currentEvent) ?? undefined}
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
