import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SponsorsTab } from '../components/SponsorsTab'
import { useEventWorkspace } from '../EventWorkspaceContext'

export function EventSponsorsSection() {
  const { currentEvent } = useEventWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Sponsors</CardTitle>
        <CardDescription>
          Manage sponsors and showcase their support for your event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SponsorsTab eventId={currentEvent.id} />
      </CardContent>
    </Card>
  )
}
