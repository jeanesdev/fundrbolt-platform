/**
 * Projection Controls Component
 * 
 * Allows admins to adjust projected amounts by source and switch between scenarios
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useUpdateProjections } from '../hooks/useEventDashboard'
import type { RevenueSourceSummary, ScenarioType, ProjectionAdjustment } from '@/types/event-dashboard'

interface ProjectionControlsProps {
  eventId: string
  scenario: ScenarioType
  onScenarioChange: (scenario: ScenarioType) => void
  sources: RevenueSourceSummary[]
}

export function ProjectionControls({ eventId, scenario, onScenarioChange, sources }: ProjectionControlsProps) {
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})
  const updateProjections = useUpdateProjections()

  const handleAdjustmentChange = (source: string, value: string) => {
    setAdjustments((prev) => ({ ...prev, [source]: value }))
  }

  const handleSave = () => {
    const projectionAdjustments: ProjectionAdjustment[] = sources.map((source) => ({
      source: source.source,
      projected: {
        amount: adjustments[source.source] || source.projected.amount,
        currency: source.projected.currency,
      },
    }))

    updateProjections.mutate({
      eventId,
      update: {
        scenario,
        adjustments: projectionAdjustments,
      },
    })
  }

  const handleReset = () => {
    setAdjustments({})
  }

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Projection Scenario</CardTitle>
          <CardDescription>
            Select a scenario to view and adjust projections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup type="single" value={scenario} onValueChange={(value) => value && onScenarioChange(value as ScenarioType)}>
            <ToggleGroupItem value="conservative">Conservative</ToggleGroupItem>
            <ToggleGroupItem value="base">Base</ToggleGroupItem>
            <ToggleGroupItem value="optimistic">Optimistic</ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      {/* Projection Adjustments */}
      <Card>
        <CardHeader>
          <CardTitle>Adjust Projections</CardTitle>
          <CardDescription>
            Update projected amounts by revenue source for what-if analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sources.map((source) => (
            <div key={source.source} className="grid gap-2">
              <Label htmlFor={`projection-${source.source}`}>{formatSourceName(source.source)}</Label>
              <div className="flex gap-2">
                <Input
                  id={`projection-${source.source}`}
                  type="number"
                  step="0.01"
                  placeholder={source.projected.amount}
                  value={adjustments[source.source] || ''}
                  onChange={(e) => handleAdjustmentChange(source.source, e.target.value)}
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  {source.projected.currency}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Current: ${parseFloat(source.projected.amount).toLocaleString()}
              </p>
            </div>
          ))}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={updateProjections.isPending}>
              {updateProjections.isPending ? 'Saving...' : 'Save Projections'}
            </Button>
            <Button onClick={handleReset} variant="outline">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatSourceName(source: string): string {
  return source
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
