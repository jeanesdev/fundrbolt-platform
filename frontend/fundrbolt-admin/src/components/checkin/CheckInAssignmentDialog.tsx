import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkinService } from '@/services/checkin-service'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CheckInAssignmentDialogProps {
  open: boolean
  eventId: string
  attendeeName: string
  onConfirm: (bidderNumber: number, tableNumber: number | null) => void
  onCancel: () => void
}

export function CheckInAssignmentDialog({
  open,
  eventId,
  attendeeName,
  onConfirm,
  onCancel,
}: CheckInAssignmentDialogProps) {
  const [bidderInput, setBidderInput] = useState('')
  const [tableInput, setTableInput] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['next-assignment', eventId],
    queryFn: () => checkinService.getNextAssignment(eventId),
    enabled: open,
    staleTime: 0,
  })

  // Pre-fill when data arrives
  useEffect(() => {
    if (data) {
      setBidderInput(String(data.next_bidder_number))
      setTableInput(data.next_table_number != null ? String(data.next_table_number) : '')
    }
  }, [data])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setBidderInput('')
      setTableInput('')
    }
  }, [open])

  const bidderNumber = parseInt(bidderInput, 10)
  const tableNumber = tableInput.trim() !== '' ? parseInt(tableInput, 10) : null

  const bidderValid =
    !isNaN(bidderNumber) && bidderNumber >= 100 && bidderNumber <= 999
  const tableValid =
    tableNumber === null || (!isNaN(tableNumber) && tableNumber >= 1)

  const canSubmit = bidderValid && tableValid && !isLoading

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm(bidderNumber, tableNumber)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Check In Attendee</DialogTitle>
          <DialogDescription>
            Assign a bidder number and table to{' '}
            <span className="font-medium text-foreground">{attendeeName}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bidder-number">
                Bidder Number{' '}
                <span className="text-muted-foreground font-normal">
                  (100–999)
                </span>
              </Label>
              <Input
                id="bidder-number"
                type="number"
                min={100}
                max={999}
                value={bidderInput}
                onChange={(e) => setBidderInput(e.target.value)}
                className={
                  bidderInput && !bidderValid ? 'border-destructive' : ''
                }
              />
              {bidderInput && !bidderValid && (
                <p className="text-xs text-destructive">
                  Must be between 100 and 999
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="table-number">
                Table Number{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="table-number"
                type="number"
                min={1}
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                placeholder="Leave blank to skip"
                className={
                  tableInput && !tableValid ? 'border-destructive' : ''
                }
              />
              {tableInput && !tableValid && (
                <p className="text-xs text-destructive">
                  Must be a positive number
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            Check In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
