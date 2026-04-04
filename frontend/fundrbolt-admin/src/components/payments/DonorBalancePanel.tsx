/**
 * DonorBalancePanel — T050
 *
 * Lists outstanding donor balances for an event and lets admins initiate a
 * charge via AdminChargeModal.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DonorBalanceSummary } from '@/types/payments'
import { CreditCard, Loader2, RefreshCw, Zap } from 'lucide-react'
import { getDonorBalances } from '@/lib/api/admin-payments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BidderAvatar } from '@/components/bidder-avatar'
import { AdminChargeModal } from './AdminChargeModal'

interface DonorBalancePanelProps {
  eventId: string
  npoId: string
}

export function DonorBalancePanel({ eventId, npoId }: DonorBalancePanelProps) {
  const queryClient = useQueryClient()
  const [chargeTarget, setChargeTarget] = useState<DonorBalanceSummary | null>(
    null
  )

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-donor-balances', eventId],
    queryFn: () => getDonorBalances(eventId),
    refetchInterval: 30_000,
  })

  const handleChargeSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: ['admin-donor-balances', eventId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['admin-transactions', eventId],
    })
  }

  const totalOutstanding = data ? parseFloat(data.total_outstanding) : 0

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <CreditCard className='h-5 w-5' />
                Donor Balances
              </CardTitle>
              <CardDescription>
                Outstanding balances across auction wins, donations, bids, and
                tickets
              </CardDescription>
            </div>
            <div className='flex items-center gap-3'>
              {data && (
                <div className='text-right'>
                  <p className='text-muted-foreground text-xs'>
                    Total Outstanding
                  </p>
                  <p className='text-lg font-bold text-orange-600'>
                    ${totalOutstanding.toFixed(2)}
                  </p>
                </div>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['admin-donor-balances', eventId],
                  })
                }
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
            </div>
          ) : isError ? (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              {error instanceof Error
                ? error.message
                : 'Failed to load donor balances.'}
            </div>
          ) : !data || data.donors.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center text-sm'>
              <p className='font-medium'>All donors are settled up</p>
              <p className='mt-1'>No outstanding balances for this event.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className='text-right'>Balance</TableHead>
                  <TableHead className='text-center'>Card on File</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.donors.map((donor) => (
                  <TableRow key={donor.user_id}>
                    <TableCell className='font-medium'>
                      <div className='flex items-center gap-2'>
                        <BidderAvatar
                          name={`${donor.first_name} ${donor.last_name}`}
                        />
                        {donor.first_name} {donor.last_name}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground text-sm'>
                      {donor.email}
                    </TableCell>
                    <TableCell className='text-right font-semibold text-orange-600'>
                      ${parseFloat(donor.total_balance).toFixed(2)}
                    </TableCell>
                    <TableCell className='text-center'>
                      {donor.has_payment_profile ? (
                        <Badge
                          variant='outline'
                          className='border-green-200 bg-green-50 text-green-700'
                        >
                          <CreditCard className='mr-1 h-3 w-3' />
                          Yes
                        </Badge>
                      ) : (
                        <Badge
                          variant='outline'
                          className='text-muted-foreground'
                        >
                          No card
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        disabled={!donor.has_payment_profile}
                        title={
                          donor.has_payment_profile
                            ? `Charge ${donor.first_name} ${donor.last_name}`
                            : 'No payment profile on file'
                        }
                        onClick={() => setChargeTarget(donor)}
                      >
                        <Zap className='mr-1.5 h-3.5 w-3.5' />
                        Charge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {chargeTarget && (
        <AdminChargeModal
          open={chargeTarget !== null}
          onOpenChange={(open) => {
            if (!open) setChargeTarget(null)
          }}
          donor={chargeTarget}
          npoId={npoId}
          eventId={eventId}
          onSuccess={handleChargeSuccess}
        />
      )}
    </>
  )
}
