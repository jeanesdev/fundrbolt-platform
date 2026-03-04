import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { type Row, type Table, flexRender } from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

/** Columns with these IDs are excluded from the card field list. */
const EXCLUDED_COLUMN_IDS = new Set(['select', 'actions'])

type DataTableCardViewProps<TData> = {
  /** TanStack Table instance */
  table: Table<TData>
  /** Number of leading columns to show as primary fields (default: 4) */
  primaryFieldCount?: number
  /** Optional class for the card grid container */
  className?: string
}

/**
 * Generic card view renderer for TanStack Table instances.
 *
 * Renders each row as a card with primaryFieldCount prominent fields
 * and remaining fields in a collapsible "More details" section.
 */
export function DataTableCardView<TData>({
  table,
  primaryFieldCount = 4,
  className,
}: DataTableCardViewProps<TData>) {
  const rows = table.getRowModel().rows

  if (!rows.length) {
    return (
      <div className='text-muted-foreground flex h-24 items-center justify-center rounded-md border'>
        No results.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {rows.map((row) => (
        <CardItem
          key={row.id}
          row={row}
          primaryFieldCount={primaryFieldCount}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

type CardItemProps<TData> = {
  row: Row<TData>
  primaryFieldCount: number
}

function CardItem<TData>({ row, primaryFieldCount }: CardItemProps<TData>) {
  const [expanded, setExpanded] = useState(false)

  const visibleCells = row.getVisibleCells()

  // Partition cells into select, primary fields, secondary fields, and actions
  const selectCell = visibleCells.find((c) => c.column.id === 'select')
  const actionsCell = visibleCells.find((c) => c.column.id === 'actions')
  const fieldCells = visibleCells.filter(
    (c) => !EXCLUDED_COLUMN_IDS.has(c.column.id)
  )
  const primaryCells = fieldCells.slice(0, primaryFieldCount)
  const secondaryCells = fieldCells.slice(primaryFieldCount)

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 shadow-sm transition-colors',
        row.getIsSelected() && 'ring-primary ring-2'
      )}
      data-state={row.getIsSelected() ? 'selected' : undefined}
    >
      {/* Card header — checkbox + actions */}
      <div className='mb-3 flex items-center justify-between'>
        {selectCell ? (
          <div>
            {flexRender(
              selectCell.column.columnDef.cell,
              selectCell.getContext()
            )}
          </div>
        ) : (
          <div />
        )}
        {actionsCell && (
          <div>
            {flexRender(
              actionsCell.column.columnDef.cell,
              actionsCell.getContext()
            )}
          </div>
        )}
      </div>

      {/* Primary fields */}
      <dl className='space-y-1.5'>
        {primaryCells.map((cell) => {
          const label = getColumnLabel(cell.column)
          return (
            <div key={cell.id} className='flex items-baseline gap-2'>
              {label && (
                <dt className='text-muted-foreground shrink-0 text-xs font-medium'>
                  {label}
                </dt>
              )}
              <dd className='min-w-0 truncate text-sm'>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </dd>
            </div>
          )
        })}
      </dl>

      {/* Secondary fields (collapsible) */}
      {secondaryCells.length > 0 && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className='text-muted-foreground hover:text-foreground mt-3 flex w-full items-center gap-1 text-xs font-medium'>
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                expanded && 'rotate-180'
              )}
            />
            {expanded ? 'Less details' : 'More details'}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className='mt-2 space-y-1.5 border-t pt-2'>
              {secondaryCells.map((cell) => {
                const label = getColumnLabel(cell.column)
                return (
                  <div key={cell.id} className='flex items-baseline gap-2'>
                    {label && (
                      <dt className='text-muted-foreground shrink-0 text-xs font-medium'>
                        {label}
                      </dt>
                    )}
                    <dd className='min-w-0 truncate text-sm'>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers

/**
 * Extract a human-readable label for a column.
 * Checks column.columnDef.meta?.title first, then the header if it's a string.
 */
function getColumnLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: { columnDef: { header?: any; meta?: Record<string, any> } }
): string | null {
  // Check meta.title (common pattern with DataTableColumnHeader)
  const meta = column.columnDef.meta as
    | (Record<string, unknown> & { title?: string })
    | undefined
  if (meta?.title) return meta.title

  // If header is a plain string, use it directly
  if (typeof column.columnDef.header === 'string') {
    return column.columnDef.header
  }

  return null
}
