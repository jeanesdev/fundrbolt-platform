/**
 * ReceiptView — T042 (US8)
 *
 * Inline receipt viewer for a completed PaymentTransaction.
 * Shows itemised line items, card details, and a PDF download button.
 * Used in the donor transaction history route (T055).
 */

import { CheckoutSummary } from '@/components/payments/CheckoutSummary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getTransaction, type TransactionDetail } from '@/lib/api/payments'
import type { LineItem } from '@/types/payment'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  Receipt,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReceiptViewProps {
  transactionId: string
  /** Pre-loaded data (optional — skips the query if provided) */
  transaction?: TransactionDetail
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
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

export function ReceiptView({ transactionId, transaction: prefetch, className = '' }: ReceiptViewProps) {
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
      <div className={`flex justify-center items-center py-10 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !txn) {
    return (
      <div className={`flex gap-2 items-center text-destructive text-sm py-4 ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Could not load receipt.</span>
      </div>
    )
  }

  const status = STATUS_LABELS[txn.status] ?? { label: txn.status, variant: 'outline' as const }
  const lineItems: LineItem[] = Array.isArray(txn.line_items) ? txn.line_items : []

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-sm leading-tight">
              {txn.event_name ?? 'Payment'}
            </p>
            <p className="text-xs text-muted-foreground">{fmtDate(txn.created_at)}</p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Card info */}
      {txn.card_last4 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>
            {txn.card_brand ? `${txn.card_brand.toUpperCase()} ` : ''}
            ···· {txn.card_last4}
          </span>
        </div>
      )}

      <Separator />

      {/* Line items + total */}
      {lineItems.length > 0 ? (
        <CheckoutSummary
          lineItems={lineItems}
          total={Number(txn.amount)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Total: ${Number(txn.amount).toFixed(2)}
        </p>
      )}

      {/* Transaction ID */}
      <p className="text-xs text-muted-foreground">
        Transaction ID: {txn.id.slice(0, 8).toUpperCase()}
      </p>

      {/* Receipt PDF actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {txn.receipt_url ? (
          <>
            <Button
              size="sm"
              variant="outline"
              asChild
            >
              <a href={txn.receipt_url} download={`receipt-${txn.id.slice(0, 8)}.pdf`}>
                <Download className="w-4 h-4 mr-1.5" />
                Download Receipt
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              asChild
            >
              <a href={txn.receipt_url} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Open PDF
              </a>
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Receipt being generated…
          </p>
        )}
      </div>
    </div>
  )
}
