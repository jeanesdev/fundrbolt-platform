import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { type RevenueGeneratorItemSummary } from '@/services/revenueGeneratorService'
import { Slider } from '@/components/ui/slider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Props {
  item: RevenueGeneratorItemSummary
  brandPrimary?: string
  onPurchase?: (itemId: string) => void
  isPurchasing?: boolean
}

export function RevenueGeneratorCard({
  item,
  brandPrimary,
  onPurchase,
  isPurchasing,
}: Props) {
  const primary = brandPrimary ?? '59, 130, 246'
  const [slideValue, setSlideValue] = useState<number[]>([0])
  const [showConfirm, setShowConfirm] = useState(false)
  const slidePercent = slideValue[0] ?? 0

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
    const pct = value[0] ?? 0
    if (pct >= 95 && !isPurchasing && onPurchase) {
      setShowConfirm(true)
    }
    setSlideValue([0])
  }

  return (
    <div
      className='animate-card-enter relative overflow-hidden rounded-2xl border'
      style={{
        borderColor: `rgba(${primary}, 0.2)`,
        backgroundColor: `rgba(${primary}, 0.04)`,
      }}
    >
      <span
        className='absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-xs font-bold tracking-wide text-white'
        style={{ backgroundColor: `rgb(${primary})` }}
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
                className='text-sm'
                style={{ color: 'var(--event-text-on-background, #6B7280)' }}
              >
                {item.description}
              </p>
            )}
          </div>
          <div className='shrink-0 text-right'>
            <span
              className='text-lg font-bold'
              style={{ color: `rgb(${primary})` }}
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
                    backgroundColor: `rgba(${primary}, 0.15)`,
                    color: `rgb(${primary})`,
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

        {item.is_open_for_entries && onPurchase && (
          <div
            className='relative mt-3 h-14 overflow-hidden rounded-[28px]'
            style={{
              backgroundColor: 'rgb(255, 255, 255)',
              border: `1px solid rgba(${primary}, 0.35)`,
              touchAction: 'none',
            }}
            onPointerLeave={() => setSlideValue([0])}
          >
            <div className='pointer-events-none absolute inset-0 z-0 bg-white' />
            <div
              className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)]'
              style={{ width: getFillWidth(slidePercent) }}
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
                backgroundColor: `rgb(${primary})`,
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
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm entry purchase</AlertDialogTitle>
            <AlertDialogDescription>
              Buy 1 entry for{' '}
              <strong>{item.name}</strong> for{' '}
              <strong>${Number(item.price_per_entry).toFixed(2)}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false)
                onPurchase?.(item.id)
              }}
              style={{ backgroundColor: `rgb(${primary})` }}
            >
              Buy Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
