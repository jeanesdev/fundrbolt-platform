/**
 * Event Dashboard Page
 * 
 * Main page for event dashboard showing fundraising progress, revenue sources,
 * projections, and segment drilldowns.
 */

import { useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw, TrendingUp, Target, DollarSign, AlertCircle } from 'lucide-react'
import { useEventDashboard, useRefreshDashboard } from '../hooks/useEventDashboard'
import { SummaryCards } from '../components/SummaryCards'
import { SourceBreakdownChart } from '../components/SourceBreakdownChart'
import { PacingChart } from '../components/PacingChart'
import { WaterfallChart } from '../components/WaterfallChart'
import { CashflowTimeline } from '../components/CashflowTimeline'
import { AlertCards } from '../components/AlertCards'
import { ProjectionControls } from '../components/ProjectionControls'
import { SegmentDrilldown } from '../components/SegmentDrilldown'
import { ScenarioType } from '@/types/event-dashboard'

export function EventDashboardPage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/dashboard' })
  const [scenario, setScenario] = useState<ScenarioType>('base')
  const [activeTab, setActiveTab] = useState('overview')
  
  const { data: dashboard, isLoading, error, isFetching } = useEventDashboard({
    eventId,
    scenario,
  })
  
  const refreshDashboard = useRefreshDashboard()

  const handleManualRefresh = () => {
    refreshDashboard(eventId)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to load dashboard data'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleManualRefresh} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No dashboard data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Fundraising progress and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(dashboard.last_refreshed_at).toLocaleTimeString()}
          </div>
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards dashboard={dashboard} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="projections">
            <Target className="mr-2 h-4 w-4" />
            Projections
          </TabsTrigger>
          <TabsTrigger value="segments">
            <DollarSign className="mr-2 h-4 w-4" />
            Segments
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Alerts */}
          {dashboard.alerts.length > 0 && (
            <AlertCards alerts={dashboard.alerts} />
          )}

          {/* Revenue Sources */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Source</CardTitle>
              <CardDescription>
                Actual vs projected contributions by revenue category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SourceBreakdownChart sources={dashboard.sources} />
            </CardContent>
          </Card>

          {/* Pacing Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Pacing vs Goal Trajectory</CardTitle>
              <CardDescription>
                Progress compared to linear goal trajectory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PacingChart
                dashboard={dashboard}
                eventId={eventId}
              />
            </CardContent>
          </Card>

          {/* Two Column Layout */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Waterfall Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Waterfall Analysis</CardTitle>
                <CardDescription>
                  Cumulative contribution to goal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WaterfallChart
                  waterfall={dashboard.waterfall}
                  goal={dashboard.goal}
                />
              </CardContent>
            </Card>

            {/* Cashflow Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Cashflow Timeline</CardTitle>
                <CardDescription>
                  Daily/weekly fundraising trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CashflowTimeline cashflow={dashboard.cashflow} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projections Tab */}
        <TabsContent value="projections" className="space-y-6">
          <ProjectionControls
            eventId={eventId}
            scenario={scenario}
            onScenarioChange={setScenario}
            sources={dashboard.sources}
          />
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-6">
          <SegmentDrilldown eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
