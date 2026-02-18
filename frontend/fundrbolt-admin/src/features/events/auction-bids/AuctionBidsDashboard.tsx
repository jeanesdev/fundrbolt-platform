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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuctionBidDashboardResponse } from '@/types/auctionBidImport'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, Filter, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

interface AuctionBidsDashboardProps {
  data: AuctionBidDashboardResponse | undefined
  isLoading: boolean
  onImportClick: () => void
  eventId: string
}

type SortDirection = 'asc' | 'desc'
type HighestSortKey = 'itemCode' | 'itemName' | 'bidderName' | 'amount'
type RecentSortKey = 'itemCode' | 'itemName' | 'bidderName' | 'amount' | 'time'

type HighestFilters = {
  itemCode: string
  itemName: string
  bidderName: string
  amount: string
}

type RecentFilters = {
  itemCode: string
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

const normalizeText = (value: string | undefined | null) => value?.toLowerCase() ?? ''

export function AuctionBidsDashboard({
  data,
  isLoading,
  onImportClick,
  eventId,
}: AuctionBidsDashboardProps) {
  const [highestSortKey, setHighestSortKey] = useState<HighestSortKey>('amount')
  const [highestSortDirection, setHighestSortDirection] = useState<SortDirection>('desc')
  const [highestFilters, setHighestFilters] = useState<HighestFilters>({
    itemCode: '',
    itemName: '',
    bidderName: '',
    amount: '',
  })
  const [recentSortKey, setRecentSortKey] = useState<RecentSortKey>('time')
  const [recentSortDirection, setRecentSortDirection] = useState<SortDirection>('desc')
  const [recentFilters, setRecentFilters] = useState<RecentFilters>({
    itemCode: '',
    itemName: '',
    bidderName: '',
    amount: '',
    time: '',
  })

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
          <ArrowUpDown className='h-3 w-3 text-muted-foreground' />
          {activeSortKey === sortKey && (
            <span className='text-xs text-muted-foreground'>
              {sortDirection === 'asc' ? '^' : 'v'}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className='rounded-sm p-1 text-muted-foreground hover:text-foreground'
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

  const highestBids = useMemo(() => data?.highest_bids ?? [], [data?.highest_bids])
  const recentBids = useMemo(() => data?.recent_bids ?? [], [data?.recent_bids])

  const filteredHighestBids = useMemo(() => {
    return highestBids.filter((bid) => {
      const bidderName = bid.bidder_name || bid.bidder_email
      if (highestFilters.itemCode) {
        if (!normalizeText(bid.auction_item_code).includes(normalizeText(highestFilters.itemCode))) {
          return false
        }
      }
      if (highestFilters.itemName) {
        if (!normalizeText(bid.auction_item_title).includes(normalizeText(highestFilters.itemName))) {
          return false
        }
      }
      if (highestFilters.bidderName) {
        if (!normalizeText(bidderName).includes(normalizeText(highestFilters.bidderName))) {
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
        case 'itemCode':
          return (
            a.auction_item_code.localeCompare(b.auction_item_code, undefined, {
              numeric: true,
              sensitivity: 'base',
            }) * direction
          )
        case 'itemName':
          return (
            a.auction_item_title.localeCompare(b.auction_item_title, undefined, {
              sensitivity: 'base',
            }) * direction
          )
        case 'bidderName': {
          const bidderA = a.bidder_name || a.bidder_email
          const bidderB = b.bidder_name || b.bidder_email
          return bidderA.localeCompare(bidderB, undefined, { sensitivity: 'base' }) * direction
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
      if (recentFilters.itemCode) {
        if (!normalizeText(bid.auction_item_code).includes(normalizeText(recentFilters.itemCode))) {
          return false
        }
      }
      if (recentFilters.itemName) {
        if (!normalizeText(bid.auction_item_title).includes(normalizeText(recentFilters.itemName))) {
          return false
        }
      }
      if (recentFilters.bidderName) {
        if (!normalizeText(bidderName).includes(normalizeText(recentFilters.bidderName))) {
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
        case 'itemCode':
          return (
            a.auction_item_code.localeCompare(b.auction_item_code, undefined, {
              numeric: true,
              sensitivity: 'base',
            }) * direction
          )
        case 'itemName':
          return (
            a.auction_item_title.localeCompare(b.auction_item_title, undefined, {
              sensitivity: 'base',
            }) * direction
          )
        case 'bidderName': {
          const bidderA = a.bidder_name || a.bidder_email
          const bidderB = b.bidder_name || b.bidder_email
          return bidderA.localeCompare(bidderB, undefined, { sensitivity: 'base' }) * direction
        }
        case 'amount':
          return (a.bid_amount - b.bid_amount) * direction
        case 'time':
        default:
          return (new Date(a.bid_time).valueOf() - new Date(b.bid_time).valueOf()) * direction
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
        <Button onClick={onImportClick} variant='outline'>
          Import Bids
        </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  {renderHeader(
                    'Item Code',
                    'itemCode',
                    highestSortKey,
                    highestSortDirection,
                    (key) => handleHighestSortChange(key as HighestSortKey),
                    highestFilters.itemCode,
                    (value) =>
                      setHighestFilters((prev) => ({
                        ...prev,
                        itemCode: value,
                      })),
                    'Search item code'
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
                    <TableRow key={`${bid.auction_item_id}-${bid.bidder_email}`}>
                      <TableCell className='font-medium'>
                        <Link
                          to='/events/$eventId/auction-items/$itemId'
                          params={{ eventId, itemId: bid.auction_item_id }}
                          className='text-primary underline-offset-4 hover:underline'
                        >
                          {bid.auction_item_code}
                        </Link>
                      </TableCell>
                      <TableCell>{bid.auction_item_title}</TableCell>
                      <TableCell>{bid.bidder_name || bid.bidder_email}</TableCell>
                      <TableCell className='text-right'>
                        {formatCurrency(bid.bid_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className='text-muted-foreground text-sm'>
                      No bids match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  {renderHeader(
                    'Item Code',
                    'itemCode',
                    recentSortKey,
                    recentSortDirection,
                    (key) => handleRecentSortChange(key as RecentSortKey),
                    recentFilters.itemCode,
                    (value) =>
                      setRecentFilters((prev) => ({
                        ...prev,
                        itemCode: value,
                      })),
                    'Search item code'
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
                          {bid.auction_item_code}
                        </Link>
                      </TableCell>
                      <TableCell>{bid.auction_item_title}</TableCell>
                      <TableCell>{bid.bidder_name || bid.bidder_email}</TableCell>
                      <TableCell>{formatDateTime(bid.bid_time)}</TableCell>
                      <TableCell className='text-right'>
                        {formatCurrency(bid.bid_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='text-muted-foreground text-sm'>
                      No bids match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
