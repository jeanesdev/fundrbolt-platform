import { Button } from '@/components/ui/button'
import type { ScenarioType } from '@/services/event-dashboard'

interface ScenarioToggleProps {
  value: ScenarioType
  onChange: (value: ScenarioType) => void
}

const scenarios: ScenarioType[] = ['base', 'optimistic', 'conservative']

export function ScenarioToggle({ value, onChange }: ScenarioToggleProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      {scenarios.map((scenario) => (
        <Button
          key={scenario}
          type='button'
          size='sm'
          variant={value === scenario ? 'default' : 'outline'}
          onClick={() => onChange(scenario)}
        >
          {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
        </Button>
      ))}
    </div>
  )
}
