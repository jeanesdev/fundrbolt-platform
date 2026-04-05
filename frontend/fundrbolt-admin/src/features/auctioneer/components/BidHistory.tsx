import type { BidHistoryEntry } from '@/services/auctioneerService'
import { History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface BidHistoryProps {
  bids: BidHistoryEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function BidHistory({ bids }: BidHistoryProps) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <History className='h-4 w-4' />
          Bid History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bids.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No bids yet</p>
        ) : (
          <div className='space-y-2'>
            {bids.map((bid, index) => (
              <div
                key={`${bid.placed_at}-${index}`}
                className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
              >
                <div className='flex items-center gap-2'>
                  {bid.bidder_number !== null && (
                    <span className='bg-muted rounded px-1.5 py-0.5 text-xs font-medium'>
                      #{bid.bidder_number}
                    </span>
                  )}
                  <span>{bid.bidder_name}</span>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='font-semibold'>
                    {formatCurrency(bid.bid_amount)}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {formatTime(bid.placed_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
