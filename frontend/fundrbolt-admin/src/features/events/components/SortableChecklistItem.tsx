/**
 * SortableChecklistItem — DnD wrapper for ChecklistItemRow using @dnd-kit
 */
import type { ChecklistItem, ChecklistItemStatus } from '@/types/checklist'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChecklistItemRow } from './ChecklistItem'

interface SortableChecklistItemProps {
  item: ChecklistItem
  onStatusChange: (itemId: string, newStatus: ChecklistItemStatus) => void
  onEdit?: (item: ChecklistItem) => void
  onDelete?: (itemId: string) => void
}

export function SortableChecklistItem({
  item,
  onStatusChange,
  onEdit,
  onDelete,
}: SortableChecklistItemProps) {
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
      <ChecklistItemRow
        item={item}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}
