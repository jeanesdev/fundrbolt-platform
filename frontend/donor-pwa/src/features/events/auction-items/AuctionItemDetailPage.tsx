/**
 * AuctionItemDetailPage
 * Page for viewing auction item details
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { AuctionType, ItemStatus } from '@/types/auction-item'
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const formatCurrency = (amount: number | null): string => {
  if (!amount) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function AuctionItemDetailPage() {
  const navigate = useNavigate()
  const { eventSlug, itemId } = useParams({
    from: '/_authenticated/events/$eventSlug/auction-items/$itemId/',
  })

  const { currentEvent, loadEventBySlug } = useEventStore()
  const { selectedItem, isLoading, getAuctionItem, clearSelectedItem } =
    useAuctionItemStore()

  // Resolve slug to event UUID if not already loaded
  useEffect(() => {
    if (eventSlug && currentEvent?.slug !== eventSlug) {
      loadEventBySlug(eventSlug).catch(() => {
        toast.error('Failed to load event')
        navigate({
          to: '/events/$eventSlug/auction-items',
          params: { eventSlug },
        })
      })
    }
  }, [eventSlug, currentEvent?.slug, loadEventBySlug, navigate])

  useEffect(() => {
    if (currentEvent?.id) {
      getAuctionItem(currentEvent.id, itemId).catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load auction item'
        )
        navigate({
          to: '/events/$eventSlug/auction-items',
          params: { eventSlug },
        })
      })
    }

    return () => {
      clearSelectedItem()
    }
  }, [
    currentEvent?.id,
    itemId,
    getAuctionItem,
    clearSelectedItem,
    navigate,
    eventSlug,
  ])

  const handleEdit = () => {
    navigate({
      to: '/events/$eventSlug/auction-items/$itemId/edit',
      params: { eventSlug, itemId },
    })
  }

  const handleBack = () => {
    navigate({ to: '/events/$eventSlug/auction-items', params: { eventSlug } })
  }

  if (isLoading || !selectedItem) {
    return (
      <div className='container mx-auto max-w-4xl py-4 md:py-8'>
        <div className='mb-4 space-y-4 md:mb-6'>
          <Skeleton className='h-10 w-40' />
          <Skeleton className='h-8 w-64' />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-20 w-full' />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto max-w-4xl py-4 md:py-8'>
      <div className='mb-4 space-y-4 md:mb-6'>
        <Button
          variant='ghost'
          onClick={handleBack}
          className='px-0 hover:bg-transparent'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Auction Items
        </Button>

        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <h1 className='text-2xl font-bold md:text-3xl'>
              {selectedItem.title}
            </h1>
            <p className='text-muted-foreground mt-1 text-sm md:text-base'>
              Bid #{selectedItem.bid_number}
            </p>
          </div>
          <Button onClick={handleEdit}>
            <Pencil className='mr-2 h-4 w-4' />
            Edit
          </Button>
        </div>
      </div>

      {/* Status & Type */}
      <div className='mb-6 flex gap-2'>
        <Badge
          variant={
            selectedItem.status === ItemStatus.PUBLISHED
              ? 'default'
              : selectedItem.status === ItemStatus.DRAFT
                ? 'secondary'
                : selectedItem.status === ItemStatus.WITHDRAWN
                  ? 'destructive'
                  : 'outline'
          }
        >
          {selectedItem.status}
        </Badge>
        <Badge variant='outline'>
          {selectedItem.auction_type === AuctionType.LIVE ? 'Live' : 'Silent'}{' '}
          Auction
        </Badge>
      </div>

      {/* Description */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='whitespace-pre-wrap'>{selectedItem.description}</p>
        </CardContent>
      </Card>

      {/* Pricing Information */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle>Pricing Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
            <div>
              <p className='text-muted-foreground text-sm'>Starting Bid</p>
              <p className='text-lg font-semibold'>
                {formatCurrency(selectedItem.starting_bid)}
              </p>
            </div>

            {selectedItem.donor_value && (
              <div>
                <p className='text-muted-foreground text-sm'>
                  Fair Market Value
                </p>
                <p className='text-lg font-semibold'>
                  {formatCurrency(selectedItem.donor_value)}
                </p>
              </div>
            )}

            {selectedItem.cost && (
              <div>
                <p className='text-muted-foreground text-sm'>
                  Consignment Cost
                </p>
                <p className='text-lg font-semibold'>
                  {formatCurrency(selectedItem.cost)}
                </p>
              </div>
            )}

            {selectedItem.buy_now_price && selectedItem.buy_now_enabled && (
              <div>
                <p className='text-muted-foreground text-sm'>Buy Now Price</p>
                <p className='text-lg font-semibold'>
                  {formatCurrency(selectedItem.buy_now_price)}
                </p>
              </div>
            )}

            <div>
              <p className='text-muted-foreground text-sm'>
                Quantity Available
              </p>
              <p className='text-lg font-semibold'>
                {selectedItem.quantity_available}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {selectedItem.donated_by && (
              <div>
                <p className='text-muted-foreground text-sm'>Donated By</p>
                <p className='font-medium'>{selectedItem.donated_by}</p>
              </div>
            )}

            {selectedItem.item_webpage && (
              <div>
                <p className='text-muted-foreground text-sm'>Item Webpage</p>
                <a
                  href={selectedItem.item_webpage}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary inline-flex items-center gap-1 hover:underline'
                >
                  View Details
                  <ExternalLink className='h-3 w-3' />
                </a>
              </div>
            )}

            {selectedItem.display_priority !== null &&
              selectedItem.display_priority !== undefined && (
                <div>
                  <p className='text-muted-foreground text-sm'>
                    Display Priority
                  </p>
                  <p className='font-medium'>{selectedItem.display_priority}</p>
                </div>
              )}

            <div>
              <p className='text-muted-foreground text-sm'>Created</p>
              <p className='font-medium'>
                {new Date(selectedItem.created_at).toLocaleString()}
              </p>
            </div>

            <div>
              <p className='text-muted-foreground text-sm'>Last Updated</p>
              <p className='font-medium'>
                {new Date(selectedItem.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
