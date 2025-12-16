/**
 * GuestCard Component
 *
 * Draggable card displaying guest information for seating assignments.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Hash, Mail, MapPin, Users } from 'lucide-react'

interface GuestCardProps {
  guest: GuestSeatingInfo
  isDragging?: boolean
  isPartyMember?: boolean
  partySize?: number
  onAssignClick?: (guest: GuestSeatingInfo) => void
  showAssignButton?: boolean
}

export function GuestCard({
  guest,
  isDragging = false,
  isPartyMember = false,
  partySize,
  onAssignClick,
  showAssignButton = false,
}: GuestCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: guest.guest_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  const handleAssignClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAssignClick?.(guest)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`
        cursor-move transition-shadow hover:shadow-md
        ${isDragging || isSortableDragging ? 'shadow-lg ring-2 ring-primary' : ''}
        ${isPartyMember ? 'border-l-4 border-l-blue-500' : ''}
      `}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <GripVertical className="mt-1 h-4 w-4 text-muted-foreground flex-shrink-0" />

          <div className="flex-1 min-w-0">
            {/* Guest Name */}
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-sm truncate">
                {guest.name || 'Unknown Guest'}
              </p>
              {partySize && partySize > 1 && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="mr-1 h-3 w-3" />
                  {partySize}
                </Badge>
              )}
            </div>

            {/* Guest Email */}
            {guest.email && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <Mail className="h-3 w-3" />
                <span className="truncate">{guest.email}</span>
              </div>
            )}

            {/* Bidder Number */}
            {guest.bidder_number && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200 font-mono font-semibold text-xs"
              >
                <Hash className="mr-1 h-3 w-3" />
                {guest.bidder_number}
              </Badge>
            )}

            {/* Assign Table Button */}
            {showAssignButton && onAssignClick && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleAssignClick}
              >
                <MapPin className="mr-2 h-3 w-3" />
                Assign Table
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
