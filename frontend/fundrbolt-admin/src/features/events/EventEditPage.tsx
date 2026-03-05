/**
 * EventEditPage
 * Page for editing an existing event with media, links, and food options
 */
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/error-utils'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { useSponsorStore } from '@/stores/sponsorStore'
import type {
  EventLinkCreateRequest,
  EventMediaUsageTag,
  EventUpdateRequest,
  FoodOptionCreateRequest,
  MediaUpdateRequest,
} from '@/types/event'
import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EventWorkspaceProvider } from './EventWorkspaceProvider'

export function EventEditPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams({ strict: false })

  // Extract eventId from URL path manually as fallback
  const pathMatch = location.pathname.match(/\/events\/([^/]+)/)
  const eventId = (params.eventId || pathMatch?.[1]) as string

  const {
    currentEvent,
    eventsLoading,
    loadEventById,
    loadEventBySlug,
    loadNPOBranding,
    npoBranding,
    updateEvent,
    deleteEvent,
    uploadMedia,
    updateMedia,
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const apiEventId = currentEvent?.id ?? eventId

  const loadEvent = useCallback(() => {
    if (eventId) {
      // Skip loading if we already have this event loaded
      if (
        currentEvent &&
        (currentEvent.id === eventId || currentEvent.slug === eventId)
      ) {
        return
      }
      // Check if eventId is a numeric ID or a slug
      const isNumericId = /^\d+$/.test(eventId)
      const loadFn = isNumericId ? loadEventById : loadEventBySlug
      loadFn(eventId).catch((_err) => {
        setLoadError('Failed to load event')
        toast.error('Failed to load event')
      })
    }
  }, [eventId, currentEvent, loadEventById, loadEventBySlug])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  // Load sponsors for tab count
  useEffect(() => {
    if (currentEvent?.id) {
      fetchSponsors(currentEvent.id).catch(() => {
        // Silently fail - SponsorsTab will show error if user navigates there
      })
    }
  }, [currentEvent?.id, fetchSponsors])

  // Load auction items for tab count
  useEffect(() => {
    if (currentEvent?.id) {
      fetchAuctionItems(currentEvent.id).catch(() => {
        // Silently fail - auction items tab will show error if user navigates there
      })
    }
  }, [currentEvent?.id, fetchAuctionItems])

  // Load NPO branding when event is loaded
  useEffect(() => {
    if (currentEvent?.npo_id && !npoBranding) {
      loadNPOBranding(currentEvent.npo_id)
    }
  }, [currentEvent?.npo_id, npoBranding, loadNPOBranding])

  const handleSubmit = async (data: EventUpdateRequest) => {
    setIsSubmitting(true)
    try {
      await updateEvent(apiEventId, data)
      toast.success('Event updated successfully!')
    } catch (err: unknown) {
      const error = err as { response?: { status: number } }
      if (error?.response?.status === 409) {
        toast.error(
          'Event was modified by another user. Please refresh and try again.'
        )
      } else {
        toast.error(getErrorMessage(err, 'Failed to update event'))
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
      await deleteEvent(apiEventId)
      toast.success('Event deleted successfully')
      navigate({ to: '/events' })
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete event'
      toast.error(errorMessage)
    }
  }

  const handleMediaUpload = async (
    file: File,
    usageTag: EventMediaUsageTag
  ) => {
    await uploadMedia(apiEventId, file, usageTag)
    // Note: Toast notification is shown by MediaUploader component
  }

  const handleMediaUpdate = async (
    mediaId: string,
    data: MediaUpdateRequest
  ) => {
    await updateMedia(apiEventId, mediaId, data)
  }

  const handleMediaDelete = async (mediaId: string) => {
    await deleteMedia(apiEventId, mediaId)
    // Note: Toast notification is shown by MediaUploader component
  }

  const handleLinkCreate = async (data: EventLinkCreateRequest) => {
    try {
      await createLink(apiEventId, data)
      toast.success('Link added successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add link'
      toast.error(message)
    }
  }

  const handleLinkDelete = async (linkId: string) => {
    try {
      await deleteLink(apiEventId, linkId)
      toast.success('Link deleted successfully!')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete link'
      toast.error(message)
    }
  }

  const handleFoodOptionCreate = async (data: FoodOptionCreateRequest) => {
    try {
      await createFoodOption(apiEventId, data)
      toast.success('Food option added successfully!')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to add food option'
      toast.error(message)
    }
  }

  const handleFoodOptionDelete = async (optionId: string) => {
    try {
      await deleteFoodOption(apiEventId, optionId)
      toast.success('Food option deleted successfully!')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete food option'
      toast.error(message)
    }
  }

  if (loadError && !currentEvent) {
    return (
      <div className='flex h-96 flex-col items-center justify-center gap-4'>
        <p className='text-muted-foreground'>{loadError}</p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => {
              setLoadError(null)
              loadEvent()
            }}
          >
            Retry
          </Button>
          <Button variant='ghost' onClick={() => navigate({ to: '/' })}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (eventsLoading || !currentEvent) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <Clock className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  const contextValue = {
    eventId,
    currentEvent,
    npoBranding,
    isSubmitting,
    uploadProgress,
    uploadingFiles,
    auctionItems,
    sponsorsCount: sponsors.length,
    handleSubmit,
    handleCancel,
    handleDelete,
    handleMediaUpload,
    handleMediaUpdate,
    handleMediaDelete,
    handleLinkCreate,
    handleLinkDelete,
    handleFoodOptionCreate,
    handleFoodOptionDelete,
    updateEvent,
    loadEventById,
    fetchAuctionItems,
  }

  // Show loading state while event is being loaded
  if (eventsLoading || !currentEvent) {
    return (
      <div className='container mx-auto px-2 py-3 sm:px-6 sm:py-4 md:py-8'>
        <div className='flex items-center justify-center py-12'>
          <p className='text-muted-foreground'>Loading event...</p>
        </div>
      </div>
    )
  }

  return (
    <EventWorkspaceProvider value={contextValue}>
      <div className='container mx-auto px-2 py-3 sm:px-6 sm:py-4 md:py-8'>
        <div className='mb-4 md:mb-6'>
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
                  className={`rounded px-2 py-1 text-xs whitespace-nowrap ${currentEvent.status === 'draft'
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

        <div className='mt-6 space-y-6'>
          <Outlet />
        </div>
      </div>
    </EventWorkspaceProvider>
  )
}
