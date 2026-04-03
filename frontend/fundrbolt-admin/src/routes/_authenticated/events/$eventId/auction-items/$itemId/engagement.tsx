import { AuctionItemDetailLayout } from '@/features/events/auction-items/AuctionItemDetailLayout'
import { EngagementPanel } from '@/features/events/auction-items/components/EngagementPanel'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-items/$itemId/engagement'
)({
  component: EngagementRoute,
})

function EngagementRoute() {
  const { currentEvent } = useEventWorkspace()
  const { itemId } = Route.useParams()

  return (
    <AuctionItemDetailLayout>
      <EngagementPanel eventId={currentEvent.id} itemId={itemId} />
    </AuctionItemDetailLayout>
  )
}
