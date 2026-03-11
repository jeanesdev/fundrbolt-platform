/**
 * UnassignedSection Component
 *
 * Lists guests who don't have table assignments yet, acts as a droppable zone.
 */
import { useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Search, UserX } from 'lucide-react'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GuestCard } from './GuestCard'

interface UnassignedSectionProps {
  guests: GuestSeatingInfo[]
  onGuestClick?: (guest: GuestSeatingInfo) => void
  onAssignClick?: (guest: GuestSeatingInfo) => void
}

export function UnassignedSection({
  guests,
  onGuestClick,
  onAssignClick,
}: UnassignedSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
    data: {
      type: 'unassigned',
    },
  })

  // Filter guests by search query
  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return guests

    const query = searchQuery.toLowerCase()
    return guests.filter(
      (guest) =>
        guest.name?.toLowerCase().includes(query) ||
        guest.email?.toLowerCase().includes(query) ||
        guest.bidder_number?.toString().includes(query)
    )
  }, [guests, searchQuery])

  return (
    <Card
      ref={setNodeRef}
      className={`flex h-full flex-col transition-all ${isOver ? 'ring-primary bg-primary/5 ring-2' : ''} `}
    >
      <CardHeader>
        <div className='mb-3 flex items-center justify-between'>
          <CardTitle className='text-lg font-semibold'>
            Unassigned Guests
          </CardTitle>
          <Badge variant='secondary' className='font-mono'>
            {guests.length}
          </Badge>
        </div>

        {/* Search Input */}
        {guests.length > 0 && (
          <div className='relative'>
            <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
            <Input
              placeholder='Search guests...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>
        )}
      </CardHeader>

      <CardContent className='flex-1 overflow-auto'>
        {guests.length === 0 ? (
          <div className='text-muted-foreground flex items-center justify-center py-12 text-center text-sm'>
            <div>
              <UserX className='mx-auto mb-3 h-12 w-12 opacity-50' />
              <p className='font-medium'>All guests assigned!</p>
              <p className='mt-1 text-xs'>Every guest has a table</p>
            </div>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className='text-muted-foreground flex items-center justify-center py-12 text-center text-sm'>
            <div>
              <Search className='mx-auto mb-2 h-8 w-8 opacity-50' />
              <p>No guests match your search</p>
            </div>
          </div>
        ) : (
          <SortableContext
            items={filteredGuests.map((g) => g.guest_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className='space-y-2'>
              {filteredGuests.map((guest) => (
                <div key={guest.guest_id} onClick={() => onGuestClick?.(guest)}>
                  <GuestCard
                    guest={guest}
                    showAssignButton={!!onAssignClick}
                    onAssignClick={onAssignClick}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        )}
      </CardContent>
    </Card>
  )
}
