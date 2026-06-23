/**
 * CheckoutSummaryCard — T038
 *
 * Shown on the My Event home page when checkout is open.
 * Polls every 10 seconds for checkout status updates.
 */
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  downloadCheckoutReceipt,
  getCheckoutSession,
  getCheckoutStatus,
} from '@/lib/api/checkout'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, CreditCard, Download, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

export interface CheckoutSummaryCardProps {
  eventId: string
  eventSlug: string
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function CheckoutSummaryCard({
  eventId,
  eventSlug,
}: CheckoutSummaryCardProps) {
  const { data: status } = useQuery({
    queryKey: ['checkout-status', eventId],
    queryFn: () => getCheckoutStatus(eventId),
    refetchInterval: 10_000,
    enabled: !!eventId,
  })

  const checkoutVisible = status?.donor_visible ?? false
  const checkoutOpen = status?.checkout_open ?? false
  const sessionStatus = status?.session_status

  const { data: session } = useQuery({
    queryKey: ['checkout-session', eventId],
    queryFn: () => getCheckoutSession(eventId),
    enabled: checkoutVisible && !!eventId,
    refetchInterval: 10_000,
  })

  // Hide entirely when checkout isn't enabled for donors, unless their session
  // is already complete (so they can still see the receipt).
  if (!checkoutVisible) return null
  if (!checkoutOpen && sessionStatus !== 'complete') return null

  // Completed state
  if (sessionStatus === 'complete' && session) {
    return (
      <Card
        className='bg-green-50'
        style={{
          borderColor: 'var(--event-cause-border-color, #3B82F6)',
          borderWidth: 'var(--event-cause-border-width, 1px)',
        }}
      >
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base text-green-800'>
            <CheckCircle2 className='h-5 w-5 text-green-600' />
            Checkout Complete
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 pt-0'>
          <p className='text-sm text-green-700'>
            Total paid:{' '}
            <span className='font-semibold'>
              {fmtCurrency(session.total_cents)}
            </span>
          </p>
          <Button
            variant='outline'
            size='sm'
            className='gap-2 border-green-300 text-green-800 hover:bg-green-100'
            onClick={() =>
              void downloadCheckoutReceipt(eventId).catch(() =>
                toast.error(
                  'Receipt not available yet. Please try again shortly.'
                )
              )
            }
          >
            <Download className='h-3.5 w-3.5' />
            Download Receipt
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Empty state — no items
  const hasItems = session && session.items.length > 0
  if (session && !hasItems) {
    return (
      <div
        className='flex items-center gap-3 rounded-xl px-4 py-4'
        style={{
          backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)',
          border: '1px solid rgb(var(--event-primary, 59, 130, 246) / 0.25)',
        }}
      >
        <ShoppingBag
          className='h-5 w-5 shrink-0'
          style={{ color: 'var(--event-text-on-background, #6B7280)' }}
        />
        <p
          className='text-sm'
          style={{ color: 'var(--event-text-on-background, #6B7280)' }}
        >
          You have no items to check out.
        </p>
      </div>
    )
  }

  // Standard — items to pay
  const estimatedTotal = session?.total_cents ?? 0

  return (
    <Card
      className='bg-orange-50'
      style={{
        borderColor: 'var(--event-cause-border-color, #3B82F6)',
        borderWidth: 'var(--event-cause-border-width, 1px)',
      }}
    >
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-base text-orange-900'>
          <CreditCard className='h-5 w-5 text-orange-600' />
          Checkout Ready
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 pt-0'>
        {estimatedTotal > 0 && (
          <p className='text-sm font-medium text-orange-800'>
            Estimated total:{' '}
            <span className='font-bold'>{fmtCurrency(estimatedTotal)}</span>
          </p>
        )}
        <Link
          to='/events/$slug/checkout'
          params={{ slug: eventSlug }}
          className='block'
        >
          <Button className='w-full gap-2 bg-orange-600 text-white hover:bg-orange-700'>
            <CreditCard className='h-4 w-4' />
            Review &amp; Pay
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

export default CheckoutSummaryCard
