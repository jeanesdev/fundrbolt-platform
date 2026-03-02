import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import type { ScenarioType, SegmentType } from '@/services/event-dashboard'
import { useState } from 'react'
import { AlertCards } from '../components/AlertCards'
import { CashflowTimeline } from '../components/CashflowTimeline'
import { LastRefreshed } from '../components/LastRefreshed'
import { PacingChart } from '../components/PacingChart'
import { ProjectionControls } from '../components/ProjectionControls'
import { ScenarioToggle } from '../components/ScenarioToggle'
import { SegmentDrilldown } from '../components/SegmentDrilldown'
import { SourceBreakdownChart } from '../components/SourceBreakdownChart'
import { SummaryCards } from '../components/SummaryCards'
import { WaterfallChart } from '../components/WaterfallChart'
import {
  useEventDashboard,
  useEventDashboardProjections,
  useEventDashboardSegments,
  useUpdateEventDashboardProjections,
} from '../hooks/useEventDashboard'

export function EventDashboardPage() {
  const { currentEvent } = useEventWorkspace()
  const [scenario, setScenario] = useState<ScenarioType>('base')
  const [segmentType, setSegmentType] = useState<SegmentType>('guest')

  const summaryQuery = useEventDashboard(currentEvent.id, scenario)
  const projectionsQuery = useEventDashboardProjections(currentEvent.id, scenario)
  const segmentsQuery = useEventDashboardSegments(currentEvent.id, segmentType)
  const updateProjections = useUpdateEventDashboardProjections(currentEvent.id)

  if (summaryQuery.isLoading) {
    return (
      <Card>
        <CardContent className='p-6 text-sm text-muted-foreground'>Loading event dashboard...</CardContent>
      </Card>
    )
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <Card>
        <CardContent className='space-y-4 p-6'>
          <p className='text-sm text-destructive'>Unable to load event dashboard data.</p>
          <Button type='button' onClick={() => void summaryQuery.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const summary = summaryQuery.data

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <ScenarioToggle value={scenario} onChange={setScenario} />
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              void summaryQuery.refetch()
              void projectionsQuery.refetch()
              void segmentsQuery.refetch()
            }}
          >
            Refresh
          </Button>
          <LastRefreshed timestamp={summary.last_refreshed_at} />
        </div>
      </div>

      <SummaryCards summary={summary} />

      <div className='grid gap-4 xl:grid-cols-2'>
        <SourceBreakdownChart sources={summary.sources} />
        <PacingChart pacing={summary.pacing} />
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <WaterfallChart steps={summary.waterfall} />
        <CashflowTimeline points={summary.cashflow} />
      </div>

      <AlertCards alerts={summary.alerts} />

      <ProjectionControls
        projections={projectionsQuery.data}
        saving={updateProjections.isPending}
        onSave={(adjustments) => {
          void updateProjections.mutateAsync({
            scenario,
            adjustments,
          })
        }}
        onReset={() => {
          void projectionsQuery.refetch()
        }}
      />

      <SegmentDrilldown
        segmentType={segmentType}
        onSegmentTypeChange={setSegmentType}
        items={segmentsQuery.data?.items ?? []}
      />
    </div>
  )
}
