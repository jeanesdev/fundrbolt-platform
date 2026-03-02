import { Card } from '@/components/ui/card'
import { useState } from 'react'
import { AuctionBidImportDialog } from '../auction-bids/AuctionBidImportDialog'
import { AuctionBidsDashboard } from '../auction-bids/AuctionBidsDashboard'
import { useEventWorkspace } from '../useEventWorkspace'
import { useAuctionBidDashboard } from './hooks/useAuctionBidDashboard'

export function EventAuctionBidsSection() {
  const { currentEvent } = useEventWorkspace()
  const [importOpen, setImportOpen] = useState(false)
  const { data, isLoading, refetch } = useAuctionBidDashboard(currentEvent.id)

  return (
    <Card className='p-6'>
      <AuctionBidsDashboard
        data={data}
        isLoading={isLoading}
        onImportClick={() => setImportOpen(true)}
        eventId={currentEvent.id}
      />
      <AuctionBidImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventId={currentEvent.id}
        onImportComplete={() => {
          refetch()
        }}
      />
    </Card>
  )
}
