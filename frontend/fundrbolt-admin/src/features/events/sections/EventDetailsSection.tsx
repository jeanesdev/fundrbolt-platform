import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EventForm } from '../components/EventForm'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventDetailsSection() {
  const { currentEvent, npoBranding, handleSubmit, handleCancel, isSubmitting } = useEventWorkspace()

  return (
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
  )
}
