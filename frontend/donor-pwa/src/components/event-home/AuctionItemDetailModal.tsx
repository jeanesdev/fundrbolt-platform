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
import { WatchListButton } from '@/components/auction/WatchListButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useItemViewTracking } from '@/hooks/useItemViewTracking'
import { cn } from '@/lib/utils'
import auctionItemService from '@/services/auctionItemService'
import { useAuthStore } from '@/stores/auth-store'
import { getEffectiveNow, useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker'
import '@ncdai/react-wheel-picker/style.css'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Loader2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export interface AuctionItemDetailModalProps {
  eventId: string
  itemId: string | null
  eventStatus?: 'draft' | 'active' | 'closed'
  eventDateTime?: string
  onClose: () => void
  onPlaceBid?: (itemId: string, amount: number) => void
  onSetMaxBid?: (itemId: string, amount: number) => void
  onBuyNow?: (itemId: string) => void
  isSubmittingBid?: boolean
  isWatching?: boolean
  isCurrentUserWinning?: boolean
  currentUserMaxBid?: number | null
  onWatchToggle?: (isWatching: boolean) => void
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
  }).format(amount)
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
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
  onPlaceBid,
  onSetMaxBid,
  onBuyNow,
  isSubmittingBid = false,
  isWatching = false,
  onWatchToggle,
  isCurrentUserWinning,
  currentUserMaxBid = null,
}: AuctionItemDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isFullscreenImageOpen, setIsFullscreenImageOpen] = useState(false)
  const [fullscreenImageSrc, setFullscreenImageSrc] = useState<string | null>(
    null
  )
  const [fullscreenImageAlt, setFullscreenImageAlt] = useState('Auction item image')
  const [selectedBidAmount, setSelectedBidAmount] = useState(0)
  const [optionCount, setOptionCount] = useState(50)
  const [isManualBidDialogOpen, setIsManualBidDialogOpen] = useState(false)
  const [manualBidInputValue, setManualBidInputValue] = useState('')
  const [manualBidInputError, setManualBidInputError] = useState<string | null>(
    null
  )
  const [loadedImageSources, setLoadedImageSources] = useState<Record<string, true>>({})
  const [preloadedImageSources, setPreloadedImageSources] = useState<Record<string, true>>({})
  const [placeBidSlideValue, setPlaceBidSlideValue] = useState<number[]>([0])
  const [maxBidSlideValue, setMaxBidSlideValue] = useState<number[]>([0])
  const [buyNowSlideValue, setBuyNowSlideValue] = useState<number[]>([0])
  const authUserId = useAuthStore((state) => state.user?.id)
  const spoofedUserId = useDebugSpoofStore((state) => state.spoofedUser?.id)

  // Check if event is in the future
  const isEventInFuture = eventDateTime
    ? new Date(eventDateTime) > getEffectiveNow()
    : false

  // Fetch auction item details
  const {
    data: item,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['auction-item-detail', eventId, itemId],
    queryFn: () => auctionItemService.getAuctionItem(eventId, itemId!),
    enabled: !!itemId && !!eventId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  })
  const isLiveAuctionItem = item?.auction_type === 'live'

  // Track view duration
  useItemViewTracking({
    eventId,
    itemId,
    enabled: !!itemId && eventStatus === 'active',
  })

  const isOpen = !!itemId

  const displayBid = isLiveAuctionItem
    ? (item?.current_bid_amount ?? null)
    : (item?.current_bid_amount ?? item?.starting_bid ?? 0)
  const hasCurrentBid = (item?.current_bid_amount ?? 0) > 0
  const bidLabel = hasCurrentBid ? 'Current High Bid' : 'Starting Bid'
  const bidCount = item?.bid_count ?? 0
  const effectiveUserId = normalizeIdentifier(spoofedUserId ?? authUserId)
  const winningStateFromItemDetails = useMemo(() => {
    if (!item) {
      return false
    }

    const itemData = item as Record<string, unknown>
    const explicitWinningFlagKeys = [
      'is_current_user_winning',
      'is_winning',
      'current_user_is_high_bidder',
      'user_is_high_bidder',
      'is_high_bidder',
    ]

    for (const key of explicitWinningFlagKeys) {
      if (typeof itemData[key] === 'boolean' && itemData[key] === true) {
        return true
      }
    }

    if (!effectiveUserId) {
      return false
    }

    const highBidderIdKeys = [
      'high_bidder_user_id',
      'current_high_bidder_id',
      'leading_bidder_user_id',
      'highest_bidder_user_id',
      'winning_bidder_user_id',
    ]

    for (const key of highBidderIdKeys) {
      const candidateId = normalizeIdentifier(itemData[key])
      if (candidateId && candidateId === effectiveUserId) {
        return true
      }
    }

    return false
  }, [item, effectiveUserId])
  const winningStateFromBidHistory = false
  const showWinningState =
    ((isCurrentUserWinning ?? winningStateFromItemDetails) ||
      winningStateFromBidHistory) &&
    hasCurrentBid
  const bidCardBackgroundColor = showWinningState
    ? 'rgb(22, 163, 74)'
    : 'rgb(var(--event-card-bg, 147, 51, 234))'
  const bidCardTextColor = showWinningState
    ? 'var(--event-text-on-primary, #FFFFFF)'
    : 'var(--event-card-text, #000000)'
  const bidCardMutedTextColor = showWinningState
    ? 'rgb(220, 252, 231)'
    : 'var(--event-card-text-muted, #6B7280)'
  const currentBidDisplayLabel = showWinningState
    ? 'You are currently the high bidder at:'
    : isLiveAuctionItem
      ? 'Current High Bid'
      : bidLabel
  const isEffectivelyLive = eventStatus === 'active' && !isEventInFuture
  const isBiddingOpen =
    eventStatus !== 'closed' &&
    (item?.bidding_open !== false || isEffectivelyLive)

  const images = useMemo(() => {
    if (!item?.media) return []

    const seen = new Set<string>()
    return item.media.filter((media) => {
      if (media.media_type !== 'image') {
        return false
      }

      const identity = `${media.file_path}|${media.thumbnail_path || ''}`
      if (seen.has(identity)) {
        return false
      }

      seen.add(identity)
      return true
    })
  }, [item])

  const selectedImage =
    images[Math.min(selectedImageIndex, Math.max(images.length - 1, 0))]
  const selectedImageThumbnailSrc = selectedImage?.thumbnail_path || ''
  const activeImageSrc = selectedImage?.file_path || item?.primary_image_url || ''
  const activeImageDisplaySrc = selectedImageThumbnailSrc || activeImageSrc
  const activeImageSrcSet =
    selectedImageThumbnailSrc && selectedImageThumbnailSrc !== activeImageSrc
      ? `${selectedImageThumbnailSrc} 640w, ${activeImageSrc} 1920w`
      : undefined
  const isPrimaryImageLoading =
    !!isOpen &&
    !!item &&
    !!activeImageSrc &&
    !loadedImageSources[activeImageSrc] &&
    !preloadedImageSources[activeImageSrc]

  useEffect(() => {
    if (!isOpen || !item || !activeImageSrc || loadedImageSources[activeImageSrc]) {
      return
    }

    const preloadedImage = new Image()

    preloadedImage.onload = () => {
      setLoadedImageSources((prev) => ({
        ...prev,
        [activeImageSrc]: true,
      }))
    }

    preloadedImage.onerror = () => {
      setLoadedImageSources((prev) => ({
        ...prev,
        [activeImageSrc]: true,
      }))
    }

    preloadedImage.src = activeImageSrc
  }, [activeImageSrc, isOpen, item, loadedImageSources])

  useEffect(() => {
    if (!isOpen || !item) {
      return
    }

    const urls = [
      item.primary_image_url,
      ...images.map((image) => image.thumbnail_path),
      ...images.map((image) => image.file_path),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    const uniqueUrls = Array.from(new Set(urls)).slice(0, 10)

    uniqueUrls.forEach((url) => {
      if (loadedImageSources[url] || preloadedImageSources[url]) {
        return
      }

      const preloadedImage = new Image()
      preloadedImage.onload = () => {
        setPreloadedImageSources((prev) => ({
          ...prev,
          [url]: true,
        }))
      }
      preloadedImage.onerror = () => {
        setPreloadedImageSources((prev) => ({
          ...prev,
          [url]: true,
        }))
      }
      preloadedImage.src = url
    })
  }, [images, isOpen, item, loadedImageSources, preloadedImageSources])

  const openFullscreenImage = (src: string, alt: string) => {
    if (!src) {
      return
    }

    setFullscreenImageSrc(src)
    setFullscreenImageAlt(alt)
    setIsFullscreenImageOpen(true)
  }

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const numericCurrentBid = item?.current_bid_amount ?? 0
  const numericStartingBid = item?.starting_bid ?? 0
  const minimumNextBidBase = Math.max(
    item?.min_next_bid_amount ?? 0,
    numericCurrentBid,
    numericStartingBid
  )
  const minimumNextBid = Math.ceil((minimumNextBidBase + 10) / 10) * 10
  const defaultWheelBidAmount = minimumNextBid + 10
  const effectiveSelectedBidAmount =
    selectedBidAmount > 0 ? selectedBidAmount : defaultWheelBidAmount

  const wheelOptions = useMemo(() => {
    if (!item || isLiveAuctionItem) {
      return []
    }

    return Array.from({ length: optionCount }, (_, index) => {
      const amount = minimumNextBid + index * 10
      return {
        value: amount,
        label: formatCurrency(amount),
      }
    })
  }, [item, isLiveAuctionItem, minimumNextBid, optionCount])

  const openManualBidEntryDialog = () => {
    if (!item || isLiveAuctionItem) {
      return
    }

    setManualBidInputValue(String(effectiveSelectedBidAmount))
    setManualBidInputError(null)
    setIsManualBidDialogOpen(true)
  }

  const handleManualBidEntrySubmit = () => {
    if (!item || isLiveAuctionItem) {
      return
    }

    const numericInput = Number(manualBidInputValue.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(numericInput) || numericInput <= 0) {
      setManualBidInputError('Please enter a valid dollar amount.')
      return
    }

    const normalizedAmount = Math.round(numericInput)

    if (normalizedAmount < minimumNextBid) {
      setManualBidInputError(
        `Bid must be at least ${formatCurrency(minimumNextBid)}.`
      )
      return
    }

    if (normalizedAmount % 10 !== 0) {
      setManualBidInputError('Bid amount must be in $10 increments.')
      return
    }

    const requiredOptionCount =
      Math.floor((normalizedAmount - minimumNextBid) / 10) + 1
    if (requiredOptionCount > optionCount) {
      setOptionCount(requiredOptionCount + 40)
    }

    setSelectedBidAmount(normalizedAmount)
    setManualBidInputError(null)
    setIsManualBidDialogOpen(false)
  }

  const handleSlidePlaceBid = (value: number[]) => {
    if (isSubmittingBid || !item || !onPlaceBid) {
      return
    }
    setPlaceBidSlideValue(value)
  }

  const handleSlidePlaceBidCommit = (value: number[]) => {
    const percent = value[0] ?? 0
    if (percent >= 95 && !isSubmittingBid && item && onPlaceBid) {
      onPlaceBid(item.id, effectiveSelectedBidAmount)
    }

    setPlaceBidSlideValue([0])
  }

  const handleSlideMaxBid = (value: number[]) => {
    if (isSubmittingBid || !item || !onSetMaxBid) {
      return
    }
    setMaxBidSlideValue(value)
  }

  const handleSlideMaxBidCommit = (value: number[]) => {
    const percent = value[0] ?? 0
    if (percent >= 95 && !isSubmittingBid && item && onSetMaxBid) {
      onSetMaxBid(item.id, effectiveSelectedBidAmount)
    }

    setMaxBidSlideValue([0])
  }

  const handleSlideBuyNow = (value: number[]) => {
    if (
      isSubmittingBid ||
      !item?.buy_now_enabled ||
      !item?.buy_now_price ||
      !onBuyNow
    ) {
      return
    }
    setBuyNowSlideValue(value)
  }

  const handleSlideBuyNowCommit = (value: number[]) => {
    const percent = value[0] ?? 0
    if (
      percent >= 95 &&
      !isSubmittingBid &&
      item?.buy_now_enabled &&
      item?.buy_now_price &&
      onBuyNow
    ) {
      onBuyNow(item.id)
    }

    setBuyNowSlideValue([0])
  }

  const slideActionsDisabled =
    isSubmittingBid ||
    eventStatus !== 'active' ||
    isEventInFuture ||
    !isBiddingOpen

  const placeBidPercent = placeBidSlideValue[0] ?? 0
  const maxBidPercent = maxBidSlideValue[0] ?? 0
  const buyNowPercent = buyNowSlideValue[0] ?? 0

  const sliderKnobDiameterPx = 56
  const sliderKnobRadiusPx = sliderKnobDiameterPx / 2

  const getSliderCenterX = (percent: number) =>
    `calc(${sliderKnobRadiusPx}px + (100% - ${sliderKnobDiameterPx}px) * ${percent / 100})`

  const getSliderKnobLeft = (percent: number) =>
    `calc(${getSliderCenterX(percent)} - ${sliderKnobRadiusPx}px)`

  const getSliderFillWidth = (percent: number) => getSliderCenterX(percent)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className={cn(
            'max-h-[90vh] max-w-4xl overflow-y-auto p-0',
            showWinningState && 'border-4 border-green-600'
          )}
          style={{
            backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
          }}
        >
          {!isOpen ? null : isLoading ? (
            <div className='space-y-4 p-6'>
              <div
                className='relative aspect-video overflow-hidden rounded-lg'
                style={{
                  backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234) / 0.18)',
                }}
              >
                <div className='absolute inset-0 animate-pulse' />
                <div className='absolute inset-0 flex items-center justify-center'>
                  <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
                </div>
              </div>
              <div
                className='h-6 w-3/4 rounded animate-pulse'
                style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.18)' }}
              />
              <div
                className='h-4 w-1/2 rounded animate-pulse'
                style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.14)' }}
              />
            </div>
          ) : item ? (
            <div className='flex flex-col'>
              {/* Image Section */}
              {images.length > 0 && (
                <div
                  className='relative'
                  style={{
                    backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
                  }}
                >
                  {/* Main Image */}
                  <div className='relative aspect-video overflow-hidden'>
                    {isPrimaryImageLoading && (
                      <div
                        className='absolute inset-0 z-10 flex items-center justify-center animate-pulse'
                        style={{
                          backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234) / 0.28)',
                        }}
                      >
                        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
                      </div>
                    )}
                    <img
                      src={activeImageDisplaySrc}
                      srcSet={activeImageSrcSet}
                      sizes='(max-width: 768px) 100vw, 960px'
                      alt={item.title}
                      className={cn(
                        'h-full w-full cursor-zoom-in object-contain transition-opacity duration-300',
                        isPrimaryImageLoading ? 'opacity-0' : 'opacity-100'
                      )}
                      loading='eager'
                      fetchPriority='high'
                      decoding='async'
                      onLoad={() => {
                        if (!activeImageSrc) return
                        setLoadedImageSources((prev) => ({
                          ...prev,
                          [activeImageSrc]: true,
                        }))
                      }}
                      onError={() => {
                        if (!activeImageSrc) return
                        setLoadedImageSources((prev) => ({
                          ...prev,
                          [activeImageSrc]: true,
                        }))
                      }}
                      onClick={() => {
                        const src = activeImageSrc
                        openFullscreenImage(src, item.title)
                      }}
                    />

                    {/* Image navigation buttons */}
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className='absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70'
                          aria-label='Previous image'
                        >
                          <ChevronLeft className='h-6 w-6' />
                        </button>
                        <button
                          onClick={handleNextImage}
                          className='absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70'
                          aria-label='Next image'
                        >
                          <ChevronRight className='h-6 w-6' />
                        </button>

                        {/* Image counter */}
                        <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm text-white'>
                          {selectedImageIndex + 1} / {images.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Image Thumbnails */}
                  {images.length > 1 && (
                    <div className='flex gap-2 overflow-x-auto p-4'>
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
                            className='h-16 w-16 object-cover'
                            loading='lazy'
                            decoding='async'
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Promotion badge */}
                  {item.promotion_badge && (
                    <div className='absolute top-4 left-4 rounded-full bg-amber-500/90 px-3 py-1 text-sm font-bold text-white shadow-lg'>
                      {item.promotion_badge}
                    </div>
                  )}

                  {showWinningState && (
                    <div
                      className={cn(
                        'animate-winning-badge-glow absolute left-4 rounded-full bg-green-600/90 px-3 py-1 text-sm font-bold text-white shadow-lg',
                        item.promotion_badge ? 'top-14' : 'top-4'
                      )}
                    >
                      Currently Winning
                    </div>
                  )}

                  {/* Auction Type Badge */}
                  <div
                    className={cn(
                      'absolute top-4 right-16 rounded-full px-3 py-1 text-sm font-medium capitalize',
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
              <div className='space-y-6 p-6'>
                {/* Header with Watch Button */}
                <DialogHeader>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1'>
                      <DialogTitle
                        className='mb-2 text-2xl font-bold'
                        style={{
                          color: 'var(--event-text-on-background, #000000)',
                        }}
                      >
                        {item.title}
                      </DialogTitle>
                      <DialogDescription
                        className='text-base'
                        style={{
                          color: 'var(--event-text-muted-on-background, #6B7280)',
                        }}
                      >
                        Item #{item.bid_number}
                      </DialogDescription>
                    </div>
                    <WatchListButton
                      eventId={eventId}
                      itemId={item.id}
                      isWatching={isWatching}
                      onToggle={onWatchToggle}
                      variant='icon'
                    />
                  </div>
                </DialogHeader>

                {/* Promotion notice */}
                {item.promotion_notice && (
                  <div
                    className='rounded-lg p-3 text-sm'
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
                  className='rounded-lg p-4'
                  style={{
                    backgroundColor: bidCardBackgroundColor,
                  }}
                >
                  {displayBid !== null && (
                    <div className='mb-4 flex items-baseline justify-between'>
                      <span
                        className='text-sm font-medium'
                        style={{ color: bidCardMutedTextColor }}
                      >
                        {currentBidDisplayLabel}
                      </span>
                      <span
                        className='text-3xl font-bold'
                        style={{ color: bidCardTextColor }}
                      >
                        {formatCurrency(displayBid)}
                      </span>
                    </div>
                  )}

                  {/* Bid count */}
                  {bidCount > 0 && (
                    <div
                      className='mb-4 flex items-center gap-2 text-sm'
                      style={{ color: bidCardMutedTextColor }}
                    >
                      <Users className='h-4 w-4' />
                      {bidCount} bid{bidCount !== 1 ? 's' : ''} placed
                    </div>
                  )}

                  {currentUserMaxBid !== null && currentUserMaxBid > 0 && (
                    <div
                      className='mb-4 text-sm font-medium'
                      style={{ color: bidCardMutedTextColor }}
                    >
                      Your max bid is set to {formatCurrency(currentUserMaxBid)}
                    </div>
                  )}

                  {/* Bidding Controls */}
                  {!isLiveAuctionItem ? (
                    <div className='space-y-3'>
                      <div
                        className='relative h-[60px] rounded-xl border px-2 py-0'
                        style={{
                          borderColor:
                            'rgb(var(--event-primary, 59, 130, 246) / 0.45)',
                          backgroundColor:
                            'rgb(var(--event-background, 255, 255, 255))',
                        }}
                        role='button'
                        tabIndex={0}
                        onClick={openManualBidEntryDialog}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openManualBidEntryDialog()
                          }
                        }}
                        aria-label='Bid amount wheel. Tap to type bid amount.'
                      >
                        <WheelPickerWrapper className='flex h-[112px] items-center justify-center'>
                          <WheelPicker
                            value={effectiveSelectedBidAmount}
                            onValueChange={(value) => {
                              const nextValue = Number(value)
                              setSelectedBidAmount(nextValue)
                              const selectedIndex = Math.floor(
                                (nextValue - minimumNextBid) / 10
                              )
                              if (optionCount - selectedIndex <= 5) {
                                setOptionCount((prev) => prev + 40)
                              }
                            }}
                            options={wheelOptions}
                            visibleCount={7}
                            dragSensitivity={1.1}
                            scrollSensitivity={1.0}
                            optionItemHeight={36}
                            classNames={{
                              optionItem:
                                'text-sm text-center text-[var(--event-text-muted-on-background,#6B7280)] opacity-65',
                              highlightWrapper:
                                'relative z-10 bg-[rgb(var(--event-background,255,255,255))] border-y border-[rgb(var(--event-primary,59,130,246)/0.45)]',
                              highlightItem:
                                'text-lg font-semibold text-[var(--event-text-on-background,#000000)]',
                            }}
                          />
                        </WheelPickerWrapper>
                        <div
                          className='pointer-events-none absolute top-0 right-0 left-0 h-2 rounded-t-xl'
                          style={{
                            background:
                              'linear-gradient(to bottom, rgb(var(--event-background, 255, 255, 255)) 0%, rgb(var(--event-background, 255, 255, 255) / 0) 100%)',
                          }}
                        />
                        <div
                          className='pointer-events-none absolute right-0 bottom-0 left-0 h-2 rounded-b-xl'
                          style={{
                            background:
                              'linear-gradient(to top, rgb(var(--event-background, 255, 255, 255)) 0%, rgb(var(--event-background, 255, 255, 255) / 0) 100%)',
                          }}
                        />
                      </div>

                      <div className='space-y-2'>
                        <div
                          className='relative h-14 overflow-hidden rounded-[28px]'
                          style={{
                            backgroundColor:
                              'rgb(var(--event-background, 255, 255, 255))',
                            border:
                              '1px solid rgb(var(--event-primary, 59, 130, 246) / 0.35)',
                          }}
                        >
                          <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
                          <div
                            className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)]'
                            style={{ width: getSliderFillWidth(placeBidPercent) }}
                          />
                          <div className='pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-base font-semibold text-[var(--event-text-on-background,#000000)]'>
                            Slide to Place Bid ·
                            <span className='ml-2'>
                              {formatCurrency(effectiveSelectedBidAmount)}
                            </span>
                          </div>
                          <div
                            className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--event-primary,59,130,246))] text-white shadow-md'
                            style={{
                              left: getSliderKnobLeft(placeBidPercent),
                            }}
                          >
                            <ArrowRight className='h-6 w-6' />
                          </div>
                          <Slider
                            value={placeBidSlideValue}
                            onValueChange={handleSlidePlaceBid}
                            onValueCommit={handleSlidePlaceBidCommit}
                            min={0}
                            max={100}
                            step={1}
                            className='absolute inset-0 z-20 w-full opacity-0'
                            aria-label='Slide to place bid'
                            disabled={slideActionsDisabled}
                          />
                        </div>

                        <div
                          className='relative h-14 overflow-hidden rounded-[28px]'
                          style={{
                            backgroundColor:
                              'rgb(var(--event-background, 255, 255, 255))',
                            border:
                              '1px solid rgb(var(--event-primary, 59, 130, 246) / 0.35)',
                          }}
                        >
                          <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
                          <div
                            className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)]'
                            style={{ width: getSliderFillWidth(maxBidPercent) }}
                          />
                          <div className='pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-base font-semibold text-[var(--event-text-on-background,#000000)]'>
                            Slide to Set Max Bid ·
                            <span className='ml-2'>
                              {formatCurrency(effectiveSelectedBidAmount)}
                            </span>
                          </div>
                          <div
                            className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--event-primary,59,130,246))] text-white shadow-md'
                            style={{
                              left: getSliderKnobLeft(maxBidPercent),
                            }}
                          >
                            <TrendingUp className='h-6 w-6' />
                          </div>
                          <Slider
                            value={maxBidSlideValue}
                            onValueChange={handleSlideMaxBid}
                            onValueCommit={handleSlideMaxBidCommit}
                            min={0}
                            max={100}
                            step={1}
                            className='absolute inset-0 z-20 w-full opacity-0'
                            aria-label='Slide to set max bid'
                            disabled={slideActionsDisabled}
                          />
                        </div>

                        {item.buy_now_enabled && item.buy_now_price && (
                          <div
                            className='relative h-14 overflow-hidden rounded-[28px]'
                            style={{
                              backgroundColor:
                                'rgb(var(--event-background, 255, 255, 255))',
                              border:
                                '1px solid rgb(var(--event-primary, 59, 130, 246) / 0.35)',
                            }}
                          >
                            <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
                            <div
                              className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)]'
                              style={{ width: getSliderFillWidth(buyNowPercent) }}
                            />
                            <div className='pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-base font-semibold text-[var(--event-text-on-background,#000000)]'>
                              Slide to Buy Now ·
                              <span className='ml-2'>
                                {formatCurrency(item.buy_now_price)}
                              </span>
                            </div>
                            <div
                              className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--event-primary,59,130,246))] text-white shadow-md'
                              style={{
                                left: getSliderKnobLeft(buyNowPercent),
                              }}
                            >
                              <DollarSign className='h-6 w-6' />
                            </div>
                            <Slider
                              value={buyNowSlideValue}
                              onValueChange={handleSlideBuyNow}
                              onValueCommit={handleSlideBuyNowCommit}
                              min={0}
                              max={100}
                              step={1}
                              className='absolute inset-0 z-20 w-full opacity-0'
                              aria-label='Slide to buy now'
                              disabled={slideActionsDisabled}
                            />
                          </div>
                        )}
                      </div>

                      {(eventStatus !== 'active' ||
                        isEventInFuture ||
                        !isBiddingOpen) && (
                          <p
                            className='text-center text-sm font-medium'
                            style={{
                              color: 'var(--event-card-text-muted, #6B7280)',
                            }}
                          >
                            {isEventInFuture
                              ? 'Event Not Started'
                              : eventStatus === 'closed' || !isBiddingOpen
                                ? 'Bidding Closed'
                                : 'Event Not Active'}
                          </p>
                        )}
                    </div>
                  ) : (
                    <p
                      className='text-center text-sm font-medium'
                      style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
                    >
                      Live auction coming up!
                    </p>
                  )}
                </div>

                {/* Description */}
                {item.description && (
                  <div>
                    <h3
                      className='mb-2 text-lg font-semibold'
                      style={{
                        color: 'var(--event-text-on-background, #000000)',
                      }}
                    >
                      Description
                    </h3>
                    <p
                      className='text-sm leading-relaxed whitespace-pre-wrap'
                      style={{
                        color: 'var(--event-text-muted-on-background, #6B7280)',
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                )}

                {/* Additional Details */}
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  {item.donated_by && (
                    <div>
                      <p
                        className='mb-1 font-medium'
                        style={{
                          color: 'var(--event-text-on-background, #000000)',
                        }}
                      >
                        Donated By
                      </p>
                      <p
                        style={{
                          color: 'var(--event-text-muted-on-background, #6B7280)',
                        }}
                      >
                        {item.donated_by}
                      </p>
                    </div>
                  )}

                  {item.quantity_available > 1 && (
                    <div>
                      <p
                        className='mb-1 font-medium'
                        style={{
                          color: 'var(--event-text-on-background, #000000)',
                        }}
                      >
                        Quantity Available
                      </p>
                      <p
                        style={{
                          color: 'var(--event-text-muted-on-background, #6B7280)',
                        }}
                      >
                        {item.quantity_available}
                      </p>
                    </div>
                  )}

                  {item.item_webpage && (
                    <div>
                      <p
                        className='mb-1 font-medium'
                        style={{
                          color: 'var(--event-text-on-background, #000000)',
                        }}
                      >
                        More Info
                      </p>
                      <a
                        href={item.item_webpage}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 hover:underline'
                        style={{
                          color: 'rgb(var(--event-primary, 59, 130, 246))',
                        }}
                      >
                        View Item Webpage
                        <ExternalLink className='h-3 w-3' />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isError ? (
            <div className='flex items-center justify-center py-20'>
              <p className='text-muted-foreground'>
                Unable to load auction item details
              </p>
            </div>
          ) : (
            <div className='flex items-center justify-center py-20'>
              <p className='text-muted-foreground'>Auction item not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFullscreenImageOpen}
        onOpenChange={(open) => {
          setIsFullscreenImageOpen(open)
          if (!open) {
            setFullscreenImageSrc(null)
          }
        }}
      >
        <DialogContent
          className='h-[100vh] max-h-[100vh] w-[100vw] max-w-[100vw] border-0 bg-black/95 p-0'
        >
          {fullscreenImageSrc && (
            <div className='flex h-full w-full items-center justify-center p-4'>
              <img
                src={fullscreenImageSrc}
                alt={fullscreenImageAlt}
                className='max-h-full max-w-full object-contain'
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isManualBidDialogOpen}
        onOpenChange={(open) => {
          setIsManualBidDialogOpen(open)
          if (!open) {
            setManualBidInputError(null)
          }
        }}
      >
        <DialogContent
          className='max-w-sm p-6'
          style={{
            backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className='text-lg font-semibold'
              style={{ color: 'var(--event-text-on-background, #000000)' }}
            >
              Enter Bid Amount
            </DialogTitle>
            <DialogDescription
              className='text-sm'
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              Minimum {formatCurrency(minimumNextBid)} · increments of $10
            </DialogDescription>
          </DialogHeader>

          <form
            className='space-y-3'
            onSubmit={(event) => {
              event.preventDefault()
              handleManualBidEntrySubmit()
            }}
          >
            <Input
              className='placeholder:text-[var(--event-text-muted-on-background,#6B7280)]'
              type='number'
              inputMode='numeric'
              min={minimumNextBid}
              step={10}
              value={manualBidInputValue}
              onChange={(event) => {
                setManualBidInputValue(event.target.value)
                if (manualBidInputError) {
                  setManualBidInputError(null)
                }
              }}
              placeholder={String(minimumNextBid)}
              autoFocus
              aria-label='Bid amount input'
              style={{
                color: 'var(--event-text-on-background, #000000)',
                backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.55)',
              }}
            />

            {manualBidInputError && (
              <p className='text-sm' style={{ color: 'rgb(220, 38, 38)' }}>
                {manualBidInputError}
              </p>
            )}

            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsManualBidDialogOpen(false)}
                style={{
                  color: 'var(--event-text-on-background, #000000)',
                  backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.55)',
                }}
              >
                Cancel
              </Button>
              <Button type='submit'>Apply</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AuctionItemDetailModal
