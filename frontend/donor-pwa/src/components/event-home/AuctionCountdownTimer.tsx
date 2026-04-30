/**
 * AuctionCountdownTimer – displays a live countdown to the silent auction close.
 *
 * Uses the debug spoof store's effective time so the timer honours spoofed clocks.
 *
 * Visual states:
 *  - > 1 hour remaining  → small green badge with HH:MM:SS
 *  - 15 min – 1 hour     → larger amber/yellow badge (more prominent)
 *  - < 15 minutes        → large red flashing badge
 *  - Closed              → static "Auction Closed" badge
 */
import { useEffect, useState } from 'react'
import { Timer, TimerOff } from 'lucide-react'
import { useDebugSpoofStore } from '../../stores/debug-spoof-store'

interface AuctionCountdownTimerProps {
  /** ISO-8601 date-time string for when the silent auction closes */
  closeDateTime: string
  className?: string
}

function formatTimeRemaining(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

export function AuctionCountdownTimer({
  closeDateTime,
  className = '',
}: AuctionCountdownTimerProps) {
  const getEffectiveNowMs = useDebugSpoofStore((s) => s.getEffectiveNowMs)
  const closeTimeMs = new Date(closeDateTime).getTime()

  const [tick, setTick] = useState(0)

  const secondsRemaining = Math.max(
    0,
    Math.floor((closeTimeMs - getEffectiveNowMs()) / 1000)
  )

  useEffect(() => {
    if (secondsRemaining <= 0) return

    const interval = setInterval(() => {
      const remaining = Math.floor((closeTimeMs - getEffectiveNowMs()) / 1000)
      if (remaining <= 0) {
        setTick((value) => value + 1)
        clearInterval(interval)
      } else {
        setTick((value) => value + 1)
      }
    }, 1_000)

    return () => clearInterval(interval)
  }, [closeTimeMs, getEffectiveNowMs, secondsRemaining])

  void tick

  const isClosed = secondsRemaining <= 0
  const isFlashing = !isClosed && secondsRemaining <= 900 // ≤ 15 min
  const isProminent = !isClosed && !isFlashing && secondsRemaining <= 3600 // ≤ 1 hour

  if (isClosed) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${className}`}
        style={{
          backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
          color: 'var(--event-text-muted-on-background, #6B7280)',
        }}
      >
        <TimerOff className='h-4 w-4' />
        Auction Closed
      </div>
    )
  }

  // ── Flashing: last 15 minutes ──
  if (isFlashing) {
    return (
      <div
        className={`animate-auction-flash flex items-center justify-center gap-2 rounded-lg border-2 border-red-500 px-5 py-3 text-base font-extrabold tabular-nums ${className}`}
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#DC2626',
        }}
      >
        <Timer className='h-5 w-5' />
        <span>Auction closes in {formatTimeRemaining(secondsRemaining)}</span>
      </div>
    )
  }

  // ── Prominent: last hour ──
  if (isProminent) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold tabular-nums ${className}`}
        style={{
          backgroundColor: 'rgba(245, 158, 11, 0.18)',
          color: '#B45309',
        }}
      >
        <Timer className='h-4.5 w-4.5' />
        <span>Auction closes in {formatTimeRemaining(secondsRemaining)}</span>
      </div>
    )
  }

  // ── Normal: > 1 hour remaining ──
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums ${className}`}
      style={{
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: '#16A34A',
      }}
    >
      <Timer className='h-3.5 w-3.5' />
      <span>Auction closes in {formatTimeRemaining(secondsRemaining)}</span>
    </div>
  )
}
