/**
 * RosCountdownBadge — Sticky header badge showing countdown to the next
 * run-of-show item using a live 1-second interval.
 */
import { useEffect, useRef, useState } from 'react'
import type { RunOfShowItem } from '@/types/run-of-show'
import { CalendarClock } from 'lucide-react'

interface RosCountdownBadgeProps {
  nextItem: RunOfShowItem | null
}

function computeCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return '0s'
  const weeks = Math.floor(diff / 604_800_000)
  const days = Math.floor((diff % 604_800_000) / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)
  const parts: string[] = []
  if (weeks > 0) parts.push(`${weeks}w`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function RosCountdownBadge({ nextItem }: RosCountdownBadgeProps) {
  const [countdown, setCountdown] = useState<string>(() =>
    nextItem ? computeCountdown(nextItem.scheduled_time) : '0s'
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (!nextItem) {
      setCountdown('0s')
      return
    }

    setCountdown(computeCountdown(nextItem.scheduled_time))
    intervalRef.current = setInterval(() => {
      setCountdown(computeCountdown(nextItem.scheduled_time))
    }, 1_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [nextItem])

  if (!nextItem) {
    return (
      <div className='bg-muted/70 flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1 text-xs'>
        <CalendarClock className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
        <div className='min-w-0'>
          <div className='text-muted-foreground leading-none'>Next Up</div>
          <div className='truncate pt-0.5 leading-none font-semibold'>
            Complete
          </div>
        </div>
      </div>
    )
  }

  const isPast = new Date(nextItem.scheduled_time).getTime() < Date.now()

  const handleClick = () => {
    const el = document.getElementById('ros-card')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      className='bg-muted/70 hover:bg-muted hover:border-foreground/20 flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors'
      title='Scroll to Run of Show'
    >
      <CalendarClock className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
      <div className='min-w-0'>
        <div className='text-muted-foreground max-w-32 truncate leading-none'>
          {nextItem.title}
        </div>
        <div className='truncate pt-0.5 leading-none font-semibold tabular-nums'>
          {isPast ? 'now' : countdown}
        </div>
      </div>
    </button>
  )
}
