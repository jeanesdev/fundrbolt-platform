/**
 * ChecklistProgressBar — Shows "X of Y complete" with visual progress bar
 */
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface ChecklistProgressBarProps {
  totalCount: number
  completedCount: number
  inProgressCount: number
  overdueCount: number
  progressPercentage: number
}

export function ChecklistProgressBar({
  totalCount,
  completedCount,
  inProgressCount,
  overdueCount,
  progressPercentage,
}: ChecklistProgressBarProps) {
  if (totalCount === 0) return null

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          <span className='flex items-center gap-1'>
            <CheckCircle2 className='h-4 w-4 text-green-600' />
            <span className='font-medium'>
              {completedCount}/{totalCount}
            </span>{' '}
            complete
          </span>
          {inProgressCount > 0 && (
            <span className='text-muted-foreground text-xs'>
              {inProgressCount} in progress
            </span>
          )}
          {overdueCount > 0 && (
            <span className='flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400'>
              <AlertTriangle className='h-3.5 w-3.5' />
              {overdueCount} overdue
            </span>
          )}
        </div>
        <span className='text-muted-foreground text-xs'>
          {Math.round(progressPercentage)}%
        </span>
      </div>
      <Progress value={progressPercentage} className='h-2' />
    </div>
  )
}
