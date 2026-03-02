/**
 * SponsorList
 * Displays a grid of sponsors grouped by logo size with drag-and-drop reordering
 */

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Sponsor } from '@/types/sponsor'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable'
import { AlertCircle, Building2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SortableSponsorCard } from './SortableSponsorCard'
import { SponsorCard } from './SponsorCard'

interface SponsorListProps {
  sponsors: Sponsor[]
  isLoading?: boolean
  error?: string | null
  onAdd?: () => void
  onEdit?: (sponsor: Sponsor) => void
  onDelete?: (sponsor: Sponsor) => void
  onReorder?: (sponsorIds: string[]) => Promise<void>
  readOnly?: boolean
}

export function SponsorList({
  sponsors,
  isLoading = false,
  error = null,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  readOnly = false,
}: SponsorListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localSponsors, setLocalSponsors] = useState<Sponsor[]>(sponsors)

  // Update local sponsors when prop changes
  useEffect(() => {
    setLocalSponsors(sponsors)
  }, [sponsors])

  // Sensors for drag-and-drop (require 5px movement to prevent accidental drags)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    // Find indices of dragged and target sponsors
    const oldIndex = localSponsors.findIndex((s) => s.id === active.id)
    const newIndex = localSponsors.findIndex((s) => s.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Optimistic update - reorder locally
    const reordered = arrayMove(localSponsors, oldIndex, newIndex)
    setLocalSponsors(reordered)

    // Call onReorder with new order
    if (onReorder) {
      try {
        await onReorder(reordered.map((s) => s.id))
      } catch {
        // Revert on error - localSponsors will sync back from props
        setLocalSponsors(sponsors)
      }
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  // Group sponsors by sponsor_level (or 'other' if no level)
  const groupedSponsors = localSponsors.reduce(
    (acc, sponsor) => {
      const level = sponsor.sponsor_level || 'other'
      if (!acc[level]) {
        acc[level] = []
      }
      acc[level].push(sponsor)
      return acc
    },
    {} as Record<string, Sponsor[]>
  )

  // Get unique sponsor levels from the data, sorted by total sponsor count (descending)
  const sponsorLevels = Object.entries(groupedSponsors)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([level]) => level)

  const activeSponsor = activeId
    ? localSponsors.find((s) => s.id === activeId)
    : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (sponsors.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No sponsors yet</h3>
        <p className="text-muted-foreground mb-6">
          Add sponsors to showcase their support for your event
        </p>
        {!readOnly && onAdd && (
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Sponsor
          </Button>
        )}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-8">
        {/* Add Button */}
        {!readOnly && onAdd && (
          <div className="flex justify-end">
            <Button onClick={onAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Sponsor
            </Button>
          </div>
        )}

        {/* Grouped Sponsors */}
        {sponsorLevels.map((level) => {
          const levelSponsors = groupedSponsors[level]
          if (!levelSponsors || levelSponsors.length === 0) return null

          // Format the level name for display
          const displayName = level === 'other'
            ? 'Other Sponsors'
            : `${level} Sponsors`

          return (
            <div key={level} className="space-y-4">
              <h3 className="text-xl font-semibold border-b pb-2">
                {displayName}
              </h3>
              <SortableContext
                items={levelSponsors.map((s) => s.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {levelSponsors.map((sponsor) =>
                    readOnly || !onReorder ? (
                      <SponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        readOnly={readOnly}
                      />
                    ) : (
                      <SortableSponsorCard
                        key={sponsor.id}
                        sponsor={sponsor}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    )
                  )}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeSponsor && (
          <div className="opacity-50">
            <SponsorCard sponsor={activeSponsor} readOnly />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
