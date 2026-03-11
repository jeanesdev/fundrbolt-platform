import type { ProjectionAdjustmentSet } from '@/services/event-dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatSourceLabel } from '../utils/formatters'

interface ProjectionControlsProps {
  projections?: ProjectionAdjustmentSet
  onSave: (values: ProjectionAdjustmentSet['adjustments']) => void
  onReset: () => void
  saving: boolean
}

export function ProjectionControls({
  projections,
  onSave,
  onReset,
  saving,
}: ProjectionControlsProps) {
  if (!projections) {
    return null
  }

  const parseCurrencyInput = (value: string): number => {
    const normalized = value.replace(/[^\d.-]/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-muted-foreground text-sm font-medium'>
          Projection Controls
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='grid gap-3 md:grid-cols-2'>
          {projections.adjustments.map((adjustment) => (
            <label key={adjustment.source} className='space-y-1'>
              <span className='text-muted-foreground text-xs'>
                {formatSourceLabel(adjustment.source)}
              </span>
              <Input
                type='text'
                defaultValue={formatCurrency(adjustment.projected.amount)}
                onBlur={(event) => {
                  const value = parseCurrencyInput(event.target.value)
                  event.target.value = formatCurrency(value)
                  onSave(
                    projections.adjustments.map((item) =>
                      item.source === adjustment.source
                        ? {
                            ...item,
                            projected: {
                              ...item.projected,
                              amount: value,
                            },
                          }
                        : item
                    )
                  )
                }}
              />
            </label>
          ))}
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            size='sm'
            disabled={saving}
            onClick={() => onSave(projections.adjustments)}
          >
            Save Projections
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={saving}
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
