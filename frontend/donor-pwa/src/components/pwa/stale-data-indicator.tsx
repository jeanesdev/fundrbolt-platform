import { useEffect, useState } from 'react'

export interface StaleDataIndicatorProps {
  /** Timestamp of the last successful data fetch */
  lastFetchedAt: Date | null
  /** Whether data should be considered stale */
  isStale: boolean
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

/**
 * Small inline indicator showing when cached data was last refreshed.
 * Only renders when `isStale` is true.
 */
export function StaleDataIndicator({
  lastFetchedAt,
  isStale,
}: StaleDataIndicatorProps) {
  const [, setTick] = useState(0)

  // Re-render every 30 seconds to keep relative time fresh
  useEffect(() => {
    if (!isStale || !lastFetchedAt) return

    const timer = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [isStale, lastFetchedAt])

  if (!isStale || !lastFetchedAt) return null

  return (
    <p className="text-xs font-medium text-amber-600" role="status">
      Data from {formatRelativeTime(lastFetchedAt)}
    </p>
  )
}
