/**
 * GuestCard Component
 *
 * Draggable card displaying guest information for seating assignments.
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Hash,
  Mail,
  MapPin,
  UserCheck,
  Users,
} from 'lucide-react'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
      className={`cursor-move transition-shadow hover:shadow-md ${isDragging || isSortableDragging ? 'ring-primary shadow-lg ring-2' : ''} ${isPartyMember ? 'border-l-4 border-l-blue-500' : ''} `}
      {...attributes}
      {...listeners}
    >
      <CardContent className='p-3'>
        <div className='flex items-start gap-2'>
          {/* Drag Handle */}
          <GripVertical className='text-muted-foreground mt-1 h-4 w-4 flex-shrink-0' />

          <div className='min-w-0 flex-1'>
            {/* Guest Name */}
            <div className='mb-1 flex items-center gap-2'>
              <p className='truncate text-sm font-medium'>
                {guest.name || 'Unknown Guest'}
              </p>
              {partySize && partySize > 1 && (
                <Badge variant='secondary' className='text-xs'>
                  <Users className='mr-1 h-3 w-3' />
                  {partySize}
                </Badge>
              )}
            </div>

            {/* Guest Email */}
            {guest.email && (
              <div className='text-muted-foreground mb-2 flex items-center gap-1 text-xs'>
                <Mail className='h-3 w-3' />
                <span className='truncate'>{guest.email}</span>
              </div>
            )}

            {/* Guest of Primary Registrant Indicator */}
            {guest.is_guest_of_primary && guest.primary_registrant_name && (
              <div className='text-muted-foreground mb-2 flex items-center gap-1 text-xs'>
                <UserCheck className='h-3 w-3 text-blue-500' />
                <span className='truncate'>
                  Guest of{' '}
                  <span className='font-medium'>
                    {guest.primary_registrant_name}
                  </span>
                </span>
              </div>
            )}

            {/* Bidder Number */}
            {guest.bidder_number && (
              <Badge
                variant='outline'
                className='border-amber-200 bg-amber-50 font-mono text-xs font-semibold text-amber-700'
              >
                <Hash className='mr-1 h-3 w-3' />
                {guest.bidder_number}
              </Badge>
            )}

            {/* Assign Table Button */}
            {showAssignButton && onAssignClick && (
              <Button
                variant='outline'
                size='sm'
                className='mt-2 w-full'
                onClick={handleAssignClick}
              >
                <MapPin className='mr-2 h-3 w-3' />
                Assign Table
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
