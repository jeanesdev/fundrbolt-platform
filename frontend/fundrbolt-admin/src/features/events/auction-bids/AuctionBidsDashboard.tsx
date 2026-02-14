import type { AuctionBidDashboardResponse } from '@/types/auctionBidImport'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AuctionBidsDashboardProps {
  data: AuctionBidDashboardResponse | undefined
  isLoading: boolean
  onImportClick: () => void
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

export function AuctionBidsDashboard({
  data,
  isLoading,
  onImportClick,
}: AuctionBidsDashboardProps) {
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
          {data?.highest_bids?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Bidder</TableHead>
                  <TableHead className='text-right'>Bid Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.highest_bids.map((bid) => (
                  <TableRow
                    key={`${bid.auction_item_code}-${bid.bidder_email}`}
                  >
                    <TableCell className='font-medium'>
                      {bid.auction_item_code}
                    </TableCell>
                    <TableCell>{bid.bidder_email}</TableCell>
                    <TableCell className='text-right'>
                      {formatCurrency(bid.bid_amount)}
                    </TableCell>
                  </TableRow>
                ))}
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
          {data?.recent_bids?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Bidder</TableHead>
                  <TableHead>Bid Time</TableHead>
                  <TableHead className='text-right'>Bid Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_bids.map((bid) => (
                  <TableRow
                    key={`${bid.auction_item_code}-${bid.bidder_email}-${bid.bid_time}`}
                  >
                    <TableCell className='font-medium'>
                      {bid.auction_item_code}
                    </TableCell>
                    <TableCell>{bid.bidder_email}</TableCell>
                    <TableCell>{formatDateTime(bid.bid_time)}</TableCell>
                    <TableCell className='text-right'>
                      {formatCurrency(bid.bid_amount)}
                    </TableCell>
                  </TableRow>
                ))}
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
