/**
 * AuctionItemCard - Card component for displaying auction items in the gallery
 *
 * Displays thumbnail, title, current/starting bid, and bid button.
 * Uses event branding colors via CSS variables.
 */

import { cn } from '@/lib/utils';
import type { AuctionItemGalleryItem } from '@/types/auction-gallery';
import { Gavel, Image as ImageIcon } from 'lucide-react';

export interface AuctionItemCardProps {
  item: AuctionItemGalleryItem;
  onBidClick?: (item: AuctionItemGalleryItem) => void;
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
  className,
}: AuctionItemCardProps) {
  const displayBid = item.current_bid ?? item.starting_bid;
  const hasCurrentBid = item.current_bid !== null && item.current_bid > 0;
  const bidLabel = hasCurrentBid ? 'Current Bid' : 'Starting Bid';

  const handleBidClick = () => {
    onBidClick?.(item);
  };

  return (
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md',
        // Use event accent color for border on hover
        'hover:border-[var(--event-accent,rgb(147,51,234))]',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/50">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          </div>
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
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-sm font-medium leading-tight">
          {item.title}
        </h3>

        {/* Bid info */}
        <div className="mt-auto space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">{bidLabel}</span>
            {item.bid_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {item.bid_count} bid{item.bid_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div
            className="text-lg font-bold"
            style={{ color: 'var(--event-primary, #3B82F6)' }}
          >
            {formatCurrency(displayBid)}
          </div>
        </div>

        {/* Bid button */}
        <button
          onClick={handleBidClick}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
          style={{
            backgroundColor: 'var(--event-primary, #3B82F6)',
          }}
        >
          <Gavel className="h-4 w-4" aria-hidden="true" />
          Place Bid
        </button>
      </div>
    </div>
  );
}

export default AuctionItemCard;
