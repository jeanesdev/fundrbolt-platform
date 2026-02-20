/**
 * AuctionItemDetailModal - Full-screen modal dialog for auction item details
 *
 * Displays complete auction item information including:
 * - Image gallery with swipe-through
 * - Full description
 * - Bid information
 * - Watch list button
 * - Bid count
 * - Place bid button
 * - Donated by / item webpage
 * - View tracking
 */

import { WatchListButton } from '@/components/auction/WatchListButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemViewTracking } from '@/hooks/useItemViewTracking';
import { cn } from '@/lib/utils';
import auctionItemService from '@/services/auctionItemService';
import { getEffectiveNow } from '@/stores/debug-spoof-store';
import type { AuctionItemDetail } from '@/types/auction-item';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, Gavel, Loader2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface AuctionItemDetailModalProps {
  eventId: string;
  itemId: string | null;
  eventStatus?: 'draft' | 'active' | 'closed';
  eventDateTime?: string;
  onClose: () => void;
  onBid?: (item: AuctionItemDetail) => void;
  isWatching?: boolean;
  onWatchToggle?: (isWatching: boolean) => void;
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
 * AuctionItemDetailModal component
 */
export function AuctionItemDetailModal({
  eventId,
  itemId,
  eventStatus = 'active',
  eventDateTime,
  onClose,
  onBid,
  isWatching = false,
  onWatchToggle,
}: AuctionItemDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Check if event is in the future
  const isEventInFuture = eventDateTime ? new Date(eventDateTime) > getEffectiveNow() : false;

  // Fetch auction item details
  const { data: item, isLoading } = useQuery({
    queryKey: ['auction-item-detail', eventId, itemId],
    queryFn: () => auctionItemService.getAuctionItem(eventId, itemId!),
    enabled: !!itemId,
  });

  // Track view duration
  useItemViewTracking({
    eventId,
    itemId,
    enabled: !!itemId && eventStatus === 'active',
  });

  const isOpen = !!itemId;

  if (!isOpen) return null;

  const displayBid = item?.current_bid_amount ?? item?.starting_bid ?? 0;
  const hasCurrentBid = (item?.current_bid_amount ?? 0) > 0;
  const bidLabel = hasCurrentBid ? 'Current High Bid' : 'Starting Bid';
  const bidCount = item?.bid_count ?? 0;
  const isBiddingOpen = item?.bidding_open !== false;

  const images = useMemo(() => {
    if (!item?.media) return [];

    const seen = new Set<string>();
    return item.media.filter((media) => {
      if (media.media_type !== 'image') {
        return false;
      }

      const identity = `${media.file_path}|${media.thumbnail_path || ''}`;
      if (seen.has(identity)) {
        return false;
      }

      seen.add(identity);
      return true;
    });
  }, [item?.media]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [itemId]);

  useEffect(() => {
    if (selectedImageIndex >= images.length && images.length > 0) {
      setSelectedImageIndex(images.length - 1);
    }
  }, [images.length, selectedImageIndex]);

  const selectedImage = images[selectedImageIndex];

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0"
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : item ? (
          <div className="flex flex-col">
            {/* Image Section */}
            {images.length > 0 && (
              <div
                className="relative"
                style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))' }}
              >
                {/* Main Image */}
                <div className="aspect-video overflow-hidden relative">
                  <img
                    src={selectedImage?.file_path || item.primary_image_url || ''}
                    alt={item.title}
                    className="h-full w-full object-contain"
                  />

                  {/* Image navigation buttons */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>

                      {/* Image counter */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm text-white">
                        {selectedImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Image Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-4">
                    {images.map((img, index) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedImageIndex(index)}
                        className={cn(
                          'flex-shrink-0 overflow-hidden rounded border-2 transition-all',
                          index === selectedImageIndex
                            ? 'border-primary'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        )}
                      >
                        <img
                          src={img.thumbnail_path || img.file_path}
                          alt={`${item.title} ${index + 1}`}
                          className="h-16 w-16 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Promotion badge */}
                {item.promotion_badge && (
                  <div className="absolute left-4 top-4 rounded-full bg-amber-500/90 px-3 py-1 text-sm font-bold text-white shadow-lg">
                    {item.promotion_badge}
                  </div>
                )}

                {/* Auction Type Badge */}
                <div
                  className={cn(
                    'absolute right-4 top-4 rounded-full px-3 py-1 text-sm font-medium capitalize',
                    item.auction_type === 'live'
                      ? 'bg-red-500/90 text-white'
                      : 'bg-blue-500/90 text-white'
                  )}
                >
                  {item.auction_type}
                </div>
              </div>
            )}

            {/* Content Section */}
            <div className="p-6 space-y-6">
              {/* Header with Watch Button */}
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle
                      className="text-2xl font-bold mb-2"
                      style={{ color: 'var(--event-text-on-background, #000000)' }}
                    >
                      {item.title}
                    </DialogTitle>
                    <DialogDescription
                      className="text-base"
                      style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                    >
                      Bid #{item.bid_number}
                    </DialogDescription>
                  </div>
                  <WatchListButton
                    eventId={eventId}
                    itemId={item.id}
                    isWatching={isWatching}
                    onToggle={onWatchToggle}
                    variant="icon"
                  />
                </div>
              </DialogHeader>

              {/* Promotion notice */}
              {item.promotion_notice && (
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    color: 'rgb(180, 83, 9)',
                    borderLeft: '4px solid rgb(245, 158, 11)',
                  }}
                >
                  {item.promotion_notice}
                </div>
              )}

              {/* Bid Info Card */}
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))' }}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
                  >
                    {bidLabel}
                  </span>
                  <span
                    className="text-3xl font-bold"
                    style={{ color: 'var(--event-card-text, #000000)' }}
                  >
                    {formatCurrency(displayBid)}
                  </span>
                </div>

                {/* Bid count */}
                {bidCount > 0 && (
                  <div
                    className="flex items-center gap-2 mb-4 text-sm"
                    style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
                  >
                    <Users className="h-4 w-4" />
                    {bidCount} bid{bidCount !== 1 ? 's' : ''} placed
                  </div>
                )}

                {/* Bid Increment */}
                {item.bid_increment > 0 && (
                  <p
                    className="text-sm mb-4"
                    style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
                  >
                    Minimum bid increment: {formatCurrency(item.bid_increment)}
                  </p>
                )}

                {/* Place Bid Button */}
                <Button
                  onClick={() => onBid?.(item)}
                  className="w-full"
                  disabled={eventStatus !== 'active' || isEventInFuture || !isBiddingOpen}
                  style={{
                    backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                    color: 'var(--event-text-on-primary, #FFFFFF)',
                  }}
                >
                  <Gavel className="h-4 w-4 mr-2" />
                  {isEventInFuture
                    ? 'Event Not Started'
                    : eventStatus === 'active' && isBiddingOpen
                      ? 'Place Bid'
                      : eventStatus === 'closed' || !isBiddingOpen
                        ? 'Bidding Closed'
                        : 'Event Not Active'}
                </Button>

                {/* Buy Now */}
                {item.buy_now_enabled && item.buy_now_price && (
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => {
                      // TODO: Implement buy now functionality
                    }}
                  >
                    Buy Now - {formatCurrency(item.buy_now_price)}
                  </Button>
                )}
              </div>

              {/* Description */}
              {item.description && (
                <div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: 'var(--event-text-on-background, #000000)' }}
                  >
                    Description
                  </h3>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                  >
                    {item.description}
                  </p>
                </div>
              )}

              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {item.donated_by && (
                  <div>
                    <p
                      className="font-medium mb-1"
                      style={{ color: 'var(--event-text-on-background, #000000)' }}
                    >
                      Donated By
                    </p>
                    <p style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
                      {item.donated_by}
                    </p>
                  </div>
                )}

                {item.quantity_available > 1 && (
                  <div>
                    <p
                      className="font-medium mb-1"
                      style={{ color: 'var(--event-text-on-background, #000000)' }}
                    >
                      Quantity Available
                    </p>
                    <p style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}>
                      {item.quantity_available}
                    </p>
                  </div>
                )}

                {item.item_webpage && (
                  <div>
                    <p
                      className="font-medium mb-1"
                      style={{ color: 'var(--event-text-on-background, #000000)' }}
                    >
                      More Info
                    </p>
                    <a
                      href={item.item_webpage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
                    >
                      View Item Webpage
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Auction item not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AuctionItemDetailModal;
