/**
 * AuctionItemDetailModal - Full-screen modal dialog for auction item details
 *
 * Displays complete auction item information including:
 * - Image gallery
 * - Full description
 * - Bid information
 * - Donated by / item webpage
 * - Place bid button
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import auctionItemService from '@/services/auctionItemService';
import type { AuctionItemDetail } from '@/types/auction-item';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Gavel, Loader2 } from 'lucide-react';
import { useState } from 'react';

export interface AuctionItemDetailModalProps {
  eventId: string;
  itemId: string | null;
  eventStatus?: 'draft' | 'active' | 'closed';
  eventDateTime?: string;
  onClose: () => void;
  onBid?: (item: AuctionItemDetail) => void;
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
}: AuctionItemDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Check if event is in the future
  const isEventInFuture = eventDateTime ? new Date(eventDateTime) > new Date() : false;

  // Fetch auction item details
  const { data: item, isLoading } = useQuery({
    queryKey: ['auction-item-detail', eventId, itemId],
    queryFn: () => auctionItemService.getAuctionItem(eventId, itemId!),
    enabled: !!itemId,
  });

  const isOpen = !!itemId;

  if (!isOpen) return null;

  const displayBid = item?.starting_bid ?? 0;
  const bidLabel = 'Starting Bid'; // Will update when bidding is implemented

  // Get all images
  const images = item?.media?.filter((m) => m.media_type === 'image') || [];
  const selectedImage = images[selectedImageIndex];

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
              <div className="relative bg-muted">
                {/* Main Image */}
                <div className="aspect-video overflow-hidden">
                  <img
                    src={selectedImage?.file_path || item.primary_image_url || ''}
                    alt={item.title}
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* Image Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-4">
                    {images.map((img, index) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 overflow-hidden rounded border-2 transition-all ${index === selectedImageIndex
                          ? 'border-primary'
                          : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
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

                {/* Auction Type Badge */}
                <div
                  className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-medium capitalize ${item.auction_type === 'live'
                    ? 'bg-red-500/90 text-white'
                    : 'bg-blue-500/90 text-white'
                    }`}
                >
                  {item.auction_type}
                </div>
              </div>
            )}

            {/* Content Section */}
            <div className="p-6 space-y-6">
              {/* Header */}
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
                </div>
              </DialogHeader>

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
                  disabled={eventStatus !== 'active' || isEventInFuture}
                  style={{
                    backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                    color: 'var(--event-text-on-primary, #FFFFFF)',
                  }}
                >
                  <Gavel className="h-4 w-4 mr-2" />
                  {isEventInFuture
                    ? 'Event Not Started'
                    : eventStatus === 'active'
                      ? 'Place Bid'
                      : eventStatus === 'closed'
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
