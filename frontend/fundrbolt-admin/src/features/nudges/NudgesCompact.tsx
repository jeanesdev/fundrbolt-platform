import { useState } from 'react'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NudgesPanel } from './NudgesPanel'
import { useNudges } from './useNudges'

interface NudgesCompactProps {
  eventId: string
}

export function NudgesCompact({ eventId }: NudgesCompactProps) {
  const { nudges, activeCount, isLoading } = useNudges(eventId)
  const [expanded, setExpanded] = useState(false)

  const minRank =
    nudges.length > 0 ? Math.min(...nudges.map((n) => n.rank)) : null

  const rankColors: Record<number, string> = {
    1: 'bg-red-500',
    2: 'bg-amber-500',
    3: 'bg-blue-500',
    4: 'bg-slate-400',
    5: 'bg-slate-300',
  }

  return (
    <div className='space-y-3'>
      <Card className='cursor-pointer' onClick={() => setExpanded((v) => !v)}>
        <CardContent className='flex items-center justify-between p-3'>
          <div className='flex items-center gap-2'>
            <Zap className='h-4 w-4 text-amber-500' />
            <span className='text-sm font-medium'>Revenue Nudges</span>
            {!isLoading && activeCount > 0 && (
              <>
                <Badge
                  className={`flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs text-white ${rankColors[minRank ?? 5] ?? 'bg-slate-400'}`}
                >
                  {activeCount}
                </Badge>
                {minRank && minRank <= 2 && (
                  <span
                    className={`h-2 w-2 animate-pulse rounded-full ${rankColors[minRank] ?? 'bg-amber-500'}`}
                  />
                )}
                <span className='text-muted-foreground text-xs'>
                  ⚡ Rank {minRank} alert
                </span>
              </>
            )}
            {!isLoading && activeCount === 0 && (
              <span className='text-xs text-green-600'>
                Event running smoothly 🎉
              </span>
            )}
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            aria-label={
              expanded ? 'Collapse revenue nudges' : 'Expand revenue nudges'
            }
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? (
              <ChevronUp className='h-4 w-4' />
            ) : (
              <ChevronDown className='h-4 w-4' />
            )}
          </Button>
        </CardContent>
      </Card>
      {expanded && <NudgesPanel eventId={eventId} />}
    </div>
  )
}
