import { useNavigate } from '@tanstack/react-router'
import type { CommissionListItem } from '@/services/auctioneerService'
import { Image } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

interface CommissionGalleryProps {
  commissions: CommissionListItem[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function CommissionGallery({ commissions }: CommissionGalleryProps) {
  const navigate = useNavigate()
  const { currentEvent } = useEventWorkspace()

  if (commissions.length === 0) {
    return (
      <Card>
        <CardContent className='py-8 text-center'>
          <p className='text-muted-foreground'>
            No commissions set. Add commissions on individual auction items.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {commissions.map((item) => {
        const earning =
          item.cost != null ? (item.cost * item.commission_percent) / 100 : null

        return (
          <Card
            key={item.auction_item_id}
            className='cursor-pointer transition-shadow hover:shadow-md'
            onClick={() =>
              navigate({
                to: '/events/$eventId/auction-items/$itemId/' as string,
                params: {
                  eventId: currentEvent.id,
                  itemId: item.auction_item_id,
                },
              })
            }
          >
            <div className='aspect-video overflow-hidden rounded-t-lg bg-neutral-100 dark:bg-neutral-800'>
              {item.primary_image_url ? (
                <img
                  src={item.primary_image_url}
                  alt={item.auction_item_title}
                  className='h-full w-full object-cover'
                />
              ) : (
                <div className='flex h-full items-center justify-center'>
                  <Image className='text-muted-foreground h-8 w-8' />
                </div>
              )}
            </div>
            <CardHeader className='pb-2'>
              <div className='flex min-w-0 items-start justify-between gap-2'>
                <CardTitle className='min-w-0 truncate text-sm'>
                  {item.auction_item_bid_number != null && (
                    <span className='text-muted-foreground mr-1'>
                      #{item.auction_item_bid_number}
                    </span>
                  )}
                  {item.auction_item_title}
                </CardTitle>
                {item.auction_type && (
                  <Badge
                    variant='outline'
                    className='shrink-0 text-xs whitespace-nowrap capitalize'
                  >
                    {item.auction_type.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className='space-y-1 text-sm'>
              <div className='flex items-center gap-1'>
                <span>Commission: {item.commission_percent}%</span>
              </div>
              {item.quantity_available != null && (
                <div className='text-muted-foreground'>
                  {item.item_status === 'sold'
                    ? `Sold: ${item.quantity_available} of ${item.quantity_available}`
                    : `Available: ${item.quantity_available}`}
                  {item.bid_count > 0 &&
                    ` · ${item.bid_count} bid${item.bid_count !== 1 ? 's' : ''}`}
                </div>
              )}
              {item.current_bid_amount != null && (
                <div className='text-muted-foreground'>
                  Current bid: {formatCurrency(item.current_bid_amount)}
                </div>
              )}
              {item.cost != null && (
                <div className='text-muted-foreground'>
                  Starting price: {formatCurrency(item.cost)}
                </div>
              )}
              {earning != null && (
                <div className='font-medium text-green-600 dark:text-green-400'>
                  Est. earning: {formatCurrency(earning)}
                </div>
              )}
              {item.notes && (
                <div className='text-muted-foreground truncate text-xs'>
                  {item.notes}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
