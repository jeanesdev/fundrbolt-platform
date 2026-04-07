import { Badge } from '@/components/ui/badge'
import type { TimerData } from '@/services/auctioneerService'
import { Clock, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CountdownTimersProps {
  timer: TimerData
}

function getTimeRemaining(target: string): string {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return '0:00:00'

  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function statusBadge(status: string) {
  switch (status) {
    case 'in_progress':
      return <Badge variant='default'>In Progress</Badge>
    case 'open':
      return <Badge variant='default'>Open</Badge>
    case 'ended':
    case 'closed':
      return <Badge variant='secondary'>Ended</Badge>
    default:
      return <Badge variant='outline'>Not Started</Badge>
  }
}

export function CountdownTimers({ timer }: CountdownTimersProps) {
  const [, setTick] = useState(0)

  const hasTimers = timer
    ? timer.live_auction_start_datetime || timer.auction_close_datetime
    : false

  useEffect(() => {
    if (!hasTimers) return
    const interval = setInterval(() => setTick((t) => t + 1), 1_000)
    return () => clearInterval(interval)
  }, [hasTimers])

  if (!timer || !hasTimers) return null

  return (
    <div className='flex flex-wrap gap-4'>
      {timer.live_auction_start_datetime && (
        <div className='bg-muted flex min-w-0 flex-wrap items-center gap-2 rounded-lg px-4 py-2'>
          <Timer className='h-4 w-4 shrink-0' />
          <div className='min-w-0'>
            <div className='text-xs font-medium'>Live Auction</div>
            <div className='font-mono text-sm font-bold'>
              {timer.live_auction_status === 'not_started'
                ? getTimeRemaining(timer.live_auction_start_datetime)
                : '--:--:--'}
            </div>
          </div>
          {statusBadge(timer.live_auction_status)}
        </div>
      )}
      {timer.auction_close_datetime && (
        <div className='bg-muted flex min-w-0 flex-wrap items-center gap-2 rounded-lg px-4 py-2'>
          <Clock className='h-4 w-4 shrink-0' />
          <div className='min-w-0'>
            <div className='text-xs font-medium'>
              {timer.silent_auction_status === 'open'
                ? 'Silent Auction Closes In'
                : 'Silent Auction'}
            </div>
            <div className='font-mono text-sm font-bold'>
              {timer.silent_auction_status === 'open'
                ? getTimeRemaining(timer.auction_close_datetime)
                : '--:--:--'}
            </div>
          </div>
          {statusBadge(timer.silent_auction_status)}
        </div>
      )}
    </div>
  )
}
