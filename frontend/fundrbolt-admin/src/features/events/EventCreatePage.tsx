/**
 * EventCreatePage
 * Page for creating a new event
 */

import { NPOSelect } from '@/components/npo/npo-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { useEventStore } from '@/stores/event-store'
import type { EventCreateRequest, EventUpdateRequest } from '@/types/event'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EventForm } from './components/EventForm'

export function EventCreatePage() {
  const navigate = useNavigate()
  const { isSuperAdmin, npoId } = useAuth()
  const { createEvent, loadNPOBranding, npoBranding, npoBrandingLoading } = useEventStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedNpoId, setSelectedNpoId] = useState<string>('')

  // Determine NPO ID based on user role
  // Super Admin: Must select NPO from dropdown
  // NPO Admin/Staff: Auto-use their npo_id
  const effectiveNpoId = isSuperAdmin ? selectedNpoId : npoId || ''

  // Load NPO branding when NPO is selected/determined
  useEffect(() => {
    if (effectiveNpoId) {
      loadNPOBranding(effectiveNpoId)
    }
  }, [effectiveNpoId, loadNPOBranding])

  const handleSubmit = async (data: EventCreateRequest & Partial<EventUpdateRequest>) => {
    setIsSubmitting(true)
    try {
      const createdEvent = await createEvent(data as EventCreateRequest)

      if (!createdEvent?.id) {
        throw new Error('Event created but no ID returned from server')
      }

      toast.success('Event created successfully!')
      navigate({ to: '/events/$eventId/edit', params: { eventId: createdEvent.id } })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/events' })
  }

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-4xl">
      <div className="mb-4 md:mb-6 space-y-4">
        <Button variant="ghost" onClick={handleCancel} className="px-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Create New Event</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
            Set up a new fundraising event for your organization
          </p>
        </div>
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
      {effectiveNpoId && !npoBrandingLoading && (
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
              npoId={effectiveNpoId}
              npoBranding={npoBranding}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      )}

      {/* Loading state while branding loads */}
      {effectiveNpoId && npoBrandingLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading Organization Details...</CardTitle>
            <CardDescription>
              Please wait while we load the organization's branding
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading branding...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-show form for non-super-admin users without NPO */}
      {!isSuperAdmin && !npoId && (
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
