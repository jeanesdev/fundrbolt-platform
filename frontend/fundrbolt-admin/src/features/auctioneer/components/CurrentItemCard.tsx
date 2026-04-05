import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LiveAuctionItem } from '@/services/auctioneerService'
import { Gavel, Image } from 'lucide-react'

interface CurrentItemCardProps {
  item: LiveAuctionItem
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function CurrentItemCard({ item }: CurrentItemCardProps) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Gavel className='h-4 w-4' />
          Current Item
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex gap-4'>
          <div className='h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800'>
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className='h-full w-full object-cover'
              />
            ) : (
              <div className='flex h-full items-center justify-center'>
                <Image className='text-muted-foreground h-6 w-6' />
              </div>
            )}
          </div>
          <div className='min-w-0 flex-1'>
            <h3 className='truncate text-lg font-semibold'>{item.title}</h3>
            {item.description && (
              <p className='text-muted-foreground mt-1 line-clamp-2 text-sm'>
                {item.description}
              </p>
            )}
            <div className='mt-2 flex gap-4 text-sm'>
              {item.starting_bid !== null && (
                <div>
                  <span className='text-muted-foreground'>Starting: </span>
                  <span className='font-medium'>
                    {formatCurrency(item.starting_bid)}
                  </span>
                </div>
              )}
              {item.current_bid !== null && (
                <div>
                  <span className='text-muted-foreground'>Current: </span>
                  <span className='font-bold text-green-600 dark:text-green-400'>
                    {formatCurrency(item.current_bid)}
                  </span>
                </div>
              )}
              <div>
                <span className='text-muted-foreground'>Bids: </span>
                <span className='font-medium'>{item.bid_count}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
