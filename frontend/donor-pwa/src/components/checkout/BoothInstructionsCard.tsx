/**
 * BoothInstructionsCard — T060
 *
 * Shown when Cash / Check / DAF payment method is selected.
 */
import { Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export interface BoothInstructionsCardProps {
  cashInstructions?: string
  npoName?: string
}

export function BoothInstructionsCard({
  cashInstructions,
  npoName,
}: BoothInstructionsCardProps) {
  return (
    <Card className='border-amber-200 bg-amber-50'>
      <CardContent className='space-y-2 pt-4 pb-4'>
        <div className='flex items-center gap-2'>
          <Building2 className='h-4 w-4 shrink-0 text-amber-700' />
          <span className='text-sm font-semibold text-amber-900'>
            Payment Booth Instructions
          </span>
        </div>

        {cashInstructions ? (
          <p className='text-sm text-amber-800'>{cashInstructions}</p>
        ) : (
          <p className='text-sm text-amber-800'>
            Please bring your payment to the checkout booth before the end of
            the evening.
          </p>
        )}

        {npoName && (
          <p className='text-xs text-amber-700'>
            Make checks payable to:{' '}
            <span className='font-semibold'>{npoName}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default BoothInstructionsCard
