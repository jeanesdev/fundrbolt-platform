import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { colors as brandColors } from '@fundrbolt/shared/assets'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCategoryBreakdown } from '../hooks/useDonorDashboard'

const COLORS = [
  brandColors.accent.aqua,
  brandColors.accent.violet,
  brandColors.accent.magenta,
  brandColors.primary.gold,
  brandColors.accent.plum,
]

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface GivingCategoryChartsProps {
  eventId?: string
  npoId?: string
}

export function GivingCategoryCharts({
  eventId,
  npoId,
}: GivingCategoryChartsProps) {
  const { data, isLoading, isError, refetch } = useCategoryBreakdown({
    event_id: eventId,
    npo_id: npoId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          Loading category data...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-muted-foreground text-sm'>
            Unable to load category data. Please try again.
          </p>
          <Button size='sm' onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className='text-muted-foreground p-6 text-sm'>
          No category data available for the current scope.
        </CardContent>
      </Card>
    )
  }

  const pieData = data.giving_type_breakdown.map((g) => ({
    name: g.category.replace(/_/g, ' '),
    value: g.total_amount,
    count: g.donor_count,
  }))

  const barData = data.auction_category_breakdown.map((c) => ({
    name: c.category || 'Uncategorized',
    amount: c.total_bid_amount,
    items: c.item_count,
  }))

  return (
    <div className='grid gap-6 md:grid-cols-2'>
      {/* Giving Type Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Giving by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <p className='text-muted-foreground text-sm'>No giving data.</p>
          ) : (
            <ResponsiveContainer width='100%' height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='50%'
                  innerRadius={60}
                  outerRadius={100}
                  dataKey='value'
                  label={({
                    name,
                    percent,
                  }: {
                    name?: string
                    percent?: number
                  }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_entry, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    color: 'var(--color-popover-foreground)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                  }}
                  formatter={(value?: number | string) =>
                    fmt(Number(value ?? 0))
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Auction Category Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Auction Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              No auction category data.
            </p>
          ) : (
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={barData} margin={{ bottom: 40 }}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis
                  dataKey='name'
                  fontSize={12}
                  interval={0}
                  angle={-35}
                  textAnchor='end'
                />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    color: 'var(--color-popover-foreground)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                  }}
                  formatter={(value?: number | string, name?: string) => [
                    name === 'amount' ? fmt(Number(value ?? 0)) : (value ?? 0),
                    name === 'amount' ? 'Amount' : 'Items',
                  ]}
                />
                <Bar
                  dataKey='amount'
                  fill='currentColor'
                  className='fill-primary'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
