/**
 * AuctionItemCreatePage
 * Page for creating a new auction item
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AuctionItemCreate, AuctionItemUpdate } from '@/types/auction-item'
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
import { AuctionItemForm } from '@/features/events/components/AuctionItemForm'

export function AuctionItemCreatePage() {
  const navigate = useNavigate()
  const { eventSlug } = useParams({
    from: '/_authenticated/events/$eventSlug/auction-items/create',
  })

  const { createAuctionItem } = useAuctionItemStore()
  const { currentEvent, loadEventBySlug } = useEventStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Resolve slug to event UUID if not already loaded
  useEffect(() => {
    if (eventSlug && currentEvent?.slug !== eventSlug) {
      loadEventBySlug(eventSlug).catch(() => {
        toast.error('Failed to load event')
      })
    }
  }, [eventSlug, currentEvent?.slug, loadEventBySlug])

  const eventId = currentEvent?.id

  const handleSubmit = async (data: AuctionItemCreate | AuctionItemUpdate) => {
    if (!eventId) {
      toast.error('Event not loaded yet')
      return
    }
    setIsSubmitting(true)
    try {
      const createdItem = await createAuctionItem(
        eventId,
        data as AuctionItemCreate
      )

      if (!createdItem?.id) {
        throw new Error('Item created but no ID returned from server')
      }

      toast.success('Auction item created successfully!')
      navigate({
        to: '/events/$eventSlug/auction-items',
        params: { eventSlug },
      })
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create auction item'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/events/$eventSlug/auction-items', params: { eventSlug } })
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
          <h1 className='text-2xl font-bold md:text-3xl'>Add Auction Item</h1>
          <p className='text-muted-foreground mt-1 text-sm md:mt-2 md:text-base'>
            Create a new item for the auction
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            Fill out the information below to add a new auction item
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionItemForm
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
