/**
 * EventEditPage
 * Page for editing an existing event with media, links, and food options
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type {
  EventLinkCreateRequest,
  EventUpdateRequest,
  FoodOptionCreateRequest,
} from '@/types/event'
import { ArrowLeft, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { useSponsorStore } from '@/stores/sponsorStore'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuctionItemList } from './components/AuctionItemList'
import { EventForm } from './components/EventForm'
import { EventLinkForm } from './components/EventLinkForm'
import { FoodOptionSelector } from './components/FoodOptionSelector'
import { MediaUploader } from './components/MediaUploader'
import { SponsorsTab } from './components/SponsorsTab'

export function EventEditPage() {
  const navigate = useNavigate()
  const { eventSlug } = useParams({
    from: '/_authenticated/events/$eventSlug/edit',
  })
  const {
    currentEvent,
    eventsLoading,
    loadEventById,
    loadNPOBranding,
    npoBranding,
    updateEvent,
    deleteEvent,
    uploadMedia,
    deleteMedia,
    createLink,
    deleteLink,
    createFoodOption,
    deleteFoodOption,
    uploadProgress,
    uploadingFiles,
  } = useEventStore()
  const { sponsors, fetchSponsors } = useSponsorStore()
  const { items: auctionItems, fetchAuctionItems } = useAuctionItemStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const resolvedEventId = currentEvent?.id ?? eventSlug

  const loadEvent = useCallback(() => {
    if (eventSlug) {
      loadEventById(eventSlug).catch((_err) => {
        toast.error('Failed to load event')
        navigate({ to: '/' })
      })
    }
  }, [eventSlug, loadEventById, navigate])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  // Load sponsors for tab count
  useEffect(() => {
    if (eventSlug) {
      fetchSponsors(eventSlug).catch(() => {
        // Silently fail - SponsorsTab will show error if user navigates there
      })
    }
  }, [eventSlug, fetchSponsors])

  // Load auction items for tab count
  useEffect(() => {
    if (eventSlug) {
      fetchAuctionItems(eventSlug).catch(() => {
        // Silently fail - auction items tab will show error if user navigates there
      })
    }
  }, [eventSlug, fetchAuctionItems])

  // Load NPO branding when event is loaded
  useEffect(() => {
    if (currentEvent?.npo_id && !npoBranding) {
      loadNPOBranding(currentEvent.npo_id)
    }
  }, [currentEvent?.npo_id, npoBranding, loadNPOBranding])

  const handleSubmit = async (data: EventUpdateRequest) => {
    setIsSubmitting(true)
    try {
      await updateEvent(resolvedEventId, data)
      toast.success('Event updated successfully!')
    } catch (err: unknown) {
      const error = err as { response?: { status: number } }
      if (error?.response?.status === 409) {
        toast.error(
          'Event was modified by another user. Please refresh and try again.'
        )
      } else {
        toast.error('Failed to update event')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/events' })
  }

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this event? This action cannot be undone.'
      )
    )
      return

    try {
      await deleteEvent(resolvedEventId)
      toast.success('Event deleted successfully')
      navigate({ to: '/events' })
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete event'
      toast.error(errorMessage)
    }
  }

  const handleMediaUpload = async (file: File) => {
    await uploadMedia(resolvedEventId, file)
    await loadEventById(resolvedEventId)
    // Note: Toast notification is shown by MediaUploader component
  }

  const handleMediaDelete = async (mediaId: string) => {
    await deleteMedia(resolvedEventId, mediaId)
    // Note: Toast notification is shown by MediaUploader component
  }

  const handleLinkCreate = async (data: EventLinkCreateRequest) => {
    try {
      await createLink(resolvedEventId, data)
      toast.success('Link added successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add link'
      toast.error(message)
    }
  }

  const handleLinkDelete = async (linkId: string) => {
    try {
      await deleteLink(resolvedEventId, linkId)
      toast.success('Link deleted successfully!')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete link'
      toast.error(message)
    }
  }

  const handleFoodOptionCreate = async (data: FoodOptionCreateRequest) => {
    try {
      await createFoodOption(resolvedEventId, data)
      toast.success('Food option added successfully!')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to add food option'
      toast.error(message)
    }
  }

  const handleFoodOptionDelete = async (optionId: string) => {
    try {
      await deleteFoodOption(resolvedEventId, optionId)
      toast.success('Food option deleted successfully!')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete food option'
      toast.error(message)
    }
  }

  if (eventsLoading || !currentEvent) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <Clock className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  return (
    <div className='container mx-auto max-w-6xl px-2 py-3 sm:px-6 sm:py-4 md:py-8'>
      <div className='mb-4 space-y-4 md:mb-6'>
        <Button
          variant='ghost'
          onClick={handleCancel}
          className='px-0 hover:bg-transparent'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Events
        </Button>

        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div className='min-w-0 flex-1'>
            <h1 className='truncate text-2xl font-bold md:text-3xl'>
              {currentEvent.name}
            </h1>
            <div className='mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4'>
              {currentEvent.npo_name && (
                <p className='text-muted-foreground text-sm'>
                  <span className='font-medium'>Organization:</span>{' '}
                  {currentEvent.npo_name}
                </p>
              )}
              <p className='text-muted-foreground hidden text-sm sm:block'>
                Edit event details and content
              </p>
            </div>
          </div>
          <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4'>
            <div className='flex items-center gap-2'>
              <span className='text-muted-foreground text-sm'>Status:</span>
              <span
                className={`rounded px-2 py-1 text-xs whitespace-nowrap ${
                  currentEvent.status === 'draft'
                    ? 'bg-gray-100 text-gray-800'
                    : currentEvent.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {currentEvent.status.charAt(0).toUpperCase() +
                  currentEvent.status.slice(1)}
              </span>
            </div>
            {(currentEvent.status === 'draft' ||
              currentEvent.status === 'closed') && (
              <Button
                variant='destructive'
                size='sm'
                onClick={handleDelete}
                className='w-full sm:w-auto'
              >
                Delete Event
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue='details' className='space-y-4 md:space-y-6'>
        <TabsList className='grid h-auto w-full grid-cols-2 lg:grid-cols-6'>
          <TabsTrigger value='details' className='text-xs sm:text-sm'>
            <span className='hidden sm:inline'>Event </span>Details
          </TabsTrigger>
          <TabsTrigger value='media' className='text-xs sm:text-sm'>
            Media{' '}
            <span className='hidden sm:inline'>
              ({currentEvent.media?.length || 0})
            </span>
          </TabsTrigger>
          <TabsTrigger value='links' className='text-xs sm:text-sm'>
            Links{' '}
            <span className='hidden sm:inline'>
              ({currentEvent.links?.length || 0})
            </span>
          </TabsTrigger>
          <TabsTrigger value='food' className='text-xs sm:text-sm'>
            <span className='hidden md:inline'>Food </span>Options
            <span className='hidden sm:inline'>
              {' '}
              ({currentEvent.food_options?.length || 0})
            </span>
          </TabsTrigger>
          <TabsTrigger value='sponsors' className='text-xs sm:text-sm'>
            Sponsors
            <span className='hidden sm:inline'> ({sponsors.length})</span>
          </TabsTrigger>
          <TabsTrigger value='auction-items' className='text-xs sm:text-sm'>
            <span className='hidden md:inline'>Auction </span>Items
            <span className='hidden sm:inline'> ({auctionItems.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Event Details Tab */}
        <TabsContent value='details'>
          <Card>
            <CardHeader>
              <CardTitle>Event Information</CardTitle>
              <CardDescription>
                Update event details, branding, and location information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventForm
                event={currentEvent}
                npoId={currentEvent.npo_id}
                npoBranding={npoBranding}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isSubmitting={isSubmitting}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value='media'>
          <Card>
            <CardHeader>
              <CardTitle>Event Media</CardTitle>
              <CardDescription>
                Upload images, logos, and promotional materials for your event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MediaUploader
                media={currentEvent.media || []}
                onUpload={handleMediaUpload}
                onDelete={handleMediaDelete}
                uploadProgress={uploadProgress}
                uploadingFiles={uploadingFiles}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value='links'>
          <Card>
            <CardHeader>
              <CardTitle>Event Links</CardTitle>
              <CardDescription>
                Add videos, websites, and social media links related to your
                event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {/* Existing Links */}
                {currentEvent.links && currentEvent.links.length > 0 && (
                  <div className='space-y-2'>
                    {currentEvent.links.map((link) => (
                      <Card key={link.id}>
                        <CardContent className='p-4'>
                          <div className='flex items-center justify-between'>
                            <div className='flex-1'>
                              <p className='font-medium'>
                                {link.label || 'Untitled Link'}
                              </p>
                              <p className='text-muted-foreground truncate text-sm'>
                                {link.url}
                              </p>
                              <p className='text-muted-foreground text-xs capitalize'>
                                {link.link_type.replace('_', ' ')}
                              </p>
                            </div>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleLinkDelete(link.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add Link Form */}
                <EventLinkForm onSubmit={handleLinkCreate} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Food Options Tab */}
        <TabsContent value='food'>
          <Card>
            <CardHeader>
              <CardTitle>Food & Dietary Options</CardTitle>
              <CardDescription>
                Manage food choices and dietary accommodations for attendees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FoodOptionSelector
                options={currentEvent.food_options || []}
                onCreate={handleFoodOptionCreate}
                onDelete={handleFoodOptionDelete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sponsors Tab */}
        <TabsContent value='sponsors'>
          <Card>
            <CardHeader>
              <CardTitle>Event Sponsors</CardTitle>
              <CardDescription>
                Manage sponsors and showcase their support for your event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SponsorsTab eventId={resolvedEventId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auction Items Tab */}
        <TabsContent value='auction-items'>
          <Card>
            <CardHeader>
              <CardTitle>Auction Items</CardTitle>
              <CardDescription>
                Manage live and silent auction items for your fundraising event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuctionItemList
                items={auctionItems}
                isLoading={false}
                onAdd={() =>
                  navigate({
                    to: '/events/$eventSlug/auction-items/create',
                    params: { eventSlug },
                  })
                }
                onEdit={(item) =>
                  navigate({
                    to: '/events/$eventSlug/auction-items/$itemId/edit',
                    params: { eventSlug, itemId: item.id },
                  })
                }
                onView={(item) =>
                  navigate({
                    to: '/events/$eventSlug/auction-items/$itemId',
                    params: { eventSlug, itemId: item.id },
                  })
                }
                onDelete={async (item) => {
                  if (
                    !confirm(`Are you sure you want to delete "${item.title}"?`)
                  )
                    return
                  const { deleteAuctionItem } = useAuctionItemStore.getState()
                  try {
                    await deleteAuctionItem(resolvedEventId, item.id)
                    toast.success('Auction item deleted successfully')
                    // Refresh the list
                    fetchAuctionItems(resolvedEventId)
                  } catch (err) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : 'Failed to delete auction item'
                    toast.error(message)
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
