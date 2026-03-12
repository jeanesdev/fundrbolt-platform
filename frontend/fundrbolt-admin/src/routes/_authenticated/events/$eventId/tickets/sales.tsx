import { createFileRoute } from '@tanstack/react-router'
import { SalesSummaryCard } from '@/features/events/tickets/components/SalesSummaryCard'
import { TicketSalesTable } from '@/features/events/tickets/components/TicketSalesTable'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/sales'
)({
  component: TicketSalesPage,
})

function TicketSalesPage() {
  const { currentEvent } = useEventWorkspace()

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Ticket Sales</h1>
        <p className='text-muted-foreground'>
          View and manage ticket sales for this event
        </p>
      </div>

      <SalesSummaryCard eventId={currentEvent.id} />
      <TicketSalesTable eventId={currentEvent.id} />
    </div>
  )
}
