import { CheckCircle2 } from 'lucide-react'
import type { DonationResponse } from '@/lib/api/donateNow'
import { Button } from '@/components/ui/button'

interface DonationSuccessOverlayProps {
  donation: DonationResponse
  npoName: string
  onClose: () => void
}

export function DonationSuccessOverlay({
  donation,
  npoName,
  onClose,
}: DonationSuccessOverlayProps) {
  return (
    <div className='bg-background/95 fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='w-full max-w-sm space-y-4 text-center'>
        <CheckCircle2 className='mx-auto h-16 w-16 text-green-500' />
        <h2 className='text-2xl font-bold'>Thank You!</h2>
        <p className='text-muted-foreground'>
          Your ${(donation.total_charged_cents / 100).toFixed(2)}{' '}
          {donation.is_monthly ? 'monthly ' : ''}donation to {npoName} has been
          received.
        </p>
        <Button onClick={onClose} className='w-full'>
          Done
        </Button>
      </div>
    </div>
  )
}
