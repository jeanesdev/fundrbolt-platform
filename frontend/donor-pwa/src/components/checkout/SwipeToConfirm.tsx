/**
 * SwipeToConfirm — T016
 *
 * Reusable swipe-to-confirm slider extracted from BidConfirmSlide pattern.
 */
import { useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'

export interface SwipeToConfirmProps {
  label: string
  onComplete: () => void
  disabled?: boolean
  completed?: boolean
}

export function SwipeToConfirm({
  label,
  onComplete,
  disabled = false,
  completed = false,
}: SwipeToConfirmProps) {
  const [sliderValue, setSliderValue] = useState<number[]>([0])
  const [isConfirmed, setIsConfirmed] = useState(false)

  const slidePercent = sliderValue[0] ?? 0
  const isComplete = completed || slidePercent >= 95

  // Reset when external completed prop changes
  useEffect(() => {
    if (!completed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSliderValue([0])
      setIsConfirmed(false)
    }
  }, [completed])

  // Auto-confirm when slider reaches end
  useEffect(() => {
    if (isComplete && !isConfirmed && !completed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsConfirmed(true)
      setTimeout(() => {
        onComplete()
      }, 300)
    }
  }, [isComplete, isConfirmed, completed, onComplete])

  const handleSliderChange = (value: number[]) => {
    if (!isConfirmed && !disabled && !completed) {
      setSliderValue(value)
    }
  }

  const showGreen = isComplete || completed

  return (
    <div className='relative'>
      {/* Track background */}
      <div
        className={cn(
          'relative rounded-full p-1 transition-all duration-300',
          disabled && 'opacity-40',
          showGreen ? 'opacity-100' : 'opacity-90'
        )}
        style={{
          background: showGreen
            ? 'rgb(34, 197, 94)'
            : `linear-gradient(to right,
                rgb(var(--event-primary, 59, 130, 246)) 0%,
                rgb(var(--event-primary, 59, 130, 246)) ${slidePercent}%,
                rgb(var(--event-secondary, 147, 51, 234)) ${slidePercent}%,
                rgb(var(--event-secondary, 147, 51, 234)) 100%)`,
        }}
      >
        <div className='flex items-center justify-between px-4 py-3'>
          {/* Left arrow */}
          <div
            className={cn(
              'transition-opacity duration-300',
              slidePercent > 30 ? 'opacity-0' : 'opacity-100'
            )}
          >
            <ArrowRight className='h-5 w-5 text-white' />
          </div>

          {/* Center text */}
          <div className='text-sm font-semibold text-white'>
            {showGreen ? 'Confirmed!' : label}
          </div>

          {/* Right check */}
          <div
            className={cn(
              'transition-opacity duration-300',
              showGreen ? 'opacity-100' : 'opacity-0'
            )}
          >
            <Check className='h-5 w-5 text-white' />
          </div>
        </div>
      </div>

      {/* Invisible slider overlay */}
      {!disabled && !completed && (
        <div className='absolute inset-0 flex items-center'>
          <Slider
            value={sliderValue}
            onValueChange={handleSliderChange}
            min={0}
            max={100}
            step={1}
            className='w-full cursor-grab opacity-0 active:cursor-grabbing'
            aria-label={label}
            disabled={isConfirmed}
          />
        </div>
      )}
    </div>
  )
}

export default SwipeToConfirm
