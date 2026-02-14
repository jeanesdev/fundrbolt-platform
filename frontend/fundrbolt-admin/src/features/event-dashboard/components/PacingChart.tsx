/**
 * Pacing Chart Component
 * 
 * Displays pacing line chart comparing actual progress to linear goal trajectory
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { DashboardSummary } from '@/types/event-dashboard'

interface PacingChartProps {
  dashboard: DashboardSummary
  eventId: string
}

export function PacingChart({ dashboard }: PacingChartProps) {
  // Generate pacing data
  // TODO: Use actual cashflow data from backend
  const chartData = dashboard.cashflow.map((point) => ({
    date: point.date,
    actual: parseFloat(point.actual.amount),
    projected: point.projected ? parseFloat(point.projected.amount) : null,
  }))

  const goalAmount = parseFloat(dashboard.goal.amount)

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Legend />
          <ReferenceLine y={goalAmount} stroke="#94a3b8" strokeDasharray="3 3" label="Goal" />
          <Line type="monotone" dataKey="actual" stroke="#10b981" name="Actual" strokeWidth={2} />
          <Line type="monotone" dataKey="projected" stroke="#3b82f6" strokeDasharray="5 5" name="Projected" />
        </LineChart>
      </ResponsiveContainer>
      {chartData.length === 0 && (
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No pacing data available yet
        </div>
      )}
    </div>
  )
}
