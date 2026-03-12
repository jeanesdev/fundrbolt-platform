/**
 * AuctionItemsIndexPage
 * Page for listing all auction items for an event
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AuctionItem } from '@/types/auction-item'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuctionItemList } from '@/features/events/components/AuctionItemList'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

export function AuctionItemsIndexPage() {
  const navigate = useNavigate()
  const { currentEvent } = useEventWorkspace()
  const { eventId: routeEventId } = useParams({
    from: '/_authenticated/events/$eventId/auction-items/',
  })
  // Use the real UUID for API calls, keep route param for navigation
  const eventId = currentEvent.id
  const eventSlugOrId = routeEventId

  const { items, isLoading, error, fetchAuctionItems, deleteAuctionItem } =
    useAuctionItemStore()

  useEffect(() => {
    if (eventId) {
      fetchAuctionItems(eventId).catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load auction items'
        )
      })
    }
  }, [eventId, fetchAuctionItems])

  const handleAdd = () => {
    navigate({
      to: '/events/$eventId/auction-items/create',
      params: { eventId: eventSlugOrId },
    })
  }

  const handleEdit = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventId/auction-items/$itemId/edit',
      params: { eventId: eventSlugOrId, itemId: item.id },
    })
  }

  const handleView = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventId/auction-items/$itemId',
      params: { eventId: eventSlugOrId, itemId: item.id },
    })
  }

  const handleDelete = async (item: AuctionItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${item.title}"? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      await deleteAuctionItem(eventId, item.id)
      toast.success('Auction item deleted successfully')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete auction item'
      )
    }
  }

  return (
    <div className='space-y-4 md:space-y-6'>
      <div className='mb-4 space-y-4 md:mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold md:text-3xl'>Auction Items</h1>
            <p className='text-muted-foreground mt-1 text-sm md:mt-2 md:text-base'>
              Manage auction items for this event
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className='mr-2 h-4 w-4' />
            Add Item
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Auction Items</CardTitle>
          <CardDescription>
            Live and silent auction items available for bidding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionItemList
            items={items}
            isLoading={isLoading}
            error={error}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
          />
        </CardContent>
      </Card>
    </div>
  )
}
