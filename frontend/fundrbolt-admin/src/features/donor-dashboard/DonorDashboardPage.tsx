import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEventContext } from '@/hooks/use-event-context'
import { useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { BidWarsTab } from './components/BidWarsTab'
import { DonorLeaderboard } from './components/DonorLeaderboard'
import { DonorProfilePanel } from './components/DonorProfilePanel'
import { GivingCategoryCharts } from './components/GivingCategoryCharts'
import { OutbidLeadersTab } from './components/OutbidLeadersTab'
import { ScopeToggle } from './components/ScopeToggle'
import { SurveyAnswersTab } from './components/SurveyAnswersTab'

type Scope = 'event' | 'all'

export function DonorDashboardPage() {
  const { selectedEventId } = useEventContext()
  const routeParams = useParams({ strict: false }) as { eventId?: string }
  // URL param takes precedence over globally selected event
  const effectiveEventId = routeParams.eventId ?? selectedEventId ?? null

  const [scopePreference, setScopePreference] = useState<Scope>(
    effectiveEventId ? 'event' : 'all'
  )
  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null)

  // If no event is selected, force scope to 'all' regardless of preference
  const scope = useMemo<Scope>(
    () => (effectiveEventId ? scopePreference : 'all'),
    [effectiveEventId, scopePreference]
  )

  const eventId = scope === 'event' ? (effectiveEventId ?? undefined) : undefined

  // If a donor is selected, show the profile panel
  if (selectedDonorId) {
    return (
      <div className='space-y-4 py-4 sm:py-6'>
        <DonorProfilePanel
          userId={selectedDonorId}
          eventId={eventId}
          onClose={() => setSelectedDonorId(null)}
        />
      </div>
    )
  }

  return (
    <div className='space-y-6 py-4 sm:py-6'>
      <div className='space-y-2 sm:space-y-0'>
        <div className='flex items-start justify-between gap-3 sm:items-center'>
          <div>
            <h1 className='text-xl font-bold tracking-tight sm:text-2xl'>Donor Dashboard</h1>
            <p className='text-muted-foreground text-sm'>
              Analyze donor giving behavior and engagement.
            </p>
          </div>
          <div className='hidden sm:block'>
            <ScopeToggle
              value={scope}
              onChange={setScopePreference}
              hasEvent={!!effectiveEventId}
            />
          </div>
        </div>
        <div className='sm:hidden'>
          <ScopeToggle
            value={scope}
            onChange={setScopePreference}
            hasEvent={!!effectiveEventId}
          />
        </div>
      </div>

      <Tabs defaultValue='leaderboard' className='space-y-4'>
        <div className='overflow-x-auto'>
          <TabsList className='w-max'>
            <TabsTrigger value='leaderboard'>Leaderboard</TabsTrigger>
            <TabsTrigger value='outbid'>Outbid Leaders</TabsTrigger>
            <TabsTrigger value='bidwars'>Bid Wars</TabsTrigger>
            <TabsTrigger value='categories'>Categories</TabsTrigger>
            <TabsTrigger value='survey-answers'>Survey Answers</TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value='survey-answers' className='space-y-4'>
          <SurveyAnswersTab
            eventId={eventId}
            onSelectDonor={setSelectedDonorId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
