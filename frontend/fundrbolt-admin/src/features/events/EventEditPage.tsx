/**
 * EventEditPage
 * Page for editing an existing event with media, links, and food options
 */

import { AttendeeListTable } from '@/components/admin/AttendeeListTable'
import { InviteGuestDialog } from '@/components/admin/InviteGuestDialog'
import { MealSummaryCard } from '@/components/admin/MealSummaryCard'
import { SeatingTabContent } from '@/components/seating/SeatingTabContent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { useSponsorStore } from '@/stores/sponsorStore'
import type {
  EventLinkCreateRequest,
  EventUpdateRequest,
  FoodOptionCreateRequest,
} from '@/types/event'
import { Outlet, useNavigate, useParams, useLocation } from '@tanstack/react-router'
import { ArrowLeft, Clock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuctionItemList } from './components/AuctionItemList'
import { EventForm } from './components/EventForm'
import { EventLinkForm } from './components/EventLinkForm'
import { FoodOptionSelector } from './components/FoodOptionSelector'
import { MediaUploader } from './components/MediaUploader'
import { SponsorsTab } from './components/SponsorsTab'
import { TicketPackagesIndexPage } from './tickets/TicketPackagesIndexPage'
import { EventWorkspaceProvider } from './EventWorkspaceContext'

export function EventEditPage() {
  console.log('[EventEditPage] Rendering - this should wrap child routes')
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams({ strict: false })
  
  // Extract eventId from URL path manually as fallback
  const pathMatch = location.pathname.match(/\/events\/([^\/]+)/)
  const eventId = (params.eventId || pathMatch?.[1]) as string
  
  console.log('[EventEditPage] location.pathname:', location.pathname)
  console.log('[EventEditPage] eventId from params:', params.eventId)
  console.log('[EventEditPage] eventId from path:', pathMatch?.[1])
  console.log('[EventEditPage] final eventId:', eventId)
  
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

  const loadEvent = useCallback(() => {
    if (eventId) {
      // Check if eventId is a numeric ID or a slug
      const isNumericId = /^\d+$/.test(eventId)
      const loadFn = isNumericId ? loadEventById : loadEventBySlug
      loadFn(eventId).catch((_err) => {
        toast.error('Failed to load event')
        navigate({ to: '/' })
      })
    }
  }, [eventId, loadEventById, loadEventBySlug, navigate])

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
      await updateEvent(eventId, data)
      toast.success('Event updated successfully!')
    } catch (err: unknown) {
      const error = err as { response?: { status: number } }
      if (error?.response?.status === 409) {
        toast.error('Event was modified by another user. Please refresh and try again.')
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
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return

    try {
      await deleteEvent(eventId)
      toast.success('Event deleted successfully')
      navigate({ to: '/events' })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event'
      toast.error(errorMessage)
    }
  }

  const handleMediaUpload = async (file: File) => {
    await uploadMedia(eventId, file)
    // Note: Toast notification is shown by MediaUploader component
  }

  const handleMediaDelete = async (mediaId: string) => {
    await deleteMedia(eventId, mediaId)
    // Note: Toast notification is shown by MediaUploader component
  }

  const handleLinkCreate = async (data: EventLinkCreateRequest) => {
    try {
      await createLink(eventId, data)
      toast.success('Link added successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add link'
      toast.error(message)
    }
  }

  const handleLinkDelete = async (linkId: string) => {
    try {
      await deleteLink(eventId, linkId)
      toast.success('Link deleted successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete link'
      toast.error(message)
    }
  }

  const handleFoodOptionCreate = async (data: FoodOptionCreateRequest) => {
    try {
      await createFoodOption(eventId, data)
      toast.success('Food option added successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add food option'
      toast.error(message)
    }
  }

  const handleFoodOptionDelete = async (optionId: string) => {
    try {
      await deleteFoodOption(eventId, optionId)
      toast.success('Food option deleted successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete food option'
      toast.error(message)
    }
  }

  if (eventsLoading || !currentEvent) {
    return (
      <div className="flex items-center justify-center h-96">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
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
      <div className="container mx-auto px-2 py-3 sm:px-6 sm:py-4 md:py-8 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    )
  }

  return (
    <EventWorkspaceProvider value={contextValue}>
      <div className="container mx-auto px-2 py-3 sm:px-6 sm:py-4 md:py-8 max-w-6xl">
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold truncate">{currentEvent.name}</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                {currentEvent.npo_name && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Organization:</span> {currentEvent.npo_name}
                  </p>
                )}
                <p className="text-sm text-muted-foreground hidden sm:block">Edit event details and content</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span
                  className={`text-xs px-2 py-1 rounded whitespace-nowrap ${currentEvent.status === 'draft'
                    ? 'bg-gray-100 text-gray-800'
                    : currentEvent.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}
                >
                  {currentEvent.status.charAt(0).toUpperCase() + currentEvent.status.slice(1)}
                </span>
              </div>
              {(currentEvent.status === 'draft' || currentEvent.status === 'closed') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="w-full sm:w-auto"
                >
                  Delete Event
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <Outlet />
        </div>
      </div>
    </EventWorkspaceProvider>
  )
}
