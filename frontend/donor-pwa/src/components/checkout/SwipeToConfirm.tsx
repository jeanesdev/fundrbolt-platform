/**
 * SwipeToConfirm — donate-page style swipe slider.
 *
 * White pill with a primary-colored circular knob and a green fill that grows
 * from the left as the user drags. Matches the "Slide to Donate" aesthetic.
 */
import { useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Slider } from '@/components/ui/slider'

export interface SwipeToConfirmProps {
  label: string
  onComplete: () => void
  disabled?: boolean
  completed?: boolean
}

const KNOB_PX = 56
const KNOB_RADIUS = KNOB_PX / 2

function knobLeft(pct: number): string {
  return `calc(${KNOB_RADIUS}px + (100% - ${KNOB_PX}px) * ${pct / 100} - ${KNOB_RADIUS}px)`
}

function fillWidth(pct: number): string {
  return `calc(${KNOB_RADIUS}px + (100% - ${KNOB_PX}px) * ${pct / 100})`
}

export function SwipeToConfirm({
  label,
  onComplete,
  disabled = false,
  completed = false,
}: SwipeToConfirmProps) {
  const [value, setValue] = useState<number[]>([0])
  const [locked, setLocked] = useState(false)

  const pct = value[0] ?? 0
  const showGreen = completed || locked

  // Reset when external completed resets
  useEffect(() => {
    if (!completed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue([0])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocked(false)
    }
  }, [completed])

  // Trigger on reach
  useEffect(() => {
    if (pct >= 95 && !locked && !completed && !disabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocked(true)
      setTimeout(onComplete, 300)
    }
  }, [pct, locked, completed, disabled, onComplete])

  const displayPct = showGreen ? 100 : pct

  return (
    <div
      className='relative h-14 overflow-hidden rounded-[28px]'
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      {/* White base */}
      <div className='pointer-events-none absolute inset-0 z-0 bg-white' />

      {/* Green fill */}
      <div
        className='pointer-events-none absolute top-0 bottom-0 left-0 z-[1] rounded-l-[28px] bg-[rgb(34_197_94)] transition-[width] duration-150'
        style={{ width: fillWidth(displayPct) }}
      />

      {/* Center label */}
      <div className='pointer-events-none absolute inset-y-0 right-14 left-14 z-[2] flex items-center justify-center text-sm font-semibold text-gray-800'>
        {showGreen ? (
          <span className='flex items-center gap-1.5 text-white'>
            <Check className='h-4 w-4' />
            Confirmed!
          </span>
        ) : (
          label
        )}
      </div>

      {/* Knob */}
      <div
        className='pointer-events-none absolute top-0 z-[3] flex h-14 w-14 items-center justify-center rounded-full shadow-md transition-[left] duration-150'
        style={{
          left: knobLeft(displayPct),
          backgroundColor: showGreen
            ? 'rgb(34, 197, 94)'
            : 'rgb(var(--event-primary, 59, 130, 246))',
          color: 'white',
        }}
      >
        {showGreen ? (
          <Check className='h-6 w-6' />
        ) : (
          <ArrowRight className='h-6 w-6' />
        )}
      </div>

      {/* Invisible slider overlay */}
      {!disabled && !completed && !locked && (
        <Slider
          value={value}
          onValueChange={(v) => setValue(v)}
          onValueCommit={() => {
            if (!locked) setValue([0])
          }}
          min={0}
          max={100}
          step={1}
          className='absolute inset-0 z-20 w-full cursor-grab opacity-0 active:cursor-grabbing'
          aria-label={label}
        />
      )}
    </div>
  )
}

export default SwipeToConfirm
