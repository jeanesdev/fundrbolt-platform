import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FoodOptionSelector } from '../components/FoodOptionSelector'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventFoodSection() {
  const {
    currentEvent,
    handleFoodOptionCreate,
    handleFoodOptionUpdate,
    handleFoodOptionDelete,
  } = useEventWorkspace()

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
          onUpdate={handleFoodOptionUpdate}
          onDelete={handleFoodOptionDelete}
        />
      </CardContent>
    </Card>
  )
}
