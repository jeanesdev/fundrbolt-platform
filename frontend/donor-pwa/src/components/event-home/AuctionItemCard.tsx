/**
 * AuctionItemCard — Premium redesign for native app feel
 *
 * Changes:
 * - Taller 4:3 image ratio for more visual impact
 * - Winning: green glow pulse animation + "WINNING" badge
 * - Outbid indicator (tracked via isCurrentUserWinning=false when has bid)
 * - Bid count shown as activity indicator
 * - Cleaner typography hierarchy
 * - More prominent CTA button with scale-bounce on click
 */

import { cn } from '@/lib/utils';
import { getEffectiveNow } from '@/stores/debug-spoof-store';
import type { AuctionItemGalleryItem } from '@/types/auction-gallery';
import { Eye, Flame, Gavel, Heart, Image as ImageIcon, Zap } from 'lucide-react';
import { useRef, useState } from 'react';

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
  /** Show the card in compact mode (no bid button — for watchlist rows) */
  compact?: boolean;
  /** Eagerly load thumbnail image for above-the-fold cards */
  eagerLoadImage?: boolean;
  /** Explicit control from gallery for hot badge visibility */
  isHotItem?: boolean;
}

const loadedAuctionCardImageUrls = new Set<string>();
const loadedAuctionCardImageKeys = new Set<string>();
const auctionCardImageSrcByKey = new Map<string, string>();

function getAuctionImageWarmCache(): Set<string> {
  if (typeof window === 'undefined') {
    return loadedAuctionCardImageUrls;
  }

  const globalWindow = window as Window & {
    __auctionImageWarmCache?: Set<string>;
  };

  if (!globalWindow.__auctionImageWarmCache) {
    globalWindow.__auctionImageWarmCache = new Set<string>();
  }

  return globalWindow.__auctionImageWarmCache;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function IncomingAuctionCardImage({
  src,
  onPromote,
}: {
  src: string;
  onPromote: (src: string) => void;
}) {
  const [isReady, setIsReady] = useState(false);

  return (
    <img
      src={src}
      alt=''
      aria-hidden='true'
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-150',
        isReady ? 'opacity-100' : 'opacity-0'
      )}
      loading='eager'
      fetchPriority='high'
      decoding='async'
      onLoad={() => {
        setIsReady(true);
      }}
      onError={() => {
        setIsReady(true);
      }}
      onTransitionEnd={() => {
        if (!isReady) {
          return;
        }

        onPromote(src);
      }}
    />
  );
}

