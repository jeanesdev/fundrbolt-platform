/**
 * TableCard Component
 *
 * Displays a table with its assigned guests as a droppable zone for drag-and-drop.
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { AlertCircle, Check, Users } from 'lucide-react'
import { GuestCard } from './GuestCard'

interface TableCardProps {
  tableNumber: number
  guests: GuestSeatingInfo[]
  maxCapacity: number
  onGuestClick?: (guest: GuestSeatingInfo) => void
}

export function TableCard({
  tableNumber,
  guests,
  maxCapacity,
  onGuestClick,
}: TableCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `table-${tableNumber}`,
    data: {
      type: 'table',
      tableNumber,
    },
  })

  const currentOccupancy = guests.length
  const isFull = currentOccupancy >= maxCapacity
  const availableSeats = maxCapacity - currentOccupancy

  return (
    <Card
      ref={setNodeRef}
      className={`
        transition-all
        ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''}
        ${isFull ? 'border-destructive/50 bg-destructive/5' : ''}
      `}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Table {tableNumber}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Occupancy Badge */}
            <Badge
              variant={isFull ? 'destructive' : 'secondary'}
              className="font-mono"
            >
              {currentOccupancy}/{maxCapacity}
            </Badge>
            {/* Status Icon */}
            {isFull ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : currentOccupancy > 0 ? (
              <Users className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Check className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        {availableSeats > 0 && (
          <p className="text-xs text-muted-foreground">
            {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {guests.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            <div>
              <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No guests assigned</p>
              <p className="text-xs mt-1">Drag guests here to assign</p>
            </div>
          </div>
        ) : (
          <SortableContext
            items={guests.map((g) => g.guest_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {guests.map((guest) => (
                <div
                  key={guest.guest_id}
                  onClick={() => onGuestClick?.(guest)}
                  className="cursor-pointer"
                >
                  <GuestCard guest={guest} />
                </div>
              ))}
            </div>
          </SortableContext>
        )}
      </CardContent>
    </Card>
  )
}
