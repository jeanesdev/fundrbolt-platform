import type { AuctionItemDetailResponse } from '@/services/auction-dashboard'
import { colors } from '@fundrbolt/shared/assets'
import { ArrowLeft } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface ItemDetailViewProps {
  data: AuctionItemDetailResponse
  onBack: () => void
}

export function ItemDetailView({ data, onBack }: ItemDetailViewProps) {
  const { item, bid_history, bid_timeline } = data

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='sm' onClick={onBack}>
          <ArrowLeft className='mr-1 h-4 w-4' />
          Back
        </Button>
        <div>
          <h2 className='text-2xl font-bold'>{item.title}</h2>
          <p className='text-muted-foreground text-sm'>{item.event_name}</p>
        </div>
      </div>

      {/* Item stats */}
      <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
        <StatCard
          label='Current Bid'
          value={
            item.current_bid_amount != null ? fmt(item.current_bid_amount) : '—'
          }
        />
        <StatCard label='Starting Bid' value={fmt(item.starting_bid)} />
        <StatCard label='Bid Count' value={item.bid_count.toLocaleString()} />
        <StatCard
          label='Watchers'
          value={item.watcher_count.toLocaleString()}
        />
      </div>

      {/* Item details */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>Item Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            <DetailField label='Type' value={titleCase(item.auction_type)} />
            <DetailField label='Category' value={item.category ?? '—'} />
            <DetailField label='Status'>
              <Badge
                variant={item.status === 'published' ? 'default' : 'secondary'}
              >
                {item.status}
              </Badge>
            </DetailField>
            <DetailField
              label='Bid Increment'
              value={fmt(item.bid_increment)}
            />
            <DetailField
              label='Buy Now'
              value={
                item.buy_now_enabled && item.buy_now_price
                  ? fmt(item.buy_now_price)
                  : 'Disabled'
              }
            />
            <DetailField
              label='Fair Market Value'
              value={item.donor_value != null ? fmt(item.donor_value) : '—'}
            />
            <DetailField label='Donated By' value={item.donated_by ?? '—'} />
            <DetailField
              label='Bidding Open'
              value={item.bidding_open ? 'Yes' : 'No'}
            />
          </dl>
          {item.description && (
            <div className='mt-4'>
              <dt className='text-muted-foreground text-xs font-medium'>
                Description
              </dt>
              <dd className='mt-1 text-sm'>{item.description}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bid Timeline Chart */}
      {bid_timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>
              Bid Value Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <LineChart data={bid_timeline}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='timestamp'
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v: number) => fmt(v)} />
                <Tooltip
                  labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                  formatter={(v) => [fmt(Number(v)), 'Bid']}
                />
                <Line
                  type='stepAfter'
                  dataKey='bid_amount'
                  stroke={colors.status.info}
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bid History Table */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Bid History ({bid_history.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bid_history.length === 0 ? (
            <p className='text-muted-foreground text-sm'>No bids yet.</p>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bidder</TableHead>
                    <TableHead className='text-right'>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bid_history.map((bid) => (
                    <TableRow key={bid.id}>
                      <TableCell className='font-medium'>
                        {bid.bidder_name}
                      </TableCell>
                      <TableCell className='text-right'>
                        {fmt(bid.bid_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='text-xs'>
                          {titleCase(bid.bid_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <BidStatusBadge status={bid.bid_status} />
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {new Date(bid.placed_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className='pt-4'>
        <p className='text-muted-foreground text-xs font-medium'>{label}</p>
        <p className='text-2xl font-bold'>{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <dt className='text-muted-foreground text-xs font-medium'>{label}</dt>
      <dd className='mt-0.5 text-sm'>{children ?? value}</dd>
    </div>
  )
}

function BidStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'winning'
      ? 'default'
      : status === 'active'
        ? 'secondary'
        : status === 'outbid'
          ? 'outline'
          : 'destructive'
  return (
    <Badge variant={variant} className='text-xs'>
      {titleCase(status)}
    </Badge>
  )
}
