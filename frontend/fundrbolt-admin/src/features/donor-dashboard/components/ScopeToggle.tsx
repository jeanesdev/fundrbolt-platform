import { Button } from '@/components/ui/button'

interface ScopeToggleProps {
  value: 'event' | 'all'
  onChange: (value: 'event' | 'all') => void
  hasEvent: boolean
}

export function ScopeToggle({ value, onChange, hasEvent }: ScopeToggleProps) {
  return (
    <div className='inline-flex rounded-md border'>
      <Button
        type='button'
        variant={value === 'event' ? 'default' : 'ghost'}
        size='sm'
        onClick={() => onChange('event')}
        disabled={!hasEvent}
        className='rounded-r-none'
      >
        This Event
      </Button>
      <Button
        type='button'
        variant={value === 'all' ? 'default' : 'ghost'}
        size='sm'
        onClick={() => onChange('all')}
        className='rounded-l-none'
      >
        All Events
      </Button>
    </div>
  )
}
