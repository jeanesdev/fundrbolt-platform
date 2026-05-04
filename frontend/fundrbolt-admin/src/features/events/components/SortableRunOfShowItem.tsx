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
  onUpdate: (
    itemId: string,
    updates: {
      title?: string
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
        onUpdate={onUpdate}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
