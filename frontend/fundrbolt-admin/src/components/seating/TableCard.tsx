/**
 * TableCard Component
 *
 * Displays a table with its assigned guests as a droppable zone for drag-and-drop.
 * Feature 014: Integrated with TableDetailsPanel for table customization.
 */
import type { EventTableDetails } from '@/services/seating-service'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, Crown, Settings, Users } from 'lucide-react'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableCapacityTooltip } from '@/components/admin/seating/TableCapacityTooltip'
import { GuestCard } from './GuestCard'

interface TableCardProps {
  tableNumber: number
  guests: GuestSeatingInfo[]
  maxCapacity: number
  tableDetails?: EventTableDetails
  onGuestClick?: (guest: GuestSeatingInfo) => void
  onEditTable?: (tableNumber: number) => void
}

export function TableCard({
  tableNumber,
  guests,
  maxCapacity,
  tableDetails,
  onGuestClick,
  onEditTable,
}: TableCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `table-${tableNumber}`,
    data: {
      type: 'table',
      tableNumber,
    },
  })

  // Use effective capacity from tableDetails if available (Feature 014)
  const effectiveCapacity = tableDetails?.effective_capacity ?? maxCapacity
  const currentOccupancy = tableDetails?.current_occupancy ?? guests.length
  const isFull = tableDetails?.is_full ?? currentOccupancy >= effectiveCapacity
  const availableSeats = effectiveCapacity - currentOccupancy
  const tableName = tableDetails?.table_name ?? null

  // Display name: "Table N - Name" or "Table N"
  const displayName = tableName
    ? `Table ${tableNumber} - ${tableName}`
    : `Table ${tableNumber}`

  return (
    <Card
      ref={setNodeRef}
      className={`transition-all ${isOver ? 'ring-primary bg-primary/5 ring-2' : ''} ${isFull ? 'border-green-500/50 bg-green-500/5' : ''} `}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg font-semibold'>{displayName}</CardTitle>
          <div className='flex items-center gap-2'>
            {/* Occupancy Badge */}
            <Badge
              variant={isFull ? 'default' : 'secondary'}
              className={`font-mono ${isFull ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
              {currentOccupancy}/{effectiveCapacity}
            </Badge>
            {/* Status Icon with Tooltip for full tables */}
            {isFull ? (
              <TableCapacityTooltip
                tableNumber={tableNumber}
                tableName={tableName}
                currentOccupancy={currentOccupancy}
                effectiveCapacity={effectiveCapacity}
              />
            ) : currentOccupancy > 0 ? (
              <Users className='text-muted-foreground h-4 w-4' />
            ) : (
              <Check className='text-muted-foreground h-4 w-4' />
            )}
            {/* Edit Button (Feature 014) */}
            {onEditTable && (
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6'
                onClick={() => onEditTable(tableNumber)}
                title='Edit table details'
              >
                <Settings className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        </div>
        {availableSeats > 0 && (
          <p className='text-muted-foreground text-xs'>
            {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
          </p>
        )}
        {tableDetails?.custom_capacity && (
          <p className='text-xs text-blue-600'>
            Custom capacity: {tableDetails.custom_capacity} (default:{' '}
            {maxCapacity})
          </p>
        )}
        {tableDetails?.table_captain && (
          <div className='flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-500'>
            <Crown className='h-3.5 w-3.5' />
            <span className='font-medium'>
              Captain: {tableDetails.table_captain.first_name}{' '}
              {tableDetails.table_captain.last_name}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className='space-y-2'>
        {guests.length === 0 ? (
          <div className='text-muted-foreground flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-center text-sm'>
            <div>
              <Users className='mx-auto mb-2 h-8 w-8 opacity-50' />
              <p>No guests assigned</p>
              <p className='mt-1 text-xs'>Drag guests here to assign</p>
            </div>
          </div>
        ) : (
          <SortableContext
            items={guests.map((g) => g.guest_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className='space-y-2'>
              {guests.map((guest) => (
                <div
                  key={guest.guest_id}
                  onClick={() => onGuestClick?.(guest)}
                  className='cursor-pointer'
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
