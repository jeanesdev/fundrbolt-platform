/**
 * MealSummaryCard Component
 *
 * Displays meal selection summary for an event with counts per meal option.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getMealSummary } from '@/lib/api/admin-attendees'
import { useQuery } from '@tanstack/react-query'
import { Loader2, UtensilsCrossed } from 'lucide-react'

interface MealSummaryCardProps {
  eventId: string
  className?: string
}

export function MealSummaryCard({ eventId, className }: MealSummaryCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['meal-summary', eventId],
    queryFn: () => getMealSummary(eventId),
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UtensilsCrossed className='h-5 w-5' />
            Meal Summary
          </CardTitle>
          <CardDescription>Loading meal selections...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <UtensilsCrossed className='h-5 w-5' />
            Meal Summary
          </CardTitle>
          <CardDescription className='text-destructive'>
            Error loading meal summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  const summary = data!
  const selectionRate =
    summary.total_active_attendees > 0
      ? (summary.total_meal_selections / summary.total_active_attendees) * 100
      : 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <UtensilsCrossed className='h-5 w-5' />
          Meal Summary
        </CardTitle>
        <CardDescription>
          Meal selections for {summary.event_name}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Overview Stats */}
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-1'>
            <p className='text-sm font-medium text-muted-foreground'>
              Total Active Attendees
            </p>
            <p className='text-2xl font-bold'>{summary.total_active_attendees}</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm font-medium text-muted-foreground'>
              Meal Selections
            </p>
            <p className='text-2xl font-bold'>{summary.total_meal_selections}</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm font-medium text-muted-foreground'>
              Selection Rate
            </p>
            <p className='text-2xl font-bold'>{selectionRate.toFixed(0)}%</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Overall Progress</span>
            <span className='font-medium'>
              {summary.total_meal_selections} / {summary.total_active_attendees}
            </span>
          </div>
          <Progress value={selectionRate} className='h-2' />
        </div>

        {/* Meal Options Breakdown */}
        {summary.meal_counts.length > 0 ? (
          <div className='space-y-4'>
            <h4 className='text-sm font-medium'>Meal Options</h4>
            <div className='space-y-3'>
              {summary.meal_counts.map((meal) => {
                const percentage =
                  summary.total_meal_selections > 0
                    ? (meal.count / summary.total_meal_selections) * 100
                    : 0

                return (
                  <div key={meal.food_option_id} className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex-1 space-y-1'>
                        <p className='font-medium'>{meal.name}</p>
                        {meal.description && (
                          <p className='text-xs text-muted-foreground line-clamp-1'>
                            {meal.description}
                          </p>
                        )}
                      </div>
                      <div className='ml-4 text-right'>
                        <p className='font-medium'>{meal.count}</p>
                        <p className='text-xs text-muted-foreground'>
                          {percentage.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <Progress value={percentage} className='h-1.5' />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className='rounded-md border border-dashed p-8 text-center'>
            <UtensilsCrossed className='mx-auto h-8 w-8 text-muted-foreground opacity-50' />
            <p className='mt-2 text-sm text-muted-foreground'>
              No meal options configured for this event
            </p>
          </div>
        )}

        {/* Pending Selections */}
        {summary.total_active_attendees > summary.total_meal_selections && (
          <div className='rounded-md bg-muted/50 p-3'>
            <p className='text-sm text-muted-foreground'>
              <span className='font-medium text-foreground'>
                {summary.total_active_attendees - summary.total_meal_selections}
              </span>{' '}
              attendee{summary.total_active_attendees - summary.total_meal_selections !== 1 ? 's' : ''} haven't
              selected a meal yet
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
