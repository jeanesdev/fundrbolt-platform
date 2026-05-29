import { BidConfirmSlide } from '@/components/auction/BidConfirmSlide'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { type RevenueGeneratorItemSummary } from '@/services/revenueGeneratorService'
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker'
import '@ncdai/react-wheel-picker/style.css'
import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'

interface Props {
  item: RevenueGeneratorItemSummary
  brandPrimary?: string
  onPurchase?: (itemId: string, quantity?: number) => void
  isPurchasing?: boolean
}

export function RevenueGeneratorCard({
  item,
  onPurchase,
  isPurchasing,
}: Props) {
  const [slideValue, setSlideValue] = useState<number[]>([0])
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [reviewingPurchase, setReviewingPurchase] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const slidePercent = slideValue[0] ?? 0
  const remainingPerPersonEntries =
    item.max_entries_per_person != null
      ? Math.max(item.max_entries_per_person - item.my_entry_count, 0)
      : null
  const hasReachedPerPersonLimit = remainingPerPersonEntries === 0
  const maxSelectableEntries = Math.max(
    1,
    Math.min(remainingPerPersonEntries ?? 10, 25)
  )
  const canChooseMultipleEntries = maxSelectableEntries > 1
  const wheelOptions = useMemo(
    () =>
      Array.from({ length: maxSelectableEntries }, (_, index) => {
        const quantity = index + 1
        return {
          value: quantity,
          label: `${quantity}`,
        }
      }),
    [maxSelectableEntries]
  )
  const purchaseTotal = Number(item.price_per_entry) * selectedQuantity

  const knobDiameterPx = 56
  const knobRadiusPx = knobDiameterPx / 2
  const getSliderCenterX = (pct: number) =>
    `calc(${knobRadiusPx}px + (100% - ${knobDiameterPx}px) * ${pct / 100})`
  const getKnobLeft = (pct: number) =>
    `calc(${getSliderCenterX(pct)} - ${knobRadiusPx}px)`
  const getFillWidth = (pct: number) => getSliderCenterX(pct)

  const handleSlide = (value: number[]) => {
    if (isPurchasing || !onPurchase) return
    setSlideValue(value)
  }

  const handleSlideCommit = (value: number[]) => {
    setIsDragging(false)
    const pct = value[0] ?? 0
    if (pct >= 95 && !isPurchasing && onPurchase) {
      setSelectedQuantity(1)
      setShowPurchaseModal(true)
    }
    setSlideValue([0])
  }

  return (
    <div
      className='animate-card-enter relative overflow-hidden rounded-2xl border'
      style={{
        borderColor: 'rgba(var(--event-primary, 59, 130, 246), 0.2)',
        backgroundColor: 'rgba(var(--event-primary, 59, 130, 246), 0.04)',
      }}
    >
      <span
        className='absolute top-0 right-0 rounded-bl-lg px-2 py-0.5 text-xs font-bold tracking-wide text-white'
        style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
      >
        PLAY
      </span>
      <div className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 space-y-1'>
            <h3
              className='font-semibold'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              {item.name}
            </h3>
            {item.description && (
              <p
                className='text-xs leading-relaxed'
                style={{ color: 'var(--event-text-on-background, #9CA3AF)' }}
              >
                {item.description}
              </p>
            )}
          </div>
          <div className='shrink-0 text-right'>
            <span
              className='text-lg font-bold'
              style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
            >
              ${Number(item.price_per_entry).toFixed(2)}
            </span>
            <p
              className='text-xs'
              style={{ color: 'var(--event-text-on-background, #6B7280)' }}
            >
              per entry
            </p>
          </div>
        </div>

        <div className='mt-3 flex items-center gap-4'>
          <div>
            <span
              className='text-sm font-medium'
              style={{ color: 'var(--event-text-on-background, #374151)' }}
            >
              {item.my_entry_count}{' '}
              {item.my_entry_count === 1 ? 'entry' : 'entries'} (mine)
            </span>
            {item.max_entries_per_person != null && (
              <p
                className='text-xs'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                Max {item.max_entries_per_person} per person
              </p>
            )}
          </div>
          {item.current_winner_name && (
            <div>
              <span
                className='text-xs'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                🏆 {item.current_winner_name}
              </span>
            </div>
          )}
          <div className='ml-auto'>
            <span
              className='rounded-full px-2 py-0.5 text-xs font-medium'
              style={
                item.is_open_for_entries
                  ? {
                    backgroundColor:
                      'rgba(var(--event-primary, 59, 130, 246), 0.15)',
                    color: 'rgb(var(--event-primary, 59, 130, 246))',
                  }
                  : {
                    backgroundColor: 'rgba(107, 114, 128, 0.1)',
                    color: 'rgb(107, 114, 128)',
                  }
              }
            >
              {item.is_open_for_entries ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {item.is_open_for_entries &&
          onPurchase &&
          !hasReachedPerPersonLimit && (
            <div
              className='relative mt-3 h-14 overflow-hidden rounded-[28px]'
              style={{
                backgroundColor: 'rgb(255, 255, 255)',
                border:
                  '1px solid rgba(var(--event-primary, 59, 130, 246), 0.35)',
                touchAction: 'none',
              }}
              onPointerDown={() => setIsDragging(true)}
              onPointerLeave={() => {
                if (!isDragging) setSlideValue([0])
              }}
            >
              <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
              <div
                className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px]'
                style={{
                  width: getFillWidth(slidePercent),
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                }}
              />
              <div className='pointer-events-none absolute inset-y-0 right-14 left-14 z-[2] flex items-center justify-center text-xs font-semibold text-[var(--event-text-on-background,#000000)]'>
                {isPurchasing ? (
                  <span>Processing…</span>
                ) : (
                  <>
                    <span>Slide to Buy ·</span>
                    <span className='ml-1'>
                      ${Number(item.price_per_entry).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
              <div
                className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md'
                style={{
                  left: getKnobLeft(slidePercent),
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                }}
              >
                <ArrowRight className='h-6 w-6' />
              </div>
              <Slider
                value={slideValue}
                onValueChange={handleSlide}
                onValueCommit={handleSlideCommit}
                min={0}
                max={100}
                step={1}
                className='absolute inset-0 z-20 w-full opacity-0'
                aria-label='Slide to buy entry'
                disabled={isPurchasing}
              />
            </div>
          )}

        {item.is_open_for_entries && hasReachedPerPersonLimit && (
          <p
            className='mt-3 rounded-md border px-3 py-2 text-sm font-medium'
            style={{
              borderColor: 'rgba(107, 114, 128, 0.35)',
              color: 'rgb(107, 114, 128)',
              backgroundColor: 'rgba(107, 114, 128, 0.08)',
            }}
          >
            Purchase limit reached for this item
          </p>
        )}
      </div>

      <Dialog
        open={showPurchaseModal}
        onOpenChange={(open) => {
          setShowPurchaseModal(open)
          if (!open) {
            setReviewingPurchase(false)
          }
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Review Purchase</DialogTitle>
            <DialogDescription>{item.name}</DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            {canChooseMultipleEntries ? (
              <div
                className='h-[132px] overflow-hidden rounded-xl border px-3 py-2'
                style={{
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.35)',
                  backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                }}
              >
                <WheelPickerWrapper className='flex h-full items-center justify-center'>
                  <WheelPicker
                    value={selectedQuantity}
                    onValueChange={(value) => {
                      setSelectedQuantity(Number(value))
                    }}
                    options={wheelOptions}
                    visibleCount={9}
                    dragSensitivity={1}
                    scrollSensitivity={1}
                    optionItemHeight={28}
                    classNames={{
                      optionItem: 'donate-now-wheel-option text-sm font-semibold',
                      highlightWrapper: 'bg-muted/85 border-y border-border/70',
                      highlightItem: 'text-base font-semibold text-foreground',
                    }}
                  />
                </WheelPickerWrapper>
              </div>
            ) : (
              <div
                className='rounded-xl border p-4 text-center text-base font-semibold'
                style={{
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.35)',
                  color: 'var(--event-text-on-background, #000000)',
                  backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
                }}
              >
                1 entry
              </div>
            )}

            <div className='space-y-1 text-center'>
              <p
                className='text-sm'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                {selectedQuantity} {selectedQuantity === 1 ? 'entry' : 'entries'} at ${Number(item.price_per_entry).toFixed(2)} each
              </p>
              <p
                className='text-xl font-bold'
                style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
              >
                Total: ${purchaseTotal.toFixed(2)}
              </p>
              {item.max_entries_per_person == null && (
                <p
                  className='text-xs'
                  style={{ color: 'var(--event-text-on-background, #6B7280)' }}
                >
                  Showing up to 10 entries per purchase.
                </p>
              )}
              {remainingPerPersonEntries != null && remainingPerPersonEntries > maxSelectableEntries && (
                <p
                  className='text-xs'
                  style={{ color: 'var(--event-text-on-background, #6B7280)' }}
                >
                  Showing up to {maxSelectableEntries} entries at a time.
                </p>
              )}
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowPurchaseModal(false)}
                disabled={isPurchasing}
              >
                Cancel
              </Button>
              <Button
                type='button'
                onClick={() => {
                  setShowPurchaseModal(false)
                  setReviewingPurchase(true)
                }}
                disabled={isPurchasing || !onPurchase}
              >
                Review Purchase
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BidConfirmSlide
        isOpen={reviewingPurchase}
        onClose={() => setReviewingPurchase(false)}
        onConfirm={() => {
          onPurchase?.(item.id, selectedQuantity)
          setReviewingPurchase(false)
        }}
        bidAmount={purchaseTotal}
        itemTitle={item.name}
        title='Review Purchase'
        summaryLabel='Purchase Amount'
        helperText='Slide again to confirm your purchase'
        cancelLabel='Back'
      />
    </div>
  )
}
