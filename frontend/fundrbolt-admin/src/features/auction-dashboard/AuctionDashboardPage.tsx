import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEventContext } from '@/hooks/use-event-context'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScopeToggle } from '@/features/donor-dashboard/components/ScopeToggle'
import { AuctionCharts } from './components/AuctionCharts'
import { AuctionItemsTable } from './components/AuctionItemsTable'
import { SummaryCards } from './components/SummaryCards'
import {
  useAuctionCharts,
  useAuctionSummary,
} from './hooks/useAuctionDashboard'

type Scope = 'event' | 'all'

export function AuctionDashboardPage() {
  const { selectedEventId } = useEventContext()
  const queryClient = useQueryClient()
  const [scopePreference, setScopePreference] = useState<Scope>(
    selectedEventId ? 'event' : 'all'
  )

  const scope = useMemo<Scope>(
    () => (selectedEventId ? scopePreference : 'all'),
    [selectedEventId, scopePreference]
  )

  const eventId = scope === 'event' ? (selectedEventId ?? undefined) : undefined

  const params = useMemo(() => ({ event_id: eventId }), [eventId])

  const summaryQuery = useAuctionSummary(params)
  const chartsQuery = useAuctionCharts(params)

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['auction-dashboard'] })
  }

  return (
    <div className='space-y-6 px-4 py-6 sm:px-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            Auction Dashboard
          </h1>
          <p className='text-muted-foreground text-sm'>
            Analyze auction item performance and bidding activity.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <ScopeToggle
            value={scope}
            onChange={setScopePreference}
            hasEvent={!!selectedEventId}
          />
          <Button
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            title='Refresh all data'
          >
            <RefreshCw className='h-4 w-4' />
          </Button>
        </div>
      </div>

      <SummaryCards
        data={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
      />

      <Tabs defaultValue='items' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='items'>Items</TabsTrigger>
          <TabsTrigger value='charts'>Charts</TabsTrigger>
        </TabsList>

        <TabsContent value='items' className='space-y-4'>
          <AuctionItemsTable eventId={eventId} />
        </TabsContent>

        <TabsContent value='charts' className='space-y-4'>
          <AuctionCharts
            data={chartsQuery.data}
            isLoading={chartsQuery.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
