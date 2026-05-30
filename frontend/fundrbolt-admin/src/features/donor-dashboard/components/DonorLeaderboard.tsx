import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { useViewPreference } from '@/hooks/use-view-preference'
import apiClient from '@/lib/axios'
import {
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Filter,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDonorLeaderboard } from '../hooks/useDonorDashboard'
import { SendNotificationDialog } from './SendNotificationDialog'

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

type FilterPreset = 'zero_only' | 'nonzero_only' | 'custom'

interface ColumnFilter {
  col: SortColumn
  preset: FilterPreset
  min: string
  max: string
}

interface LeaderboardFilters {
  name: string
  total_given: string
  events_attended: string
  ticket_total: string
  donation_total: string
  silent_auction_total: string
  live_auction_total: string
  buy_now_total: string
}

const defaultFilters: LeaderboardFilters = {
  name: '',
  total_given: '',
  events_attended: '',
  ticket_total: '',
  donation_total: '',
  silent_auction_total: '',
  live_auction_total: '',
  buy_now_total: '',
}

const NUMERIC_COLS: { key: SortColumn; label: string }[] = [
  { key: 'total_given', label: 'Total Given' },
  { key: 'events_attended', label: 'Events' },
  { key: 'ticket_total', label: 'Tickets' },
  { key: 'donation_total', label: 'Donations' },
  { key: 'silent_auction_total', label: 'Silent' },
  { key: 'live_auction_total', label: 'Live' },
  { key: 'buy_now_total', label: 'Buy-Now' },
]

function SortIcon({
  column,
  sortBy,
  sortOrder,
}: {
  column: SortColumn
  sortBy: SortColumn
  sortOrder: 'asc' | 'desc'
}) {
  if (sortBy !== column) return <ChevronsUpDown className='h-3.5 w-3.5 opacity-50' />
  return sortOrder === 'desc' ? (
    <ArrowDown className='h-3.5 w-3.5' />
  ) : (
    <ArrowUp className='h-3.5 w-3.5' />
  )
}

