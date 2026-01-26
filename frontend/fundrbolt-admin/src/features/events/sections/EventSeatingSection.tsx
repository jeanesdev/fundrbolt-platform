import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventWorkspace } from '../useEventWorkspace'
import { SeatingTabContent } from '@/components/seating/SeatingTabContent'
import { toast } from 'sonner'

export function EventSeatingSection() {
  const { currentEvent, updateEvent, loadEventById } = useEventWorkspace()

  if (!currentEvent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seating Assignments</CardTitle>
          <CardDescription>
            Assign guests to tables and manage seating arrangements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading event...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seating Assignments</CardTitle>
        <CardDescription>
          Assign guests to tables and manage seating arrangements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SeatingTabContent
          eventId={currentEvent.id}
          tableCount={currentEvent?.table_count ?? undefined}
          maxGuestsPerTable={currentEvent?.max_guests_per_table ?? undefined}
          layoutImageUrl={currentEvent?.seating_layout_image_url ?? null}
          onLayoutImageUpdate={async (url) => {
            try {
              await updateEvent(currentEvent.id, {
                seating_layout_image_url: url,
              })
              
              // Reload to ensure we have latest data
              await loadEventById(currentEvent.id)
              // Note: loadEventById returns void, check currentEvent after store updates
            } catch (error) {
              toast.error('Failed to update layout image')
              throw error // Re-throw so modal knows it failed
            }
          }}
        />
      </CardContent>
    </Card>
  )
}
