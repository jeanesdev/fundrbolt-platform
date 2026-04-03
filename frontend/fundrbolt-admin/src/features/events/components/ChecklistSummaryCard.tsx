/**
 * ChecklistSummaryCard — Compact checklist progress card for the event dashboard.
 * Shows progress bar + counts and a button to navigate to the full checklist page.
 */
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useChecklistStore } from '@/stores/checklistStore'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Pencil,
} from 'lucide-react'
import { useEffect } from 'react'

interface ChecklistSummaryCardProps {
  eventId: string
}

export function ChecklistSummaryCard({ eventId }: ChecklistSummaryCardProps) {
  const { checklist, isLoading, fetchChecklist } = useChecklistStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchChecklist(eventId).catch(() => { })
  }, [eventId, fetchChecklist])

  const total = checklist?.total_count ?? 0
  const completed = checklist?.completed_count ?? 0
  const inProgress = checklist?.in_progress_count ?? 0
  const overdue = checklist?.overdue_count ?? 0
  const pct = checklist?.progress_percentage ?? 0

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='flex items-center gap-2 text-base font-semibold'>
          <ClipboardList className='text-primary h-5 w-5' />
          Planning Checklist
        </CardTitle>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            navigate({
              to: '/events/$eventId/checklist',
              params: { eventId },
            })
          }
        >
          <Pencil className='mr-1 h-3 w-3' />
          Edit
        </Button>
      </CardHeader>
      <CardContent className='space-y-3'>
        {isLoading && total === 0 && (
          <p className='text-muted-foreground text-sm'>Loading...</p>
        )}

        {!isLoading && total === 0 && (
          <p className='text-muted-foreground text-sm'>
            No checklist items yet. Click Edit to get started.
          </p>
        )}

        {total > 0 && (
          <>
            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center gap-3'>
                <span className='flex items-center gap-1'>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                  <span className='font-medium'>
                    {completed} of {total}
                  </span>{' '}
                  complete
                </span>
                {inProgress > 0 && (
                  <span className='text-muted-foreground'>
                    {inProgress} in progress
                  </span>
                )}
                {overdue > 0 && (
                  <span className='flex items-center gap-1 text-orange-600 dark:text-orange-400'>
                    <AlertTriangle className='h-3.5 w-3.5' />
                    {overdue} overdue
                  </span>
                )}
              </div>
              <span className='text-muted-foreground text-xs'>
                {Math.round(pct)}%
              </span>
            </div>
            <Progress value={pct} className='h-2' />
          </>
        )}
      </CardContent>
    </Card>
  )
}
