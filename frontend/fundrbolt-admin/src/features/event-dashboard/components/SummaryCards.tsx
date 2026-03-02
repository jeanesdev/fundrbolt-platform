import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardSummary } from '@/services/event-dashboard'
import { formatCurrency, formatPercent } from '../utils/formatters'

interface SummaryCardsProps {
  summary: DashboardSummary
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const percentToGoal =
    summary.goal.amount > 0
      ? (summary.total_actual.amount / summary.goal.amount) * 100
      : 0
  const progressWidth = `${Math.max(0, Math.min(percentToGoal, 100))}%`

  const cards = [
    { title: 'Goal', value: summary.goal.amount },
    { title: 'Projected', value: summary.total_projected.amount },
    { title: 'Variance', value: summary.variance_amount.amount },
  ]

  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
      <Card className='md:col-span-2'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>Current Raised</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex items-baseline justify-between gap-3'>
            <p className='text-3xl font-semibold'>{formatCurrency(summary.total_actual.amount)}</p>
            <p className='text-sm font-semibold text-primary'>{formatPercent(percentToGoal, 1)} of Goal</p>
          </div>
          <div className='h-2 rounded-full bg-muted'>
            <div className='h-2 rounded-full bg-primary' style={{ width: progressWidth }} />
          </div>
        </CardContent>
      </Card>
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{formatCurrency(card.value)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
