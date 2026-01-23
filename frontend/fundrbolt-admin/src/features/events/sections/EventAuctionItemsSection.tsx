import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuctionItemList } from '../components/AuctionItemList'
import { useEventWorkspace } from '../EventWorkspaceContext'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'

export function EventAuctionItemsSection() {
  const navigate = useNavigate()
  const { currentEvent, auctionItems, fetchAuctionItems } = useEventWorkspace()
  const deleteAuctionItem = useAuctionItemStore((state) => state.deleteAuctionItem)
  const eventId = currentEvent.slug || currentEvent.id  // Use slug for navigation

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auction Items</CardTitle>
        <CardDescription>
          Manage live and silent auction items for your fundraising event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuctionItemList
          items={auctionItems}
          isLoading={false}
          onAdd={() => navigate({ to: '/events/$eventId/auction-items/create', params: { eventId } })}
          onEdit={(item) =>
            navigate({
              to: '/events/$eventId/auction-items/$itemId/edit',
              params: { eventId, itemId: item.id },
            })
          }
          onView={(item) =>
            navigate({
              to: '/events/$eventId/auction-items/$itemId',
              params: { eventId, itemId: item.id },
            })
          }
          onDelete={async (item) => {
            if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return
            try {
              await deleteAuctionItem(currentEvent.id, item.id)
              toast.success('Auction item deleted successfully')
              await fetchAuctionItems(currentEvent.id)
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete auction item'
              toast.error(message)
            }
          }}
        />
      </CardContent>
    </Card>
  )
}
