/**
 * SeatingTab Component
 *
 * Standalone page for seating assignments.
 */

import { SeatingTabContent } from '@/components/seating/SeatingTabContent'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/events/$eventId/seating')({
  component: SeatingTab,
})

function SeatingTab() {
  const { eventId } = Route.useParams()

  return (
    <div className="container mx-auto py-6">
      <SeatingTabContent eventId={eventId} />
    </div>
  )
}
