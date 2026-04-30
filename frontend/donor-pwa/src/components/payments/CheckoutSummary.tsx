/**
 * CheckoutSummary — T037 Phase 6 (US4 / US5)
 *
 * Itemised line-items table with an optional promo discount row and a
 * bold total footer.  Reusable for both the ticket checkout (US4) and
 * the end-of-night self-checkout (US5).
 */
import type { LineItem } from '@/types/payment'
import { Tag } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromoDiscount {
  code: string
  /** Negative amount (discount value) */
  amount: number
}

export interface CheckoutSummaryProps {
  lineItems: LineItem[]
  total: number
  /** Optional promo discount to show as a separate row */
  promoDiscount?: PromoDiscount | null
  currency?: string
  /** Show a "Processing…" skeleton state */
  isLoading?: boolean
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LINE_ITEM_TYPE_LABELS: Record<string, string> = {
  ticket: 'Ticket',
  auction_win: 'Auction Item',
  donation: 'Donation',
  extra_tip: 'Extra Tip',
  fee_coverage: 'Processing Fee',
}

function fmtCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}

/** Item type badge label */
function typeBadge(type: string): string {
  return LINE_ITEM_TYPE_LABELS[type] ?? type
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CheckoutSummary({
  lineItems,
  total,
  promoDiscount,
  currency = 'USD',
  isLoading = false,
  className = '',
}: CheckoutSummaryProps) {
  if (isLoading) {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className='flex justify-between py-1 text-sm'>
            <div className='bg-muted h-4 w-2/3 rounded' />
            <div className='bg-muted h-4 w-16 rounded' />
          </div>
        ))}
        <div className='bg-muted h-px' />
        <div className='flex justify-between font-semibold'>
          <div className='bg-muted h-4 w-1/4 rounded' />
          <div className='bg-muted h-4 w-20 rounded' />
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Line items */}
      {lineItems.map((item, idx) => (
        <div
          key={idx}
          className='flex items-start justify-between gap-2 py-1 text-sm'
        >
          <div className='min-w-0 flex-1'>
            <span className='text-foreground'>{item.label}</span>
            <span className='text-muted-foreground ml-2 text-xs'>
              {typeBadge(item.type)}
            </span>
          </div>
          <span
            className={
              item.type === 'fee_coverage'
                ? 'text-muted-foreground'
                : 'text-foreground font-medium'
            }
          >
            {fmtCurrency(Number(item.amount), currency)}
          </span>
        </div>
      ))}

      {/* Promo discount */}
      {promoDiscount && (
        <div className='flex items-center justify-between gap-2 py-1 text-sm text-green-700 dark:text-green-400'>
          <div className='flex items-center gap-1'>
            <Tag className='h-3.5 w-3.5' />
            <span>Promo: {promoDiscount.code}</span>
          </div>
          <span className='font-medium'>
            -{fmtCurrency(Math.abs(promoDiscount.amount), currency)}
          </span>
        </div>
      )}

      <Separator className='my-2' />

      {/* Total */}
      <div className='flex items-center justify-between py-1'>
        <span className='text-base font-semibold'>Total</span>
        <span className='text-primary text-base font-bold'>
          {fmtCurrency(total, currency)}
        </span>
      </div>
    </div>
  )
}
