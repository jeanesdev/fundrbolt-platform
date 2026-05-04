/**
 * RosNextItemCountdownCard — Card showing a live countdown to the next
 * run-of-show item using a 1-second interval.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { getRunOfShow } from '@/services/runOfShowService'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RosNextItemCountdownCardProps {
  eventId: string
}

function computeCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return '00:00:00'
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1_000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function RosNextItemCountdownCard({
  eventId,
}: RosNextItemCountdownCardProps) {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState('--:--:--')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data } = useQuery({
    queryKey: ['ros', eventId],
    queryFn: () => getRunOfShow(eventId),
    staleTime: 30_000,
  })

  const nextItem = data?.next_item ?? null

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (!nextItem) {
      setCountdown('--:--:--')
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

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='flex items-center gap-2 text-base font-semibold'>
          <CalendarClock className='text-primary h-5 w-5' />
          Next Program Item
        </CardTitle>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            navigate({
              to: '/events/$eventId/run-of-show',
              params: { eventId },
            })
          }
        >
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {!nextItem && (
          <p className='text-muted-foreground text-sm'>No upcoming items.</p>
        )}
        {nextItem && (
          <div className='space-y-1'>
            <p className='truncate text-sm font-medium'>{nextItem.title}</p>
            <p className='font-mono text-3xl font-bold tabular-nums'>
              {countdown}
            </p>
            <p className='text-muted-foreground text-xs'>
              Scheduled:{' '}
              {new Date(nextItem.scheduled_time).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
