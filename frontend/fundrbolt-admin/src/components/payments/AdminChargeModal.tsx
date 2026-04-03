/**
 * AdminChargeModal — T051
 *
 * Presents a confirmation + charge UI when an admin clicks "Charge" next to a
 * donor in the DonorBalancePanel. Calls POST /admin/payments/charge.
 */
import { BidderAvatar } from '@/components/bidder-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminChargeDonor } from '@/lib/api/admin-payments'
import type { AdminChargeResponse, DonorBalanceSummary } from '@/types/payments'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface AdminChargeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  donor: DonorBalanceSummary
  npoId: string
  eventId: string
  onSuccess: () => void
}

export function AdminChargeModal({
  open,
  onOpenChange,
  donor,
  npoId,
  eventId,
  onSuccess,
}: AdminChargeModalProps) {
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<AdminChargeResponse | null>(null)

  const fullName = `${donor.first_name} ${donor.last_name}`
  const balance = parseFloat(donor.total_balance)

  const chargeMutation = useMutation({
    mutationFn: () =>
      adminChargeDonor({
        user_id: donor.user_id,
        npo_id: npoId,
        event_id: eventId,
        payment_profile_id: donor.payment_profile_id ?? '',
        line_items: [
          {
            type: 'outstanding_balance',
            label: 'Outstanding Balance',
            amount: balance,
          },
        ],
        total_amount: balance,
        reason: reason.trim() || 'Admin checkout',
        idempotency_key: `admin-charge-${donor.user_id}-${eventId}-${Date.now()}`,
      }),
    onSuccess: (data) => {
      setResult(data)
      onSuccess()
    },
  })

  const handleClose = () => {
    if (chargeMutation.isPending) return
    setReason('')
    setResult(null)
    chargeMutation.reset()
    onOpenChange(false)
  }

  const isDeclined = result?.status === 'declined' || chargeMutation.isError

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-md'>
        {result && result.status === 'approved' ? (
          <>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2 text-green-700'>
                <CheckCircle2 className='h-5 w-5' />
                Charge Approved
              </DialogTitle>
            </DialogHeader>
            <div className='space-y-2 py-2 text-sm'>
              <p>
                <span className='font-medium'>{fullName}</span> was successfully
                charged{' '}
                <span className='font-medium'>
                  ${parseFloat(result.amount_charged).toFixed(2)}
                </span>
                .
              </p>
              {result.gateway_transaction_id && (
                <p className='text-muted-foreground'>
                  Gateway ref:{' '}
                  <code className='text-xs'>
                    {result.gateway_transaction_id}
                  </code>
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : isDeclined ? (
          <>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2 text-red-700'>
                <AlertCircle className='h-5 w-5' />
                Charge Declined
              </DialogTitle>
            </DialogHeader>
            <div className='space-y-2 py-2 text-sm'>
              {result?.decline_reason ? (
                <p className='text-red-600'>{result.decline_reason}</p>
              ) : (
                <p className='text-red-600'>
                  {chargeMutation.error instanceof Error
                    ? chargeMutation.error.message
                    : 'The charge was declined. Please verify the card on file.'}
                </p>
              )}
            </div>
            <DialogFooter className='gap-2'>
              <Button variant='outline' onClick={handleClose}>
                Close
              </Button>
              <Button
                variant='destructive'
                onClick={() => {
                  setResult(null)
                  chargeMutation.reset()
                }}
              >
                Try Again
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Charge Donor</DialogTitle>
              <DialogDescription>
                Charge the card on file for{' '}
                <span className='font-medium'>{fullName}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4 py-2'>
              <div className='rounded-md border p-3'>
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Donor</span>
                  <span className='flex items-center gap-2 font-medium'>
                    <BidderAvatar name={fullName} />
                    {fullName}
                  </span>
                </div>
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>Email</span>
                  <span>{donor.email}</span>
                </div>
                <div className='flex justify-between text-sm'>
                  <span className='text-muted-foreground'>
                    Outstanding Balance
                  </span>
                  <span className='font-semibold text-orange-600'>
                    ${balance.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='charge-reason'>
                  Reason{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id='charge-reason'
                  placeholder='e.g. End-of-night checkout'
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  disabled={chargeMutation.isPending}
                />
              </div>
            </div>

            <DialogFooter className='gap-2'>
              <Button
                variant='outline'
                onClick={handleClose}
                disabled={chargeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => chargeMutation.mutate()}
                disabled={
                  chargeMutation.isPending || !donor.has_payment_profile
                }
              >
                {chargeMutation.isPending ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Charging…
                  </>
                ) : (
                  `Charge $${balance.toFixed(2)}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
