/**
 * ChecklistItem — Single checklist item row with status cycle-click badge
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  ChecklistItemStatus,
  ChecklistItem as ChecklistItemType,
} from '@/types/checklist'
import { AlertTriangle, Check, Circle, Clock } from 'lucide-react'

const STATUS_CYCLE: Record<ChecklistItemStatus, ChecklistItemStatus> = {
  not_complete: 'in_progress',
  in_progress: 'complete',
  complete: 'not_complete',
}

const STATUS_CONFIG: Record<
  ChecklistItemStatus,
  { label: string; icon: typeof Circle; className: string }
> = {
  not_complete: {
    label: 'Not Complete',
    icon: Circle,
    className:
      'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    className:
      'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300',
  },
  complete: {
    label: 'Complete',
    icon: Check,
    className:
      'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300',
  },
}

interface ChecklistItemProps {
  item: ChecklistItemType
  onStatusChange: (itemId: string, newStatus: ChecklistItemStatus) => void
  onEdit?: (item: ChecklistItemType) => void
  onDelete?: (itemId: string) => void
  dragHandleProps?: Record<string, unknown>
}

export function ChecklistItemRow({
  item,
  onStatusChange,
  onEdit,
  onDelete,
  dragHandleProps,
}: ChecklistItemProps) {
  const config = STATUS_CONFIG[item.status]
  const Icon = config.icon

  const handleStatusClick = () => {
    const nextStatus = STATUS_CYCLE[item.status]
    onStatusChange(item.id, nextStatus)
  }

  const formattedDueDate = item.due_date
    ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    : null

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 transition-colors',
        item.status === 'complete' && 'bg-muted/50 opacity-75',
        item.is_overdue &&
        item.status !== 'complete' &&
        'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950'
      )}
    >
      {/* Top row: drag handle + status badge + title */}
      <div className='flex items-start gap-2'>
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className='text-muted-foreground hover:text-foreground mt-0.5 shrink-0 cursor-grab'
          >
            ⠿
          </span>
        )}

        <button
          onClick={handleStatusClick}
          className='mt-0.5 shrink-0'
          title={`Click to change status to ${STATUS_CYCLE[item.status].replace('_', ' ')}`}
        >
          <Badge
            className={cn(
              'cursor-pointer gap-1 transition-colors',
              config.className
            )}
          >
            <Icon className='h-3 w-3' />
            <span className='hidden sm:inline'>{config.label}</span>
          </Badge>
        </button>

        <div className='min-w-0 flex-1'>
          <span
            className={cn(
              'text-sm leading-relaxed',
              item.status === 'complete' && 'text-muted-foreground line-through'
            )}
          >
            {item.title}
          </span>
        </div>
      </div>

      {/* Bottom row: due date + actions */}
      {(formattedDueDate || onEdit || onDelete) && (
        <div className='mt-1 flex items-center justify-between pl-6 sm:pl-0'>
          <div>
            {formattedDueDate && (
              <span
                className={cn(
                  'text-xs',
                  item.is_overdue && item.status !== 'complete'
                    ? 'font-medium text-orange-600 dark:text-orange-400'
                    : 'text-muted-foreground'
                )}
              >
                {item.is_overdue && item.status !== 'complete' && (
                  <AlertTriangle className='mr-1 inline h-3 w-3' />
                )}
                {formattedDueDate}
              </span>
            )}
          </div>
          {(onEdit || onDelete) && (
            <div className='flex shrink-0 gap-1'>
              {onEdit && (
                <button
                  onClick={() => onEdit(item)}
                  className='text-muted-foreground hover:text-foreground rounded p-1 text-xs'
                  title='Edit item'
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className='rounded p-1 text-xs text-red-500 hover:text-red-700'
                  title='Delete item'
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
