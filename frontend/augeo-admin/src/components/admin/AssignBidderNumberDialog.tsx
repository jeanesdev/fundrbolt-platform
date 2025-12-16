/**
 * AssignBidderNumberDialog Component
 *
 * Dialog for manually assigning or reassigning a bidder number to a guest.
 * Handles conflict resolution when the requested number is already assigned.
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { assignBidderNumber } from '@/lib/api/admin-seating'
import { AlertTriangle, Hash, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface AssignBidderNumberDialogProps {
  eventId: string
  guestId: string
  guestName: string
  currentBidderNumber?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssignmentComplete?: () => void
}

export function AssignBidderNumberDialog({
  eventId,
  guestId,
  guestName,
  currentBidderNumber,
  open,
  onOpenChange,
  onAssignmentComplete,
}: AssignBidderNumberDialogProps) {
  const [bidderNumber, setBidderNumber] = useState<string>(
    currentBidderNumber?.toString() || ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conflictInfo, setConflictInfo] = useState<{
    previous_holder_id: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const numberValue = parseInt(bidderNumber, 10)

    // Validate bidder number range
    if (isNaN(numberValue) || numberValue < 100 || numberValue > 999) {
      toast.error('Bidder number must be between 100 and 999')
      return
    }

    setIsSubmitting(true)
    setConflictInfo(null)

    try {
      const result = await assignBidderNumber(eventId, guestId, numberValue)

      // Check if a swap occurred (conflict resolution)
      if (result.previous_holder_id) {
        setConflictInfo({ previous_holder_id: result.previous_holder_id })
        toast.warning(
          `Bidder number ${numberValue} was reassigned. The previous holder was swapped to another number.`,
          { duration: 5000 }
        )
      } else {
        toast.success(
          `Bidder number ${numberValue} assigned to ${guestName} successfully!`
        )
      }

      // Close dialog and refresh
      onOpenChange(false)
      if (onAssignmentComplete) {
        onAssignmentComplete()
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to assign bidder number'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChangeInternal = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
      if (!newOpen) {
        // Reset form when closing
        setBidderNumber(currentBidderNumber?.toString() || '')
        setConflictInfo(null)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-amber-600" />
              {currentBidderNumber ? 'Reassign' : 'Assign'} Bidder Number
            </DialogTitle>
            <DialogDescription>
              {currentBidderNumber
                ? `Change bidder number for ${guestName}. Current number: ${currentBidderNumber}.`
                : `Assign a bidder number (100-999) to ${guestName}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Conflict Warning */}
            {conflictInfo && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Number Swap Occurred</p>
                    <p className="mt-1 text-amber-700">
                      The previous holder of this number was automatically
                      reassigned to another available number.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bidder Number Input */}
            <div className="grid gap-2">
              <Label htmlFor="bidder-number">
                Bidder Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bidder-number"
                type="number"
                min={100}
                max={999}
                placeholder="100-999"
                value={bidderNumber}
                onChange={(e) => setBidderNumber(e.target.value)}
                required
                disabled={isSubmitting}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Three-digit number between 100 and 999. If already assigned, the
                numbers will be automatically swapped.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChangeInternal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Hash className="mr-2 h-4 w-4" />
                  Assign Number
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
