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
import apiClient from '@/lib/axios'
import { ChevronRight, Download, Filter, Search } from 'lucide-react'
import { useState } from 'react'
import { useDonorLeaderboard } from '../hooks/useDonorDashboard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface DonorLeaderboardProps {
  eventId?: string
  npoId?: string
  onSelectDonor: (userId: string) => void
}

type SortColumn =
  | 'total_given'
  | 'events_attended'
  | 'ticket_total'
  | 'donation_total'
  | 'silent_auction_total'
  | 'live_auction_total'
  | 'buy_now_total'

export function DonorLeaderboard({
  eventId,
  npoId,
  onSelectDonor,
}: DonorLeaderboardProps) {
  const [viewMode, setViewMode] = useViewPreference('donor-leaderboard')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortColumn>('total_given')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)
  const perPage = 25

  const query = useDonorLeaderboard({
    event_id: eventId,
    npo_id: npoId,
    sort_by: sortBy,
    sort_order: sortOrder,
    search: debouncedSearch || undefined,
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
    setPage(1)
  }

  const handleSearchSubmit = () => {
    setDebouncedSearch(search)
    setPage(1)
  }

  const handleExport = async () => {
    try {
      const response = await apiClient.get(
        '/admin/donor-dashboard/leaderboard/export',
        {
          params: {
            event_id: eventId,
            npo_id: npoId,
            sort_by: sortBy,
            sort_order: sortOrder,
            search: debouncedSearch || undefined,
          },
          responseType: 'blob',
        }
      )
      const url = window.URL.createObjectURL(
        new Blob([response.data as BlobPart])
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'donor-leaderboard.csv'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      // Silently fail — user can retry
    }
  }

  const sortIndicator = (col: SortColumn) =>
    sortBy === col ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading leaderboard...
        </CardContent>
      </Card>
    )
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-destructive text-sm'>
            Unable to load donor leaderboard.
          </p>
          <Button type='button' onClick={() => void query.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const data = query.data
  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-center text-sm'>
          No donor data found for the selected scope.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-4'>
        <CardTitle>Donor Leaderboard</CardTitle>
        <div className='flex items-center gap-2'>
          <DataTableViewToggle value={viewMode} onChange={setViewMode} />
          <div className='relative'>
            <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
            <Input
              placeholder='Search donors...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              className='w-[200px] pl-8'
            />
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => void handleExport()}
          >
            <Download className='mr-1 h-4 w-4' />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                Sort
              </Button>
              <span className='text-muted-foreground text-sm'>
                Sorted by:{' '}
                <button
                  type='button'
                  className='font-medium underline'
                  onClick={() => setCardFiltersOpen(true)}
                >
                  {sortBy.replace(/_/g, ' ')} {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </span>
            </div>
            {cardFiltersOpen && (
              <div className='bg-muted/30 rounded-md border p-3'>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
                  {(
                    [
                      ['total_given', 'Total Given'],
                      ['events_attended', 'Events'],
                      ['ticket_total', 'Tickets'],
                      ['donation_total', 'Donations'],
                      ['silent_auction_total', 'Silent'],
                      ['live_auction_total', 'Live'],
                      ['buy_now_total', 'Buy-Now'],
                    ] as [SortColumn, string][]
                  ).map(([col, label]) => (
                    <Button
                      key={col}
                      variant={sortBy === col ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => handleSort(col)}
                    >
                      {label}
                      {sortBy === col && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {/* Cards grid */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {data.items.map((donor, i) => (
                <div
                  key={donor.user_id}
                  className='hover:bg-muted/50 cursor-pointer space-y-2 rounded-md border p-3'
                  onClick={() => onSelectDonor(donor.user_id)}
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground font-mono text-xs'>
                        #{(page - 1) * perPage + i + 1}
                      </span>
                      <span
                        className={`font-medium ${!donor.is_active ? 'text-muted-foreground' : ''}`}
                      >
                        {donor.first_name} {donor.last_name}
                      </span>
                      {!donor.is_active && (
                        <Badge variant='secondary' className='text-xs'>
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                    <dt className='text-muted-foreground'>Total Given</dt>
                    <dd className='font-semibold'>{fmt(donor.total_given)}</dd>
                    <dt className='text-muted-foreground'>Events</dt>
                    <dd>{donor.events_attended}</dd>
                    <dt className='text-muted-foreground'>Tickets</dt>
                    <dd>{fmt(donor.ticket_total)}</dd>
                    <dt className='text-muted-foreground'>Donations</dt>
                    <dd>{fmt(donor.donation_total)}</dd>
                    <dt className='text-muted-foreground'>Silent</dt>
                    <dd>{fmt(donor.silent_auction_total)}</dd>
                    <dt className='text-muted-foreground'>Live</dt>
                    <dd>{fmt(donor.live_auction_total)}</dd>
                    <dt className='text-muted-foreground'>Buy-Now</dt>
                    <dd>{fmt(donor.buy_now_total)}</dd>
                  </dl>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='mt-2 w-full'
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectDonor(donor.user_id)
                    }}
                  >
                    View Profile
                    <ChevronRight className='ml-1 h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[50px]'>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('total_given')}
                  >
                    Total Given{sortIndicator('total_given')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('events_attended')}
                  >
                    Events{sortIndicator('events_attended')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('ticket_total')}
                  >
                    Tickets{sortIndicator('ticket_total')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('donation_total')}
                  >
                    Donations{sortIndicator('donation_total')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('silent_auction_total')}
                  >
                    Silent{sortIndicator('silent_auction_total')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('live_auction_total')}
                  >
                    Live{sortIndicator('live_auction_total')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer whitespace-nowrap select-none'
                    onClick={() => handleSort('buy_now_total')}
                  >
                    Buy-Now{sortIndicator('buy_now_total')}
                  </TableHead>
                  <TableHead className='w-[80px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((donor, i) => (
                  <TableRow
                    key={donor.user_id}
                    className='hover:bg-muted/50 cursor-pointer'
                    onClick={() => onSelectDonor(donor.user_id)}
                  >
                    <TableCell className='font-mono text-sm'>
                      {(page - 1) * perPage + i + 1}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span
                          className={
                            !donor.is_active ? 'text-muted-foreground' : ''
                          }
                        >
                          {donor.first_name} {donor.last_name}
                        </span>
                        {!donor.is_active && (
                          <Badge variant='secondary' className='text-xs'>
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='font-semibold'>
                      {fmt(donor.total_given)}
                    </TableCell>
                    <TableCell>{donor.events_attended}</TableCell>
                    <TableCell>{fmt(donor.ticket_total)}</TableCell>
                    <TableCell>{fmt(donor.donation_total)}</TableCell>
                    <TableCell>{fmt(donor.silent_auction_total)}</TableCell>
                    <TableCell>{fmt(donor.live_auction_total)}</TableCell>
                    <TableCell>{fmt(donor.buy_now_total)}</TableCell>
                    <TableCell>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectDonor(donor.user_id)
                        }}
                      >
                        View
                        <ChevronRight className='ml-1 h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {data.pages > 1 && (
          <div className='mt-4 flex items-center justify-between'>
            <p className='text-muted-foreground text-sm'>
              Page {data.page} of {data.pages} ({data.total} donors)
            </p>
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
