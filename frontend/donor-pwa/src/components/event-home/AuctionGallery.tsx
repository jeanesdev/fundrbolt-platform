/**
 * AuctionGallery - Amazon-style auction items gallery with infinite scroll
 *
 * Features:
 * - CSS Grid layout (responsive: 2 cols mobile, 3 cols tablet, 4 cols desktop)
 * - Auction type filter (All/Silent/Live) using button group
 * - Infinite scroll pagination using react-query useInfiniteQuery
 * - Watched items section at top
 * - Empty state with Gavel icon
 * - Loading spinner for scroll trigger
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Eye, Gavel, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import apiClient from '@/lib/axios';
import { cn } from '@/lib/utils';
import watchListService from '@/services/watchlistService';
import type {
  AuctionFilterType,
  AuctionItemGalleryItem,
  AuctionSortType,
} from '@/types/auction-gallery';
import { AuctionItemCard } from './AuctionItemCard';

/**
 * Fetch auction items from the API
 */
async function fetchAuctionItems(
  eventId: string,
  params: {
    page: number;
    limit: number;
    auction_type?: string;
    sort_by?: string;
  }
): Promise<{
  items: AuctionItemGalleryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.auction_type && params.auction_type !== 'all') {
    searchParams.set('auction_type', params.auction_type);
  } else if (params.auction_type === 'all') {
    // Use "all" to get both types
    searchParams.set('auction_type', 'all');
  }

  if (params.sort_by) {
    searchParams.set('sort_by', params.sort_by);
  }

  const response = await apiClient.get(`/events/${eventId}/auction-items`, {
    params: Object.fromEntries(searchParams.entries()),
  });

  const data = response.data;

  // Transform API response to match our types
  return {
    items: data.items.map(
      (item: {
        id: string;
        title: string;
        description?: string | null;
        auction_type: string;
        bid_number: number;
        primary_image_url?: string | null;
        starting_bid: number | string;
      }) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? null,
        auction_type: item.auction_type as 'silent' | 'live',
        bid_number: item.bid_number,
        thumbnail_url: item.primary_image_url ?? null,
        starting_bid:
          typeof item.starting_bid === 'string'
            ? parseFloat(item.starting_bid)
            : item.starting_bid,
        current_bid: null, // Will be populated when bidding is implemented
        bid_count: 0, // Will be populated when bidding is implemented
      })
    ),
    pagination: {
      page: data.pagination.page,
      limit: data.pagination.limit,
      total: data.pagination.total,
      total_pages: data.pagination.total_pages ?? data.pagination.pages ?? 0,
      has_more:
        data.pagination.page <
        (data.pagination.total_pages ?? data.pagination.pages ?? 0),
    },
  };
}

export interface AuctionGalleryProps {
  eventId: string;
  initialFilter?: AuctionFilterType;
  initialSort?: AuctionSortType;
  onItemClick?: (item: AuctionItemGalleryItem) => void;
  eventStatus?: 'draft' | 'active' | 'closed';
  eventDateTime?: string;
  className?: string;
}

const ITEMS_PER_PAGE = 12;

const filterOptions: { value: AuctionFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'silent', label: 'Silent' },
  { value: 'live', label: 'Live' },
];

/**
 * AuctionGallery component
 */
export function AuctionGallery({
  eventId,
  initialFilter = 'all',
  initialSort = 'highest_bid',
  onItemClick,
  eventStatus,
  eventDateTime,
  className,
}: AuctionGalleryProps) {
  const [filter, setFilter] = useState<AuctionFilterType>(initialFilter);
  const [sortBy] = useState<AuctionSortType>(initialSort);

  // Ref for infinite scroll trigger
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch watch list
  const { data: watchListData } = useQuery({
    queryKey: ['watchlist', eventId],
    queryFn: () => watchListService.getWatchList(eventId),
    enabled: !!eventId,
    staleTime: 30000, // 30 seconds
  });

  const watchedItemIds = new Set(
    watchListData?.watch_list?.map((entry) => entry.auction_item_id) || []
  );

  // Infinite query for auction items
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['auction-items', eventId, filter, sortBy],
    queryFn: ({ pageParam = 1 }) =>
      fetchAuctionItems(eventId, {
        page: pageParam,
        limit: ITEMS_PER_PAGE,
        auction_type: filter,
        sort_by: sortBy,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilter: AuctionFilterType) => {
    setFilter(newFilter);
  }, []);

  // Flatten items from all pages
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages[0]?.pagination.total ?? 0;

  // Separate watched and unwatched items
  const watchedItems = items.filter((item) => watchedItemIds.has(item.id));
  const unwatchedItems = items.filter((item) => !watchedItemIds.has(item.id));

  // Handle bid click
  const handleBidClick = useCallback(
    (item: AuctionItemGalleryItem) => {
      onItemClick?.(item);
    },
    [onItemClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading auction items...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <p className="text-sm text-destructive">Failed to load auction items</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm underline"
          style={{ color: 'var(--event-primary, #3B82F6)' }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filter controls */}
      <div className="flex items-center justify-between">
        <div
          className="inline-flex rounded-lg border bg-muted/30 p-1"
          role="group"
          aria-label="Filter auction items"
        >
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleFilterChange(option.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
                filter === option.value
                  ? 'shadow-sm'
                  : 'hover:opacity-80'
              )}
              style={
                filter === option.value
                  ? {
                    backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                    color: 'var(--event-text-on-primary, #FFFFFF)',
                  }
                  : {
                    color: 'var(--event-text-muted-on-background, #6B7280)',
                  }
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <span
          className="text-sm"
          style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
        >
          {totalCount} item{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Gavel className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          <h3
            className="mt-4 text-lg font-medium"
            style={{ color: 'var(--event-text-on-background, #000000)' }}
          >
            No auction items available yet
          </h3>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          >
            Check back soon for exciting items to bid on!
          </p>
        </div>
      )}

      {/* Watched Items Section */}
      {watchedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Eye
              className="h-5 w-5"
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            />
            <h3
              className="text-lg font-semibold"
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            >
              Watched Items
            </h3>
            <span
              className="text-sm"
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              ({watchedItems.length})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {watchedItems.map((item) => (
              <AuctionItemCard
                key={item.id}
                item={item}
                onClick={handleBidClick}
                onBidClick={handleBidClick}
                eventStatus={eventStatus}
                eventDateTime={eventDateTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Items Section */}
      {items.length > 0 && watchedItems.length > 0 && (
        <h3
          className="text-lg font-semibold mt-8"
          style={{ color: 'var(--event-text-on-background, #000000)' }}
        >
          All Items
        </h3>
      )}

      {/* Items grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(watchedItems.length > 0 ? unwatchedItems : items).map((item) => (
            <AuctionItemCard
              key={item.id}
              item={item}
              onClick={handleBidClick}
              onBidClick={handleBidClick}
              eventStatus={eventStatus}
              eventDateTime={eventDateTime}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="flex items-center justify-center py-4"
        >
          {isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}

export default AuctionGallery;
