import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EventCheckinTab } from '../components/EventCheckinTab'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventCheckinSection() {
  const { currentEvent } = useEventWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Check-in</CardTitle>
        <CardDescription>
          Search for guests and manage check-ins for your event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EventCheckinTab eventId={currentEvent.id} />
      </CardContent>
    </Card>
  )
}
