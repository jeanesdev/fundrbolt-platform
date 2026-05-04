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
  if (diff <= 0) return '00:00:00'
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function RosCountdownBadge({ nextItem }: RosCountdownBadgeProps) {
  const [countdown, setCountdown] = useState<string>(() =>
    nextItem ? computeCountdown(nextItem.scheduled_time) : '00:00:00'
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (!nextItem) {
      setCountdown('00:00:00')
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
      <div className='flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200'>
        <CalendarClock className='h-3.5 w-3.5' />
        Program Complete
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
      className='flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800'
      title='Scroll to Run of Show'
    >
      <CalendarClock className='h-3.5 w-3.5 shrink-0' />
      <span className='hidden sm:inline'>Next:</span>{' '}
      <span className='max-w-32 truncate'>{nextItem.title}</span>{' '}
      <span className='tabular-nums'>{isPast ? 'now' : `in ${countdown}`}</span>
    </button>
  )
}
