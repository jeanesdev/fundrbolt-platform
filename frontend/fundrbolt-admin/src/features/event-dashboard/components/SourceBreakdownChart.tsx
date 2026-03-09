import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RevenueSourceSummary } from '@/services/event-dashboard'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatCurrencyCompact,
  formatSourceLabel,
} from '../utils/formatters'
import { ChartTooltipContent } from './ChartTooltipContent'

interface SourceBreakdownChartProps {
  sources: RevenueSourceSummary[]
}

export function SourceBreakdownChart({ sources }: SourceBreakdownChartProps) {
  const data = sources.map((source) => ({
    name: source.source,
    actual: source.actual.amount,
    projected: source.projected.amount,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Source Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={280}>
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray='3 3' />
            <XAxis dataKey='name' tickFormatter={formatSourceLabel} />
            <YAxis tickFormatter={formatCurrencyCompact} width={72} />
            <Tooltip
              content={({ label, payload }) => (
                <ChartTooltipContent
                  label={formatSourceLabel(String(label ?? ''))}
                  payload={payload as unknown as Array<{ name?: string; value?: number }>}
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
            <Bar dataKey='actual' fill='currentColor' className='text-primary' radius={4} />
            <Bar
              dataKey='projected'
              fill='currentColor'
              className='text-foreground/70'
              radius={4}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
