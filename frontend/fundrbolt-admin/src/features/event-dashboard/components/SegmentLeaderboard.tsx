import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SegmentBreakdownItem } from '@/services/event-dashboard'

interface SegmentLeaderboardProps {
  items: SegmentBreakdownItem[]
}

function asCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function SegmentLeaderboard({ items }: SegmentLeaderboardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Segment Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {items.map((item, index) => (
          <div key={item.segment_id} className='flex items-center justify-between rounded-md border px-3 py-2'>
            <div>
              <p className='text-sm font-medium'>{index + 1}. {item.segment_label}</p>
              <p className='text-xs text-muted-foreground'>Guests: {item.guest_count}</p>
            </div>
            <p className='text-sm font-semibold'>{asCurrency(item.total_amount.amount)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
