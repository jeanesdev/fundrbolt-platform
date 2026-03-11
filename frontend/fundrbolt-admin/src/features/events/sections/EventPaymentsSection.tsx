/**
 * EventPaymentsSection — T059/T060
 *
 * Full payments management page for an event: checkout toggle, donor
 * balances + manual charge, and complete transaction history.
 */
import { CheckoutStatusControl } from '@/components/payments/CheckoutStatusControl'
import { DonorBalancePanel } from '@/components/payments/DonorBalancePanel'
import { TransactionHistoryTable } from '@/components/payments/TransactionHistoryTable'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventPaymentsSection() {
  const { eventId, currentEvent } = useEventWorkspace()
  const npoId = currentEvent.npo_id

  return (
    <div className='space-y-6'>
      <CheckoutStatusControl eventId={eventId} />
      <DonorBalancePanel eventId={eventId} npoId={npoId} />
      <TransactionHistoryTable eventId={eventId} />
    </div>
  )
}
