/**
 * EventCreatePage
 * Page for creating a new event
 */

import { NPOSelect } from '@/components/npo/npo-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { useEventStore } from '@/stores/event-store'
import type { EventCreateRequest, EventUpdateRequest } from '@/types/event'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EventForm } from './components/EventForm'

export function EventCreatePage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { createEvent, loadNPOBranding, npoBranding } = useEventStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedNpoId, setSelectedNpoId] = useState<string>('')

  // Determine NPO ID based on user role
  // Super Admin: Must select NPO from dropdown
  // NPO Admin/Staff: Auto-use their npo_id
  const isSuperAdmin = user?.role === 'super_admin'
  const npoId = isSuperAdmin ? selectedNpoId : (user?.npo_id || '')

  // Load NPO branding when NPO is selected/determined
  useEffect(() => {
    if (npoId) {
      loadNPOBranding(npoId)
    }
  }, [npoId, loadNPOBranding])

  const handleSubmit = async (data: EventCreateRequest & Partial<EventUpdateRequest>) => {
    setIsSubmitting(true)
    try {
      const createdEvent = await createEvent(data as EventCreateRequest)
      toast.success('Event created successfully!')
      navigate({ to: '/events/$eventId/edit', params: { eventId: createdEvent.id } })
    } catch (_err) {
      toast.error('Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/events' })
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

      {/* Step 1: NPO Selection (Super Admin Only) */}
      {isSuperAdmin && !selectedNpoId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Organization</CardTitle>
            <CardDescription>
              Choose which organization this event is for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <NPOSelect
              value={selectedNpoId}
              onValueChange={setSelectedNpoId}
              label="Organization"
              placeholder="Select an organization"
              required
            />
            <p className="text-sm text-muted-foreground">
              Select an organization to continue creating the event
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Event Form (shown when NPO is selected/determined) */}
      {npoId && (
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
              npoBranding={npoBranding}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      )}

      {/* Auto-show form for non-super-admin users without NPO */}
      {!isSuperAdmin && !user?.npo_id && (
        <Card>
          <CardHeader>
            <CardTitle>No Organization</CardTitle>
            <CardDescription>
              You must be associated with an organization to create events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please contact an administrator to be added to an organization.
            </p>
            <Button onClick={handleCancel} className="mt-4">
              Back to Events
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
