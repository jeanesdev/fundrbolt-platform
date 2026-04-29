import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  PreviewProvider,
  type PreviewEventData,
} from '@/contexts/PreviewContext'
import type { AuctionItemGalleryItem } from '@/types/auction-gallery'
import type { AuctionItemDetail } from '@/types/auction-item'
import type { EventDetail } from '@/types/event'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEventContextStore } from '@/stores/event-context-store'
import { useEventStore } from '@/stores/event-store'
import type { Sponsor } from '@/lib/api/sponsors'
import apiClient from '@/lib/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventHomePage } from '@/features/events/EventHomePage'

interface PreviewPageProps {
  eventId?: string
  token?: string
}

interface PreviewApiResponse {
  event: EventDetail
  auction_items: Array<
    Omit<AuctionItemDetail, 'media'> & { media?: AuctionItemDetail['media'] }
  >
  sponsors: Sponsor[]
}

interface AuctionItemsPage {
  items: AuctionItemGalleryItem[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_more: boolean
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

function toGalleryItem(
  item: AuctionItemDetail,
  fallbackBidNumber: number
): AuctionItemGalleryItem {
  const itemCategory =
    (item as unknown as { category?: string | null }).category ?? null

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? null,
    auction_type: item.auction_type,
    bid_number: item.bid_number ?? fallbackBidNumber,
    thumbnail_url: item.primary_image_url ?? null,
    starting_bid: toNumber(item.starting_bid) ?? 0,
    current_bid: toNumber(item.current_bid_amount),
    bid_count: item.bid_count ?? 0,
    bidding_open: item.bidding_open,
    watcher_count: item.watcher_count,
    promotion_badge: item.promotion_badge ?? null,
    promotion_notice: item.promotion_notice ?? null,
    min_next_bid_amount: toNumber(item.min_next_bid_amount) ?? undefined,
    category: itemCategory,
  }
}

function createInfiniteAuctionData(
  items: AuctionItemGalleryItem[]
): InfiniteData<AuctionItemsPage, number> {
  return {
    pages: [
      {
        items,
        pagination: {
          page: 1,
          limit: Math.max(items.length, 1),
          total: items.length,
          total_pages: 1,
          has_more: false,
        },
      },
    ],
    pageParams: [1],
  }
}

function getPreviewLogoUrl(event: EventDetail): string | null {
  if (!event.media?.length) {
    return null
  }

  const taggedLogo = event.media.find(
    (media) =>
      media.media_type === 'image' &&
      (media.usage_tag === 'event_logo' || media.usage_tag === 'npo_logo')
  )
  if (taggedLogo?.file_url) {
    return taggedLogo.file_url
  }

  const namedLogo = event.media.find(
    (media) =>
      media.media_type === 'image' &&
      media.file_name.toLowerCase().includes('logo')
  )
  return namedLogo?.file_url ?? null
}

function PreviewStateCard({
  title,
  message,
  isLoading = false,
}: {
  title: string
  message: string
  isLoading?: boolean
}) {
  return (
    <div className='flex min-h-screen items-center justify-center p-4'>
      <Card className='w-full max-w-lg'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            {isLoading ? (
              <Loader2 className='h-5 w-5 animate-spin' />
            ) : (
              <AlertCircle className='text-destructive h-5 w-5' />
            )}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-sm'>{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function PreviewEventPage({ eventId, token }: PreviewPageProps) {
  const queryClient = useQueryClient()
  const setCurrentEvent = useEventStore((state) => state.setCurrentEvent)
  const setSelectedEvent = useEventContextStore(
    (state) => state.setSelectedEvent
  )
  const setAvailableEvents = useEventContextStore(
    (state) => state.setAvailableEvents
  )

  const isMissingParams = !eventId || !token

  const {
    data: previewData,
    error,
    isLoading,
    isError,
  } = useQuery<PreviewEventData>({
    queryKey: ['preview-event', eventId, token],
    enabled: !isMissingParams,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await apiClient.get<PreviewApiResponse>(
        `/events/preview/${eventId}`,
        {
          params: { token },
        }
      )
      const payload: PreviewEventData = {
        event: response.data.event,
        auctionItems: response.data.auction_items.map((item) => ({
          ...item,
          media: item.media ?? [],
        })),
        sponsors: response.data.sponsors,
      }

      const galleryItems = payload.auctionItems.map((item, index) =>
        toGalleryItem(item, index + 100)
      )
      const silentItems = galleryItems.filter(
        (item) => item.auction_type === 'silent'
      )
      const liveItems = galleryItems.filter(
        (item) => item.auction_type === 'live'
      )

      setCurrentEvent(payload.event)
      setSelectedEvent(payload.event.id, payload.event.name, payload.event.slug)
      setAvailableEvents([
        {
          id: payload.event.id,
          name: payload.event.name,
          slug: payload.event.slug,
          event_date: payload.event.event_datetime,
          npo_name: payload.event.npo_name ?? null,
          logo_url: getPreviewLogoUrl(payload.event),
          has_admin_access: true,
        },
      ])

      queryClient.setQueryData(['watchlist', payload.event.id], {
        watch_list: [],
        total: 0,
      })
      queryClient.setQueryData(['watchlist', payload.event.id, 'self'], {
        watch_list: [],
        total: 0,
      })
      queryClient.setQueryData(['sponsors', payload.event.id], payload.sponsors)
      queryClient.setQueryData(
        ['auction-items', payload.event.id, 'all'],
        createInfiniteAuctionData(galleryItems)
      )
      queryClient.setQueryData(
        ['auction-items', payload.event.id, 'silent'],
        createInfiniteAuctionData(silentItems)
      )
      queryClient.setQueryData(
        ['auction-items', payload.event.id, 'live'],
        createInfiniteAuctionData(liveItems)
      )

      payload.auctionItems.forEach((item) => {
        queryClient.setQueryData(
          ['auction-item-detail', payload.event.id, item.id],
          item
        )
      })

      return payload
    },
  })

  if (isMissingParams) {
    return (
      <PreviewStateCard
        title='Preview link is incomplete'
        message='This preview link is missing the event ID or preview token. Generate a new preview from the admin app.'
      />
    )
  }

  if (isLoading || !previewData) {
    return (
      <PreviewStateCard
        title='Loading donor preview'
        message='Preparing the donor preview with draft-safe event data.'
        isLoading
      />
    )
  }

  if (isError) {
    const message =
      error instanceof Error ? error.message : 'Failed to load preview data.'
    return (
      <PreviewStateCard
        title='Unable to load donor preview'
        message={message}
      />
    )
  }

  return (
    <PreviewProvider value={{ isPreviewMode: true, previewData }}>
      <EventHomePage />
    </PreviewProvider>
  )
}
