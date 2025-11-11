/**
 * EventEditPage
 * Page for editing an existing event with media, links, and food options
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEventStore } from '@/stores/event-store'
import type {
  EventLinkCreateRequest,
  EventUpdateRequest,
  FoodOptionCreateRequest,
} from '@/types/event'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Clock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EventForm } from './components/EventForm'
import { EventLinkForm } from './components/EventLinkForm'
import { FoodOptionSelector } from './components/FoodOptionSelector'
import { MediaUploader } from './components/MediaUploader'

export function EventEditPage() {
  const navigate = useNavigate()
  const { eventId } = useParams({ strict: false }) as { eventId: string }
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadEvent = useCallback(() => {
    if (eventId) {
      loadEventById(eventId).catch((_err) => {
        toast.error('Failed to load event')
        navigate({ to: '/' })
      })
    }
  }, [eventId, loadEventById, navigate])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

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
    try {
      await uploadMedia(eventId, file)
      toast.success('Media uploaded successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload media'
      toast.error(message)
    }
  }

  const handleMediaDelete = async (mediaId: string) => {
    try {
      await deleteMedia(eventId, mediaId)
      toast.success('Media deleted successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete media'
      toast.error(message)
    }
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

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-6xl">
      <div className="mb-4 md:mb-6 space-y-4">
        <Button variant="ghost" onClick={handleCancel} className="px-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>

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

      <Tabs defaultValue="details" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
          <TabsTrigger value="details" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Event </span>Details
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs sm:text-sm">
            Media <span className="hidden sm:inline">({currentEvent.media?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="links" className="text-xs sm:text-sm">
            Links <span className="hidden sm:inline">({currentEvent.links?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="food" className="text-xs sm:text-sm">
            <span className="hidden md:inline">Food </span>Options<span className="hidden sm:inline"> ({currentEvent.food_options?.length || 0})</span>
          </TabsTrigger>
        </TabsList>

        {/* Event Details Tab */}
        <TabsContent value="details">
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
        <TabsContent value="media">
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
        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle>Event Links</CardTitle>
              <CardDescription>
                Add videos, websites, and social media links related to your event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Existing Links */}
                {currentEvent.links && currentEvent.links.length > 0 && (
                  <div className="space-y-2">
                    {currentEvent.links.map((link) => (
                      <Card key={link.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{link.label || 'Untitled Link'}</p>
                              <p className="text-sm text-muted-foreground truncate">{link.url}</p>
                              <p className="text-xs text-muted-foreground capitalize">{link.link_type.replace('_', ' ')}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
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
        <TabsContent value="food">
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
      </Tabs>
    </div>
  )
}
