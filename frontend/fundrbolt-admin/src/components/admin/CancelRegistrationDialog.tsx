import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { cancelRegistration, type CancelRegistrationPayload } from '@/lib/api/cancel-registration'
import { getErrorMessage } from '@/lib/error-utils'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface CancelRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrationId: string
  registrantName: string
  onCancelComplete?: () => void
}

const REASONS = [
  { value: 'duplicate', label: 'Duplicate registration' },
  { value: 'requested', label: 'Registrant requested cancellation' },
  { value: 'payment_issue', label: 'Payment issue/refund' },
  { value: 'other', label: 'Other' },
]

export function CancelRegistrationDialog({
  open,
  onOpenChange,
  registrationId,
  registrantName,
  onCancelComplete,
}: CancelRegistrationDialogProps) {
  const [reason, setReason] = useState('requested')
  const [note, setNote] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const payload: CancelRegistrationPayload = {
        cancellation_reason: reason as CancelRegistrationPayload['cancellation_reason'],
        cancellation_note: note || undefined,
      }
      await cancelRegistration(registrationId, payload)
      toast.success('Registration cancelled successfully')
      onOpenChange(false)
      onCancelComplete?.()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to cancel registration'))
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Registration</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel registration for <strong>{registrantName}</strong>?
            <br />
            This will also cancel all linked guests and meal selections.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 mt-2">
          <label className="text-sm font-medium">Cancellation Reason</label>
          <div className="flex flex-col gap-2">
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cancel-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-primary"
                  disabled={isCancelling}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          {reason === 'other' && (
            <Input
              placeholder="Enter custom reason"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isCancelling}
              className="mt-2"
            />
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isCancelling}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isCancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Registration'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
