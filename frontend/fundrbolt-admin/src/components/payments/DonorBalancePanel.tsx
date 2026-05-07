/**
 * DonorBalancePanel — T050
 *
 * Lists outstanding donor balances for an event and lets admins initiate a
 * charge via AdminChargeModal. Supports search, filter, sort, and card/table
 * view toggle for mobile.
 */
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DonorBalanceSummary } from '@/types/payments'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  CreditCard,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react'
import { getDonorBalances } from '@/lib/api/admin-payments'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BidderAvatar } from '@/components/bidder-avatar'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { AdminChargeModal } from './AdminChargeModal'

interface DonorBalancePanelProps {
  eventId: string
  npoId: string
}

type SortKey = 'name' | 'balance'
type CardFilter = 'all' | 'card' | 'no-card'

function fmtCurrency(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function SortIcon({
  colKey,
  sortKey,
  sortDir,
}: {
  colKey: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}) {
  if (sortKey !== colKey)
    return <ChevronsUpDown className='h-3.5 w-3.5 opacity-40' />
  return sortDir === 'asc' ? (
    <ArrowUp className='h-3.5 w-3.5 text-blue-500' />
  ) : (
    <ArrowDown className='h-3.5 w-3.5 text-blue-500' />
  )
}

export function DonorBalancePanel({ eventId, npoId }: DonorBalancePanelProps) {
  const queryClient = useQueryClient()
  const [chargeTarget, setChargeTarget] = useState<DonorBalanceSummary | null>(
    null
  )
  const [search, setSearch] = useState('')
  const [cardFilter, setCardFilter] = useState<CardFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('balance')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useViewPreference('donor-balances')

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

  const displayed = useMemo(() => {
    if (!data) return []
    let donors = [...data.donors]

    // search
    const q = search.trim().toLowerCase()
    if (q) {
      donors = donors.filter(
        (d) =>
          `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q)
      )
    }

    // card filter
    if (cardFilter === 'card')
      donors = donors.filter((d) => d.has_payment_profile)
    if (cardFilter === 'no-card')
      donors = donors.filter((d) => !d.has_payment_profile)

    // sort
    donors.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`
        )
      } else {
        cmp = parseFloat(a.total_balance) - parseFloat(b.total_balance)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return donors
  }, [data, search, cardFilter, sortKey, sortDir])

  const totalOutstanding = data ? parseFloat(data.total_outstanding) : 0
  const hasData = !isLoading && !isError && data && data.donors.length > 0

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          {/* Title row */}
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <div className='min-w-0'>
              <CardTitle className='flex items-center gap-2'>
                <CreditCard className='h-5 w-5 shrink-0' />
                Donor Balances
              </CardTitle>
              <CardDescription className='mt-0.5'>
                Outstanding balances across auction wins, donations, bids, and
                tickets
              </CardDescription>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              {data && (
                <div className='text-right'>
                  <p className='text-muted-foreground text-xs'>Outstanding</p>
                  <p className='text-base font-bold text-orange-600'>
                    {fmtCurrency(totalOutstanding)}
                  </p>
                </div>
              )}
              <Button
                variant='outline'
                size='icon'
                className='h-8 w-8'
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

          {/* Toolbar — only shown when there's data */}
          {hasData && (
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <div className='relative min-w-0 flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder='Search name or email…'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='h-8 pl-9 text-sm'
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className={`h-8 gap-1.5 ${cardFilter !== 'all' ? 'border-blue-300 text-blue-600' : ''}`}
                  >
                    <Filter className='h-3.5 w-3.5' />
                    {cardFilter === 'card'
                      ? 'Has card'
                      : cardFilter === 'no-card'
                        ? 'No card'
                        : 'Card'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-40'>
                  <DropdownMenuLabel className='text-muted-foreground text-xs'>
                    Filter by card
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={cardFilter}
                    onValueChange={(v) => setCardFilter(v as CardFilter)}
                  >
                    <DropdownMenuRadioItem value='all'>
                      All donors
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value='card'>
                      Has card
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value='no-card'>
                      No card
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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
              {error instanceof Error
                ? error.message
                : 'Failed to load donor balances.'}
            </div>
          ) : !data || data.donors.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center text-sm'>
              <p className='font-medium'>All donors are settled up</p>
              <p className='mt-1'>No outstanding balances for this event.</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              No donors match the current filters.
            </div>
          ) : viewMode === 'card' ? (
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {displayed.map((donor) => (
                <div
                  key={donor.user_id}
                  className='bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-sm'
                >
                  <div className='flex items-center gap-3'>
                    <BidderAvatar
                      name={`${donor.first_name} ${donor.last_name}`}
                    />
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>
                        {donor.first_name} {donor.last_name}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {donor.email}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-muted-foreground text-xs'>Balance</p>
                      <p className='text-lg font-bold text-orange-600'>
                        {fmtCurrency(donor.total_balance)}
                      </p>
                    </div>
                    {donor.has_payment_profile ? (
                      <Badge
                        variant='outline'
                        className='border-green-200 bg-green-50 text-green-700'
                      >
                        <CreditCard className='mr-1 h-3 w-3' />
                        Card on file
                      </Badge>
                    ) : (
                      <Badge
                        variant='outline'
                        className='text-muted-foreground'
                      >
                        No card
                      </Badge>
                    )}
                  </div>
                  <Button
                    size='sm'
                    className='w-full'
                    disabled={!donor.has_payment_profile}
                    title={
                      donor.has_payment_profile
                        ? `Charge ${donor.first_name} ${donor.last_name}`
                        : 'No payment profile on file'
                    }
                    onClick={() => setChargeTarget(donor)}
                  >
                    <Zap className='mr-1.5 h-3.5 w-3.5' />
                    Charge {fmtCurrency(donor.total_balance)}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Donor */}
                  <TableHead className='p-0'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className='hover:bg-muted/50 flex h-10 w-full items-center gap-1.5 px-4 text-left text-sm font-medium'>
                          Donor
                          <SortIcon
                            colKey='name'
                            sortKey={sortKey}
                            sortDir={sortDir}
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='start' className='w-40'>
                        <DropdownMenuLabel className='text-muted-foreground text-xs'>
                          Sort
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortKey('name')
                            setSortDir('asc')
                          }}
                        >
                          <ArrowUp className='mr-2 h-3.5 w-3.5' /> A → Z
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortKey('name')
                            setSortDir('desc')
                          }}
                        >
                          <ArrowDown className='mr-2 h-3.5 w-3.5' /> Z → A
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>

                  {/* Email — hidden on mobile, no menu */}
                  <TableHead className='hidden sm:table-cell'>Email</TableHead>

                  {/* Balance */}
                  <TableHead className='p-0 text-right'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className='hover:bg-muted/50 flex h-10 w-full items-center justify-end gap-1.5 px-4 text-right text-sm font-medium'>
                          Balance
                          <SortIcon
                            colKey='balance'
                            sortKey={sortKey}
                            sortDir={sortDir}
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end' className='w-44'>
                        <DropdownMenuLabel className='text-muted-foreground text-xs'>
                          Sort
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortKey('balance')
                            setSortDir('desc')
                          }}
                        >
                          <ArrowDown className='mr-2 h-3.5 w-3.5' /> Highest
                          first
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortKey('balance')
                            setSortDir('asc')
                          }}
                        >
                          <ArrowUp className='mr-2 h-3.5 w-3.5' /> Lowest first
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>

                  {/* Card */}
                  <TableHead className='text-center'>Card</TableHead>

                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((donor) => (
                  <TableRow key={donor.user_id}>
                    <TableCell className='font-medium'>
                      <div className='flex items-center gap-2'>
                        <BidderAvatar
                          name={`${donor.first_name} ${donor.last_name}`}
                        />
                        <div className='min-w-0'>
                          <p className='truncate'>
                            {donor.first_name} {donor.last_name}
                          </p>
                          <p className='text-muted-foreground truncate text-xs sm:hidden'>
                            {donor.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground hidden text-sm sm:table-cell'>
                      {donor.email}
                    </TableCell>
                    <TableCell className='text-right font-semibold text-orange-600'>
                      {fmtCurrency(donor.total_balance)}
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
