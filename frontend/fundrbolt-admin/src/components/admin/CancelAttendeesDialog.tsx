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
import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

const REASONS = [
  { value: 'duplicate', label: 'Duplicate registration' },
  { value: 'requested', label: 'Registrant requested cancellation' },
  { value: 'payment_issue', label: 'Payment issue/refund' },
  { value: 'other', label: 'Other' },
]

export interface CancelAttendeesPayload {
  cancellation_reason: 'duplicate' | 'requested' | 'payment_issue' | 'other'
  cancellation_note?: string
}

interface CancelAttendeesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  isPending?: boolean
  onConfirm: (payload: CancelAttendeesPayload) => void
}

export function CancelAttendeesDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending = false,
  onConfirm,
}: CancelAttendeesDialogProps) {
  const [reason, setReason] = useState<CancelAttendeesPayload['cancellation_reason']>(
    'requested'
  )
  const [note, setNote] = useState('')

  const handleConfirm = () => {
    onConfirm({
      cancellation_reason: reason,
      cancellation_note: note || undefined,
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
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
                  onChange={() => setReason(r.value as CancelAttendeesPayload['cancellation_reason'])}
                  className="accent-primary"
                  disabled={isPending}
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
              disabled={isPending}
              className="mt-2"
            />
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
