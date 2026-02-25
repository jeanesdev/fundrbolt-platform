import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WaterfallStep } from '@/services/event-dashboard'
import { formatCurrency } from '../utils/formatters'

interface WaterfallChartProps {
  steps: WaterfallStep[]
}

export function WaterfallChart({ steps }: WaterfallChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {steps.map((step) => (
          <div key={step.label} className='flex items-center justify-between rounded-md border px-3 py-2'>
            <span className='text-sm'>{step.label}</span>
            <span className='text-sm font-medium'>{formatCurrency(step.amount.amount)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
