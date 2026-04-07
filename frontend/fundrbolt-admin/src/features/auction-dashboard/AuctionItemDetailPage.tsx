import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ItemDetailView } from './components/ItemDetailView'
import { useAuctionItemDetail } from './hooks/useAuctionDashboard'

export function AuctionItemDetailPage() {
  const { eventId, itemId } = useParams({ strict: false }) as {
    eventId: string
    itemId: string
  }
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useAuctionItemDetail(itemId)

  const handleBack = () => {
    void navigate({
      to: '/events/$eventId/auction-dashboard',
      params: { eventId },
    })
  }

  if (isLoading) {
    return (
      <div className='px-4 py-6 sm:px-6'>
        <Card>
          <CardContent className='text-muted-foreground p-6 text-sm'>
            Loading item details...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className='px-4 py-6 sm:px-6'>
        <Card>
          <CardContent className='space-y-4 p-6'>
            <p className='text-destructive text-sm'>
              Unable to load item details.
            </p>
            <Button type='button' onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='px-4 py-6 sm:px-6'>
      <ItemDetailView data={data} onBack={handleBack} />
    </div>
  )
}
