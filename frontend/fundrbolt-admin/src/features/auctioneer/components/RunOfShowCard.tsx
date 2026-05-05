/**
 * RunOfShowCard — Auctioneer-facing run-of-show card showing program items
 * with live completion toggles.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  auctioneerMarkComplete,
  auctioneerMarkIncomplete,
  getAuctioneerRunOfShow,
} from '@/services/runOfShowService'
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RunOfShowCardProps {
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

export function RunOfShowCard({ eventId }: RunOfShowCardProps) {
  const [isOpen, setIsOpen] = useState(true)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['auctioneer-ros', eventId],
    queryFn: () => getAuctioneerRunOfShow(eventId),
    refetchInterval: 30_000,
  })

  const completeMutation = useMutation({
    mutationFn: ({
      itemId,
      isComplete,
    }: {
      itemId: string
      isComplete: boolean
    }) =>
      isComplete
        ? auctioneerMarkComplete(eventId, itemId)
        : auctioneerMarkIncomplete(eventId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['auctioneer-ros', eventId],
      })
    },
    onError: () => toast.error('Failed to update item status'),
  })

  const sortedItems = [...(data?.items ?? [])].sort(
    (a, b) =>
      new Date(a.scheduled_time).getTime() -
      new Date(b.scheduled_time).getTime()
  )

  return (
    <Card id='ros-card'>
      <CardHeader
        className='cursor-pointer pb-2 select-none'
        onClick={() => setIsOpen((v) => !v)}
      >
        <CardTitle className='flex items-center gap-2 text-base font-semibold'>
          {isOpen ? (
            <ChevronDown className='text-muted-foreground h-4 w-4 shrink-0' />
          ) : (
            <ChevronRight className='text-muted-foreground h-4 w-4 shrink-0' />
          )}
          <CalendarClock className='text-primary h-5 w-5' />
          Run of Show
          {data && data.total_count > 0 && (
            <span className='text-muted-foreground text-sm font-normal'>
              ({data.completed_count}/{data.total_count})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className='space-y-1'>
          {isLoading && (
            <p className='text-muted-foreground text-sm'>Loading...</p>
          )}
          {!isLoading && sortedItems.length === 0 && (
            <p className='text-muted-foreground text-sm'>
              No items in the program.
            </p>
          )}
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors',
                item.is_complete && 'opacity-60'
              )}
            >
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className={cn(
                  'h-7 w-7 shrink-0 rounded-full',
                  item.is_complete
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                onClick={() =>
                  completeMutation.mutate({
                    itemId: item.id,
                    isComplete: !item.is_complete,
                  })
                }
                title={item.is_complete ? 'Mark incomplete' : 'Mark complete'}
              >
                {item.is_complete ? (
                  <Check className='h-4 w-4' />
                ) : (
                  <Circle className='h-4 w-4' />
                )}
              </Button>
              <span className='text-muted-foreground w-16 shrink-0 text-xs tabular-nums'>
                {formatTime(item.scheduled_time)}
              </span>
              <div className='min-w-0 flex-1'>
                <span
                  className={cn('text-sm', item.is_complete && 'line-through')}
                >
                  {item.title}
                </span>
                {item.description && (
                  <p className='text-muted-foreground mt-0.5 text-xs leading-tight'>
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
