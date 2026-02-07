/**
 * Source Breakdown Chart Component
 * 
 * Displays revenue breakdown by source with actual, projected, and target values
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { RevenueSourceSummary } from '@/types/event-dashboard'

interface SourceBreakdownChartProps {
  sources: RevenueSourceSummary[]
}

export function SourceBreakdownChart({ sources }: SourceBreakdownChartProps) {
  // Transform data for Recharts
  const chartData = sources.map((source) => ({
    name: formatSourceName(source.source),
    actual: parseFloat(source.actual.amount),
    projected: parseFloat(source.projected.amount),
    target: parseFloat(source.target.amount),
  }))

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
        <Legend />
        <Bar dataKey="actual" fill="#10b981" name="Actual" />
        <Bar dataKey="projected" fill="#3b82f6" name="Projected" />
        <Bar dataKey="target" fill="#94a3b8" name="Target" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function formatSourceName(source: string): string {
  return source
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
