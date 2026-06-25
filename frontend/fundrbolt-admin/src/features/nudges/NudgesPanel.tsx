import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { NudgeCard } from './NudgeCard'
import { useNudges } from './useNudges'

interface NudgesPanelProps {
  eventId: string
  disableNotifyLinks?: boolean
}

const INITIAL_VISIBLE = 5

export function NudgesPanel({
  eventId,
  disableNotifyLinks = false,
}: NudgesPanelProps) {
  const {
    nudges,
    activeCount,
    isLoading,
    isError,
    dismiss,
    clearAll,
    refresh,
  } = useNudges(eventId)
  const [expanded, setExpanded] = useState(false)

  const visibleNudges = expanded ? nudges : nudges.slice(0, INITIAL_VISIBLE)
  const hiddenCount = nudges.length - INITIAL_VISIBLE

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Zap className='h-5 w-5 text-amber-500' />
            <CardTitle className='text-base'>Revenue Nudges</CardTitle>
            {activeCount > 0 && (
              <Badge
                variant='destructive'
                className='flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs'
              >
                {activeCount}
              </Badge>
            )}
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7'
              aria-label='Refresh nudges'
              title='Refresh nudges'
              onClick={() => refresh()}
            >
              <RefreshCw className='h-3.5 w-3.5' />
            </Button>
            {nudges.length > 0 && (
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground h-7 text-xs'
                aria-label='Clear all dismissals'
                title='Clear all dismissals'
                onClick={() => clearAll()}
              >
                <Trash2 className='mr-1 h-3 w-3' />
                Reset all
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className='h-20 w-full rounded-lg' />
            ))}
          </>
        )}
        {isError && (
          <div className='text-muted-foreground py-4 text-center text-sm'>
            Could not load nudges —{' '}
            <button
              className='text-primary underline'
              onClick={() => refresh()}
            >
              click to retry
            </button>
          </div>
        )}
        {!isLoading && !isError && nudges.length === 0 && (
          <div className='py-6 text-center'>
            <div className='text-2xl'>🎉</div>
            <p className='text-muted-foreground mt-1 text-sm'>
              No active nudges — your event is running smoothly!
            </p>
          </div>
        )}
        {!isLoading &&
          !isError &&
          visibleNudges.map((nudge) => (
            <NudgeCard
              key={nudge.nudge_key}
              nudge={nudge}
              onDismiss={() => dismiss(nudge.nudge_key, 'dismissed')}
              onAction={() => dismiss(nudge.nudge_key, 'actioned')}
              disableNotifyLinks={disableNotifyLinks}
            />
          ))}
        {!expanded && hiddenCount > 0 && (
          <Button
            variant='outline'
            size='sm'
            className='w-full'
            onClick={() => setExpanded(true)}
          >
            Show {hiddenCount} more nudge{hiddenCount !== 1 ? 's' : ''}
          </Button>
        )}
        {expanded && nudges.length > INITIAL_VISIBLE && (
          <Button
            variant='ghost'
            size='sm'
            className='w-full'
            onClick={() => setExpanded(false)}
          >
            Show less
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
