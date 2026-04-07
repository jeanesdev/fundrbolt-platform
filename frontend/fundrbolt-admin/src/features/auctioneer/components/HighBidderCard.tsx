import type { HighBidder } from '@/services/auctioneerService'
import { Crown, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface HighBidderCardProps {
  bidder: HighBidder
}

export function HighBidderCard({ bidder }: HighBidderCardProps) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Crown className='h-4 w-4 text-yellow-500' />
          High Bidder
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex items-center gap-4'>
          <div className='bg-muted flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full'>
            {bidder.profile_picture_url ? (
              <img
                src={bidder.profile_picture_url}
                alt={`${bidder.first_name} ${bidder.last_name}`}
                className='h-full w-full object-cover'
              />
            ) : (
              <User className='text-muted-foreground h-6 w-6' />
            )}
          </div>
          <div>
            <div className='text-lg font-semibold'>
              {bidder.first_name} {bidder.last_name}
            </div>
            <div className='text-muted-foreground flex gap-3 text-sm'>
              {bidder.bidder_number !== null && (
                <span>Bidder #{bidder.bidder_number}</span>
              )}
              {bidder.table_number !== null && (
                <span>Table {bidder.table_number}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
