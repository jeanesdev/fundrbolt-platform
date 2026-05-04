/**
 * RunOfShowSummaryCard — Compact run-of-show overview card for the event dashboard.
 * Shows items with time + title + completion status, and a link to the full page.
 */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { getRunOfShow } from '@/services/runOfShowService'
import { CalendarClock, CheckCircle2, Circle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RunOfShowSummaryCardProps {
  eventId: string
}

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

export function RunOfShowSummaryCard({ eventId }: RunOfShowSummaryCardProps) {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['ros', eventId],
    queryFn: () => getRunOfShow(eventId),
    staleTime: 30_000,
  })

  const sortedItems = [...(data?.items ?? [])].sort(
    (a, b) =>
      new Date(a.scheduled_time).getTime() -
      new Date(b.scheduled_time).getTime()
  )

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='flex items-center gap-2 text-base font-semibold'>
          <CalendarClock className='text-primary h-5 w-5' />
          Run of Show
          {data && data.total_count > 0 && (
            <span className='text-muted-foreground text-sm font-normal'>
              {data.completed_count}/{data.total_count} done
            </span>
          )}
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
          <Pencil className='mr-1 h-3 w-3' />
          Edit
        </Button>
      </CardHeader>
      <CardContent className='space-y-1'>
        {isLoading && (
          <p className='text-muted-foreground text-sm'>Loading...</p>
        )}
        {!isLoading && sortedItems.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            No program items yet. Click Edit to get started.
          </p>
        )}
        {sortedItems.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2 rounded px-1 py-0.5',
              item.is_complete && 'opacity-60'
            )}
          >
            {item.is_complete ? (
              <CheckCircle2 className='h-3.5 w-3.5 shrink-0 text-green-600' />
            ) : (
              <Circle className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
            )}
            <span className='text-muted-foreground w-14 shrink-0 text-xs tabular-nums'>
              {formatTime(item.scheduled_time)}
            </span>
            <span
              className={cn(
                'flex-1 truncate text-xs',
                item.is_complete && 'line-through'
              )}
            >
              {item.title}
            </span>
          </div>
        ))}
        {sortedItems.length > 8 && (
          <p className='text-muted-foreground text-xs'>
            +{sortedItems.length - 8} more items
          </p>
        )}
      </CardContent>
    </Card>
  )
}
