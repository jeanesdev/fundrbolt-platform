import { ChevronDown, ChevronUp, ChevronsUpDown, Filter } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type SortDir = 'asc' | 'desc'

interface FilterableColumnHeaderProps {
  label: string
  sortField: string
  currentSort: { field: string; dir: SortDir } | null
  onSort: (field: string) => void
  filterValue: string
  onFilterChange: (value: string) => void
}

export function FilterableColumnHeader({
  label,
  sortField,
  currentSort,
  onSort,
  filterValue,
  onFilterChange,
}: FilterableColumnHeaderProps) {
  const isActive = currentSort?.field === sortField
  const hasFilter = filterValue.length > 0

  return (
    <div className='flex items-center gap-0.5'>
      <button
        type='button'
        className='flex items-center gap-0.5 text-left hover:opacity-70'
        onClick={() => onSort(sortField)}
      >
        {label}
        {!isActive && (
          <ChevronsUpDown className='ml-0.5 inline h-3 w-3 opacity-40' />
        )}
        {isActive && currentSort?.dir === 'asc' && (
          <ChevronUp className='ml-0.5 inline h-3 w-3' />
        )}
        {isActive && currentSort?.dir === 'desc' && (
          <ChevronDown className='ml-0.5 inline h-3 w-3' />
        )}
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type='button'
            className={`rounded p-0.5 transition-colors ${
              hasFilter
                ? 'text-primary'
                : 'text-muted-foreground opacity-50 hover:opacity-80'
            }`}
            aria-label={`Filter by ${label}`}
          >
            <Filter className='h-3 w-3' />
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-48 p-2' align='start'>
          <input
            className='w-full rounded border px-2 py-1 text-sm outline-none focus:ring-1'
            placeholder={`Filter ${label.toLowerCase()}…`}
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            autoFocus
          />
          {hasFilter && (
            <button
              type='button'
              className='text-muted-foreground mt-1 text-xs hover:underline'
              onClick={() => onFilterChange('')}
            >
              Clear
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
