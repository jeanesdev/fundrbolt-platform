/**
 * AuctionGallery - Amazon-style auction items gallery with infinite scroll
 *
 * Features:
 * - CSS Grid layout (responsive: 2 cols mobile, 3 cols tablet, 4 cols desktop)
 * - Auction type filter (All/Silent/Live/My Items) using button group
 * - Infinite scroll pagination using react-query useInfiniteQuery
 * - Watched items section at top
 * - Empty state with Gavel icon
 * - Loading spinner for scroll trigger
 */

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Gavel, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/axios';
import { cn } from '@/lib/utils';
import watchListService from '@/services/watchlistService';
import { useAuthStore } from '@/stores/auth-store';
import { useDebugSpoofStore } from '@/stores/debug-spoof-store';
import type {
  AuctionFilterType,
  AuctionItemGalleryItem,
  AuctionSortType,
} from '@/types/auction-gallery';
import { AuctionItemCard } from './AuctionItemCard';

declare global {
  interface Window {
    requestIdleCallback?: (callback: () => void) => number;
    cancelIdleCallback?: (id: number) => void;
  }
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function parseBidAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parsePlacedAt(value: unknown): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Fetch auction items from the API
 */
async function fetchAuctionItems(
  eventId: string,
  params: {
    page: number;
    limit: number;
    auction_type?: 'silent' | 'live';
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

  if (params.auction_type) {
    searchParams.set('auction_type', params.auction_type);
  }

  const response = await apiClient.get(`/events/${eventId}/auction-items`, {
    params: Object.fromEntries(searchParams.entries()),
    timeout: 15000,
  });

  const data = response.data;

  const toNumber = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(parsed) ? parsed : null;
  };

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
        current_bid_amount?: number | string | null;
        bid_count?: number;
        bidding_open?: boolean;
        watcher_count?: number;
        promotion_badge?: string | null;
        promotion_notice?: string | null;
        min_next_bid_amount?: number | string | null;
        category?: string | null;
        category_name?: string | null;
      }) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? null,
        auction_type: item.auction_type as 'silent' | 'live',
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
  watchlistScope?: string;
  maxBidItemMap?: Record<string, number>;
  winningItemMap?: Record<string, boolean>;
  initialFilter?: AuctionFilterType;
  initialSort?: AuctionSortType;
  onItemClick?: (item: AuctionItemGalleryItem, isWinning: boolean) => void;
  eventStatus?: 'draft' | 'active' | 'closed';
  eventDateTime?: string;
  className?: string;
  /** When true, only shows items in the user's watchlist or that they've bid on */
  showOnlyMyItems?: boolean;
}

const ITEMS_PER_PAGE = 12;
const IMAGE_PRELOAD_COUNT = Number.POSITIVE_INFINITY;
const HOT_MIN_BID_COUNT = 10;
const HOT_MAX_ITEMS = 6;

const preloadedAuctionImageUrls = new Set<string>();
const preconnectedAuctionHosts = new Set<string>();

function getAuctionImageWarmCache(): Set<string> {
  if (typeof window === 'undefined') {
    return preloadedAuctionImageUrls;
  }

  const globalWindow = window as Window & {
    __auctionImageWarmCache?: Set<string>;
  };

  if (!globalWindow.__auctionImageWarmCache) {
    globalWindow.__auctionImageWarmCache = new Set<string>();
  }

  return globalWindow.__auctionImageWarmCache;
}

const filterOptions: { value: AuctionFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'silent', label: 'Silent' },
  { value: 'live', label: 'Live' },
  { value: 'my', label: 'My Items' },
];

const sortOptions: { value: AuctionSortType; label: string }[] = [
  { value: 'highest_bid', label: 'Highest Bid' },
  { value: 'lowest_bid', label: 'Lowest Bid' },
  { value: 'most_bids', label: 'Most Bids' },
  { value: 'item_number', label: 'Item Number' },
  { value: 'title', label: 'Title (A-Z)' },
];

