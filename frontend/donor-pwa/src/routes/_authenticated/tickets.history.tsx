/**
 * Purchase History Route — /_authenticated/tickets.history
 * Route: /tickets/history
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PurchaseHistory } from '@/features/tickets/PurchaseHistory'

export const Route = createFileRoute('/_authenticated/tickets/history')({
  component: PurchaseHistoryPage,
})

function PurchaseHistoryPage() {
  return (
    <div className='container mx-auto max-w-2xl space-y-6 px-4 py-8'>
      <div className='flex items-center gap-3'>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/tickets'>
            <ArrowLeft className='mr-1 h-4 w-4' />
            My Tickets
          </Link>
        </Button>
      </div>

      <h1 className='flex items-center gap-2 text-2xl font-bold'>
        <History className='h-6 w-6' />
        Purchase History
      </h1>

      <PurchaseHistory />
    </div>
  )
}
