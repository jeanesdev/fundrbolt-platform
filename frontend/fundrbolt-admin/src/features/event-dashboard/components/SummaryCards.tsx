/**
 * Summary Cards Component
 * 
 * Displays high-level summary metrics: total raised, goal, variance, and pacing status
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Target, DollarSign, Activity } from 'lucide-react'
import type { DashboardSummary } from '@/types/event-dashboard'

interface SummaryCardsProps {
  dashboard: DashboardSummary
}

export function SummaryCards({ dashboard }: SummaryCardsProps) {
  const formatMoney = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: dashboard.goal.currency,
    }).format(parseFloat(value))
  }

  const isOnTrack = dashboard.pacing.status === 'on_track'
  const isPositiveVariance = parseFloat(dashboard.variance_amount.amount) < 0 // Negative variance means we exceeded goal

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Raised */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Raised</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(dashboard.total_actual.amount)}</div>
          <p className="text-xs text-muted-foreground">
            of {formatMoney(dashboard.goal.amount)} goal
          </p>
        </CardContent>
      </Card>

      {/* Projected Total */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projected Total</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMoney(dashboard.total_projected.amount)}</div>
          <p className="text-xs text-muted-foreground">
            with current projections
          </p>
        </CardContent>
      </Card>

      {/* Variance from Goal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Variance from Goal</CardTitle>
          {isPositiveVariance ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isPositiveVariance ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(dashboard.variance_amount.amount)}
          </div>
          <p className="text-xs text-muted-foreground">
            {dashboard.variance_percent.toFixed(1)}% {isPositiveVariance ? 'over' : 'under'} goal
          </p>
        </CardContent>
      </Card>

      {/* Pacing Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pacing Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isOnTrack ? 'text-green-600' : 'text-yellow-600'}`}>
            {isOnTrack ? 'On Track' : 'Off Track'}
          </div>
          <p className="text-xs text-muted-foreground">
            {dashboard.pacing.pacing_percent.toFixed(0)}% pacing
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
