/**
 * UnassignedSection Component
 *
 * Lists guests who don't have table assignments yet, acts as a droppable zone.
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Search, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
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
      className={`
        transition-all h-full flex flex-col
        ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''}
      `}
    >
      <CardHeader>
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-lg font-semibold">
            Unassigned Guests
          </CardTitle>
          <Badge variant="secondary" className="font-mono">
            {guests.length}
          </Badge>
        </div>

        {/* Search Input */}
        {guests.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {guests.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-center text-sm text-muted-foreground">
            <div>
              <UserX className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">All guests assigned!</p>
              <p className="text-xs mt-1">Every guest has a table</p>
            </div>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-center text-sm text-muted-foreground">
            <div>
              <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No guests match your search</p>
            </div>
          </div>
        ) : (
          <SortableContext
            items={filteredGuests.map((g) => g.guest_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredGuests.map((guest) => (
                <div
                  key={guest.guest_id}
                  onClick={() => onGuestClick?.(guest)}
                >
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
