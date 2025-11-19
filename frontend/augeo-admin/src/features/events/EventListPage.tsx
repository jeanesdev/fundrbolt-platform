/**
 * EventListPage
 * Displays list of events with filters and status grouping
 */

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useEventStore } from '@/stores/event-store'
import type { EventStatus } from '@/types/event'
import { useNavigate } from '@tanstack/react-router'
import { Building2, Calendar, Clock, MapPin, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export function EventListPage() {
  const navigate = useNavigate()
  const { events, eventsLoading, loadEvents, publishEvent, closeEvent, deleteEvent } = useEventStore()
  const { selectedNpoId } = useNpoContext()
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all')

  const loadEventsCallback = useCallback(() => {
    const params = selectedNpoId ? { npo_id: selectedNpoId } : undefined
    loadEvents(params).catch((_err) => {
      toast.error('Failed to load events')
    })
  }, [loadEvents, selectedNpoId])

  useEffect(() => {
    loadEventsCallback()
  }, [loadEventsCallback])

  const handleCreateClick = () => {
    navigate({ to: '/events/create' })
  }

  const handleEditClick = (eventId: string) => {
    navigate({ to: '/events/$eventId/edit', params: { eventId } })
  }

  const handlePublish = async (eventId: string) => {
    try {
      await publishEvent(eventId)
      toast.success('Event published successfully')
    } catch (_err) {
      toast.error('Failed to publish event')
    }
  }

  const handleClose = async (eventId: string) => {
    if (!confirm('Close this event? It will no longer accept new bids.')) return

    try {
      await closeEvent(eventId)
      toast.success('Event closed successfully')
    } catch (_err) {
      toast.error('Failed to close event')
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return

    try {
      await deleteEvent(eventId)
      toast.success('Event deleted successfully')
      loadEventsCallback()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event'
      toast.error(errorMessage)
    }
  }

  const filteredEvents = events.filter((event) => {
    if (statusFilter === 'all') return true
    return event.status === statusFilter
  })

  const draftEvents = events.filter((e) => e.status === 'draft')
  const activeEvents = events.filter((e) => e.status === 'active')
  const closedEvents = events.filter((e) => e.status === 'closed')

  const formatEventDate = (datetime: string, timezone: string) => {
    const date = new Date(datetime)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${timezone})`
  }

  const getStatusBadge = (status: EventStatus) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const EventCard = ({ event }: { event: typeof events[0] }) => (
    <Card key={event.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{event.name}</CardTitle>
            {event.tagline && (
              <CardDescription>{event.tagline}</CardDescription>
            )}
          </div>
          {getStatusBadge(event.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          {event.npo_name && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{event.npo_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatEventDate(event.event_datetime, event.timezone)}</span>
          </div>
          {event.venue_name && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{event.venue_name}</span>
              {event.venue_city && <span>• {event.venue_city}, {event.venue_state}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditClick(event.id)}
          >
            Edit
          </Button>

          {event.status === 'draft' && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => handlePublish(event.id)}
              >
                Publish
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(event.id)}
              >
                Delete
              </Button>
            </>
          )}

          {event.status === 'active' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleClose(event.id)}
            >
              Close
            </Button>
          )}

          {event.status === 'closed' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(event.id)}
            >
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Manage your fundraising events
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as EventStatus | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs View */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All ({events.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({draftEvents.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeEvents.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({closedEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No events found</p>
                <Button className="mt-4" onClick={handleCreateClick}>
                  Create Your First Event
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredEvents.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          {draftEvents.map((event) => <EventCard key={event.id} event={event} />)}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeEvents.map((event) => <EventCard key={event.id} event={event} />)}
        </TabsContent>

        <TabsContent value="closed" className="space-y-4">
          {closedEvents.map((event) => <EventCard key={event.id} event={event} />)}
        </TabsContent>
      </Tabs>
    </div>
  )
}
