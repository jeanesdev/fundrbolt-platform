import { Skeleton } from '@/components/ui/skeleton'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { CategoryPercentages } from '../components/CategoryPercentages'
import { CommissionGallery } from '../components/CommissionGallery'
import { CountdownTimers } from '../components/CountdownTimers'
import { EarningsSummary } from '../components/EarningsSummary'
import { EventTotals } from '../components/EventTotals'
import {
  useAuctioneerCommissions,
  useAuctioneerDashboard,
  useAuctioneerSettings,
} from '../hooks/useAuctioneerData'

export function AuctioneerDashboardPage() {
  const { currentEvent } = useEventWorkspace()
  const { data, isLoading, error } = useAuctioneerDashboard(currentEvent.id)
  const { data: commissions } = useAuctioneerCommissions(currentEvent.id)
  const { data: settings } = useAuctioneerSettings(currentEvent.id)

  if (isLoading) {
    return (
      <div className='space-y-4 p-4'>
        <Skeleton className='h-20 w-full' />
        <div className='grid gap-4 md:grid-cols-2'>
          <Skeleton className='h-48' />
          <Skeleton className='h-48' />
        </div>
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='p-4'>
        <p className='text-destructive'>Failed to load auctioneer dashboard.</p>
      </div>
    )
  }

  return (
    <div className='space-y-6 p-4'>
      <div>
        <h2 className='text-2xl font-bold'>Auctioneer Dashboard</h2>
        <p className='text-muted-foreground text-sm'>
          Track your commissions and event earnings
        </p>
      </div>

      <CountdownTimers timer={data.timers} />

      <div className='grid gap-4 md:grid-cols-2'>
        <EarningsSummary earnings={data.earnings} />
        <EventTotals totals={data.event_totals} />
      </div>

      <CategoryPercentages eventId={currentEvent.id} settings={settings ?? null} />

      <div>
        <h3 className='mb-3 text-lg font-semibold'>Item Commissions</h3>
        <CommissionGallery commissions={commissions?.commissions ?? []} />
      </div>
    </div>
  )
}
