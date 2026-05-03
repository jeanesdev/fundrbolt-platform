import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RevenueGeneratorsTab } from '@/features/revenue-generators'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventRevenueGeneratorsSection() {
  const { currentEvent } = useEventWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Generators</CardTitle>
        <CardDescription>
          Manage raffle and game-of-chance items for this event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RevenueGeneratorsTab eventId={currentEvent.id} />
      </CardContent>
    </Card>
  )
}
