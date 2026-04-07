import { useMemo, useState } from 'react'
import { useEventContext } from '@/hooks/use-event-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BidWarsTab } from './components/BidWarsTab'
import { DonorLeaderboard } from './components/DonorLeaderboard'
import { DonorProfilePanel } from './components/DonorProfilePanel'
import { GivingCategoryCharts } from './components/GivingCategoryCharts'
import { OutbidLeadersTab } from './components/OutbidLeadersTab'
import { ScopeToggle } from './components/ScopeToggle'

type Scope = 'event' | 'all'

export function DonorDashboardPage() {
  const { selectedEventId } = useEventContext()
  const [scopePreference, setScopePreference] = useState<Scope>(
    selectedEventId ? 'event' : 'all'
  )
  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null)

  // If no event is selected, force scope to 'all' regardless of preference
  const scope = useMemo<Scope>(
    () => (selectedEventId ? scopePreference : 'all'),
    [selectedEventId, scopePreference]
  )

  const eventId = scope === 'event' ? (selectedEventId ?? undefined) : undefined

  // If a donor is selected, show the profile panel
  if (selectedDonorId) {
    return (
      <div className='container space-y-4 py-6'>
        <DonorProfilePanel
          userId={selectedDonorId}
          eventId={eventId}
          onClose={() => setSelectedDonorId(null)}
        />
      </div>
    )
  }

  return (
    <div className='container space-y-6 py-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Donor Dashboard</h1>
          <p className='text-muted-foreground text-sm'>
            Analyze donor giving behavior and engagement.
          </p>
        </div>
        <ScopeToggle
          value={scope}
          onChange={setScopePreference}
          hasEvent={!!selectedEventId}
        />
      </div>

      <Tabs defaultValue='leaderboard' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='leaderboard'>Leaderboard</TabsTrigger>
          <TabsTrigger value='outbid'>Outbid Leaders</TabsTrigger>
          <TabsTrigger value='bidwars'>Bid Wars</TabsTrigger>
          <TabsTrigger value='categories'>Categories</TabsTrigger>
        </TabsList>

        <TabsContent value='leaderboard' className='space-y-4'>
          <DonorLeaderboard
            eventId={eventId}
            onSelectDonor={setSelectedDonorId}
          />
        </TabsContent>

        <TabsContent value='outbid' className='space-y-4'>
          <OutbidLeadersTab
            eventId={eventId}
            onSelectDonor={setSelectedDonorId}
          />
        </TabsContent>

        <TabsContent value='bidwars' className='space-y-4'>
          <BidWarsTab eventId={eventId} />
        </TabsContent>

        <TabsContent value='categories' className='space-y-4'>
          <GivingCategoryCharts eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
