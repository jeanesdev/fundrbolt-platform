import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CashflowPoint } from '@/services/event-dashboard'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrencyCompact } from '../utils/formatters'
import { ChartTooltipContent } from './ChartTooltipContent'

interface CashflowTimelineProps {
  points: CashflowPoint[]
}

export function CashflowTimeline({ points }: CashflowTimelineProps) {
  const data = points.map((point) => ({
    date: new Date(point.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    actual: point.actual.amount,
    projected: point.projected.amount,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashflow Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' />
            <YAxis tickFormatter={formatCurrencyCompact} width={72} />
            <Tooltip
              content={({ label, payload }) => (
                <ChartTooltipContent
                  label={String(label ?? '')}
                  payload={payload as Array<{ name?: string; value?: number }>}
                  seriesLabels={{
                    actual: 'Actual',
                    projected: 'Projected',
                  }}
                />
              )}
            />
            <Legend
              formatter={(seriesName) =>
                seriesName === 'actual' ? 'Actual' : 'Projected'
              }
            />
            <Line
              type='monotone'
              dataKey='actual'
              stroke='currentColor'
              className='text-primary'
              strokeWidth={2}
            />
            <Line
              type='monotone'
              dataKey='projected'
              stroke='currentColor'
              className='text-foreground/70'
              strokeWidth={2}
              strokeDasharray='4 4'
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