/**
 * AuctionGallery component
 */
export function AuctionGallery({
  eventId,
  watchlistScope = 'self',
  maxBidItemMap = {},
  winningItemMap = {},
  initialFilter = 'all',
  initialSort = 'highest_bid',
  onItemClick,
  eventStatus,
  eventDateTime,
  className,
  showOnlyMyItems = false,
}: AuctionGalleryProps) {
  const authUserId = useAuthStore((state) => state.user?.id);
  const spoofedUserId = useDebugSpoofStore((state) => state.spoofedUser?.id);
  const effectiveUserId = normalizeIdentifier(spoofedUserId ?? authUserId);

  const [filter, setFilter] = useState<AuctionFilterType>(initialFilter);
  const [sortBy, setSortBy] = useState<AuctionSortType>(initialSort);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Ref for infinite scroll trigger
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const preloadedImageUrlsRef = useRef<Set<string>>(preloadedAuctionImageUrls);
  const preconnectedHostsRef = useRef<Set<string>>(preconnectedAuctionHosts);

  // Fetch watch list
  const { data: watchListData } = useQuery({
    queryKey: ['watchlist', eventId, watchlistScope],
    queryFn: () => watchListService.getWatchList(eventId),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const watchedItemIds = new Set(
    watchListData?.watch_list?.map((entry) => entry.auction_item_id) || []
  );

  const { mutate: addToWatchList } = useMutation({
    mutationFn: (itemId: string) => watchListService.addToWatchList(eventId, itemId),
    onSuccess: (_data, itemId) => {
      queryClient.setQueryData(
        ['watchlist', eventId, watchlistScope],
        (previous:
          | {
            watch_list?: Array<{
              id: string;
              user_id: string;
              auction_item_id: string;
              added_at: string;
            }>;
            total?: number;
          }
          | undefined) => {
          const existing = previous?.watch_list ?? [];
          if (existing.some((entry) => entry.auction_item_id === itemId)) {
            return previous;
          }

          return {
            watch_list: [
              ...existing,
              {
                id: itemId,
                user_id: '',
                auction_item_id: itemId,
                added_at: new Date().toISOString(),
              },
            ],
            total: (previous?.total ?? existing.length) + 1,
          };
        }
      );
    },
  });

  const { mutate: removeFromWatchList } = useMutation({
    mutationFn: (itemId: string) => watchListService.removeFromWatchList(eventId, itemId),
    onSuccess: (_data, itemId) => {
      queryClient.setQueryData(
        ['watchlist', eventId, watchlistScope],
        (previous:
          | {
            watch_list?: Array<{
              id: string;
              user_id: string;
              auction_item_id: string;
              added_at: string;
            }>;
            total?: number;
          }
          | undefined) => {
          const existing = previous?.watch_list ?? [];
          const next = existing.filter((entry) => entry.auction_item_id !== itemId);
          return {
            watch_list: next,
            total: next.length,
          };
        }
      );
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim().toLowerCase());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

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
    queryKey: ['auction-items', eventId, filter],
    queryFn: ({ pageParam = 1 }) =>
      fetchAuctionItems(eventId, {
        page: pageParam,
        limit: ITEMS_PER_PAGE,
        auction_type:
          filter === 'silent' || filter === 'live'
            ? filter
            : undefined,
      }),
    enabled: !!eventId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
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

  // Flatten items from all pages and de-duplicate by item ID
  const allLoadedItemsRaw = data?.pages.flatMap((page) => page.items) ?? [];
  const allLoadedItems = Array.from(
    new Map(allLoadedItemsRaw.map((item) => [item.id, item])).values()
  );
  const categories = Array.from(
    new Set(
      allLoadedItems
        .map((item) => item.category?.trim())
        .filter((value): value is string => !!value)
    )
  ).sort((a, b) => a.localeCompare(b));

  const items = allLoadedItems
    .filter((item) => {
      if (categoryFilter === 'all') {
        return true;
      }
      return (item.category ?? '').trim().toLowerCase() === categoryFilter;
    })
    .filter((item) => {
      if (!debouncedSearchQuery) {
        return true;
      }

      const title = item.title.toLowerCase();
      const description = (item.description ?? '').toLowerCase();
      const bidNumber = `item #${item.bid_number}`;
      return (
        title.includes(debouncedSearchQuery) ||
        description.includes(debouncedSearchQuery) ||
        bidNumber.includes(debouncedSearchQuery)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'highest_bid':
          return (b.current_bid ?? b.starting_bid) - (a.current_bid ?? a.starting_bid);
        case 'lowest_bid':
          return (a.current_bid ?? a.starting_bid) - (b.current_bid ?? b.starting_bid);
        case 'most_bids':
          return b.bid_count - a.bid_count;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'item_number':
        default:
          return a.bid_number - b.bid_number;
      }
    });
  const totalCount = items.length;

  useEffect(() => {
    if (
      !eventId ||
      isLoading ||
      isError ||
      isFetchingNextPage ||
      !hasNextPage
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchNextPage();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    allLoadedItems.length,
    eventId,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
  ]);

  useEffect(() => {
    const warmCache = getAuctionImageWarmCache();
    const urlsToPreload = allLoadedItems
      .slice(0, IMAGE_PRELOAD_COUNT)
      .map((item) => item.thumbnail_url)
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .filter(
        (url) =>
          !preloadedImageUrlsRef.current.has(url) &&
          !warmCache.has(url)
      );

    if (urlsToPreload.length === 0) {
      return;
    }

    const schedule = window.requestIdleCallback
      ? window.requestIdleCallback
      : (callback: () => void) => window.setTimeout(callback, 0);

    const cancelScheduled = window.cancelIdleCallback
      ? window.cancelIdleCallback
      : (id: number) => window.clearTimeout(id);

    const scheduledId = schedule(() => {
      urlsToPreload.forEach((url) => {
        preloadedImageUrlsRef.current.add(url);
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
          warmCache.add(url);
        };
        image.onerror = () => {
          warmCache.add(url);
        };
        image.src = url;
      });
    });

    return () => {
      cancelScheduled(scheduledId);
    };
  }, [allLoadedItems, items]);

  useEffect(() => {
    const hostsToPreconnect = allLoadedItems
      .slice(0, IMAGE_PRELOAD_COUNT)
      .map((item) => item.thumbnail_url)
      .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      .map((url) => {
        try {
          return new URL(url).origin;
        } catch {
          return null;
        }
      })
      .filter((origin): origin is string => typeof origin === 'string')
      .filter((origin) => !preconnectedHostsRef.current.has(origin));

    hostsToPreconnect.forEach((origin) => {
      preconnectedHostsRef.current.add(origin);

      const preconnectLink = document.createElement('link');
      preconnectLink.rel = 'preconnect';
      preconnectLink.href = origin;
      preconnectLink.crossOrigin = 'anonymous';
      document.head.appendChild(preconnectLink);

      const dnsPrefetchLink = document.createElement('link');
      dnsPrefetchLink.rel = 'dns-prefetch';
      dnsPrefetchLink.href = origin;
      document.head.appendChild(dnsPrefetchLink);
    });
  }, [allLoadedItems]);

  const winningHistoryQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ['auction-item-bids', item.id, effectiveUserId ?? 'anonymous'],
      queryFn: async () => {
        const response = await apiClient.get<{
          items: Array<{
            user_id?: string | number | null;
            bidder_id?: string | number | null;
            bid_status?: string | null;
            bid_amount?: number | string | null;
            placed_at?: string | null;
            is_winning?: boolean;
          }>;
        }>(`/auction/items/${item.id}/bids`, {
          params: {
            page: 1,
            per_page: 100,
          },
        });

        return response.data.items;
      },
      enabled: !!effectiveUserId,
      staleTime: 10000,
    })),
  });

  const winningFromHistoryMap: Record<string, boolean> = {};

  if (effectiveUserId) {
    winningHistoryQueries.forEach((queryResult, index) => {
      const item = items[index];
      const bids = queryResult.data;

      if (!item || !bids || bids.length === 0) {
        return;
      }

      const explicitWinning = bids.some((bid) => {
        const bidUserId = normalizeIdentifier(bid.user_id ?? bid.bidder_id);
        return bidUserId === effectiveUserId && bid.is_winning === true;
      });

      if (explicitWinning) {
        winningFromHistoryMap[item.id] = true;
        return;
      }

      const activeOrWinningBids = bids.filter((bid) => {
        const status = String(bid.bid_status ?? '').toLowerCase();
        return status === 'active' || status === 'winning';
      });

      if (activeOrWinningBids.length === 0) {
        winningFromHistoryMap[item.id] = false;
        return;
      }

      const leadingBid = activeOrWinningBids.reduce((currentLeader, candidate) => {
        const currentAmount = parseBidAmount(currentLeader.bid_amount);
        const candidateAmount = parseBidAmount(candidate.bid_amount);

        if (candidateAmount > currentAmount) {
          return candidate;
        }

        if (candidateAmount < currentAmount) {
          return currentLeader;
        }

        const currentPlacedAt = parsePlacedAt(currentLeader.placed_at);
        const candidatePlacedAt = parsePlacedAt(candidate.placed_at);
        return candidatePlacedAt >= currentPlacedAt ? candidate : currentLeader;
      });

      const leadingUserId = normalizeIdentifier(
        leadingBid.user_id ?? leadingBid.bidder_id
      );

      winningFromHistoryMap[item.id] = leadingUserId === effectiveUserId;
    });
  }

  const isItemCurrentlyWinning = (itemId: string): boolean => {
    if (winningItemMap[itemId] === true) {
      return true;
    }

    return winningFromHistoryMap[itemId] ?? false;
  };

  // Separate watched and unwatched items
  const watchedItems = items.filter(
    (item) => watchedItemIds.has(item.id) || isItemCurrentlyWinning(item.id)
  );
  const unwatchedItems = items.filter(
    (item) => !watchedItemIds.has(item.id) && !isItemCurrentlyWinning(item.id)
  );

  const isMyItemsMode = filter === 'my' || showOnlyMyItems;

  // My Items: watched + bid on (max bid set)
  const myItemIds = isMyItemsMode
    ? new Set([
      ...Array.from(watchedItemIds),
      ...Object.keys(winningItemMap),
      ...Object.keys(maxBidItemMap),
    ])
    : null;
  const myItems = myItemIds ? items.filter((item) => myItemIds.has(item.id)) : [];
  const displayedCount = isMyItemsMode ? myItems.length : totalCount;

  const hotItemIds = new Set(
    items
      .filter((item) => (item.bid_count ?? 0) >= HOT_MIN_BID_COUNT)
      .sort((a, b) => (b.bid_count ?? 0) - (a.bid_count ?? 0))
      .slice(0, HOT_MAX_ITEMS)
      .map((item) => item.id)
  );

  // Handle bid click
  const handleBidClick = (item: AuctionItemGalleryItem) => {
    onItemClick?.(item, isItemCurrentlyWinning(item.id));
  };

  const handleToggleWatch = useCallback(
    (item: AuctionItemGalleryItem, nextWatched: boolean) => {
      if (nextWatched) {
        addToWatchList(item.id);
      } else {
        removeFromWatchList(item.id);
      }
    },
    [addToWatchList, removeFromWatchList]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading auction items...</p>
        <button
          onClick={() => refetch()}
          className="mt-3 text-xs underline"
          style={{ color: 'var(--event-primary, #3B82F6)' }}
        >
          Tap to retry
        </button>
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
      <div className="space-y-3">
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
            {displayedCount} item{displayedCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-1 text-left">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              Search
            </p>
            <Input
              placeholder="Search auction items"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search auction items"
              className="text-left"
              style={{
                backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.4)',
                color: 'var(--event-text-on-background, #111827)',
              }}
            />
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-1">
            <div className="space-y-1 text-left">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
              >
                Filter
              </p>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger
                  aria-label="Category filter"
                  className="w-full justify-between text-left md:w-44"
                  style={{
                    backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.4)',
                    color: 'var(--event-text-on-background, #111827)',
                  }}
                >
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent
                  className="text-left"
                  style={{
                    backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                    color: 'var(--event-text-on-background, #111827)',
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
                  }}
                >
                  <SelectItem className="text-left" value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      className="text-left"
                      key={category.toLowerCase()}
                      value={category.toLowerCase()}
                    >
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 text-left">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
              >
                Sort
              </p>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as AuctionSortType)}
              >
                <SelectTrigger
                  aria-label="Sort items"
                  className="w-full justify-between text-left md:w-44"
                  style={{
                    backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.4)',
                    color: 'var(--event-text-on-background, #111827)',
                  }}
                >
                  <SelectValue placeholder="Highest Bid" />
                </SelectTrigger>
                <SelectContent
                  className="text-left"
                  style={{
                    backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                    color: 'var(--event-text-on-background, #111827)',
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
                  }}
                >
                  {sortOptions.map((option) => (
                    <SelectItem className="text-left" key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && !isMyItemsMode && (
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

      {/* My Items mode: show only items user has interacted with */}
      {isMyItemsMode && (
        <>
          {myItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}
              >
                <span className="text-4xl">⭐</span>
              </div>
              <p className="mb-1 text-base font-bold" style={{ color: 'var(--event-text-on-background, #111827)' }}>
                No items yet
              </p>
              <p className="text-sm" style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
                Watch or bid on items to see them here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {myItems.map((item) => (
                <AuctionItemCard
                  key={item.id}
                  item={item}
                  eagerLoadImage={true}
                  isHotItem={hotItemIds.has(item.id)}
                  isWatched={watchedItemIds.has(item.id)}
                  currentUserMaxBid={maxBidItemMap[item.id] ?? null}
                  isCurrentUserWinning={isItemCurrentlyWinning(item.id)}
                  onToggleWatch={handleToggleWatch}
                  onClick={handleBidClick}
                  onBidClick={handleBidClick}
                  eventStatus={eventStatus}
                  eventDateTime={eventDateTime}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Watched Items Section (non-My-Items mode) */}
      {!isMyItemsMode && watchedItems.length > 0 && (
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
                eagerLoadImage={true}
                isHotItem={hotItemIds.has(item.id)}
                isWatched={watchedItemIds.has(item.id)}
                currentUserMaxBid={maxBidItemMap[item.id] ?? null}
                isCurrentUserWinning={isItemCurrentlyWinning(item.id)}
                onToggleWatch={handleToggleWatch}
                onClick={handleBidClick}
                onBidClick={handleBidClick}
                eventStatus={eventStatus}
                eventDateTime={eventDateTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Items Section (non-My-Items mode) */}
      {!isMyItemsMode && items.length > 0 && watchedItems.length > 0 && (
        <h3
          className="text-lg font-semibold mt-8"
          style={{ color: 'var(--event-text-on-background, #000000)' }}
        >
          All Items
        </h3>
      )}

      {/* Items grid (non-My-Items mode) */}
      {!isMyItemsMode && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(watchedItems.length > 0 ? unwatchedItems : items).map((item, index) => (
            <AuctionItemCard
              key={item.id}
              item={item}
              eagerLoadImage={index < IMAGE_PRELOAD_COUNT}
              isHotItem={hotItemIds.has(item.id)}
              isWatched={watchedItemIds.has(item.id)}
              currentUserMaxBid={maxBidItemMap[item.id] ?? null}
              isCurrentUserWinning={isItemCurrentlyWinning(item.id)}
              onToggleWatch={handleToggleWatch}
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