function ColHeader({
  col,
  label,
  sortBy,
  sortOrder,
  activeFilter,
  onSort,
  onFilter,
  onClearFilter,
  alignRight,
}: {
  col: SortColumn
  label: string
  sortBy: SortColumn
  sortOrder: 'asc' | 'desc'
  activeFilter: ColumnFilter | null
  onSort: (col: SortColumn, dir: 'asc' | 'desc') => void
  onFilter: (filter: ColumnFilter) => void
  onClearFilter: () => void
  alignRight?: boolean
}) {
  const isFiltered = activeFilter?.col === col
  const [customMin, setCustomMin] = useState('')
  const [customMax, setCustomMax] = useState('')

  const handlePreset = (preset: FilterPreset) => {
    if (preset === 'zero_only') {
      onFilter({ col, preset, min: '0', max: '0' })
    } else if (preset === 'nonzero_only') {
      onFilter({ col, preset, min: '0.01', max: '' })
    } else {
      onFilter({ col, preset, min: customMin, max: customMax })
    }
  }

  return (
    <TableHead className={`p-0 ${alignRight ? 'text-right' : ''}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            className={`hover:bg-muted/50 flex h-10 w-full items-center gap-1 px-3 text-sm font-medium ${alignRight ? 'justify-end' : ''} ${isFiltered ? 'text-primary' : ''}`}
          >
            {isFiltered && <Filter className='h-3 w-3 shrink-0' />}
            {label}
            <SortIcon column={col} sortBy={sortBy} sortOrder={sortOrder} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-52'>
          <DropdownMenuLabel className='text-muted-foreground text-xs'>Sort</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSort(col, 'desc')}>
            <ArrowDown className='mr-2 h-4 w-4' />
            Highest first
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSort(col, 'asc')}>
            <ArrowUp className='mr-2 h-4 w-4' />
            Lowest first
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className='text-muted-foreground text-xs'>Filter</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handlePreset('zero_only')}>
            Show only $0 (none)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePreset('nonzero_only')}>
            Show only &gt; $0 (any)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className='px-2 py-1.5 text-xs font-medium'>Custom range</div>
          <div className='flex items-center gap-1 px-2 pb-1'>
            <Input
              type='number'
              min={0}
              placeholder='Min'
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              className='h-7 text-xs'
              onClick={(e) => e.stopPropagation()}
            />
            <span className='text-muted-foreground text-xs'>–</span>
            <Input
              type='number'
              min={0}
              placeholder='Max'
              value={customMax}
              onChange={(e) => setCustomMax(e.target.value)}
              className='h-7 text-xs'
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className='px-2 pb-2'>
            <Button
              size='sm'
              variant='outline'
              className='h-7 w-full text-xs'
              onClick={(e) => {
                e.stopPropagation()
                onFilter({ col, preset: 'custom', min: customMin, max: customMax })
              }}
            >
              Apply
            </Button>
          </div>
          {isFiltered && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearFilter} className='text-destructive'>
                <X className='mr-2 h-4 w-4' />
                Clear filter
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  )
}

export function DonorLeaderboard({
  eventId,
  npoId,
  onSelectDonor,
}: DonorLeaderboardProps) {
  const [viewMode, setViewMode] = useViewPreference('donor-leaderboard')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<LeaderboardFilters>(defaultFilters)
  const [sortBy, setSortBy] = useState<SortColumn>('total_given')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ColumnFilter | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [notifyOpen, setNotifyOpen] = useState(false)
  const perPage = 25
  const searchQuery = useMemo(() => {
    const trimmed = search.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }, [search])

  const filterParams = useMemo(() => {
    if (!activeFilter) return {}
    const min =
      activeFilter.min !== '' ? parseFloat(activeFilter.min) : undefined
    const max =
      activeFilter.max !== '' ? parseFloat(activeFilter.max) : undefined
    return {
      filter_col: activeFilter.col,
      filter_min: min !== undefined && !isNaN(min) ? min : undefined,
      filter_max: max !== undefined && !isNaN(max) ? max : undefined,
    }
  }, [activeFilter])

  const query = useDonorLeaderboard({
    event_id: eventId,
    npo_id: npoId,
    sort_by: sortBy,
    sort_order: sortOrder,
    search: searchQuery,
    ...filterParams,
    page,
    per_page: perPage,
  })

  const handleSort = (col: SortColumn, dir?: 'asc' | 'desc') => {
    if (dir) {
      setSortBy(col)
      setSortOrder(dir)
    } else if (sortBy === col) {
      setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleFilter = (filter: ColumnFilter) => {
    setActiveFilter(filter)
    setPage(1)
  }

  const handleClearFilter = () => {
    setActiveFilter(null)
    setPage(1)
  }

  const clearAllFilters = () => {
    setSearch('')
    setFilters(defaultFilters)
    setActiveFilter(null)
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
            search: searchQuery,
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
      // Silently fail
    }
  }

  const filteredItems = useMemo(() => {
    const normalize = (value: string | number | null | undefined) =>
      String(value ?? '').toLowerCase()
    return (query.data?.items ?? []).filter((row) => {
      if (searchQuery) {
        const haystack = [
          `${row.first_name} ${row.last_name}`,
          row.email,
          row.total_given,
          row.events_attended,
          row.ticket_total,
          row.donation_total,
          row.silent_auction_total,
          row.live_auction_total,
          row.buy_now_total,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(searchQuery.toLowerCase())) return false
      }

      if (
        filters.name &&
        !`${row.first_name} ${row.last_name}`
          .toLowerCase()
          .includes(filters.name.toLowerCase())
      ) {
        return false
      }
      if (
        filters.total_given &&
        !normalize(row.total_given).includes(filters.total_given.toLowerCase())
      ) {
        return false
      }
      if (
        filters.events_attended &&
        !normalize(row.events_attended).includes(
          filters.events_attended.toLowerCase()
        )
      ) {
        return false
      }
      if (
        filters.ticket_total &&
        !normalize(row.ticket_total).includes(filters.ticket_total.toLowerCase())
      ) {
        return false
      }
      if (
        filters.donation_total &&
        !normalize(row.donation_total).includes(
          filters.donation_total.toLowerCase()
        )
      ) {
        return false
      }
      if (
        filters.silent_auction_total &&
        !normalize(row.silent_auction_total).includes(
          filters.silent_auction_total.toLowerCase()
        )
      ) {
        return false
      }
      if (
        filters.live_auction_total &&
        !normalize(row.live_auction_total).includes(
          filters.live_auction_total.toLowerCase()
        )
      ) {
        return false
      }
      if (
        filters.buy_now_total &&
        !normalize(row.buy_now_total).includes(filters.buy_now_total.toLowerCase())
      ) {
        return false
      }

      return true
    })
  }, [filters, query.data?.items, searchQuery])

  // Selection helpers — memoized so stable reference doesn't invalidate downstream useMemo
  const currentItems = useMemo(() => filteredItems, [filteredItems])
  const allPageSelected =
    currentItems.length > 0 &&
    currentItems.every((d) => selectedIds.has(d.user_id))
  const somePageSelected =
    currentItems.some((d) => selectedIds.has(d.user_id)) && !allPageSelected

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePageAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        currentItems.forEach((d) => next.delete(d.user_id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        currentItems.forEach((d) => next.add(d.user_id))
        return next
      })
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectedDonorNames = useMemo(
    () =>
      currentItems
        .filter((d) => selectedIds.has(d.user_id))
        .map((d) => `${d.first_name} ${d.last_name}`),
    [currentItems, selectedIds]
  )

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
  const hasItems = filteredItems.length > 0

  const colHeaderProps = (
    col: SortColumn,
    label: string,
    alignRight?: boolean
  ) => ({
    col,
    label,
    sortBy,
    sortOrder,
    activeFilter,
    onSort: handleSort,
    onFilter: handleFilter,
    onClearFilter: handleClearFilter,
    alignRight,
  })

  const filterLabel = activeFilter
    ? NUMERIC_COLS.find((c) => c.key === activeFilter.col)?.label ?? ''
    : ''

  const filterSummary = activeFilter
    ? activeFilter.preset === 'zero_only'
      ? '$0'
      : activeFilter.preset === 'nonzero_only'
        ? '> $0'
        : `${activeFilter.min || '–'} – ${activeFilter.max || '–'}`
    : ''
  const activeFilterCount =
    Object.values(filters).filter((value) => value.trim().length > 0).length +
    (activeFilter ? 1 : 0)

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <CardTitle>Donor Leaderboard</CardTitle>
            {activeFilter && (
              <Badge
                variant='secondary'
                className='flex items-center gap-1 text-xs'
              >
                <Filter className='h-3 w-3' />
                {filterLabel}: {filterSummary}
                <button
                  type='button'
                  onClick={handleClearFilter}
                  className='hover:text-foreground ml-1'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
            <div className='relative'>
              <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
              <Input
                placeholder='Search donors...'
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className='w-[200px] pl-8'
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant='ghost' size='sm' onClick={clearAllFilters}>
                <X className='mr-1 h-4 w-4' />
                Clear all
              </Button>
            )}
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
          {/* Selection action bar */}
          {selectedIds.size > 0 && (
            <div className='bg-muted/50 mb-3 flex items-center gap-3 rounded-md border px-4 py-2'>
              <span className='text-sm font-medium'>
                {selectedIds.size} selected
              </span>
              <Button
                size='sm'
                variant='outline'
                onClick={() => setNotifyOpen(true)}
                disabled={!eventId}
                title={
                  !eventId
                    ? 'Select an event to send notifications'
                    : undefined
                }
              >
                <Bell className='mr-1.5 h-4 w-4' />
                Send Notification
              </Button>
              <Button
                size='sm'
                variant='ghost'
                className='ml-auto'
                onClick={clearSelection}
              >
                <X className='mr-1 h-4 w-4' />
                Clear
              </Button>
            </div>
          )}

          {!hasItems ? (
            <div className='text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm'>
              No matching donors found.
              {activeFilterCount > 0 && (
                <div className='mt-3 flex items-center justify-center gap-2'>
                  {searchQuery && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        setSearch('')
                        setPage(1)
                      }}
                    >
                      <X className='mr-1 h-3.5 w-3.5' />
                      Clear search
                    </Button>
                  )}
                  {activeFilter && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={handleClearFilter}
                    >
                      <X className='mr-1 h-3.5 w-3.5' />
                      Clear filter
                    </Button>
                  )}
                  {!activeFilter && !searchQuery && (
                    <Button variant='outline' size='sm' onClick={clearAllFilters}>
                      <X className='mr-1 h-3.5 w-3.5' />
                      Clear all
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === 'card' ? (
            <div className='space-y-3'>
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
                    {sortBy.replace(/_/g, ' ')}{' '}
                    {sortOrder === 'desc' ? '↓' : '↑'}
                  </button>
                </span>
                {activeFilter && (
                  <Badge variant='secondary' className='text-xs'>
                    <Filter className='mr-1 h-3 w-3' />
                    {filterLabel}
                    <button
                      type='button'
                      onClick={handleClearFilter}
                      className='ml-1'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  </Badge>
                )}
              </div>
              {cardFiltersOpen && (
                <div className='bg-muted/30 rounded-md border p-3'>
                  <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
                    {NUMERIC_COLS.map(({ key, label }) => (
                      <Button
                        key={key}
                        variant={sortBy === key ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        {sortBy === key && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredItems.map((donor, i) => (
                  <div
                    key={donor.user_id}
                    className={`hover:bg-muted/50 space-y-2 rounded-md border p-3 ${selectedIds.has(donor.user_id)
                      ? 'border-primary bg-primary/5'
                      : ''
                      }`}
                  >
                    <div className='flex items-start gap-2'>
                      <Checkbox
                        checked={selectedIds.has(donor.user_id)}
                        onCheckedChange={() => toggleRow(donor.user_id)}
                        onClick={(e) => e.stopPropagation()}
                        className='mt-0.5 shrink-0'
                        aria-label={`Select ${donor.first_name} ${donor.last_name}`}
                      />
                      <div
                        role='button'
                        tabIndex={0}
                        className='min-w-0 flex-1 cursor-pointer'
                        onClick={() => onSelectDonor(donor.user_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelectDonor(donor.user_id)
                          }
                        }}
                      >
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
                        <dl className='mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                          <dt className='text-muted-foreground'>Total Given</dt>
                          <dd className='font-semibold'>
                            {fmt(donor.total_given)}
                          </dd>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[40px] px-3'>
                      <Checkbox
                        checked={
                          allPageSelected
                            ? true
                            : somePageSelected
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={togglePageAll}
                        aria-label='Select all on page'
                      />
                    </TableHead>
                    <TableHead className='w-[50px]'>#</TableHead>
                    <TableHead>Name</TableHead>
                    <ColHeader
                      {...colHeaderProps('total_given', 'Total Given', true)}
                    />
                    <ColHeader
                      {...colHeaderProps('events_attended', 'Events', true)}
                    />
                    <ColHeader
                      {...colHeaderProps('ticket_total', 'Tickets', true)}
                    />
                    <ColHeader
                      {...colHeaderProps('donation_total', 'Donations', true)}
                    />
                    <ColHeader
                      {...colHeaderProps(
                        'silent_auction_total',
                        'Silent',
                        true
                      )}
                    />
                    <ColHeader
                      {...colHeaderProps('live_auction_total', 'Live', true)}
                    />
                    <ColHeader
                      {...colHeaderProps('buy_now_total', 'Buy-Now', true)}
                    />
                    <TableHead className='w-[80px]' />
                  </TableRow>
                  <TableRow>
                    <TableHead />
                    <TableHead />
                    <TableHead>
                      <Input
                        placeholder='Filter name'
                        value={filters.name}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter total'
                        value={filters.total_given}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            total_given: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter events'
                        value={filters.events_attended}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            events_attended: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter tickets'
                        value={filters.ticket_total}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            ticket_total: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter donations'
                        value={filters.donation_total}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            donation_total: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter silent'
                        value={filters.silent_auction_total}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            silent_auction_total: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter live'
                        value={filters.live_auction_total}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            live_auction_total: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter buy-now'
                        value={filters.buy_now_total}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            buy_now_total: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className='text-muted-foreground py-8 text-center'
                      >
                        No donors match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((donor, i) => (
                      <TableRow
                        key={donor.user_id}
                        className={`hover:bg-muted/50 cursor-pointer ${selectedIds.has(donor.user_id) ? 'bg-primary/5' : ''
                          }`}
                        onClick={() => onSelectDonor(donor.user_id)}
                      >
                        <TableCell
                          className='px-3'
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.has(donor.user_id)}
                            onCheckedChange={() => toggleRow(donor.user_id)}
                            aria-label={`Select ${donor.first_name} ${donor.last_name}`}
                          />
                        </TableCell>
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
                        <TableCell className='text-right font-semibold'>
                          {fmt(donor.total_given)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {donor.events_attended}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmt(donor.ticket_total)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmt(donor.donation_total)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmt(donor.silent_auction_total)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmt(donor.live_auction_total)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmt(donor.buy_now_total)}
                        </TableCell>
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
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

      <SendNotificationDialog
        eventId={eventId}
        userIds={Array.from(selectedIds)}
        donorNames={selectedDonorNames}
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        onSent={clearSelection}
      />
    </>
  )
}
