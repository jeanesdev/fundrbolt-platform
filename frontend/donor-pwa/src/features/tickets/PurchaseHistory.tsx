/**
 * PurchaseHistory component — shows the user's ticket purchase history
 * with pagination.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getPurchaseHistory,
  type PurchaseHistoryItem,
} from '@/lib/api/ticket-purchases'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  CalendarDays,
  Download,
  Receipt,
  Tag,
  Ticket,
} from 'lucide-react'
import { useState } from 'react'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  completed: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
}

const PAYMENT_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  completed: 'default',
  pending: 'secondary',
  failed: 'destructive',
  refunded: 'outline',
}

interface PurchaseHistoryProps {
  perPage?: number
}

export function PurchaseHistory({ perPage = 20 }: PurchaseHistoryProps) {
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-history', page, perPage],
    queryFn: () => getPurchaseHistory(page, perPage),
  })

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className='h-40 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center space-y-3 py-10 text-center'>
          <AlertCircle className='text-destructive h-10 w-10' />
          <p className='text-muted-foreground'>
            Unable to load purchase history. Please try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.purchases.length === 0) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center space-y-3 py-10 text-center'>
          <Receipt className='text-muted-foreground h-12 w-12' />
          <h2 className='text-xl font-semibold'>No purchases yet</h2>
          <p className='text-muted-foreground'>
            Your ticket purchase history will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalPages = Math.ceil(data.total_count / data.per_page)

  return (
    <div className='space-y-4'>
      {data.purchases.map((item: PurchaseHistoryItem) => (
        <Card key={item.id}>
          <CardHeader className='pb-3'>
            <div className='flex items-start justify-between gap-2'>
              <div className='space-y-1'>
                <CardTitle className='text-lg'>{item.event_name}</CardTitle>
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <CalendarDays className='h-4 w-4' />
                  {new Date(item.event_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <Badge
                variant={
                  PAYMENT_STATUS_VARIANTS[item.payment_status] ?? 'secondary'
                }
              >
                {PAYMENT_STATUS_LABELS[item.payment_status] ??
                  item.payment_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center gap-2'>
              <Ticket className='text-muted-foreground h-4 w-4 shrink-0' />
              <span className='text-sm'>
                {item.package_name} &times; {item.quantity}
              </span>
            </div>

            {item.promo_code && (
              <div className='flex items-center gap-2'>
                <Tag className='text-muted-foreground h-4 w-4 shrink-0' />
                <span className='text-sm'>
                  Promo code{' '}
                  <span className='font-mono font-medium'>
                    {item.promo_code}
                  </span>
                  {' — '}
                  <span className='text-green-600'>
                    -${(item.discount_amount / 100).toFixed(2)} off
                  </span>
                </span>
              </div>
            )}

            <div className='flex items-center justify-between border-t pt-3'>
              <div className='text-muted-foreground text-sm'>
                Purchased{' '}
                {new Date(item.purchased_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className='flex items-center gap-3'>
                <span className='font-semibold'>
                  ${(item.total_price / 100).toFixed(2)}
                </span>
                {item.receipt_url ? (
                  <Button asChild variant='outline' size='sm'>
                    <a
                      href={item.receipt_url}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <Download className='mr-1 h-3 w-3' />
                      Receipt
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant='ghost' size='sm'>
                  <Link to='/events/$slug' params={{ slug: item.event_slug }}>
                    View Event
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-3 pt-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className='text-muted-foreground text-sm'>
            Page {page} of {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
