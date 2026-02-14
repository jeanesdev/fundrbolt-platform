/**
 * Alert Cards Component
 * 
 * Displays alerts for underperforming revenue sources
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { AlertCard as AlertCardType } from '@/types/event-dashboard'

interface AlertCardsProps {
  alerts: AlertCardType[]
}

export function AlertCards({ alerts }: AlertCardsProps) {
  if (alerts.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Performance Alerts</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {alerts.map((alert, index) => (
          <Alert key={index} variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{formatSourceName(alert.source)} Underperforming</AlertTitle>
            <AlertDescription>
              Below {alert.threshold_percent}% of expected pacing for {alert.consecutive_refreshes} consecutive
              refreshes. Triggered at {new Date(alert.triggered_at).toLocaleString()}.
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  )
}

function formatSourceName(source: string): string {
  return source
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
