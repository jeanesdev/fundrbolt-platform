/**
 * TableAssignmentModal Component
 *
 * Modal dialog for manually assigning a guest to a specific table via dropdown selection.
 * Provides an alternative to drag-and-drop for accessibility and precision.
 * Feature 014: Updated to respect custom table capacities.
 */

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GuestSeatingInfo } from '@/lib/api/admin-seating'
import type { EventTableDetails } from '@/services/seating-service'
import { useState } from 'react'
import { toast } from 'sonner'

interface TableOption {
  tableNumber: number
  currentOccupancy: number
  capacity: number
  isAvailable: boolean
  tableName?: string | null
}

interface TableAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: GuestSeatingInfo | null
  tableCount: number
  maxGuestsPerTable: number
  tableOccupancy: Map<number, number>
  tableDetails?: Map<number, EventTableDetails>
  onAssign: (guestId: string, tableNumber: number) => Promise<void>
}

export function TableAssignmentModal({
  open,
  onOpenChange,
  guest,
  tableCount,
  maxGuestsPerTable,
  tableOccupancy,
  tableDetails,
  onAssign,
}: TableAssignmentModalProps) {
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)

  // Generate table options with availability info
  const tableOptions: TableOption[] = Array.from(
    { length: tableCount },
    (_, i) => {
      const tableNumber = i + 1
      const currentOccupancy = tableOccupancy.get(tableNumber) || 0

      // Use effective capacity from tableDetails if available (Feature 014)
      const detail = tableDetails?.get(tableNumber)
      const capacity = detail?.effective_capacity ?? maxGuestsPerTable
      const isAvailable = currentOccupancy < capacity

      return {
        tableNumber,
        currentOccupancy,
        capacity,
        isAvailable,
        tableName: detail?.table_name,
      }
    }
  )

  const handleAssign = async () => {
    if (!guest || !selectedTable) return

    setIsAssigning(true)
    try {
      const tableNumber = parseInt(selectedTable, 10)
      await onAssign(guest.guest_id, tableNumber)
      onOpenChange(false)
      setSelectedTable('')
    } catch {
      toast.error('Failed to assign guest to table')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleCancel = () => {
    setSelectedTable('')
    onOpenChange(false)
  }

  if (!guest) return null

  const selectedTableInfo = selectedTable
    ? tableOptions.find((t) => t.tableNumber === parseInt(selectedTable, 10))
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Table</DialogTitle>
          <DialogDescription>
            Select a table for {guest.name || 'this guest'}
            {guest.bidder_number && ` (Bidder #${guest.bidder_number})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="table-select"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Table Number
            </label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger id="table-select">
                <SelectValue placeholder="Select a table..." />
              </SelectTrigger>
              <SelectContent>
                {tableOptions.map((table) => (
                  <SelectItem
                    key={table.tableNumber}
                    value={table.tableNumber.toString()}
                    disabled={!table.isAvailable}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>
                        Table {table.tableNumber}
                        {table.tableName && ` - ${table.tableName}`}
                      </span>
                      <span
                        className={`text-xs ${table.isAvailable
                          ? 'text-muted-foreground'
                          : 'text-destructive font-medium'
                          }`}
                      >
                        {table.currentOccupancy}/{table.capacity}
                        {!table.isAvailable && ' (Full)'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table Info Preview */}
          {selectedTableInfo && (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  Table {selectedTableInfo.tableNumber}
                </span>
                <span className="text-muted-foreground">
                  {selectedTableInfo.currentOccupancy + 1}/
                  {selectedTableInfo.capacity} after assignment
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedTable || isAssigning}
          >
            {isAssigning ? 'Assigning...' : 'Assign Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
