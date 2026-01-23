import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FoodOptionSelector } from '../components/FoodOptionSelector'
import { useEventWorkspace } from '../EventWorkspaceContext'

export function EventFoodSection() {
  const { currentEvent, handleFoodOptionCreate, handleFoodOptionDelete } = useEventWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Food & Dietary Options</CardTitle>
        <CardDescription>
          Manage food choices and dietary accommodations for attendees
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FoodOptionSelector
          options={currentEvent.food_options || []}
          onCreate={handleFoodOptionCreate}
          onDelete={handleFoodOptionDelete}
        />
      </CardContent>
    </Card>
  )
}
