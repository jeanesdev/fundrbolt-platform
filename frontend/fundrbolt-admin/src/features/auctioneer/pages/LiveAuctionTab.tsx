import { Gavel } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { BidHistory } from '../components/BidHistory'
import { CurrentItemCard } from '../components/CurrentItemCard'
import { HighBidderCard } from '../components/HighBidderCard'
import { useLiveAuction } from '../hooks/useAuctioneerData'

export function LiveAuctionTab() {
  const { currentEvent } = useEventWorkspace()
  const { data, isLoading, error } = useLiveAuction(currentEvent.id)

  if (isLoading) {
    return (
      <div className='space-y-4 p-4'>
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-48 w-full' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='p-4'>
        <p className='text-destructive'>Failed to load live auction data.</p>
      </div>
    )
  }

  if (!data.current_item) {
    return (
      <div className='flex flex-col items-center justify-center py-16'>
        <Gavel className='text-muted-foreground mb-4 h-12 w-12' />
        <h3 className='text-lg font-semibold'>No Active Live Auction</h3>
        <p className='text-muted-foreground text-sm'>
          Start a live auction item from the Quick Entry page to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6 p-4'>
      <div>
        <h2 className='text-2xl font-bold'>Live Auction</h2>
        <p className='text-muted-foreground text-sm'>
          Real-time view of the current live auction item
        </p>
      </div>

      <CurrentItemCard item={data.current_item} />

      {data.high_bidder && <HighBidderCard bidder={data.high_bidder} />}

      <BidHistory bids={data.bid_history} />
    </div>
  )
}
