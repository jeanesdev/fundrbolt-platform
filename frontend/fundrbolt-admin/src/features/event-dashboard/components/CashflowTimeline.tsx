/**
 * Cashflow Timeline Component
 * 
 * Displays daily/weekly cashflow trends
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { CashflowPoint } from '@/types/event-dashboard'

interface CashflowTimelineProps {
  cashflow: CashflowPoint[]
}

export function CashflowTimeline({ cashflow }: CashflowTimelineProps) {
  const chartData = cashflow.map((point) => ({
    date: point.date,
    actual: parseFloat(point.actual.amount),
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Area type="monotone" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
      {chartData.length === 0 && (
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No cashflow data available yet
        </div>
      )}
    </div>
  )
}