function AuctionCardImage({
  cacheKey,
  thumbnailUrl,
  title,
  eagerLoadImage,
}: {
  cacheKey: string;
  thumbnailUrl: string;
  title: string;
  eagerLoadImage: boolean;
}) {
  const cachedSrc = auctionCardImageSrcByKey.get(cacheKey);
  const warmCache = getAuctionImageWarmCache();
  const initialSrc = cachedSrc ?? thumbnailUrl;
  const [primarySrc, setPrimarySrc] = useState(initialSrc);
  const [isPrimaryImageLoaded, setIsPrimaryImageLoaded] = useState(
    loadedAuctionCardImageKeys.has(cacheKey) ||
    !!cachedSrc ||
    loadedAuctionCardImageUrls.has(initialSrc) ||
    warmCache.has(initialSrc)
  );
  const nextSrc = thumbnailUrl !== primarySrc ? thumbnailUrl : null;

  const promoteIncomingImage = (incomingSource: string) => {
    loadedAuctionCardImageUrls.add(incomingSource);
    warmCache.add(incomingSource);
    loadedAuctionCardImageKeys.add(cacheKey);
    auctionCardImageSrcByKey.set(cacheKey, incomingSource);
    setPrimarySrc(incomingSource);
    setIsPrimaryImageLoaded(true);
  };

  return (
    <>
      {!isPrimaryImageLoaded && (
        <div
          className='absolute inset-0 flex items-center justify-center animate-pulse'
          style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)' }}
        >
          <ImageIcon className='h-10 w-10 opacity-30' style={{ color: 'var(--event-card-text, #000)' }} />
        </div>
      )}
      <img
        src={primarySrc}
        alt={title}
        className={cn(
          'h-full w-full object-cover transition-transform duration-500',
          'group-hover:scale-105'
        )}
        loading={eagerLoadImage ? 'eager' : 'lazy'}
        fetchPriority={eagerLoadImage ? 'high' : 'auto'}
        decoding='async'
        sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
        width={640}
        height={480}
        onLoad={(event) => {
          const resolvedSrc = event.currentTarget.currentSrc || primarySrc;
          loadedAuctionCardImageKeys.add(cacheKey);
          auctionCardImageSrcByKey.set(cacheKey, resolvedSrc);
          loadedAuctionCardImageUrls.add(resolvedSrc);
          warmCache.add(resolvedSrc);
          setIsPrimaryImageLoaded(true);
        }}
        onError={(event) => {
          const resolvedSrc = event.currentTarget.currentSrc || primarySrc;
          loadedAuctionCardImageKeys.add(cacheKey);
          auctionCardImageSrcByKey.set(cacheKey, resolvedSrc);
          loadedAuctionCardImageUrls.add(resolvedSrc);
          warmCache.add(resolvedSrc);
          setIsPrimaryImageLoaded(true);
        }}
      />
      {nextSrc && (
        <IncomingAuctionCardImage
          key={nextSrc}
          src={nextSrc}
          onPromote={promoteIncomingImage}
        />
      )}
    </>
  );
}

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
  compact = false,
  eagerLoadImage = false,
  isHotItem,
}: AuctionItemCardProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const isLiveAuctionItem = item.auction_type === 'live';
  const displayBid = isLiveAuctionItem
    ? (item.current_bid ?? null)
    : (item.current_bid ?? item.starting_bid);
  const hasCurrentBid = item.current_bid !== null && item.current_bid !== undefined && item.current_bid > 0;
  const isEventInFuture = eventDateTime ? new Date(eventDateTime) > getEffectiveNow() : false;
  const isEffectivelyLive = eventStatus === 'active' && !isEventInFuture;
  const isBiddingOpen =
    eventStatus !== 'closed' && (item.bidding_open !== false || isEffectivelyLive);

  const isHot = isHotItem ?? false;

  const handleBidClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Trigger bounce animation
    if (btnRef.current) {
      btnRef.current.classList.remove('animate-bid-bounce');
      void btnRef.current.offsetWidth; // reflow
      btnRef.current.classList.add('animate-bid-bounce');
    }
    onBidClick?.(item);
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWatch?.(item, !isWatched);
  };

  return (
    <div
      onClick={() => onClick?.(item)}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200',
        'hover:shadow-xl hover:-translate-y-0.5',
        isCurrentUserWinning && hasCurrentBid && 'animate-winning-glow border-green-500',
        !isCurrentUserWinning && hasCurrentBid && isWatched && 'animate-outbid-pulse border-amber-500',
        !isCurrentUserWinning && !hasCurrentBid && 'border-transparent',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
        borderColor:
          isCurrentUserWinning && hasCurrentBid
            ? 'rgb(22, 163, 74)'
            : !isCurrentUserWinning && hasCurrentBid && isWatched
              ? 'rgb(245, 158, 11)'
              : 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
      }}
    >
      {/* Image */}
      <div className='relative overflow-hidden' style={{ paddingTop: '75%' /* 4:3 */ }}>
        <div
          className='absolute inset-0'
          style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)' }}
        >
          {item.thumbnail_url ? (
            <AuctionCardImage
              cacheKey={`auction-item:${item.id}`}
              key={item.id}
              thumbnailUrl={item.thumbnail_url}
              title={item.title}
              eagerLoadImage={eagerLoadImage}
            />
          ) : (
            <div
              className='flex h-full w-full items-center justify-center'
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}
            >
              <ImageIcon className='h-10 w-10 opacity-30' style={{ color: 'var(--event-card-text, #000)' }} />
            </div>
          )}
          {/* Bottom gradient for readability */}
          <div className='absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent' />
        </div>

        {/* Auction type pill — top right */}
        <div className='absolute top-2 right-2 z-10'>
          {item.auction_type === 'live' ? (
            <span className='flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow'>
              <Zap className='h-2.5 w-2.5' /> Live
            </span>
          ) : (
            <span className='rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-white backdrop-blur-sm'>
              Silent
            </span>
          )}
        </div>

        {/* Watch button — top left */}
        {onToggleWatch && (
          <button
            type='button'
            onClick={handleWatchClick}
            className='absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 active:scale-90'
            aria-label={isWatched ? 'Stop watching' : 'Watch this item'}
          >
            <Heart className={cn('h-3.5 w-3.5 transition-all', isWatched && 'fill-current text-red-400')} />
          </button>
        )}

        {/* Winning / Outbid overlay badge */}
        {isCurrentUserWinning && hasCurrentBid && (
          <div className='animate-winning-badge-glow absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg'>
            🏆 Winning
          </div>
        )}
        {!isCurrentUserWinning && hasCurrentBid && isWatched && (
          <div className='absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg'>
            ⚡ Outbid
          </div>
        )}

        {/* Hot item flame */}
        {isHot && !isCurrentUserWinning && (
          <div className='absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white'>
            <Flame className='h-2.5 w-2.5' /> Hot
          </div>
        )}

        {/* Promo badge */}
        {item.promotion_badge && (
          <div className='absolute left-2 top-10 z-10 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow'>
            {item.promotion_badge}
          </div>
        )}

        {/* Watcher count — bottom right if no hot badge */}
        {!isHot && item.watcher_count !== undefined && item.watcher_count > 0 && (
          <div className='absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm'>
            <Eye className='h-2.5 w-2.5' /> {item.watcher_count}
          </div>
        )}
      </div>

      {/* Content */}
      <div className='flex flex-1 flex-col p-3'>
        {/* Bid number */}
        <p
          className='mb-0.5 text-[10px] font-medium uppercase tracking-wider'
          style={{ color: 'var(--event-card-text-muted, #9CA3AF)' }}
        >
          #{item.bid_number}
        </p>

        {/* Title */}
        <h3
          className='mb-2 line-clamp-2 text-sm font-semibold leading-snug'
          style={{ color: 'var(--event-card-text, #000000)' }}
        >
          {item.title}
        </h3>

        {/* Bid info */}
        <div className='mt-auto'>
          {displayBid !== null && (
            <div className='mb-0.5 flex items-baseline justify-between'>
              <span
                className='text-lg font-black leading-none'
                style={{ color: 'var(--event-card-text, #000000)' }}
              >
                {formatCurrency(displayBid)}
              </span>
              {(item.bid_count ?? 0) > 0 && (
                <span
                  className='text-[10px]'
                  style={{ color: 'var(--event-card-text-muted, #9CA3AF)' }}
                >
                  {item.bid_count} bid{item.bid_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
          <p
            className='mb-2 text-[10px]'
            style={{ color: 'var(--event-card-text-muted, #9CA3AF)' }}
          >
            {isLiveAuctionItem
              ? 'Current bid'
              : hasCurrentBid
                ? 'Current bid'
                : 'Starting bid'}
          </p>

          {currentUserMaxBid !== null && currentUserMaxBid > 0 && (
            <p
              className='mb-2 text-[10px] font-medium'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            >
              Your max: {formatCurrency(currentUserMaxBid)}
            </p>
          )}
        </div>

        {/* CTA */}
        {!compact && (
          isLiveAuctionItem ? (
            <p
              className='mt-1 text-center text-xs font-medium italic'
              style={{ color: 'var(--event-card-text-muted, #9CA3AF)' }}
            >
              Live auction item
            </p>
          ) : (
            <button
              ref={btnRef}
              onClick={handleBidClick}
              disabled={eventStatus !== 'active' || isEventInFuture || !isBiddingOpen}
              className={cn(
                'mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold',
                'transition-all duration-150 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-40',
                'shadow-sm hover:shadow-md'
              )}
              style={{
                backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                color: 'var(--event-text-on-primary, #FFFFFF)',
              }}
            >
              <Gavel className='h-4 w-4' />
              {isEventInFuture
                ? 'Not Started'
                : eventStatus === 'active' && isBiddingOpen
                  ? 'Place Bid'
                  : eventStatus === 'closed' || !isBiddingOpen
                    ? 'Bidding Closed'
                    : 'Not Active'}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default AuctionItemCard;
