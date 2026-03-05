import { useCallback, useMemo, type ReactNode, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { AuctionBidDashboardResponse } from '@/types/auctionBidImport'
import { ArrowUpDown, Filter, Loader2, X } from 'lucide-react'
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
  DropdownMenuSeparator,
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
import { DataTableViewToggle } from '@/components/data-table/view-toggle'

interface AuctionBidsDashboardProps {
  data: AuctionBidDashboardResponse | undefined
  isLoading: boolean
  onImportClick: () => void
  eventId: string
}

type SortDirection = 'asc' | 'desc'
type HighestSortKey = 'itemNumber' | 'itemName' | 'bidderName' | 'amount'
type RecentSortKey =
  | 'itemNumber'
  | 'itemName'
  | 'bidderName'
  | 'amount'
  | 'time'

type HighestFilters = {
  itemNumber: string
  itemName: string
  bidderName: string
  amount: string
}

type RecentFilters = {
  itemNumber: string
  itemName: string
  bidderName: string
  amount: string
  time: string
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCurrency = (amount: number) =>
  currencyFormatter.format(Number(amount || 0))

const formatDateTime = (value: string) => new Date(value).toLocaleString()

const normalizeText = (value: string | undefined | null) =>
  value?.toLowerCase() ?? ''

/** Shared toolbar for card-view filter panels */
function CardFilterToolbar({
  isOpen,
  onToggle,
  activeCount,
  onClear,
  filteredCount,
  totalCount,
  label,
  children,
}: {
  isOpen: boolean
  onToggle: () => void
  activeCount: number
  onClear: () => void
  filteredCount: number
  totalCount: number
  label: string
  children: ReactNode
}) {
  return (
    <>
      <div className='flex items-center gap-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={onToggle}
          className='gap-1.5'
        >
          <Filter className='h-4 w-4' />
          Filters
          {activeCount > 0 && (
            <Badge
              variant='secondary'
              className='ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-xs'
            >
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={onClear}
            className='text-muted-foreground gap-1'
          >
            <X className='h-3.5 w-3.5' />
            Clear all
          </Button>
        )}
        <span className='text-muted-foreground ml-auto text-sm'>
          {filteredCount} of {totalCount} {label}
        </span>
      </div>
      {isOpen && (
        <div className='bg-muted/30 rounded-md border p-3'>{children}</div>
      )}
    </>
  )
}

export function AuctionBidsDashboard({
  data,
  isLoading,
  onImportClick,
  eventId,
}: AuctionBidsDashboardProps) {
  const [highestSortKey, setHighestSortKey] = useState<HighestSortKey>('amount')
  const [highestSortDirection, setHighestSortDirection] =
    useState<SortDirection>('desc')
  const [highestFilters, setHighestFilters] = useState<HighestFilters>({
    itemNumber: '',
    itemName: '',
    bidderName: '',
    amount: '',
  })
  const [recentSortKey, setRecentSortKey] = useState<RecentSortKey>('time')
  const [recentSortDirection, setRecentSortDirection] =
    useState<SortDirection>('desc')
  const [recentFilters, setRecentFilters] = useState<RecentFilters>({
    itemNumber: '',
    itemName: '',
    bidderName: '',
    amount: '',
    time: '',
  })
  const [viewMode, setViewMode] = useViewPreference('auction-bids')
  const [highestCardFiltersOpen, setHighestCardFiltersOpen] = useState(false)
  const [recentCardFiltersOpen, setRecentCardFiltersOpen] = useState(false)

  const highestActiveFilterCount = useMemo(() => {
    let count = 0
    if (highestFilters.itemNumber) count++
    if (highestFilters.itemName) count++
    if (highestFilters.bidderName) count++
    if (highestFilters.amount) count++
    return count
  }, [highestFilters])

  const recentActiveFilterCount = useMemo(() => {
    let count = 0
    if (recentFilters.itemNumber) count++
    if (recentFilters.itemName) count++
    if (recentFilters.bidderName) count++
    if (recentFilters.amount) count++
    if (recentFilters.time) count++
    return count
  }, [recentFilters])

  const clearHighestFilters = useCallback(() => {
    setHighestFilters({
      itemNumber: '',
      itemName: '',
      bidderName: '',
      amount: '',
    })
  }, [])

  const clearRecentFilters = useCallback(() => {
    setRecentFilters({
      itemNumber: '',
      itemName: '',
      bidderName: '',
      amount: '',
      time: '',
    })
  }, [])

  const handleHighestSortChange = (key: HighestSortKey) => {
    if (highestSortKey === key) {
      setHighestSortDirection(highestSortDirection === 'asc' ? 'desc' : 'asc')
      return
    }
    setHighestSortKey(key)
    setHighestSortDirection('asc')
  }

  const handleRecentSortChange = (key: RecentSortKey) => {
    if (recentSortKey === key) {
      setRecentSortDirection(recentSortDirection === 'asc' ? 'desc' : 'asc')
      return
    }
    setRecentSortKey(key)
    setRecentSortDirection('asc')
  }

  const renderHeader = (
    label: string,
    sortKey: string,
    activeSortKey: string,
    sortDirection: SortDirection,
    onSortChange: (key: string) => void,
    filterValue: string,
    onFilterChange: (value: string) => void,
    placeholder: string,
    className?: string
  ) => (
    <TableHead className={className}>
      <div className='flex items-center gap-2'>
        <button
          className='flex items-center gap-2'
          onClick={() => onSortChange(sortKey)}
          type='button'
        >
          {label}
          <ArrowUpDown className='text-muted-foreground h-3 w-3' />
          {activeSortKey === sortKey && (
            <span className='text-muted-foreground text-xs'>
              {sortDirection === 'asc' ? '^' : 'v'}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className='text-muted-foreground hover:text-foreground rounded-sm p-1'
              type='button'
              aria-label={`Filter ${label}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onSortChange(sortKey)}>
              Toggle sort
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <div
              className='px-2 py-2'
              onClick={(event) => event.stopPropagation()}
            >
              <Input
                placeholder={placeholder}
                value={filterValue}
                onChange={(event) => onFilterChange(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>
            <DropdownMenuItem
              disabled={!filterValue}
              onSelect={() => onFilterChange('')}
            >
              Clear filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

  const highestBids = useMemo(
    () => data?.highest_bids ?? [],
    [data?.highest_bids]
  )
  const recentBids = useMemo(() => data?.recent_bids ?? [], [data?.recent_bids])

  const filteredHighestBids = useMemo(() => {
    return highestBids.filter((bid) => {
      const bidderName = bid.bidder_name || bid.bidder_email
      if (highestFilters.itemNumber) {
        if (
          !String(bid.auction_item_number).includes(highestFilters.itemNumber)
        ) {
          return false
        }
      }
      if (highestFilters.itemName) {
        if (
          !normalizeText(bid.auction_item_title).includes(
            normalizeText(highestFilters.itemName)
          )
        ) {
          return false
        }
      }
      if (highestFilters.bidderName) {
        if (
          !normalizeText(bidderName).includes(
            normalizeText(highestFilters.bidderName)
          )
        ) {
          return false
        }
      }
      if (highestFilters.amount) {
        if (!formatCurrency(bid.bid_amount).includes(highestFilters.amount)) {
          return false
        }
      }
      return true
    })
  }, [highestBids, highestFilters])

  const sortedHighestBids = useMemo(() => {
    const bids = [...filteredHighestBids]
    const direction = highestSortDirection === 'asc' ? 1 : -1
    bids.sort((a, b) => {
      switch (highestSortKey) {
        case 'itemNumber':
          return (a.auction_item_number - b.auction_item_number) * direction
        case 'itemName':
          return (
            a.auction_item_title.localeCompare(
              b.auction_item_title,
              undefined,
              {
                sensitivity: 'base',
              }
            ) * direction
          )
        case 'bidderName': {
          const bidderA = a.bidder_name || a.bidder_email
          const bidderB = b.bidder_name || b.bidder_email
          return (
            bidderA.localeCompare(bidderB, undefined, { sensitivity: 'base' }) *
            direction
          )
        }
        case 'amount':
        default:
          return (a.bid_amount - b.bid_amount) * direction
      }
    })
    return bids
  }, [filteredHighestBids, highestSortDirection, highestSortKey])

  const filteredRecentBids = useMemo(() => {
    return recentBids.filter((bid) => {
      const bidderName = bid.bidder_name || bid.bidder_email
      if (recentFilters.itemNumber) {
        if (
          !String(bid.auction_item_number).includes(recentFilters.itemNumber)
        ) {
          return false
        }
      }
      if (recentFilters.itemName) {
        if (
          !normalizeText(bid.auction_item_title).includes(
            normalizeText(recentFilters.itemName)
          )
        ) {
          return false
        }
      }
      if (recentFilters.bidderName) {
        if (
          !normalizeText(bidderName).includes(
            normalizeText(recentFilters.bidderName)
          )
        ) {
          return false
        }
      }
      if (recentFilters.amount) {
        if (!formatCurrency(bid.bid_amount).includes(recentFilters.amount)) {
          return false
        }
      }
      if (recentFilters.time) {
        if (!formatDateTime(bid.bid_time).includes(recentFilters.time)) {
          return false
        }
      }
      return true
    })
  }, [recentBids, recentFilters])

  const sortedRecentBids = useMemo(() => {
    const bids = [...filteredRecentBids]
    const direction = recentSortDirection === 'asc' ? 1 : -1
    bids.sort((a, b) => {
      switch (recentSortKey) {
        case 'itemNumber':
          return (a.auction_item_number - b.auction_item_number) * direction
        case 'itemName':
          return (
            a.auction_item_title.localeCompare(
              b.auction_item_title,
              undefined,
              {
                sensitivity: 'base',
              }
            ) * direction
          )
        case 'bidderName': {
          const bidderA = a.bidder_name || a.bidder_email
          const bidderB = b.bidder_name || b.bidder_email
          return (
            bidderA.localeCompare(bidderB, undefined, { sensitivity: 'base' }) *
            direction
          )
        }
        case 'amount':
          return (a.bid_amount - b.bid_amount) * direction
        case 'time':
        default:
          return (
            (new Date(a.bid_time).valueOf() - new Date(b.bid_time).valueOf()) *
            direction
          )
      }
    })
    return bids
  }, [filteredRecentBids, recentSortDirection, recentSortKey])

  if (isLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-2xl font-semibold'>Auction Bids</h2>
          <p className='text-muted-foreground text-sm'>
            Review bid totals, highest bids, and recent activity for this event.
          </p>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <Button onClick={onImportClick} variant='outline'>
            Import Bids
          </Button>
          <DataTableViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Total Bids</CardTitle>
            <CardDescription>All bids recorded for this event</CardDescription>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>
            {data?.total_bid_count ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Bid Value</CardTitle>
            <CardDescription>Sum of all bid amounts</CardDescription>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>
            {formatCurrency(data?.total_bid_value ?? 0)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Highest Bids</CardTitle>
          <CardDescription>
            Current highest bid for each auction item
          </CardDescription>
        </CardHeader>
        <CardContent>
          {highestBids.length ? (
            viewMode === 'card' ? (
              <div className='space-y-3'>
                <CardFilterToolbar
                  isOpen={highestCardFiltersOpen}
                  onToggle={() => setHighestCardFiltersOpen((prev) => !prev)}
                  activeCount={highestActiveFilterCount}
                  onClear={clearHighestFilters}
                  filteredCount={sortedHighestBids.length}
                  totalCount={highestBids.length}
                  label='bids'
                >
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='highest-item-number-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Item #
                      </Label>
                      <Input
                        id='highest-item-number-filter'
                        placeholder='Filter item #…'
                        value={highestFilters.itemNumber}
                        onChange={(e) =>
                          setHighestFilters((prev) => ({
                            ...prev,
                            itemNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='highest-item-name-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Item Name
                      </Label>
                      <Input
                        id='highest-item-name-filter'
                        placeholder='Filter item name…'
                        value={highestFilters.itemName}
                        onChange={(e) =>
                          setHighestFilters((prev) => ({
                            ...prev,
                            itemName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='highest-bidder-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Bidder
                      </Label>
                      <Input
                        id='highest-bidder-filter'
                        placeholder='Filter bidder…'
                        value={highestFilters.bidderName}
                        onChange={(e) =>
                          setHighestFilters((prev) => ({
                            ...prev,
                            bidderName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='highest-amount-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Amount
                      </Label>
                      <Input
                        id='highest-amount-filter'
                        placeholder='Filter amount…'
                        value={highestFilters.amount}
                        onChange={(e) =>
                          setHighestFilters((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardFilterToolbar>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {sortedHighestBids.length ? (
                    sortedHighestBids.map((bid) => (
                      <div
                        key={`${bid.auction_item_id}-${bid.bidder_email}`}
                        className='space-y-1 rounded-md border p-3'
                      >
                        <div className='flex items-center justify-between'>
                          <Link
                            to='/events/$eventId/auction-items/$itemId'
                            params={{ eventId, itemId: bid.auction_item_id }}
                            className='text-primary font-medium underline-offset-4 hover:underline'
                          >
                            Item #{bid.auction_item_number}
                          </Link>
                          <span className='font-semibold'>
                            {formatCurrency(bid.bid_amount)}
                          </span>
                        </div>
                        <p className='text-sm'>{bid.auction_item_title}</p>
                        <p className='text-muted-foreground text-sm'>
                          {bid.bidder_name || bid.bidder_email}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className='text-muted-foreground col-span-full text-sm'>
                      No bids match the current filters.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderHeader(
                      'Item #',
                      'itemNumber',
                      highestSortKey,
                      highestSortDirection,
                      (key) => handleHighestSortChange(key as HighestSortKey),
                      highestFilters.itemNumber,
                      (value) =>
                        setHighestFilters((prev) => ({
                          ...prev,
                          itemNumber: value,
                        })),
                      'Search item #'
                    )}
                    {renderHeader(
                      'Item Name',
                      'itemName',
                      highestSortKey,
                      highestSortDirection,
                      (key) => handleHighestSortChange(key as HighestSortKey),
                      highestFilters.itemName,
                      (value) =>
                        setHighestFilters((prev) => ({
                          ...prev,
                          itemName: value,
                        })),
                      'Search item name'
                    )}
                    {renderHeader(
                      'Bidder',
                      'bidderName',
                      highestSortKey,
                      highestSortDirection,
                      (key) => handleHighestSortChange(key as HighestSortKey),
                      highestFilters.bidderName,
                      (value) =>
                        setHighestFilters((prev) => ({
                          ...prev,
                          bidderName: value,
                        })),
                      'Search bidder'
                    )}
                    {renderHeader(
                      'Bid Amount',
                      'amount',
                      highestSortKey,
                      highestSortDirection,
                      (key) => handleHighestSortChange(key as HighestSortKey),
                      highestFilters.amount,
                      (value) =>
                        setHighestFilters((prev) => ({
                          ...prev,
                          amount: value,
                        })),
                      'Search amount',
                      'text-right'
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHighestBids.length ? (
                    sortedHighestBids.map((bid) => (
                      <TableRow
                        key={`${bid.auction_item_id}-${bid.bidder_email}`}
                      >
                        <TableCell className='font-medium'>
                          <Link
                            to='/events/$eventId/auction-items/$itemId'
                            params={{ eventId, itemId: bid.auction_item_id }}
                            className='text-primary underline-offset-4 hover:underline'
                          >
                            {bid.auction_item_number}
                          </Link>
                        </TableCell>
                        <TableCell>{bid.auction_item_title}</TableCell>
                        <TableCell>
                          {bid.bidder_name || bid.bidder_email}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(bid.bid_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className='text-muted-foreground text-sm'
                      >
                        No bids match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )
          ) : (
            <p className='text-muted-foreground text-sm'>No bids yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bids</CardTitle>
          <CardDescription>Most recent bid activity</CardDescription>
        </CardHeader>
        <CardContent>
          {recentBids.length ? (
            viewMode === 'card' ? (
              <div className='space-y-3'>
                <CardFilterToolbar
                  isOpen={recentCardFiltersOpen}
                  onToggle={() => setRecentCardFiltersOpen((prev) => !prev)}
                  activeCount={recentActiveFilterCount}
                  onClear={clearRecentFilters}
                  filteredCount={sortedRecentBids.length}
                  totalCount={recentBids.length}
                  label='bids'
                >
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5'>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='recent-item-number-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Item #
                      </Label>
                      <Input
                        id='recent-item-number-filter'
                        placeholder='Filter item #…'
                        value={recentFilters.itemNumber}
                        onChange={(e) =>
                          setRecentFilters((prev) => ({
                            ...prev,
                            itemNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='recent-item-name-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Item Name
                      </Label>
                      <Input
                        id='recent-item-name-filter'
                        placeholder='Filter item name…'
                        value={recentFilters.itemName}
                        onChange={(e) =>
                          setRecentFilters((prev) => ({
                            ...prev,
                            itemName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='recent-bidder-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Bidder
                      </Label>
                      <Input
                        id='recent-bidder-filter'
                        placeholder='Filter bidder…'
                        value={recentFilters.bidderName}
                        onChange={(e) =>
                          setRecentFilters((prev) => ({
                            ...prev,
                            bidderName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='recent-time-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Bid Time
                      </Label>
                      <Input
                        id='recent-time-filter'
                        placeholder='Filter time…'
                        value={recentFilters.time}
                        onChange={(e) =>
                          setRecentFilters((prev) => ({
                            ...prev,
                            time: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='recent-amount-filter'
                        className='text-muted-foreground text-xs'
                      >
                        Amount
                      </Label>
                      <Input
                        id='recent-amount-filter'
                        placeholder='Filter amount…'
                        value={recentFilters.amount}
                        onChange={(e) =>
                          setRecentFilters((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardFilterToolbar>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {sortedRecentBids.length ? (
                    sortedRecentBids.map((bid) => (
                      <div
                        key={`${bid.auction_item_id}-${bid.bidder_email}-${bid.bid_time}`}
                        className='space-y-1 rounded-md border p-3'
                      >
                        <div className='flex items-center justify-between'>
                          <Link
                            to='/events/$eventId/auction-items/$itemId'
                            params={{ eventId, itemId: bid.auction_item_id }}
                            className='text-primary font-medium underline-offset-4 hover:underline'
                          >
                            Item #{bid.auction_item_number}
                          </Link>
                          <span className='font-semibold'>
                            {formatCurrency(bid.bid_amount)}
                          </span>
                        </div>
                        <p className='text-sm'>{bid.auction_item_title}</p>
                        <p className='text-muted-foreground text-sm'>
                          {bid.bidder_name || bid.bidder_email}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {formatDateTime(bid.bid_time)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className='text-muted-foreground col-span-full text-sm'>
                      No bids match the current filters.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {renderHeader(
                      'Item #',
                      'itemNumber',
                      recentSortKey,
                      recentSortDirection,
                      (key) => handleRecentSortChange(key as RecentSortKey),
                      recentFilters.itemNumber,
                      (value) =>
                        setRecentFilters((prev) => ({
                          ...prev,
                          itemNumber: value,
                        })),
                      'Search item #'
                    )}
                    {renderHeader(
                      'Item Name',
                      'itemName',
                      recentSortKey,
                      recentSortDirection,
                      (key) => handleRecentSortChange(key as RecentSortKey),
                      recentFilters.itemName,
                      (value) =>
                        setRecentFilters((prev) => ({
                          ...prev,
                          itemName: value,
                        })),
                      'Search item name'
                    )}
                    {renderHeader(
                      'Bidder',
                      'bidderName',
                      recentSortKey,
                      recentSortDirection,
                      (key) => handleRecentSortChange(key as RecentSortKey),
                      recentFilters.bidderName,
                      (value) =>
                        setRecentFilters((prev) => ({
                          ...prev,
                          bidderName: value,
                        })),
                      'Search bidder'
                    )}
                    {renderHeader(
                      'Bid Time',
                      'time',
                      recentSortKey,
                      recentSortDirection,
                      (key) => handleRecentSortChange(key as RecentSortKey),
                      recentFilters.time,
                      (value) =>
                        setRecentFilters((prev) => ({
                          ...prev,
                          time: value,
                        })),
                      'Search time'
                    )}
                    {renderHeader(
                      'Bid Amount',
                      'amount',
                      recentSortKey,
                      recentSortDirection,
                      (key) => handleRecentSortChange(key as RecentSortKey),
                      recentFilters.amount,
                      (value) =>
                        setRecentFilters((prev) => ({
                          ...prev,
                          amount: value,
                        })),
                      'Search amount',
                      'text-right'
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecentBids.length ? (
                    sortedRecentBids.map((bid) => (
                      <TableRow
                        key={`${bid.auction_item_id}-${bid.bidder_email}-${bid.bid_time}`}
                      >
                        <TableCell className='font-medium'>
                          <Link
                            to='/events/$eventId/auction-items/$itemId'
                            params={{ eventId, itemId: bid.auction_item_id }}
                            className='text-primary underline-offset-4 hover:underline'
                          >
                            {bid.auction_item_number}
                          </Link>
                        </TableCell>
                        <TableCell>{bid.auction_item_title}</TableCell>
                        <TableCell>
                          {bid.bidder_name || bid.bidder_email}
                        </TableCell>
                        <TableCell>{formatDateTime(bid.bid_time)}</TableCell>
                        <TableCell className='text-right'>
                          {formatCurrency(bid.bid_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='text-muted-foreground text-sm'
                      >
                        No bids match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )
          ) : (
            <p className='text-muted-foreground text-sm'>
              No bids recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
