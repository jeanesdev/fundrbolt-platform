import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AuctionDashboardSummary } from '@/services/auction-dashboard'
import { DollarSign, Gavel, Hash, TrendingUp } from 'lucide-react'

interface SummaryCardsProps {
  data: AuctionDashboardSummary | undefined
  isLoading: boolean
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total Items',
      value: data?.total_items ?? 0,
      icon: Gavel,
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Total Bids',
      value: data?.total_bids ?? 0,
      icon: Hash,
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Total Revenue',
      value: data?.total_revenue ?? 0,
      icon: DollarSign,
      format: (v: number) =>
        v.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }),
    },
    {
      title: 'Avg Bid Amount',
      value: data?.average_bid_amount ?? 0,
      icon: TrendingUp,
      format: (v: number) =>
        v.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }),
    },
  ]

  return (
    <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              {card.title}
            </CardTitle>
            <card.icon className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='bg-muted h-8 w-24 animate-pulse rounded' />
            ) : (
              <div className='text-2xl font-bold'>
                {card.format(card.value)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
