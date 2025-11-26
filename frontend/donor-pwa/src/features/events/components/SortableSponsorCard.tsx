/**
 * SortableSponsorCard
 * Wraps SponsorCard with drag-and-drop functionality using dnd-kit
 */

import type { Sponsor } from '@/types/sponsor'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SponsorCard } from './SponsorCard'

interface SortableSponsorCardProps {
  sponsor: Sponsor
  onEdit?: (sponsor: Sponsor) => void
  onDelete?: (sponsor: Sponsor) => void
}

export function SortableSponsorCard({
  sponsor,
  onEdit,
  onDelete,
}: SortableSponsorCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sponsor.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SponsorCard
        sponsor={sponsor}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
