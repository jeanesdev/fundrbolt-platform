/**
 * AuctionItemCard - Card component for displaying auction items in the gallery
 *
 * Displays thumbnail, title, current/starting bid, bid count, and bid button.
 * Uses event branding colors via CSS variables.
 * Supports promotional badges and watcher count.
 */

import { cn } from '@/lib/utils';
import { getEffectiveNow } from '@/stores/debug-spoof-store';
import type { AuctionItemGalleryItem } from '@/types/auction-gallery';
import { Eye, Gavel, Heart, Image as ImageIcon } from 'lucide-react';

export interface AuctionItemCardProps {
  item: AuctionItemGalleryItem;
  onBidClick?: (item: AuctionItemGalleryItem) => void;
  onClick?: (item: AuctionItemGalleryItem) => void;
  isWatched?: boolean;
  currentUserMaxBid?: number | null;
  isCurrentUserWinning?: boolean;
  onToggleWatch?: (item: AuctionItemGalleryItem, nextWatched: boolean) => void;
  eventStatus?: 'draft' | 'active' | 'closed';
  eventDateTime?: string;
  className?: string;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * AuctionItemCard component
 *
 * Amazon-style gallery card with:
 * - Square thumbnail with fallback
 * - Title with truncation
 * - Current bid or starting bid
 * - Bid count
 * - Bid button using event branding
 */
export function AuctionItemCard({
  item,
  onBidClick,
  onClick,
  isWatched = false,
  currentUserMaxBid = null,
  isCurrentUserWinning = false,
  onToggleWatch,
  eventStatus,
  eventDateTime,
  className,
}: AuctionItemCardProps) {
  const isLiveAuctionItem = item.auction_type === 'live';
  const displayBid = isLiveAuctionItem ? (item.current_bid ?? null) : (item.current_bid ?? item.starting_bid);
  const hasCurrentBid = item.current_bid !== null && item.current_bid > 0;
  const bidLabel = isCurrentUserWinning && hasCurrentBid
    ? 'Currently Winning Bid at:'
    : hasCurrentBid
      ? 'Current Bid'
      : 'Starting Bid';
  const isEventInFuture = eventDateTime ? new Date(eventDateTime) > getEffectiveNow() : false;
  const isEffectivelyLive = eventStatus === 'active' && !isEventInFuture;
  const isBiddingOpen =
    eventStatus !== 'closed' && (item.bidding_open !== false || isEffectivelyLive);

  const handleBidClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking bid button
    onBidClick?.(item);
  };

  const handleCardClick = () => {
    onClick?.(item);
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWatch?.(item, !isWatched);
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md',
        isCurrentUserWinning && hasCurrentBid && 'border-2',
        // Use event accent color for border on hover
        'hover:border-[var(--event-accent,rgb(147,51,234))]',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
        borderColor:
          isCurrentUserWinning && hasCurrentBid
            ? 'rgb(22, 163, 74)'
            : undefined,
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234) / 0.15)' }}
      >
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234) / 0.2)' }}
          >
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          </div>
        )}

        {/* Promotion badge */}
        {item.promotion_badge && (
          <div
            className={cn(
              'absolute left-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-bold text-white shadow-md',
              onToggleWatch ? 'top-11' : 'top-2'
            )}
          >
            {item.promotion_badge}
          </div>
        )}

        {onToggleWatch && (
          <button
            type="button"
            onClick={handleWatchClick}
            className="absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/80"
            aria-label={isWatched ? 'Remove from watch list' : 'Add to watch list'}
            title={isWatched ? 'Remove from watch list' : 'Add to watch list'}
          >
            <Heart
              className={cn('h-4 w-4', isWatched && 'fill-current')}
              aria-hidden="true"
            />
          </button>
        )}

        {/* Auction type badge */}
        <div
          className={cn(
            'absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            item.auction_type === 'live'
              ? 'bg-red-500/90 text-white'
              : 'bg-blue-500/90 text-white'
          )}
        >
          {item.auction_type}
        </div>

        {isCurrentUserWinning && hasCurrentBid && (
          <div
            className={cn(
              'absolute left-2 rounded-full bg-green-600/90 px-2 py-0.5 text-xs font-bold text-white shadow-md',
              item.promotion_badge
                ? onToggleWatch
                  ? 'top-20'
                  : 'top-11'
                : onToggleWatch
                  ? 'top-11'
                  : 'top-2'
            )}
          >
            Currently Winning
          </div>
        )}

        {/* Watcher count badge */}
        {item.watcher_count !== undefined && item.watcher_count > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white">
            <Eye className="h-3 w-3" aria-hidden="true" />
            {item.watcher_count}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {/* Bid Number */}
        <div
          className="text-xs font-medium mb-1"
          style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
        >
          Item #{item.bid_number}
        </div>

        {/* Title */}
        <h3
          className="mb-2 line-clamp-2 text-sm font-medium leading-tight"
          style={{ color: 'var(--event-card-text, #000000)' }}
        >
          {item.title}
        </h3>

        {/* Bid info */}
        {(displayBid !== null || item.bid_count > 0) && (
          <div className="mt-auto space-y-1">
            <div className="flex items-baseline justify-between">
              {displayBid !== null && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
                >
                  {isLiveAuctionItem ? 'Current Bid' : bidLabel}
                </span>
              )}
              {item.bid_count > 0 && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
                >
                  {item.bid_count} bid{item.bid_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {displayBid !== null && (
              <div
                className="text-lg font-bold"
                style={{ color: 'var(--event-card-text, #000000)' }}
              >
                {formatCurrency(displayBid)}
              </div>
            )}
            {currentUserMaxBid !== null && currentUserMaxBid > 0 && (
              <div
                className="text-xs font-medium"
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              >
                Your Max Bid: {formatCurrency(currentUserMaxBid)}
              </div>
            )}
          </div>
        )}

        {/* Bid controls */}
        {isLiveAuctionItem ? (
          <p
            className="mt-3 text-center text-xs font-medium"
            style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
          >
            Live auction coming up!
          </p>
        ) : (
          <button
            onClick={handleBidClick}
            disabled={eventStatus !== 'active' || isEventInFuture || !isBiddingOpen}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
              color: 'var(--event-text-on-primary, #FFFFFF)',
            }}
          >
            <Gavel className="h-4 w-4" aria-hidden="true" />
            {isEventInFuture
              ? 'Not Started'
              : eventStatus === 'active' && isBiddingOpen
                ? 'Place Bid'
                : eventStatus === 'closed' || !isBiddingOpen
                  ? 'Closed'
                  : 'Not Active'}
          </button>
        )}
      </div>
    </div>
  );
}

export default AuctionItemCard;
