/**
 * EventChecklistPage — Full-page view of the planning checklist for an event.
 * Accessible via /events/:eventId/checklist
 */
import { ChecklistPanel } from '@/features/events/components/ChecklistPanel'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

export function EventChecklistPage() {
  const { currentEvent } = useEventWorkspace()

  return (
    <div className='space-y-4'>
      <ChecklistPanel eventId={currentEvent.id} npoId={currentEvent.npo_id} />
    </div>
  )
}
