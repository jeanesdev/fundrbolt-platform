/**
 * CheckoutReceiptView — T019
 *
 * Read-only post-completion receipt view.
 */
import { useMemo } from 'react'
import { Download, Mail } from 'lucide-react'
import type { CheckoutSession } from '@/lib/api/checkout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export interface CheckoutReceiptViewProps {
  session: CheckoutSession
  event: { name: string; id: string; slug: string }
  onDownloadReceipt: () => void
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Credit / Debit Card',
  cash: 'Cash',
  check: 'Check',
  daf: 'Donor-Advised Fund',
}

export function CheckoutReceiptView({
  session,
  event,
  onDownloadReceipt,
}: CheckoutReceiptViewProps) {
  const visibleItems = session.items.filter((item) => !item.deleted_at)

  // Group duplicate line items by name (same as checkout page)
  const displayItems = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; cents: number; count: number; id: string }
    >()
    for (const item of visibleItems) {
      const key = item.name
      const existing = groups.get(key)
      if (existing) {
        existing.count++
        existing.cents += item.effective_amount_cents
      } else {
        groups.set(key, {
          name: item.name,
          cents: item.effective_amount_cents,
          count: 1,
          id: item.id,
        })
      }
    }
    return Array.from(groups.values()).map((g) => ({
      id: g.id,
      label: g.count > 1 ? `${g.name} × ${g.count}` : g.name,
      cents: g.cents,
    }))
  }, [visibleItems])

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Receipt — {event.name}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 pt-0'>
          {/* Line items */}
          <div className='space-y-2'>
            {displayItems.map((item) => (
              <div key={item.id} className='flex items-start justify-between'>
                <span className='flex-1 pr-4 text-sm font-medium'>
                  {item.label}
                </span>
                <span className='text-sm font-medium tabular-nums'>
                  {fmtCurrency(item.cents)}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Tips */}
          {session.auctioneer_tip_cents > 0 && (
            <div className='flex justify-between text-sm'>
              <span className='text-foreground/70'>Auctioneer Tip</span>
              <span>{fmtCurrency(session.auctioneer_tip_cents)}</span>
            </div>
          )}

          {session.platform_tip_cents > 0 && (
            <div className='flex justify-between text-sm'>
              <span className='text-foreground/70'>FundrBolt Tip</span>
              <span>{fmtCurrency(session.platform_tip_cents)}</span>
            </div>
          )}

          {/* Processing fee */}
          {session.cover_processing_fee && session.processing_fee_cents > 0 && (
            <div className='flex justify-between text-sm'>
              <span className='text-foreground/70'>Processing Fee</span>
              <span>{fmtCurrency(session.processing_fee_cents)}</span>
            </div>
          )}

          <Separator />

          {/* Total */}
          <div className='flex justify-between'>
            <span className='font-semibold'>Total</span>
            <span className='text-lg font-bold'>
              {fmtCurrency(session.total_cents)}
            </span>
          </div>

          {/* Payment method */}
          <div className='flex justify-between text-sm'>
            <span className='text-foreground/70'>Payment method</span>
            <span>
              {PAYMENT_METHOD_LABELS[session.payment_method] ??
                session.payment_method}
            </span>
          </div>

          {session.completed_at && (
            <div className='flex justify-between text-sm'>
              <span className='text-foreground/70'>Completed</span>
              <span>
                {new Date(session.completed_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt actions */}
      <div className='space-y-2'>
        <Button
          variant='outline'
          className='w-full gap-2'
          onClick={onDownloadReceipt}
        >
          <Download className='h-4 w-4' />
          Download Receipt
        </Button>

        <p className='text-muted-foreground text-center text-xs'>
          <Mail className='mr-1 inline h-3 w-3' />A receipt was also sent to
          your email.
        </p>
      </div>
    </div>
  )
}

export default CheckoutReceiptView
