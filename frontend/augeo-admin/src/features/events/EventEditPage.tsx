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

  const handleMediaUpload = async (file: File) => {
    await uploadMedia(eventId, file)
  }

  const handleMediaDelete = async (mediaId: string) => {
    await deleteMedia(eventId, mediaId)
  }

  const handleLinkCreate = async (data: EventLinkCreateRequest) => {
    await createLink(eventId, data)
  }

  const handleLinkDelete = async (linkId: string) => {
    await deleteLink(eventId, linkId)
  }

  const handleFoodOptionCreate = async (data: FoodOptionCreateRequest) => {
    await createFoodOption(eventId, data)
  }

  const handleFoodOptionDelete = async (optionId: string) => {
    await deleteFoodOption(eventId, optionId)
  }

  if (eventsLoading || !currentEvent) {
    return (
      <div className="flex items-center justify-center h-96">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={handleCancel} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{currentEvent.name}</h1>
            <p className="text-muted-foreground mt-2">Edit event details and content</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span
              className={`text-xs px-2 py-1 rounded ${currentEvent.status === 'draft'
                ? 'bg-gray-100 text-gray-800'
                : currentEvent.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                }`}
            >
              {currentEvent.status.charAt(0).toUpperCase() + currentEvent.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Event Details</TabsTrigger>
          <TabsTrigger value="media">Media ({currentEvent.media?.length || 0})</TabsTrigger>
          <TabsTrigger value="links">Links ({currentEvent.links?.length || 0})</TabsTrigger>
          <TabsTrigger value="food">Food Options ({currentEvent.food_options?.length || 0})</TabsTrigger>
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
                            <div>
                              <p className="font-medium">{link.title || link.url}</p>
                              <p className="text-sm text-muted-foreground">{link.link_type}</p>
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
