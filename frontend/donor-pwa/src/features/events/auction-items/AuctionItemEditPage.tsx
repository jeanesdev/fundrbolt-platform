/**
 * AuctionItemEditPage
 * Page for editing an existing auction item
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AuctionItemUpdate } from '@/types/auction-item'
import { ArrowLeft } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { AuctionItemForm } from '@/features/events/components/AuctionItemForm'

export function AuctionItemEditPage() {
  const navigate = useNavigate()
  const { eventSlug, itemId } = useParams({
    from: '/_authenticated/events/$eventSlug/auction-items/$itemId/edit',
  })

  const { currentEvent, loadEventBySlug } = useEventStore()
  const {
    selectedItem,
    isLoading,
    getAuctionItem,
    updateAuctionItem,
    clearSelectedItem,
  } = useAuctionItemStore()

  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const eventId = currentEvent?.id

  // Load item on mount
  useEffect(() => {
    if (!currentEvent?.id) return
    getAuctionItem(currentEvent.id, itemId).catch((err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load auction item'
      )
      navigate({
        to: '/events/$eventSlug/auction-items',
        params: { eventSlug },
      })
    })

    // Cleanup on unmount
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

  const handleSubmit = async (data: AuctionItemUpdate) => {
    if (!eventId) {
      toast.error('Event not loaded yet')
      return
    }
    setIsSubmitting(true)
    try {
      await updateAuctionItem(eventId, itemId, data)
      toast.success('Auction item updated successfully!')
      navigate({
        to: '/events/$eventSlug/auction-items',
        params: { eventSlug },
      })
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update auction item'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/events/$eventSlug/auction-items', params: { eventSlug } })
  }

  if (isLoading || !selectedItem) {
    return (
      <div className='container mx-auto max-w-4xl py-4 md:py-8'>
        <div className='mb-4 space-y-4 md:mb-6'>
          <Skeleton className='h-10 w-40' />
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-4 w-96' />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-32 w-full' />
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
          onClick={handleCancel}
          className='px-0 hover:bg-transparent'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Auction Items
        </Button>

        <div>
          <h1 className='text-2xl font-bold md:text-3xl'>Edit Auction Item</h1>
          <p className='text-muted-foreground mt-1 text-sm md:mt-2 md:text-base'>
            Update item details
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            Make changes to the auction item below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionItemForm
            item={selectedItem}
            eventId={eventId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  )
}
