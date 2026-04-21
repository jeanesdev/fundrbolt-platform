import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { useDonateNow } from '@/features/donate-now/useDonateNow'
import { Loader2 } from 'lucide-react'

interface DonationConfirmDialogProps {
  state: ReturnType<typeof useDonateNow>
  npoName: string
}

export function DonationConfirmDialog({ state, npoName }: DonationConfirmDialogProps) {
  const { showConfirm, setShowConfirm, totalCents, isMonthly, isPending, handleDonate, donateError } = state

  return (
    <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Your Donation</DialogTitle>
          <DialogDescription>
            You are about to donate{' '}
            <strong>${(totalCents / 100).toFixed(2)}</strong>{' '}
            {isMonthly ? 'monthly ' : ''}to {npoName}.
          </DialogDescription>
        </DialogHeader>

        {donateError && (
          <p className='text-sm text-destructive'>
            {(donateError as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
              'Payment failed. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => setShowConfirm(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleDonate} disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Confirm ${(totalCents / 100).toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
