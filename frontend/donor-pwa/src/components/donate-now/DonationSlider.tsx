import { Slider } from '@/components/ui/slider'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'
import { cn } from '@/lib/utils'
import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface DonationSliderProps {
  state: ReturnType<typeof useDonateNow>
}

export function DonationSlider({ state }: DonationSliderProps) {
  const { totalCents, isMonthly, setShowConfirm, isPending } = state
  const [sliderValue, setSliderValue] = useState<number[]>([0])
  const [isConfirmed, setIsConfirmed] = useState(false)

  const amountLabel = useMemo(() => {
    const dollars = `$${(totalCents / 100).toFixed(2)}`
    return isMonthly ? `${dollars} Monthly` : dollars
  }, [totalCents, isMonthly])

  useEffect(() => {
    setSliderValue([0])
    setIsConfirmed(false)
  }, [totalCents, isMonthly])

  useEffect(() => {
    const current = sliderValue[0] ?? 0
    if (current >= 95 && !isConfirmed) {
      setIsConfirmed(true)
      setTimeout(() => {
        setShowConfirm(true)
        setSliderValue([0])
        setIsConfirmed(false)
      }, 250)
    }
  }, [sliderValue, isConfirmed, setShowConfirm])

  if (!totalCents || totalCents <= 0) return null

  const slidePercent = sliderValue[0] ?? 0

  return (
    <section
      className='space-y-4 rounded-xl border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.22)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      <h3 className='text-lg font-semibold'>Swipe to Donate</h3>
      <div className='text-sm font-medium' style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}>
        {amountLabel}
      </div>

      <div className='relative'>
        <div
          className={cn('relative rounded-full p-1 transition-all duration-300', isConfirmed ? 'opacity-100' : 'opacity-90')}
          style={{
            background: isConfirmed
              ? 'rgb(34, 197, 94)'
              : `linear-gradient(to right,
                  rgb(var(--event-primary, 59, 130, 246)) 0%,
                  rgb(var(--event-primary, 59, 130, 246)) ${slidePercent}%,
                  rgb(var(--event-secondary, 147, 51, 234)) ${slidePercent}%,
                  rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
          }}
        >
          <div className='flex items-center justify-between px-4 py-3'>
            <div className={cn('transition-opacity duration-300', slidePercent > 30 ? 'opacity-0' : 'opacity-100')}>
              <ArrowRight className='h-5 w-5' style={{ color: 'var(--event-text-on-secondary, #FFFFFF)' }} />
            </div>

            <div
              className='text-sm font-semibold'
              style={{
                color: isConfirmed
                  ? 'var(--event-text-on-primary, #FFFFFF)'
                  : slidePercent >= 50
                    ? 'var(--event-text-on-primary, #FFFFFF)'
                    : 'var(--event-text-on-secondary, #FFFFFF)',
              }}
            >
              {isConfirmed ? 'Confirmed!' : 'Slide to Confirm'}
            </div>

            <div className={cn('transition-opacity duration-300', isConfirmed ? 'opacity-100' : 'opacity-0')}>
              <Check className='h-5 w-5' style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }} />
            </div>
          </div>
        </div>

        <div className='absolute inset-0 flex items-center'>
          <Slider
            value={sliderValue}
            onValueChange={(value) => {
              if (!isConfirmed && !isPending) {
                setSliderValue(value)
              }
            }}
            min={0}
            max={100}
            step={1}
            className='w-full cursor-grab opacity-0 active:cursor-grabbing'
            aria-label='Slide to confirm donation'
            disabled={isConfirmed || isPending}
          />
        </div>
      </div>
    </section>
  )
}
