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
import { useNavigate, useParams } from '@tanstack/react-router'
import { ChevronRight, Download, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useAuctionItems } from '../hooks/useAuctionDashboard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

type SortColumn =
  | 'title'
  | 'auction_type'
  | 'category'
  | 'current_bid_amount'
  | 'bid_count'
  | 'watcher_count'
  | 'status'

interface AuctionItemsTableProps {
  eventId?: string
  auctionType?: string
  category?: string
}

export function AuctionItemsTable({
  eventId,
  auctionType,
  category,
}: AuctionItemsTableProps) {
  const navigate = useNavigate()
  const { eventId: routeEventId } = useParams({ strict: false }) as {
    eventId?: string
  }
  const [viewMode, setViewMode] = useViewPreference('auction-items-table')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortColumn>('current_bid_amount')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const perPage = 25

  const query = useAuctionItems({
    event_id: eventId,
    auction_type: auctionType,
    category,
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
        '/admin/auction-dashboard/items/export',
        {
          params: {
            event_id: eventId,
            auction_type: auctionType,
            category,
            sort_by: sortBy,
            sort_order: sortOrder,
            search: debouncedSearch || undefined,
          },
          responseType: 'blob',
        },
      )
      const url = window.URL.createObjectURL(
        new Blob([response.data as BlobPart]),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'auction-items.csv'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      // Silently fail — user can retry
    }
  }

  const handleItemClick = (itemId: string) => {
    if (routeEventId) {
      void navigate({
        to: '/events/$eventId/auction-dashboard/items/$itemId',
        params: { eventId: routeEventId, itemId },
      })
    }
  }

  const sortIndicator = (col: SortColumn) =>
    sortBy === col ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading auction items...
        </CardContent>
      </Card>
    )
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-destructive text-sm'>
            Unable to load auction items.
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
          No auction items found for the selected filters.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='space-y-3'>
        <div className='flex items-center justify-between'>
          <CardTitle>Auction Items</CardTitle>
          <div className='flex items-center gap-2'>
            <DataTableViewToggle value={viewMode} onChange={setViewMode} />
            <Button
              variant='outline'
              size='sm'
              onClick={() => void query.refetch()}
              title='Refresh'
            >
              <RefreshCw className='h-4 w-4' />
            </Button>
            <Button variant='outline' size='sm' onClick={() => void handleExport()}>
              <Download className='mr-1 h-4 w-4' />
              CSV
            </Button>
          </div>
        </div>
        <div className='relative'>
          <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
          <Input
            placeholder='Search items...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
            className='pl-8'
          />
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'table' ? (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className='cursor-pointer'
                    onClick={() => handleSort('title')}
                  >
                    Title{sortIndicator('title')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer'
                    onClick={() => handleSort('auction_type')}
                  >
                    Type{sortIndicator('auction_type')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer'
                    onClick={() => handleSort('category')}
                  >
                    Category{sortIndicator('category')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer text-right'
                    onClick={() => handleSort('current_bid_amount')}
                  >
                    Current Bid{sortIndicator('current_bid_amount')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer text-right'
                    onClick={() => handleSort('bid_count')}
                  >
                    Bids{sortIndicator('bid_count')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer text-right'
                    onClick={() => handleSort('watcher_count')}
                  >
                    Watchers{sortIndicator('watcher_count')}
                  </TableHead>
                  <TableHead
                    className='cursor-pointer'
                    onClick={() => handleSort('status')}
                  >
                    Status{sortIndicator('status')}
                  </TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className='cursor-pointer'
                    onClick={() => handleItemClick(item.id)}
                  >
                    <TableCell className='font-medium'>{item.title}</TableCell>
                    <TableCell>
                      <TypeBadge
                        type={item.auction_type}
                        buyNow={item.buy_now_enabled}
                      />
                    </TableCell>
                    <TableCell>{item.category ?? '—'}</TableCell>
                    <TableCell className='text-right'>
                      {item.current_bid_amount != null
                        ? fmt(item.current_bid_amount)
                        : '—'}
                    </TableCell>
                    <TableCell className='text-right'>
                      {item.bid_count}
                    </TableCell>
                    <TableCell className='text-right'>
                      {item.watcher_count}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {item.event_name}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className='text-muted-foreground h-4 w-4' />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {data.items.map((item) => (
              <Card
                key={item.id}
                className='cursor-pointer transition-shadow hover:shadow-md'
                onClick={() => handleItemClick(item.id)}
              >
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-sm font-medium leading-tight'>
                      {item.title}
                    </CardTitle>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className='flex items-center gap-2'>
                    <TypeBadge
                      type={item.auction_type}
                      buyNow={item.buy_now_enabled}
                    />
                    {item.category && (
                      <Badge variant='outline' className='text-xs'>
                        {item.category}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className='space-y-1 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Current Bid</span>
                    <span className='font-medium'>
                      {item.current_bid_amount != null
                        ? fmt(item.current_bid_amount)
                        : '—'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Bids</span>
                    <span>{item.bid_count}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Watchers</span>
                    <span>{item.watcher_count}</span>
                  </div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    {item.event_name}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data.total_pages > 1 && (
          <div className='mt-4 flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              Page {data.page} of {data.total_pages} ({data.total} items)
            </span>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= data.total_pages}
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

function TypeBadge({
  type,
  buyNow,
}: {
  type: string
  buyNow: boolean
}) {
  const label = buyNow ? 'Buy Now' : type === 'live' ? 'Live' : 'Silent'
  const variant = buyNow
    ? 'default'
    : type === 'live'
      ? 'destructive'
      : 'secondary'
  return (
    <Badge variant={variant} className='text-xs'>
      {label}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'published'
      ? 'default'
      : status === 'sold'
        ? 'secondary'
        : status === 'withdrawn'
          ? 'destructive'
          : 'outline'
  return (
    <Badge variant={variant} className='text-xs'>
      {status}
    </Badge>
  )
}
