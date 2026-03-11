/**
 * CheckoutStatusControl — T059
 *
 * Toggle that lets admins open / close donor self-checkout for an event.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { getCheckoutStatus, setCheckoutStatus } from '@/lib/api/admin-payments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CheckoutStatusControlProps {
  eventId: string
}

export function CheckoutStatusControl({ eventId }: CheckoutStatusControlProps) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['checkout-status', eventId],
    queryFn: () => getCheckoutStatus(eventId),
  })

  const toggleMutation = useMutation({
    mutationFn: (open: boolean) => setCheckoutStatus(eventId, open),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-status', eventId], updated)
      toast.success(
        updated.checkout_open
          ? 'Donor checkout is now open'
          : 'Donor checkout is now closed'
      )
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update checkout status'
      )
    },
  })

  const isOpen = data?.checkout_open ?? false
  const isBusy = isLoading || toggleMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          {isOpen ? (
            <LockOpen className='h-5 w-5 text-green-600' />
          ) : (
            <Lock className='text-muted-foreground h-5 w-5' />
          )}
          Donor Checkout
        </CardTitle>
        <CardDescription>
          Control whether donors can self-checkout through the donor app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <span className='text-sm font-medium'>Status:</span>
            {isLoading ? (
              <span className='text-muted-foreground text-sm'>Loading…</span>
            ) : isOpen ? (
              <Badge className='bg-green-100 text-green-700 hover:bg-green-100'>
                Open — donors can checkout
              </Badge>
            ) : (
              <Badge variant='secondary'>Closed — checkout unavailable</Badge>
            )}
          </div>
          <Button
            variant={isOpen ? 'destructive' : 'default'}
            size='sm'
            disabled={isBusy}
            onClick={() => toggleMutation.mutate(!isOpen)}
          >
            {toggleMutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Updating…
              </>
            ) : isOpen ? (
              <>
                <Lock className='mr-2 h-4 w-4' />
                Close Checkout
              </>
            ) : (
              <>
                <LockOpen className='mr-2 h-4 w-4' />
                Open Checkout
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
