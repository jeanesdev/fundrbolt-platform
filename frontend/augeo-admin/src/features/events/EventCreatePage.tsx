/**
 * EventCreatePage
 * Page for creating a new event
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventStore } from '@/stores/event-store'
import type { EventCreateRequest, EventUpdateRequest } from '@/types/event'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EventForm } from './components/EventForm'
import { Button } from '@/components/ui/button'

export function EventCreatePage() {
  const navigate = useNavigate()
  const { createEvent } = useEventStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // TODO: Get npoId from context or user session
  const npoId = 'temp-npo-id' // Replace with actual NPO ID from auth context

  const handleSubmit = async (data: EventCreateRequest & Partial<EventUpdateRequest>) => {
    setIsSubmitting(true)
    try {
      await createEvent(data as EventCreateRequest)
      toast.success('Event created successfully!')
      // TODO: Fix navigation types when routes are set up
      navigate({ to: '/' })
    } catch (_err) {
      toast.error('Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/' })
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={handleCancel} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>

        <h1 className="text-3xl font-bold">Create New Event</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new fundraising event for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Fill in the information below to create your event. You can add media,
            links, and food options after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm
            npoId={npoId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  )
}
