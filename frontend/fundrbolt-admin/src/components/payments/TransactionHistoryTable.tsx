/**
 * TransactionHistoryTable — T054-T056
 *
 * Shows all payment transactions for an event with void / refund actions.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TransactionListItem } from '@/types/payments'
import { History, Loader2, RefreshCw, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  getEventTransactions,
  refundTransaction,
  voidTransaction,
} from '@/lib/api/admin-payments'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

interface TransactionHistoryTableProps {
  eventId: string
}

type ActionType = 'void' | 'refund'

interface PendingAction {
  type: ActionType
  transaction: TransactionListItem
}

function statusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'captured':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'voided':
    case 'declined':
    case 'failed':
      return 'destructive'
    case 'refunded':
    case 'partial_refund':
      return 'outline'
    default:
      return 'secondary'
  }
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TransactionHistoryTable({
  eventId,
}: TransactionHistoryTableProps) {
  const queryClient = useQueryClient()
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-transactions', eventId],
    queryFn: () => getEventTransactions(eventId),
    refetchInterval: 30_000,
  })

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      voidTransaction(id, { reason }),
    onSuccess: () => {
      toast.success('Transaction voided successfully')
      void queryClient.invalidateQueries({
        queryKey: ['admin-transactions', eventId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['admin-donor-balances', eventId],
      })
      closeDialog()
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to void transaction'
      )
    },
  })

  const refundMutation = useMutation({
    mutationFn: ({
      id,
      amount,
      reason,
    }: {
      id: string
      amount: number
      reason: string
    }) => refundTransaction(id, { amount, reason }),
    onSuccess: (data) => {
      toast.success(
        `Refund of $${parseFloat(data.amount_refunded).toFixed(2)} processed`
      )
      void queryClient.invalidateQueries({
        queryKey: ['admin-transactions', eventId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['admin-donor-balances', eventId],
      })
      closeDialog()
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to process refund'
      )
    },
  })

  const isMutating = voidMutation.isPending || refundMutation.isPending

  const closeDialog = () => {
    if (isMutating) return
    setPendingAction(null)
    setActionReason('')
    setRefundAmount('')
    voidMutation.reset()
    refundMutation.reset()
  }

  const handleConfirm = () => {
    if (!pendingAction) return
    const id = pendingAction.transaction.transaction_id
    const reason = actionReason.trim() || 'Admin action'

    if (pendingAction.type === 'void') {
      voidMutation.mutate({ id, reason })
    } else {
      const amount = parseFloat(refundAmount)
      if (isNaN(amount) || amount <= 0) {
        toast.error('Enter a valid refund amount')
        return
      }
      refundMutation.mutate({ id, amount, reason })
    }
  }

  const canVoid = (txn: TransactionListItem) => txn.status === 'captured'
  const canRefund = (txn: TransactionListItem) =>
    txn.status === 'captured' || txn.status === 'partial_refund'

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <History className='h-5 w-5' />
                Transaction History
              </CardTitle>
              <CardDescription>
                All payment transactions for this event
              </CardDescription>
            </div>
            <div className='flex items-center gap-3'>
              {data && (
                <span className='text-muted-foreground text-sm'>
                  {data.total} transaction{data.total !== 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['admin-transactions', eventId],
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
              Failed to load transactions.
            </div>
          ) : !data || data.transactions.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center text-sm'>
              No transactions yet for this event.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className='text-right'>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((txn) => (
                  <TableRow key={txn.transaction_id}>
                    <TableCell className='text-muted-foreground text-sm whitespace-nowrap'>
                      {new Date(txn.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className='font-medium'>{txn.user_name}</div>
                      <div className='text-muted-foreground text-xs'>
                        {txn.user_email}
                      </div>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {formatType(txn.transaction_type)}
                    </TableCell>
                    <TableCell className='text-right font-medium'>
                      ${parseFloat(txn.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(txn.status)}>
                        {txn.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        {canVoid(txn) && (
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-7 text-xs'
                            onClick={() =>
                              setPendingAction({
                                type: 'void',
                                transaction: txn,
                              })
                            }
                          >
                            <XCircle className='mr-1 h-3 w-3' />
                            Void
                          </Button>
                        )}
                        {canRefund(txn) && (
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-7 text-xs'
                            onClick={() => {
                              setRefundAmount(txn.amount)
                              setPendingAction({
                                type: 'refund',
                                transaction: txn,
                              })
                            }}
                          >
                            <RotateCcw className='mr-1 h-3 w-3' />
                            Refund
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Void / Refund confirmation dialog */}
      <Dialog open={pendingAction !== null} onOpenChange={closeDialog}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === 'void'
                ? 'Void Transaction'
                : 'Refund Transaction'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'void'
                ? 'This will reverse the captured charge. The donor will not be billed.'
                : 'Issue a full or partial refund to the donor.'}
            </DialogDescription>
          </DialogHeader>

          {pendingAction && (
            <div className='space-y-4'>
              <div className='rounded-md border p-3 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Donor</span>
                  <span className='font-medium'>
                    {pendingAction.transaction.user_name}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Amount</span>
                  <span>
                    ${parseFloat(pendingAction.transaction.amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {pendingAction.type === 'refund' && (
                <div className='space-y-1.5'>
                  <Label htmlFor='refund-amount'>Refund Amount ($)</Label>
                  <Input
                    id='refund-amount'
                    type='number'
                    min='0.01'
                    step='0.01'
                    max={parseFloat(pendingAction.transaction.amount)}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    disabled={isMutating}
                  />
                </div>
              )}

              <div className='space-y-1.5'>
                <Label htmlFor='action-reason'>
                  Reason{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id='action-reason'
                  rows={2}
                  maxLength={500}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  disabled={isMutating}
                />
              </div>
            </div>
          )}

          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              onClick={closeDialog}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleConfirm}
              disabled={isMutating}
            >
              {isMutating ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processing…
                </>
              ) : pendingAction?.type === 'void' ? (
                'Void Transaction'
              ) : (
                'Issue Refund'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
