/**
 * EventCheckoutSection — checkout control + donor balances + transaction history.
 */
import { DonorBalancePanel } from '@/components/payments/DonorBalancePanel'
import { TransactionHistoryTable } from '@/components/payments/TransactionHistoryTable'
import { CheckoutControlPanel } from '../checkout/CheckoutControlPanel'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventCheckoutSection() {
  const { currentEvent } = useEventWorkspace()
  const npoId = currentEvent.npo_id

  return (
    <div className='space-y-6'>
      <CheckoutControlPanel eventId={currentEvent.id} />
      <DonorBalancePanel eventId={currentEvent.id} npoId={npoId} />
      <TransactionHistoryTable eventId={currentEvent.id} />
    </div>
  )
}
