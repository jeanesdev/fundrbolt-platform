import type { EventTotals as EventTotalsData } from '@/services/auctioneerService'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EventTotalsProps {
  totals: EventTotalsData
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function EventTotals({ totals }: EventTotalsProps) {
  const items = [
    { label: 'Live Auction', value: totals.live_auction_raised },
    { label: 'Paddle Raise', value: totals.paddle_raise_raised },
    { label: 'Silent Auction', value: totals.silent_auction_raised },
  ]

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <BarChart3 className='h-4 w-4' />
          Event Revenue Totals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='mb-4 text-3xl font-bold'>
          {formatCurrency(totals.event_total_raised)}
        </div>
        <div className='space-y-2'>
          {items.map((item) => (
            <div
              key={item.label}
              className='flex items-center justify-between text-sm'
            >
              <span className='text-muted-foreground'>{item.label}</span>
              <span className='font-medium'>{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
