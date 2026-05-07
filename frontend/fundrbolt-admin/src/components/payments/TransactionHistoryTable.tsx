/**
 * TransactionHistoryTable — T054-T056
 *
 * Shows all payment transactions for an event with void / refund actions.
 * Supports search, filter by status/type, sort, and card/table view toggle.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TransactionListItem } from '@/types/payments'
import {
  ArrowUpDown,
  Filter,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getEventTransactions,
  refundTransaction,
  voidTransaction,
} from '@/lib/api/admin-payments'
import { useViewPreference } from '@/hooks/use-view-preference'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { DataTableViewToggle } from '@/components/data-table/view-toggle'

interface TransactionHistoryTableProps {
  eventId: string
}

type ActionType = 'void' | 'refund'

interface PendingAction {
  type: ActionType
  transaction: TransactionListItem
}

type SortKey = 'date' | 'amount' | 'donor' | 'type' | 'status'

function fmtCurrency(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
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

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useViewPreference('transactions')

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
      toast.success(`Refund of ${fmtCurrency(data.amount_refunded)} processed`)
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

  // Derive unique status/type values for filter dropdowns
  const statusOptions = useMemo(() => {
    if (!data) return []
    return [...new Set(data.transactions.map((t) => t.status))].sort()
  }, [data])

  const typeOptions = useMemo(() => {
    if (!data) return []
    return [...new Set(data.transactions.map((t) => t.transaction_type))].sort()
  }, [data])

  const displayed = useMemo(() => {
    if (!data) return []
    let txns = [...data.transactions]

    const q = search.trim().toLowerCase()
    if (q) {
      txns = txns.filter(
        (t) =>
          t.user_name.toLowerCase().includes(q) ||
          t.user_email.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all')
      txns = txns.filter((t) => t.status === statusFilter)
    if (typeFilter !== 'all')
      txns = txns.filter((t) => t.transaction_type === typeFilter)

    txns.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') {
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortKey === 'amount') {
        cmp = parseFloat(a.amount) - parseFloat(b.amount)
      } else if (sortKey === 'type') {
        cmp = a.transaction_type.localeCompare(b.transaction_type)
      } else if (sortKey === 'status') {
        cmp = a.status.localeCompare(b.status)
      } else {
        cmp = a.user_name.localeCompare(b.user_name)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return txns
  }, [data, search, statusFilter, typeFilter, sortKey, sortDir])

  function handleSortToggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const hasData = !isLoading && !isError && data && data.transactions.length > 0

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <div className='min-w-0'>
              <CardTitle className='flex items-center gap-2'>
                <History className='h-5 w-5 shrink-0' />
                Transaction History
              </CardTitle>
              <CardDescription className='mt-0.5'>
                All payment transactions for this event
              </CardDescription>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              {data && (
                <span className='text-muted-foreground text-sm'>
                  {data.total} transaction{data.total !== 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant='outline'
                size='icon'
                className='h-8 w-8'
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

          {/* Toolbar — search + view toggle; column header menus handle sort/filter */}
          {hasData && (
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <div className='relative min-w-0 flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder='Search donor name or email…'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='h-8 pl-9 text-sm'
                />
              </div>
              <DataTableViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          )}
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
          ) : displayed.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              No transactions match the current filters.
            </div>
          ) : viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {displayed.map((txn) => (
                <div
                  key={txn.transaction_id}
                  className='bg-card flex flex-col gap-2 rounded-lg border p-4 shadow-sm'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{txn.user_name}</p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {txn.user_email}
                      </p>
                    </div>
                    <Badge
                      variant={statusVariant(txn.status)}
                      className='shrink-0'
                    >
                      {txn.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-muted-foreground text-xs'>
                        {formatType(txn.transaction_type)}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {new Date(txn.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className='text-lg font-semibold'>
                      {fmtCurrency(txn.amount)}
                    </p>
                  </div>
                  {(canVoid(txn) || canRefund(txn)) && (
                    <div className='flex gap-2 border-t pt-2'>
                      {canVoid(txn) && (
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-7 flex-1 text-xs'
                          onClick={() =>
                            setPendingAction({ type: 'void', transaction: txn })
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
                          className='h-7 flex-1 text-xs'
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
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Date */}
                  <TableHead>
                    <div className='flex h-10 items-center gap-1 px-4'>
                      <button
                        type='button'
                        className='flex items-center gap-1.5 text-sm font-medium'
                        onClick={() => handleSortToggle('date')}
                      >
                        Date
                        <ArrowUpDown className='text-muted-foreground h-3 w-3' />
                        {sortKey === 'date' && (
                          <span className='text-muted-foreground text-xs'>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </div>
                  </TableHead>

                  {/* Donor */}
                  <TableHead>
                    <div className='flex h-10 items-center gap-1 px-4'>
                      <button
                        type='button'
                        className='flex items-center gap-1.5 text-sm font-medium'
                        onClick={() => handleSortToggle('donor')}
                      >
                        Donor
                        <ArrowUpDown className='text-muted-foreground h-3 w-3' />
                        {sortKey === 'donor' && (
                          <span className='text-muted-foreground text-xs'>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type='button'
                            className={`rounded-sm p-1 ${search ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                            aria-label='Filter donors'
                          >
                            <Filter className='h-3 w-3' />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start' className='w-56'>
                          <DropdownMenuLabel className='text-muted-foreground text-xs'>
                            Filter by name or email
                          </DropdownMenuLabel>
                          <div
                            className='px-2 py-2'
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              placeholder='Search name or email…'
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              className='h-8 text-sm'
                            />
                          </div>
                          <DropdownMenuItem
                            disabled={!search}
                            onSelect={() => setSearch('')}
                          >
                            Clear filter
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableHead>

                  {/* Type */}
                  <TableHead className='hidden sm:table-cell'>
                    <div className='flex h-10 items-center gap-1 px-4'>
                      <button
                        type='button'
                        className='flex items-center gap-1.5 text-sm font-medium'
                        onClick={() => handleSortToggle('type')}
                      >
                        Type
                        <ArrowUpDown className='text-muted-foreground h-3 w-3' />
                        {sortKey === 'type' && (
                          <span className='text-muted-foreground text-xs'>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type='button'
                            className={`rounded-sm p-1 ${typeFilter !== 'all' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                            aria-label='Filter by type'
                          >
                            <Filter className='h-3 w-3' />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start' className='w-48'>
                          <DropdownMenuLabel className='text-muted-foreground text-xs'>
                            Filter
                          </DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={typeFilter}
                            onValueChange={setTypeFilter}
                          >
                            <DropdownMenuRadioItem value='all'>
                              All types
                            </DropdownMenuRadioItem>
                            {typeOptions.map((t) => (
                              <DropdownMenuRadioItem key={t} value={t}>
                                {formatType(t)}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableHead>

                  {/* Amount */}
                  <TableHead className='text-right'>
                    <div className='flex h-10 items-center justify-end px-4'>
                      <button
                        type='button'
                        className='flex items-center gap-1.5 text-sm font-medium'
                        onClick={() => handleSortToggle('amount')}
                      >
                        Amount
                        <ArrowUpDown className='text-muted-foreground h-3 w-3' />
                        {sortKey === 'amount' && (
                          <span className='text-muted-foreground text-xs'>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </div>
                  </TableHead>

                  {/* Status */}
                  <TableHead>
                    <div className='flex h-10 items-center gap-1 px-4'>
                      <button
                        type='button'
                        className='flex items-center gap-1.5 text-sm font-medium'
                        onClick={() => handleSortToggle('status')}
                      >
                        Status
                        <ArrowUpDown className='text-muted-foreground h-3 w-3' />
                        {sortKey === 'status' && (
                          <span className='text-muted-foreground text-xs'>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type='button'
                            className={`rounded-sm p-1 ${statusFilter !== 'all' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                            aria-label='Filter by status'
                          >
                            <Filter className='h-3 w-3' />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start' className='w-44'>
                          <DropdownMenuLabel className='text-muted-foreground text-xs'>
                            Filter
                          </DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                          >
                            <DropdownMenuRadioItem value='all'>
                              All statuses
                            </DropdownMenuRadioItem>
                            {statusOptions.map((s) => (
                              <DropdownMenuRadioItem key={s} value={s}>
                                {s.replace(/_/g, ' ')}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableHead>

                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((txn) => (
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
                    <TableCell className='hidden text-sm sm:table-cell'>
                      {formatType(txn.transaction_type)}
                    </TableCell>
                    <TableCell className='text-right font-medium'>
                      {fmtCurrency(txn.amount)}
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
                  <span>{fmtCurrency(pendingAction.transaction.amount)}</span>
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
