import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useViewPreference } from '@/hooks/use-view-preference'
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useOutbidLeaders } from '../hooks/useDonorDashboard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface OutbidLeadersTabProps {
  eventId?: string
  npoId?: string
  onSelectDonor: (userId: string) => void
}

type SortColumn =
  | 'total_outbid_amount'
  | 'items_bid_on'
  | 'items_won'
  | 'items_lost'
  | 'win_rate'

interface Filters {
  name: string
}

export function OutbidLeadersTab({
  eventId,
  npoId,
  onSelectDonor,
}: OutbidLeadersTabProps) {
  const [viewMode, setViewMode] = useViewPreference('outbid-leaders')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({ name: '' })
  const [sortBy, setSortBy] = useState<SortColumn>('total_outbid_amount')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)
  const perPage = 20

  const { data, isLoading, isError, refetch } = useOutbidLeaders({
    event_id: eventId,
    npo_id: npoId,
    page,
    per_page: perPage,
  })

  const handleSort = (col: SortColumn) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortOrder('desc')
    }
  }

  const sortIndicator = (col: SortColumn) =>
    sortBy === col ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''

  const filteredAndSorted = useMemo(() => {
    if (!data) return []
    let items = [...data.items]

    // Filter
    if (filters.name) {
      const q = filters.name.toLowerCase()
      items = items.filter(
        (l) =>
          l.first_name.toLowerCase().includes(q) ||
          l.last_name.toLowerCase().includes(q)
      )
    }

    // Sort
    items.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      return sortOrder === 'desc'
        ? (bv as number) - (av as number)
        : (av as number) - (bv as number)
    })

    return items
  }, [data, filters, sortBy, sortOrder])

  const activeFilterCount = filters.name ? 1 : 0

  const clearFilters = () => setFilters({ name: '' })

  if (isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading outbid leaders...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-muted-foreground text-sm'>
            Unable to load outbid leaders. Please try again.
          </p>
          <Button size='sm' onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          No outbid data available for the current scope.
        </CardContent>
      </Card>
    )
  }

  const totalPages = Math.ceil(data.total / perPage)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-4'>
        <CardTitle className='text-base'>Outbid Leaders</CardTitle>
        <DataTableViewToggle value={viewMode} onChange={setViewMode} />
      </CardHeader>
      <CardContent className='space-y-4'>
        {viewMode === 'card' ? (
          <div className='space-y-3'>
            {/* Card filter bar */}
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCardFiltersOpen(!cardFiltersOpen)}
              >
                <Filter className='mr-1 h-4 w-4' />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant='secondary' className='ml-1'>
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button variant='ghost' size='sm' onClick={clearFilters}>
                  <X className='mr-1 h-4 w-4' />
                  Clear
                </Button>
              )}
            </div>
            {cardFiltersOpen && (
              <div className='bg-muted/30 rounded-md border p-3'>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='space-y-1'>
                    <span className='text-muted-foreground text-xs'>Name</span>
                    <Input
                      placeholder='Filter name…'
                      value={filters.name}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className='space-y-1'>
                    <span className='text-muted-foreground text-xs'>
                      Sort by
                    </span>
                    <div className='flex flex-wrap gap-1'>
                      {(
                        [
                          ['total_outbid_amount', 'Amount'],
                          ['items_bid_on', 'Items'],
                          ['items_won', 'Won'],
                          ['items_lost', 'Lost'],
                          ['win_rate', 'Win Rate'],
                        ] as [SortColumn, string][]
                      ).map(([col, label]) => (
                        <Button
                          key={col}
                          variant={sortBy === col ? 'default' : 'outline'}
                          size='sm'
                          className='h-7 text-xs'
                          onClick={() => handleSort(col)}
                        >
                          {label}
                          {sortBy === col &&
                            (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Cards grid */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {filteredAndSorted.map((leader, i) => (
                <div
                  key={leader.user_id}
                  className='hover:bg-muted/50 cursor-pointer space-y-2 rounded-md border p-3'
                  onClick={() => onSelectDonor(leader.user_id)}
                >
                  <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground font-mono text-xs'>
                      #{(page - 1) * perPage + i + 1}
                    </span>
                    <span className='font-medium'>
                      {leader.first_name} {leader.last_name}
                    </span>
                  </div>
                  <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                    <dt className='text-muted-foreground'>Outbid Amount</dt>
                    <dd className='font-semibold'>
                      {fmt(leader.total_outbid_amount)}
                    </dd>
                    <dt className='text-muted-foreground'>Items Bid On</dt>
                    <dd>{leader.items_bid_on}</dd>
                    <dt className='text-muted-foreground'>Won</dt>
                    <dd>{leader.items_won}</dd>
                    <dt className='text-muted-foreground'>Lost</dt>
                    <dd>{leader.items_lost}</dd>
                    <dt className='text-muted-foreground'>Win Rate</dt>
                    <dd>{(leader.win_rate * 100).toFixed(0)}%</dd>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12'>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('total_outbid_amount')}
                  >
                    Outbid Amount{sortIndicator('total_outbid_amount')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('items_bid_on')}
                  >
                    Items Bid On{sortIndicator('items_bid_on')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('items_won')}
                  >
                    Won{sortIndicator('items_won')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('items_lost')}
                  >
                    Lost{sortIndicator('items_lost')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('win_rate')}
                  >
                    Win Rate{sortIndicator('win_rate')}
                  </TableHead>
                </TableRow>
                {/* Filter row */}
                <TableRow>
                  <TableHead />
                  <TableHead>
                    <Input
                      placeholder='Filter name…'
                      value={filters.name}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className='h-7 text-xs'
                    />
                  </TableHead>
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((leader, i) => (
                  <TableRow
                    key={leader.user_id}
                    className='cursor-pointer'
                    onClick={() => onSelectDonor(leader.user_id)}
                  >
                    <TableCell className='font-medium'>
                      {(page - 1) * perPage + i + 1}
                    </TableCell>
                    <TableCell>
                      {leader.first_name} {leader.last_name}
                    </TableCell>
                    <TableCell>{fmt(leader.total_outbid_amount)}</TableCell>
                    <TableCell>{leader.items_bid_on}</TableCell>
                    <TableCell>{leader.items_won}</TableCell>
                    <TableCell>{leader.items_lost}</TableCell>
                    <TableCell>{(leader.win_rate * 100).toFixed(0)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className='flex items-center justify-between'>
            <p className='text-muted-foreground text-sm'>
              {data.total} donors total
            </p>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <span className='text-sm'>
                {page} / {totalPages}
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
