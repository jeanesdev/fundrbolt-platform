/**
 * SortableRunOfShowItem — DnD wrapper for RunOfShowItemRow using @dnd-kit
 */
import type { RunOfShowItem } from '@/types/run-of-show'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RunOfShowItemRow } from './RunOfShowItem'

interface SortableRunOfShowItemProps {
  eventId: string
  item: RunOfShowItem
  /** ISO datetime of the event start — passed through for time-only editing */
  eventDate?: string
  onUpdate: (
    itemId: string,
    updates: {
      title?: string
      description?: string | null
      scheduled_time?: string
      donor_visible?: boolean
      auctioneer_visible?: boolean
    }
  ) => void
  onDelete: (itemId: string) => void
  onToggleComplete: (itemId: string, isComplete: boolean) => void
}

export function SortableRunOfShowItem({
  eventId,
  item,
  eventDate,
  onUpdate,
  onDelete,
  onToggleComplete,
}: SortableRunOfShowItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <RunOfShowItemRow
        eventId={eventId}
        item={item}
        eventDate={eventDate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
