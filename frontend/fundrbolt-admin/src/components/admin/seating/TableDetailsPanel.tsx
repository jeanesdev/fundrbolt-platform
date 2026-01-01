/**
 * TableDetailsPanel Component
 * Feature 014: User Story 1, 2, 3
 * Panel for editing table customization (capacity, name, captain)
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { updateTableDetails, type EventTableDetails } from '@/services/seating-service'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface TableDetailsPanelProps {
  eventId: string
  table: EventTableDetails | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedTable: EventTableDetails) => void
}

export function TableDetailsPanel({
  eventId,
  table,
  isOpen,
  onClose,
  onUpdate,
}: TableDetailsPanelProps) {
  const { toast } = useToast()
  const [customCapacity, setCustomCapacity] = useState<string>('')
  const [tableName, setTableName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when table changes
  useEffect(() => {
    if (table) {
      setCustomCapacity(table.custom_capacity?.toString() ?? '')
      setTableName(table.table_name ?? '')
    }
  }, [table])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!table) return

    setIsSubmitting(true)

    try {
      // Parse capacity (null if empty, number otherwise)
      const capacityValue =
        customCapacity.trim() === '' ? null : parseInt(customCapacity, 10)

      // Validate capacity range (1-20)
      if (capacityValue !== null && (capacityValue < 1 || capacityValue > 20)) {
        toast({
          title: 'Invalid Capacity',
          description: 'Capacity must be between 1 and 20',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      // Prepare update request
      const updates = {
        custom_capacity: capacityValue,
        table_name: tableName.trim() === '' ? null : tableName.trim(),
      }

      const updatedTable = await updateTableDetails(eventId, table.table_number, updates)

      onUpdate(updatedTable)

      toast({
        title: 'Table Updated',
        description: `Table ${table.table_number} customization saved`,
      })

      onClose()
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { detail?: string } } }

      let errorMessage = 'Failed to update table customization'
      if (err.response?.status === 409) {
        errorMessage = err.response.data?.detail || 'Table capacity conflict'
      } else if (err.response?.status === 422) {
        errorMessage = 'Invalid input: ' + (err.response.data?.detail || 'Validation error')
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail
      }

      toast({
        title: 'Update Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearCapacity = () => {
    setCustomCapacity('')
  }

  const handleClearName = () => {
    setTableName('')
  }

  if (!table) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Table {table.table_number} Details</SheetTitle>
          <SheetDescription>
            Customize capacity, name, and captain for this table
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Custom Capacity Input (User Story 1) */}
          <div className="space-y-2">
            <Label htmlFor="custom-capacity">Custom Capacity</Label>
            <div className="flex gap-2">
              <Input
                id="custom-capacity"
                type="number"
                min="1"
                max="20"
                value={customCapacity}
                onChange={(e) => setCustomCapacity(e.target.value)}
                placeholder={`Default: ${table.effective_capacity}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleClearCapacity}
                disabled={!customCapacity}
              >
                Clear
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current: {table.current_occupancy}/{table.effective_capacity} seats occupied
            </p>
          </div>

          {/* Table Name Input (User Story 2) */}
          <div className="space-y-2">
            <Label htmlFor="table-name">Table Name</Label>
            <div className="flex gap-2">
              <Input
                id="table-name"
                type="text"
                maxLength={50}
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="e.g., VIP Sponsors, Youth Group"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleClearName}
                disabled={!tableName}
              >
                Clear
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional friendly name (max 50 characters)
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
