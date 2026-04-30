/**
 * AuctionItemsIndexPage
 * Page for listing all auction items for an event
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AuctionItem } from '@/types/auction-item'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AuctionItemList } from '@/features/events/components/AuctionItemList'

export function AuctionItemsIndexPage() {
  const navigate = useNavigate()
  const { eventSlug } = useParams({
    from: '/_authenticated/events/$eventSlug/auction-items/',
  })

  const { currentEvent, loadEventBySlug } = useEventStore()
  const { items, isLoading, error, fetchAuctionItems, deleteAuctionItem } =
    useAuctionItemStore()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        String(item.bid_number).includes(q)
    )
  }, [items, searchQuery])

  // Resolve slug to event UUID if not already loaded
  useEffect(() => {
    if (eventSlug && currentEvent?.slug !== eventSlug) {
      loadEventBySlug(eventSlug).catch(() => {
        toast.error('Failed to load event')
      })
    }
  }, [eventSlug, currentEvent?.slug, loadEventBySlug])

  useEffect(() => {
    if (currentEvent?.id) {
      fetchAuctionItems(currentEvent.id).catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load auction items'
        )
      })
    }
  }, [currentEvent?.id, fetchAuctionItems])

  const handleAdd = () => {
    navigate({
      to: '/events/$eventSlug/auction-items/create',
      params: { eventSlug },
    })
  }

  const handleEdit = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventSlug/auction-items/$itemId/edit',
      params: { eventSlug, itemId: item.id },
    })
  }

  const handleView = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventSlug/auction-items/$itemId',
      params: { eventSlug, itemId: item.id },
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
      if (!currentEvent?.id) {
        toast.error('Event not loaded yet')
        return
      }
      await deleteAuctionItem(currentEvent.id, item.id)
      toast.success('Auction item deleted successfully')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete auction item'
      )
    }
  }

  const handleBack = () => {
    navigate({ to: '/events/$eventSlug/edit', params: { eventSlug } })
  }

  return (
    <div className='container mx-auto max-w-6xl py-4 md:py-8'>
      <div className='mb-4 space-y-4 md:mb-6'>
        <Button
          variant='ghost'
          onClick={handleBack}
          className='px-0 hover:bg-transparent'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Event
        </Button>

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
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>All Auction Items</CardTitle>
              <CardDescription>
                Live and silent auction items available for bidding
              </CardDescription>
            </div>
            <div className='relative w-full sm:w-64'>
              <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
              <Input
                placeholder='Search by name or item #'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-8'
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AuctionItemList
            items={filteredItems}
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
