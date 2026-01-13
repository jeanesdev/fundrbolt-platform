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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { useEventStore } from '@/stores/event-store'
import { useSponsorStore } from '@/stores/sponsorStore'
import type {
  EventLinkCreateRequest,
  EventUpdateRequest,
  FoodOptionCreateRequest,
} from '@/types/event'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Clock, Ticket } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuctionItemList } from './components/AuctionItemList'
import { EventForm } from './components/EventForm'
import { EventLinkForm } from './components/EventLinkForm'
import { FoodOptionSelector } from './components/FoodOptionSelector'
import { MediaUploader } from './components/MediaUploader'
import { SponsorsTab } from './components/SponsorsTab'
import { TicketPackagesIndexPage } from './tickets/TicketPackagesIndexPage'

export function EventEditPage() {
  const navigate = useNavigate()
  const { eventId } = useParams({ strict: false }) as { eventId: string }
  const search = useSearch({ strict: false }) as { tab?: string }
  const activeTab = search?.tab || 'details'
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

  // Load sponsors for tab count
  useEffect(() => {
    if (eventId) {
      fetchSponsors(eventId).catch(() => {
        // Silently fail - SponsorsTab will show error if user navigates there
      })
    }
  }, [eventId, fetchSponsors])

  // Load auction items for tab count
  useEffect(() => {
    if (eventId) {
      fetchAuctionItems(eventId).catch(() => {
        // Silently fail - auction items tab will show error if user navigates there
      })
    }
  }, [eventId, fetchAuctionItems])

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

  return (
    <div className="container mx-auto px-2 py-3 sm:px-6 sm:py-4 md:py-8 max-w-6xl">
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

      <Tabs value={activeTab} onValueChange={(value) => navigate({ to: '/events/$eventId', params: { eventId }, search: (prev) => ({ ...prev, tab: value }) })} className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9 h-auto">
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
          <TabsTrigger value="registrations" className="text-xs sm:text-sm">
            Guest<span className="hidden sm:inline"> List</span>
          </TabsTrigger>
          <TabsTrigger value="seating" className="text-xs sm:text-sm">
            Seating
          </TabsTrigger>
          <TabsTrigger value="tickets" className="text-xs sm:text-sm">
            <Ticket className="h-3 w-3 sm:mr-1 inline" />
            <span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="text-xs sm:text-sm">
            Sponsors<span className="hidden sm:inline"> ({sponsors.length})</span>
          </TabsTrigger>
          <TabsTrigger value="auction-items" className="text-xs sm:text-sm">
            <span className="hidden md:inline">Auction </span>Items<span className="hidden sm:inline"> ({auctionItems.length})</span>
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

        {/* Registrations Tab */}
        <TabsContent value="registrations">
          <div className="space-y-6">
            {/* Meal Summary Card */}
            {currentEvent.food_options && currentEvent.food_options.length > 0 && (
              <MealSummaryCard eventId={eventId} />
            )}

            {/* Attendee List */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Guest List</CardTitle>
                    <CardDescription>
                      View all registrants and their guests, manage invitations, and export attendee data
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <InviteGuestDialog
                      eventId={eventId}
                      onGuestInvited={() => {
                        // Refresh the attendee list
                        window.location.reload();
                      }}
                    />
                    <Button
                      onClick={() => {
                        const donorUrl = `${window.location.origin.replace('5173', '5174')}/events/${currentEvent.slug || eventId}/register`;
                        navigator.clipboard.writeText(donorUrl);
                        toast.success('Registration link copied to clipboard!');
                      }}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      Copy Registration Link
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AttendeeListTable
                  eventId={eventId}
                  includeMealSelections={currentEvent.food_options && currentEvent.food_options.length > 0}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Seating Tab */}
        <TabsContent value="seating">
          <Card>
            <CardHeader>
              <CardTitle>Seating Assignments</CardTitle>
              <CardDescription>
                Assign guests to tables and manage seating arrangements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SeatingTabContent
                eventId={eventId}
                tableCount={currentEvent?.table_count ?? undefined}
                maxGuestsPerTable={currentEvent?.max_guests_per_table ?? undefined}
                layoutImageUrl={currentEvent?.seating_layout_image_url ?? null}
                onLayoutImageUpdate={async (url) => {
                  try {
                    await updateEvent(eventId, {
                      seating_layout_image_url: url,
                    })
                    await loadEventById(eventId)
                  } catch {
                    toast.error('Failed to update layout image')
                  }
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets">
          <TicketPackagesIndexPage eventId={eventId} />
        </TabsContent>

        {/* Sponsors Tab */}
        <TabsContent value="sponsors">
          <Card>
            <CardHeader>
              <CardTitle>Event Sponsors</CardTitle>
              <CardDescription>
                Manage sponsors and showcase their support for your event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SponsorsTab eventId={eventId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auction Items Tab */}
        <TabsContent value="auction-items">
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
                onAdd={() => navigate({ to: '/events/$eventId/auction-items/create', params: { eventId } })}
                onEdit={(item) => navigate({ to: '/events/$eventId/auction-items/$itemId/edit', params: { eventId, itemId: item.id } })}
                onView={(item) => navigate({ to: '/events/$eventId/auction-items/$itemId', params: { eventId, itemId: item.id } })}
                onDelete={async (item) => {
                  if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;
                  const { deleteAuctionItem } = useAuctionItemStore.getState();
                  try {
                    await deleteAuctionItem(eventId, item.id);
                    toast.success('Auction item deleted successfully');
                    // Refresh the list
                    fetchAuctionItems(eventId);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Failed to delete auction item';
                    toast.error(message);
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
