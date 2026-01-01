/**
 * SeatingTabContent Component
 *
 * Main container for the interactive seating assignment interface with drag-and-drop.
 * Can be used both as a standalone page and within a tab.
 */

import { TableDetailsPanel } from '@/components/admin/seating/TableDetailsPanel'
import { AutoAssignButton } from '@/components/seating/AutoAssignButton'
import { GuestCard } from '@/components/seating/GuestCard'
import { SeatingLayoutModal } from '@/components/seating/SeatingLayoutModal'
import { TableAssignmentModal } from '@/components/seating/TableAssignmentModal'
import { TableCard } from '@/components/seating/TableCard'
import { UnassignedSection } from '@/components/seating/UnassignedSection'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import type { EventTableDetails } from '@/services/seating-service'
import { useSeatingStore } from '@/stores/seating.store'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Image, LayoutGrid, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface SeatingTabContentProps {
  eventId: string
  tableCount?: number
  maxGuestsPerTable?: number
  layoutImageUrl?: string | null
  onLayoutImageUpdate?: (url: string) => void
}

export function SeatingTabContent({
  eventId,
  tableCount: propTableCount,
  maxGuestsPerTable: propMaxGuestsPerTable,
  layoutImageUrl,
  onLayoutImageUpdate,
}: SeatingTabContentProps) {
  const [activeGuest, setActiveGuest] = useState<GuestSeatingInfo | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [layoutModalOpen, setLayoutModalOpen] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<GuestSeatingInfo | null>(
    null
  )
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false)
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | null>(null)

  const {
    tables,
    tableDetails,
    unassignedGuests,
    isLoading,
    tableCount,
    maxGuestsPerTable,
    initialize,
    loadGuests,
    assignGuestToTable,
    removeGuestFromTable,
    setDragging,
    updateTableCustomization,
  } = useSeatingStore()

  // Initialize sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  )

  // Load event data and initialize store
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        // Use props if provided, otherwise use defaults
        const finalTableCount = propTableCount || 10
        const finalMaxGuests = propMaxGuestsPerTable || 8

        initialize(eventId, finalTableCount, finalMaxGuests)
        await loadGuests()
      } catch {
        toast.error('Failed to load seating information')
      }
    }

    fetchEventData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, propTableCount, propMaxGuestsPerTable])

  const handleDragStart = (event: DragStartEvent) => {
    const guestId = event.active.id as string
    setDragging(true)

    // Find the guest being dragged
    let guest: GuestSeatingInfo | undefined

    // Check unassigned
    guest = unassignedGuests.find((g) => g.guest_id === guestId)

    // Check tables if not found in unassigned
    if (!guest) {
      for (const tableGuests of tables.values()) {
        guest = tableGuests.find((g) => g.guest_id === guestId)
        if (guest) break
      }
    }

    setActiveGuest(guest || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const startTime = performance.now()
    const { active, over } = event
    setDragging(false)
    setActiveGuest(null)

    if (!over) return

    const guestId = active.id as string
    const overId = over.id as string

    try {
      // Handle drop on table
      if (overId.startsWith('table-')) {
        const tableNumber = parseInt(overId.replace('table-', ''), 10)
        await assignGuestToTable(guestId, tableNumber)
      }
      // Handle drop on unassigned section
      else if (overId === 'unassigned') {
        await removeGuestFromTable(guestId)
      }

      // Track performance for monitoring
      const duration = performance.now() - startTime
      if (duration > 500) {
        // Performance degradation detected
        toast.warning('Seating update was slow, please refresh if needed')
      }
    } catch {
      toast.error('Failed to update seating assignment')
      throw new Error('Drag-drop operation failed')
    }
  }

  const handleDragCancel = () => {
    setDragging(false)
    setActiveGuest(null)
  }

  const handleRefresh = async () => {
    try {
      await loadGuests()
      toast.success('Seating chart refreshed')
    } catch {
      toast.error('Failed to refresh seating chart')
    }
  }

  const handleAssignClick = (guest: GuestSeatingInfo) => {
    setSelectedGuest(guest)
    setModalOpen(true)
  }

  const handleModalAssign = async (guestId: string, tableNumber: number) => {
    await assignGuestToTable(guestId, tableNumber)
  }

  const handleEditTable = (tableNumber: number) => {
    setSelectedTableNumber(tableNumber)
    setDetailsPanelOpen(true)
  }

  const handleTableUpdate = async (_updatedTable: EventTableDetails) => {
    // Optimistic update is handled by the store via updateTableCustomization
    // Just close the panel
    setDetailsPanelOpen(false)
  }

  // Calculate table occupancy for modal
  const tableOccupancy = new Map<number, number>()
  tables.forEach((guests, tableNumber) => {
    tableOccupancy.set(tableNumber, guests.length)
  })

  if (isLoading && tables.size === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  const tablesArray = Array.from(tables.entries()).map(([num, guests]) => ({
    number: num,
    guests,
  }))

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold">Seating Assignments</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLayoutModalOpen(true)}
              disabled={isLoading}
            >
              <Image className="mr-2 h-4 w-4" />
              Layout
            </Button>
            <AutoAssignButton
              eventId={eventId}
              unassignedCount={unassignedGuests.length}
              disabled={isLoading}
              onRefresh={loadGuests}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Tables</p>
            <p className="text-2xl font-bold">{tableCount}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Capacity per Table</p>
            <p className="text-2xl font-bold">{maxGuestsPerTable}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Assigned Guests</p>
            <p className="text-2xl font-bold">
              {Array.from(tables.values()).reduce(
                (sum, guests) => sum + guests.length,
                0
              )}
            </p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Unassigned</p>
            <p className="text-2xl font-bold text-amber-600">
              {unassignedGuests.length}
            </p>
          </div>
        </div>

        {/* Seating Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tables Grid - Scrollable */}
          <div className="lg:col-span-2">
            <div className="max-h-[600px] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tablesArray.map((table) => (
                  <TableCard
                    key={table.number}
                    tableNumber={table.number}
                    guests={table.guests}
                    maxCapacity={maxGuestsPerTable}
                    tableDetails={tableDetails.get(table.number)}
                    onEditTable={handleEditTable}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Unassigned Guests */}
          <div className="lg:col-span-1">
            <UnassignedSection
              guests={unassignedGuests}
              onAssignClick={handleAssignClick}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeGuest && <GuestCard guest={activeGuest} isDragging />}
      </DragOverlay>

      {/* Table Assignment Modal */}
      <TableAssignmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        guest={selectedGuest}
        tableCount={tableCount}
        maxGuestsPerTable={maxGuestsPerTable}
        tableOccupancy={tableOccupancy}
        tableDetails={tableDetails}
        onAssign={handleModalAssign}
      />

      {/* Seating Layout Modal */}
      <SeatingLayoutModal
        open={layoutModalOpen}
        onOpenChange={setLayoutModalOpen}
        eventId={eventId}
        currentImageUrl={layoutImageUrl}
        onImageUploaded={(url) => {
          if (onLayoutImageUpdate) {
            onLayoutImageUpdate(url)
          }
        }}
      />

      {/* Table Details Panel (Feature 014) */}
      <TableDetailsPanel
        eventId={eventId}
        table={selectedTableNumber ? tableDetails.get(selectedTableNumber) ?? null : null}
        isOpen={detailsPanelOpen}
        onClose={() => setDetailsPanelOpen(false)}
        onUpdate={handleTableUpdate}
      />
    </DndContext>
  )
}
