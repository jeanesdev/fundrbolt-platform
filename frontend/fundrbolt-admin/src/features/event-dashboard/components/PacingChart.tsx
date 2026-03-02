import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PacingStatus } from '@/services/event-dashboard'
import { formatPercent } from '../utils/formatters'

interface PacingChartProps {
  pacing: PacingStatus
}

export function PacingChart({ pacing }: PacingChartProps) {
  const progress = Math.max(0, Math.min(100, pacing.pacing_percent))
  const isOnTrack = pacing.status === 'on_track'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pacing</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='h-3 rounded-full bg-muted'>
          <div
            className='h-3 rounded-full bg-primary'
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium'>
            {isOnTrack ? 'On Track' : 'Needs Attention'}
          </span>
          <span className='text-lg font-semibold'>{formatPercent(pacing.pacing_percent, 1)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
