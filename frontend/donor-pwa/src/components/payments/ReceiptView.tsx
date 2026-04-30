/**
 * ReceiptView — T042 (US8)
 *
 * Inline receipt viewer for a completed PaymentTransaction.
 * Shows itemised line items, card details, and a PDF download button.
 * Used in the donor transaction history route (T055).
 */
import { useQuery } from '@tanstack/react-query'
import type { LineItem } from '@/types/payment'
import {
  AlertCircle,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  Receipt,
} from 'lucide-react'
import { getTransaction, type TransactionDetail } from '@/lib/api/payments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckoutSummary } from '@/components/payments/CheckoutSummary'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReceiptViewProps {
  transactionId: string
  /** Pre-loaded data (optional — skips the query if provided) */
  transaction?: TransactionDetail
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  captured: { label: 'Paid', variant: 'default' },
  refunded: { label: 'Refunded', variant: 'secondary' },
  declined: { label: 'Declined', variant: 'destructive' },
  error: { label: 'Error', variant: 'destructive' },
  pending: { label: 'Pending', variant: 'outline' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReceiptView({
  transactionId,
  transaction: prefetch,
  className = '',
}: ReceiptViewProps) {
  const {
    data: txn,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => getTransaction(transactionId),
    initialData: prefetch,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
      </div>
    )
  }

  if (error || !txn) {
    return (
      <div
        className={`text-destructive flex items-center gap-2 py-4 text-sm ${className}`}
      >
        <AlertCircle className='h-4 w-4 shrink-0' />
        <span>Could not load receipt.</span>
      </div>
    )
  }

  const status = STATUS_LABELS[txn.status] ?? {
    label: txn.status,
    variant: 'outline' as const,
  }
  const lineItems: LineItem[] = Array.isArray(txn.line_items)
    ? txn.line_items
    : []

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header row */}
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Receipt className='text-muted-foreground h-5 w-5 shrink-0' />
          <div>
            <p className='text-sm leading-tight font-medium'>
              {txn.event_name ?? 'Payment'}
            </p>
            <p className='text-muted-foreground text-xs'>
              {fmtDate(txn.created_at)}
            </p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Card info */}
      {txn.card_last4 && (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <CreditCard className='h-4 w-4 shrink-0' />
          <span>
            {txn.card_brand ? `${txn.card_brand.toUpperCase()} ` : ''}
            ···· {txn.card_last4}
          </span>
        </div>
      )}

      <Separator />

      {/* Line items + total */}
      {lineItems.length > 0 ? (
        <CheckoutSummary lineItems={lineItems} total={Number(txn.amount)} />
      ) : (
        <p className='text-muted-foreground text-sm'>
          Total: ${Number(txn.amount).toFixed(2)}
        </p>
      )}

      {/* Transaction ID */}
      <p className='text-muted-foreground text-xs'>
        Transaction ID: {txn.id.slice(0, 8).toUpperCase()}
      </p>

      {/* Receipt PDF actions */}
      <div className='flex flex-wrap gap-2 pt-1'>
        {txn.receipt_url ? (
          <>
            <Button size='sm' variant='outline' asChild>
              <a
                href={txn.receipt_url}
                download={`receipt-${txn.id.slice(0, 8)}.pdf`}
              >
                <Download className='mr-1.5 h-4 w-4' />
                Download Receipt
              </a>
            </Button>
            <Button size='sm' variant='ghost' asChild>
              <a href={txn.receipt_url} target='_blank' rel='noreferrer'>
                <ExternalLink className='mr-1.5 h-4 w-4' />
                Open PDF
              </a>
            </Button>
          </>
        ) : (
          <p className='text-muted-foreground flex items-center gap-1 text-xs'>
            <Loader2 className='h-3 w-3 animate-spin' />
            Receipt being generated…
          </p>
        )}
      </div>
    </div>
  )
}
