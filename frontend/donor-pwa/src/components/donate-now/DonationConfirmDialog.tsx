import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
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

interface DonationConfirmDialogProps {
  state: ReturnType<typeof useDonateNow>
  npoName: string
}

export function DonationConfirmDialog({
  state,
  npoName,
}: DonationConfirmDialogProps) {
  const {
    showConfirm,
    setShowConfirm,
    totalCents,
    isMonthly,
    isPending,
    handleDonate,
    donateError,
    savePendingDonation,
  } = state
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  const handleAuthRedirect = (target: 'sign-in' | 'sign-up') => {
    savePendingDonation()
    const url = new URL(window.location.href)
    url.searchParams.set('donateResume', '1')
    const redirect = `${url.pathname}${url.search}`

    if (target === 'sign-in') {
      void navigate({ to: '/sign-in', search: { redirect } })
      return
    }

    void navigate({ to: '/sign-up', search: { intent: 'donor', redirect } })
  }

  return (
    <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Your Donation</DialogTitle>
          <DialogDescription>
            You are about to donate{' '}
            <strong>${(totalCents / 100).toFixed(2)}</strong>{' '}
            {isMonthly ? 'monthly ' : ''}to {npoName}.
            {!isAuthenticated && (
              <>
                <br />
                Sign in or register to complete your donation.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {donateError && (
          <p className='text-destructive text-sm'>
            {(donateError as { response?: { data?: { detail?: string } } })
              .response?.data?.detail ?? 'Payment failed. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          {isAuthenticated ? (
            <Button onClick={handleDonate} disabled={isPending}>
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Confirm ${(totalCents / 100).toFixed(2)}
            </Button>
          ) : (
            <>
              <Button
                variant='outline'
                onClick={() => handleAuthRedirect('sign-up')}
              >
                Register
              </Button>
              <Button onClick={() => handleAuthRedirect('sign-in')}>
                Login
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
