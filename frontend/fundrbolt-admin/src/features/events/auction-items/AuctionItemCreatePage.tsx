/**
 * AuctionItemCreatePage
 * Page for creating a new auction item
 */
import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { AuctionItemCreate, AuctionItemUpdate } from '@/types/auction-item'
import { ArrowLeft } from 'lucide-react'
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
import { AuctionItemForm } from '@/features/events/components/AuctionItemForm'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

export function AuctionItemCreatePage() {
  const navigate = useNavigate()
  const { currentEvent } = useEventWorkspace()
  const { eventId: routeEventId } = useParams({
    from: '/_authenticated/events/$eventId/auction-items/create',
  })
  // Use real UUID for API calls, keep route param for navigation
  const eventId = currentEvent.id

  const { createAuctionItem } = useAuctionItemStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: AuctionItemCreate | AuctionItemUpdate) => {
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
        to: '/events/$eventId',
        params: { eventId: routeEventId },
        search: { tab: 'auction-items' },
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
    navigate({
      to: '/events/$eventId',
      params: { eventId: routeEventId },
      search: { tab: 'auction-items' },
    })
  }

  return (
    <div className='space-y-4 md:space-y-6'>
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
