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
import type { BidWarEntry } from '@/services/donor-dashboard'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useBidWars } from '../hooks/useDonorDashboard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface BidWarsTabProps {
  eventId?: string
  npoId?: string
}

type SortColumn = 'bid_war_count' | 'total_bids_in_wars'

interface Filters {
  name: string
}

export function BidWarsTab({ eventId, npoId }: BidWarsTabProps) {
  const [viewMode, setViewMode] = useViewPreference('bid-wars')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Filters>({ name: '' })
  const [sortBy, setSortBy] = useState<SortColumn>('bid_war_count')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)
  const perPage = 20

  const { data, isLoading, isError, refetch } = useBidWars({
    event_id: eventId,
    npo_id: npoId,
    page,
    per_page: perPage,
  })

  const toggle = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

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

    if (filters.name) {
      const q = filters.name.toLowerCase()
      items = items.filter(
        (e) =>
          e.first_name.toLowerCase().includes(q) ||
          e.last_name.toLowerCase().includes(q)
      )
    }

    items.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      return sortOrder === 'desc' ? bv - av : av - bv
    })

    return items
  }, [data, filters, sortBy, sortOrder])

  const activeFilterCount = filters.name ? 1 : 0

  const clearFilters = () => setFilters({ name: '' })

  if (isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading bid wars...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-muted-foreground text-sm'>
            Unable to load bid wars. Please try again.
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
          No bid wars found for the current scope.
        </CardContent>
      </Card>
    )
  }

  const totalPages = Math.ceil(data.total / perPage)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-4'>
        <CardTitle className='text-base'>Bid Wars</CardTitle>
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
                          ['bid_war_count', 'Wars'],
                          ['total_bids_in_wars', 'Bids'],
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
              {filteredAndSorted.map((entry) => (
                <div
                  key={entry.user_id}
                  className='space-y-2 rounded-md border p-3'
                >
                  <div
                    className='flex cursor-pointer items-center justify-between'
                    onClick={() => toggle(entry.user_id)}
                  >
                    <span className='font-medium'>
                      {entry.first_name} {entry.last_name}
                    </span>
                    {expanded.has(entry.user_id) ? (
                      <ChevronUp className='text-muted-foreground h-4 w-4' />
                    ) : (
                      <ChevronDown className='text-muted-foreground h-4 w-4' />
                    )}
                  </div>
                  <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                    <dt className='text-muted-foreground'>Wars</dt>
                    <dd>{entry.bid_war_count}</dd>
                    <dt className='text-muted-foreground'>Total Bids</dt>
                    <dd>{entry.total_bids_in_wars}</dd>
                  </dl>
                  {expanded.has(entry.user_id) &&
                    entry.top_war_items.length > 0 && (
                      <div className='space-y-1 border-t pt-2'>
                        {entry.top_war_items.map((item) => (
                          <div
                            key={item.item_id}
                            className='flex items-center justify-between text-sm'
                          >
                            <span className='text-muted-foreground'>
                              {item.item_title}
                              {item.won && (
                                <Badge variant='default' className='ml-1'>
                                  Won
                                </Badge>
                              )}
                            </span>
                            <span>
                              {item.bid_count} bids · {fmt(item.highest_bid)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10' />
                  <TableHead>Donor</TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('bid_war_count')}
                  >
                    Wars{sortIndicator('bid_war_count')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('total_bids_in_wars')}
                  >
                    Total Bids{sortIndicator('total_bids_in_wars')}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((entry) => (
                  <BidWarRow
                    key={entry.user_id}
                    entry={entry}
                    isExpanded={expanded.has(entry.user_id)}
                    onToggle={() => toggle(entry.user_id)}
                  />
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

function BidWarRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: BidWarEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow className='cursor-pointer' onClick={onToggle}>
        <TableCell>
          {isExpanded ? (
            <ChevronUp className='text-muted-foreground h-4 w-4' />
          ) : (
            <ChevronDown className='text-muted-foreground h-4 w-4' />
          )}
        </TableCell>
        <TableCell className='font-medium'>
          {entry.first_name} {entry.last_name}
        </TableCell>
        <TableCell>{entry.bid_war_count}</TableCell>
        <TableCell>{entry.total_bids_in_wars}</TableCell>
      </TableRow>
      {isExpanded &&
        entry.top_war_items.map((item) => (
          <TableRow key={item.item_id} className='bg-muted/40'>
            <TableCell />
            <TableCell className='text-muted-foreground pl-8 text-sm'>
              {item.item_title}
              {item.won && (
                <Badge variant='default' className='ml-2'>
                  Won
                </Badge>
              )}
            </TableCell>
            <TableCell className='text-sm'>{item.bid_count} bids</TableCell>
            <TableCell className='text-sm'>{fmt(item.highest_bid)}</TableCell>
          </TableRow>
        ))}
    </>
  )
}
