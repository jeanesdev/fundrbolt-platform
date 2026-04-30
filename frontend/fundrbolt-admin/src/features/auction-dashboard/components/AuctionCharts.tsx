import type { AuctionDashboardCharts } from '@/services/auction-dashboard'
import { colors } from '@fundrbolt/shared/assets'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const COLORS = [
  colors.status.info,
  colors.accent.violet,
  colors.status.success,
  colors.status.warning,
  colors.status.error,
  colors.accent.magenta,
  colors.accent.aqua,
  colors.palette.cobalt,
  colors.palette.sunset,
  colors.palette.indigo,
]

const fmt = (n: number) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })

/** Convert snake_case / lowercase labels to Title Case ("buy_now" → "Buy Now") */
const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Apply titleCase to the label field of chart data */
const withTitleLabels = (data: { label: string; value: number }[]) =>
  data.map((d) => ({ ...d, label: titleCase(d.label) }))

/** Truncate long Y-axis labels so they don't overflow the chart area.
 *  Uses non-breaking spaces to prevent SVG word-wrapping. */
const truncateLabel = (label: string, max = 14) => {
  const s = label.length > max ? label.slice(0, max - 1) + '…' : label
  return s.replace(/ /g, '\u00A0')
}

/** Shared props for horizontal bar chart Y-axes */
const yAxisProps = {
  type: 'category' as const,
  dataKey: 'label',
  width: 110,
  tick: { fontSize: 10 },
  tickFormatter: (label: string) => truncateLabel(label),
}

interface AuctionChartsProps {
  data: AuctionDashboardCharts | undefined
  isLoading: boolean
}

export function AuctionCharts({ data, isLoading }: AuctionChartsProps) {
  if (isLoading) {
    return (
      <div className='grid gap-4 md:grid-cols-2'>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className='flex h-64 items-center justify-center'>
              <div className='bg-muted h-48 w-full animate-pulse rounded' />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {/* Revenue by Type (Pie) */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Revenue by Auction Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenue_by_type.length > 0 ? (
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={withTitleLabels(data.revenue_by_type)}
                  dataKey='value'
                  nameKey='label'
                  cx='50%'
                  cy='45%'
                  outerRadius={70}
                >
                  {data.revenue_by_type.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      {/* Revenue by Category (Pie) */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Revenue by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenue_by_category.length > 0 ? (
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={withTitleLabels(data.revenue_by_category)}
                  dataKey='value'
                  nameKey='label'
                  cx='50%'
                  cy='45%'
                  outerRadius={70}
                >
                  {data.revenue_by_category.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      {/* Top Items by Revenue (Bar) */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Top Items by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_items_by_revenue.length > 0 ? (
            <ResponsiveContainer width='100%' height={300}>
              <BarChart
                data={data.top_items_by_revenue}
                layout='vertical'
                margin={{ left: 10, right: 10 }}
              >
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis type='number' tickFormatter={(v) => fmt(Number(v))} />
                <YAxis {...yAxisProps} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar
                  dataKey='value'
                  fill={colors.status.info}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      {/* Bid Count by Type (Bar) */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>Bids by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {data.bid_count_by_type.length > 0 ? (
            <ResponsiveContainer width='100%' height={280}>
              <BarChart data={withTitleLabels(data.bid_count_by_type)}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='label' />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey='value'
                  fill={colors.accent.violet}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      {/* Top Items by Bid Count (Bar) */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Top Items by Bid Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_items_by_bid_count.length > 0 ? (
            <ResponsiveContainer width='100%' height={300}>
              <BarChart
                data={data.top_items_by_bid_count}
                layout='vertical'
                margin={{ left: 10, right: 10 }}
              >
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis type='number' allowDecimals={false} />
                <YAxis {...yAxisProps} />
                <Tooltip />
                <Bar
                  dataKey='value'
                  fill={colors.status.success}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>

      {/* Top Items by Watchers (Bar) */}
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Top Items by Watchers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.top_items_by_watchers.length > 0 ? (
            <ResponsiveContainer width='100%' height={300}>
              <BarChart
                data={data.top_items_by_watchers}
                layout='vertical'
                margin={{ left: 10, right: 10 }}
              >
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis type='number' allowDecimals={false} />
                <YAxis {...yAxisProps} />
                <Tooltip />
                <Bar
                  dataKey='value'
                  fill={colors.status.warning}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className='text-muted-foreground flex h-[250px] items-center justify-center text-sm'>
      No data available
    </div>
  )
}
