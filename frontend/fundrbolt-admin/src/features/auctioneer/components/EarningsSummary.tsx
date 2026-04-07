import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EarningsSummary as EarningsSummaryData } from '@/services/auctioneerService'
import { DollarSign } from 'lucide-react'

interface EarningsSummaryProps {
  earnings: EarningsSummaryData
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function EarningsSummary({ earnings }: EarningsSummaryProps) {
  const breakdown = [
    { label: 'Per-Item Commissions', value: earnings.per_item_total },
    { label: 'Live Auction Pool', value: earnings.live_auction_category_earning },
    { label: 'Paddle Raise Pool', value: earnings.paddle_raise_category_earning },
    { label: 'Silent Auction Pool', value: earnings.silent_auction_category_earning },
  ]

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <DollarSign className='h-4 w-4' />
          Earnings Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='mb-4 text-3xl font-bold'>
          {formatCurrency(earnings.total_earnings)}
        </div>
        <div className='space-y-2'>
          {breakdown.map((item) => (
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
