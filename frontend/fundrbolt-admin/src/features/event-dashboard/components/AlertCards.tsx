import type { AlertCard as AlertCardType } from '@/services/event-dashboard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatSourceLabel } from '../utils/formatters'

interface AlertCardsProps {
  alerts: AlertCardType[]
}

export function AlertCards({ alerts }: AlertCardsProps) {
  if (!alerts.length) {
    return null
  }

  return (
    <div className='space-y-3'>
      {alerts.map((alert, index) => (
        <Alert key={`${alert.source}-${index}`}>
          <AlertTitle>
            {formatSourceLabel(alert.source)} is below target pacing
          </AlertTitle>
          <AlertDescription>
            Below {alert.threshold_percent}% target for{' '}
            {alert.consecutive_refreshes} refreshes.
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
