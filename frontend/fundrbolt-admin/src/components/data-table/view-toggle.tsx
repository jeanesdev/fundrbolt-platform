import { LayoutGrid, Table } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/hooks/use-view-preference'
import { Button } from '@/components/ui/button'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}

/**
 * Two-button toggle group for switching between table and card views.
 */
export function DataTableViewToggle({
  value,
  onChange,
  className,
}: ViewToggleProps) {
  return (
    <div
      className={cn('inline-flex rounded-md border', className)}
      role='group'
    >
      <Button
        variant={value === 'table' ? 'secondary' : 'ghost'}
        size='icon'
        className='rounded-r-none border-0'
        onClick={() => onChange('table')}
        aria-label='Table view'
        aria-pressed={value === 'table'}
      >
        <Table className='size-4' />
      </Button>
      <Button
        variant={value === 'card' ? 'secondary' : 'ghost'}
        size='icon'
        className='rounded-l-none border-0'
        onClick={() => onChange('card')}
        aria-label='Card view'
        aria-pressed={value === 'card'}
      >
        <LayoutGrid className='size-4' />
      </Button>
    </div>
  )
}
