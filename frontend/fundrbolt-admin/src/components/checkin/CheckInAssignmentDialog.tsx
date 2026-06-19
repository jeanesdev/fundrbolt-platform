import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { checkinService } from '@/services/checkin-service'
import { Loader2, Lock } from 'lucide-react'
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

interface CheckInAssignmentDialogProps {
  open: boolean
  eventId: string
  attendeeName: string
  initialBidderNumber?: number | null
  initialTableNumber?: number | null
  requireEditToChange?: boolean
  onConfirm: (bidderNumber: number, tableNumber: number | null) => void
  onCancel: () => void
}

export function CheckInAssignmentDialog({
  open,
  eventId,
  attendeeName,
  initialBidderNumber,
  initialTableNumber,
  requireEditToChange = false,
  onConfirm,
  onCancel,
}: CheckInAssignmentDialogProps) {
  const [bidderInput, setBidderInput] = useState('')
  const [tableInput, setTableInput] = useState('')
  const [isEditingAssignments, setIsEditingAssignments] = useState(false)

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['next-assignment', eventId],
    queryFn: () => checkinService.getNextAssignment(eventId),
    enabled: open && Boolean(eventId),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Pre-fill suggestions when data arrives, but do not overwrite existing values.
  useEffect(() => {
    if (data) {
      setBidderInput((prev) =>
        prev === '' ? String(data.next_bidder_number) : prev
      )
      setTableInput((prev) =>
        prev === ''
          ? data.next_table_number != null
            ? String(data.next_table_number)
            : ''
          : prev
      )
    }
  }, [data])

  // Initialize dialog values on open and reset on close.
  useEffect(() => {
    if (open) {
      setBidderInput(
        initialBidderNumber != null ? String(initialBidderNumber) : ''
      )
      setTableInput(
        initialTableNumber != null ? String(initialTableNumber) : ''
      )
      setIsEditingAssignments(!requireEditToChange)
      return
    }

    if (!open) {
      setBidderInput('')
      setTableInput('')
      setIsEditingAssignments(false)
    }
  }, [open, initialBidderNumber, initialTableNumber, requireEditToChange])

  const bidderNumber = parseInt(bidderInput, 10)
  const tableNumber = tableInput.trim() !== '' ? parseInt(tableInput, 10) : null

  const bidderValid =
    !isNaN(bidderNumber) && bidderNumber >= 100 && bidderNumber <= 999
  const tableValid =
    tableNumber === null || (!isNaN(tableNumber) && tableNumber >= 1)

  const canSubmit = bidderValid && tableValid
  const isInitialLoading = open && isPending && !data
  const assignmentsLocked = requireEditToChange && !isEditingAssignments

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm(bidderNumber, tableNumber)
  }

  const handleAutoAssignBidder = () => {
    if (!data) return
    setBidderInput(String(data.next_bidder_number))
  }

  const handleAutoAssignTable = () => {
    if (!data || data.next_table_number == null) {
      setTableInput('')
      return
    }
    setTableInput(String(data.next_table_number))
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Check In Attendee</DialogTitle>
          <DialogDescription>
            Assign a bidder number and table to{' '}
            <span className='text-foreground font-medium'>{attendeeName}</span>
          </DialogDescription>
        </DialogHeader>

        {requireEditToChange && (
          <div className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
            <span className='text-muted-foreground'>
              Existing bidder/table assignments are locked.
            </span>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => setIsEditingAssignments(true)}
              disabled={isEditingAssignments}
            >
              {isEditingAssignments ? 'Editing Enabled' : 'Edit'}
            </Button>
          </div>
        )}

        <div className='space-y-3 py-2'>
          {isInitialLoading && (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Fetching suggested bidder and table numbers...
            </div>
          )}

          {isError && (
            <div className='rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm'>
              <p className='text-amber-200'>
                Could not load auto-assignment suggestions. You can still enter
                values manually.
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {error instanceof Error ? error.message : 'Request failed'}
              </p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='mt-2'
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          )}

          {isFetching && !isInitialLoading && (
            <div className='text-muted-foreground text-xs'>
              Refreshing assignment suggestions...
            </div>
          )}

          <div className='grid gap-4'>
            <div className='grid gap-1.5'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='bidder-number'>
                  Bidder Number{' '}
                  <span className='text-muted-foreground font-normal'>
                    (100-999)
                  </span>
                  {assignmentsLocked && (
                    <span className='text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs font-normal'>
                      <Lock className='h-3 w-3' />
                      Locked
                    </span>
                  )}
                </Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleAutoAssignBidder}
                  disabled={!data || isFetching || assignmentsLocked}
                >
                  Auto Assign
                </Button>
              </div>
              <Input
                id='bidder-number'
                type='number'
                min={100}
                max={999}
                value={bidderInput}
                onChange={(e) => setBidderInput(e.target.value)}
                disabled={assignmentsLocked}
                className={
                  bidderInput && !bidderValid ? 'border-destructive' : ''
                }
              />
              {bidderInput && !bidderValid && (
                <p className='text-destructive text-xs'>
                  Must be between 100 and 999
                </p>
              )}
            </div>

            <div className='grid gap-1.5'>
              <div className='flex items-center justify-between gap-2'>
                <Label htmlFor='table-number'>
                  Table Number{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional)
                  </span>
                  {assignmentsLocked && (
                    <span className='text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs font-normal'>
                      <Lock className='h-3 w-3' />
                      Locked
                    </span>
                  )}
                </Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleAutoAssignTable}
                  disabled={!data || isFetching || assignmentsLocked}
                >
                  Auto Assign
                </Button>
              </div>
              <Input
                id='table-number'
                type='number'
                min={1}
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                disabled={assignmentsLocked}
                placeholder='Auto assign if blank'
                className={
                  tableInput && !tableValid ? 'border-destructive' : ''
                }
              />
              {tableInput && !tableValid && (
                <p className='text-destructive text-xs'>
                  Must be a positive number
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onCancel}>
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
