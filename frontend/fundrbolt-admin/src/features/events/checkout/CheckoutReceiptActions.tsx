/**
 * CheckoutReceiptActions — T058
 *
 * Shown when a donor's checkout is complete. Lets admins download the receipt
 * PDF or re-send it via email.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { adminResendReceipt, downloadDonorReceipt } from '@/lib/api/checkout'
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
import { Button } from '@/components/ui/button'

interface CheckoutReceiptActionsProps {
  eventId: string
  userId: string
  hasReceipt: boolean
}

export function CheckoutReceiptActions({
  eventId,
  userId,
  hasReceipt,
}: CheckoutReceiptActionsProps) {
  const [confirmResendOpen, setConfirmResendOpen] = useState(false)

  const resendMutation = useMutation({
    mutationFn: () => adminResendReceipt(eventId, userId),
    onSuccess: (result) => {
      toast.success(result.message || 'Receipt sent successfully')
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to resend receipt'
      )
    },
  })

  const downloadMutation = useMutation({
    mutationFn: () => downloadDonorReceipt(eventId, userId),
    onSuccess: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to get receipt URL'
      )
    },
  })

  if (!hasReceipt) return null

  return (
    <div className='flex items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        disabled={downloadMutation.isPending}
        onClick={() => downloadMutation.mutate()}
      >
        <Download className='mr-1.5 h-3.5 w-3.5' />
        Download Receipt
      </Button>

      <Button
        variant='outline'
        size='sm'
        disabled={resendMutation.isPending}
        onClick={() => setConfirmResendOpen(true)}
      >
        <Mail className='mr-1.5 h-3.5 w-3.5' />
        Resend Receipt
      </Button>

      <AlertDialog open={confirmResendOpen} onOpenChange={setConfirmResendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the receipt email to the donor again. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmResendOpen(false)
                resendMutation.mutate()
              }}
            >
              Resend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
