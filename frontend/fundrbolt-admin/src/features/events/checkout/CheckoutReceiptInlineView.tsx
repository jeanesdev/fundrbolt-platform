/**
 * CheckoutReceiptInlineView
 *
 * Inline receipt breakdown shown inside the DonorCheckoutItemEditor sheet
 * when a donor's checkout is complete. Mirrors the donor-facing receipt layout.
 */
import { useMemo } from 'react'
import type { DonorCheckoutSession } from '@/lib/api/checkout'
import { Separator } from '@/components/ui/separator'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

interface CheckoutReceiptInlineViewProps {
  session: DonorCheckoutSession
}

export function CheckoutReceiptInlineView({
  session,
}: CheckoutReceiptInlineViewProps) {
  const activeItems = session.items.filter((i) => !i.is_removed)

  // Group duplicate line items by name (matches donor-facing display)
  const displayItems = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; cents: number; count: number; id: string }
    >()
    for (const item of activeItems) {
      const effectiveCents =
        item.adjusted_amount_cents ?? item.original_amount_cents
      const existing = groups.get(item.name)
      if (existing) {
        existing.count++
        existing.cents += effectiveCents
      } else {
        groups.set(item.name, {
          name: item.name,
          cents: effectiveCents,
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
  }, [activeItems])

  return (
    <div className='bg-muted/30 space-y-3 rounded-md border p-4'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        Receipt
      </p>

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
        {displayItems.length === 0 && (
          <p className='text-muted-foreground text-sm'>No items</p>
        )}
      </div>

      {session.processing_fee_cents > 0 && (
        <>
          <Separator />
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Processing Fee</span>
            <span>{fmtCurrency(session.processing_fee_cents)}</span>
          </div>
        </>
      )}

      <Separator />

      <div className='flex justify-between'>
        <span className='font-semibold'>Total</span>
        <span className='text-lg font-bold'>
          {fmtCurrency(session.total_cents)}
        </span>
      </div>

      {session.completed_at && (
        <div className='flex justify-between text-sm'>
          <span className='text-muted-foreground'>Completed</span>
          <span>
            {new Date(session.completed_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>
      )}
    </div>
  )
}
