/**
 * Waterfall Chart Component
 * 
 * Displays waterfall visualization of revenue sources contributing to goal
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { WaterfallStep, MoneyValue } from '@/types/event-dashboard'

interface WaterfallChartProps {
  waterfall: WaterfallStep[]
  goal: MoneyValue
}

export function WaterfallChart({ waterfall }: WaterfallChartProps) {
  // Transform data for waterfall visualization
  const chartData = waterfall.map((step, index) => ({
    name: step.label,
    value: parseFloat(step.amount.amount),
    fill: index % 2 === 0 ? '#10b981' : '#3b82f6',
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Bar dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {chartData.length === 0 && (
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No revenue data available yet
        </div>
      )}
    </div>
  )
}
