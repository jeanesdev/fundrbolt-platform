/**
 * CheckoutControlPanel — T036 + T046
 *
 * Card-based control panel that lets admins:
 * - View current checkout status
 * - Open / close checkout
 * - Schedule an auto-open (with cancel)
 * - Edit cash payment instructions
 *
 * When checkout is open, renders DonorCheckoutDashboard below.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Loader2,
  Lock,
  LockOpen,
  UserCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type CheckoutConfiguration,
  cancelScheduledOpen,
  closeCheckout,
  getCheckoutConfiguration,
  openCheckout,
  scheduleCheckoutOpen,
  updateCheckoutConfiguration,
} from '@/lib/api/checkout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DonorCheckoutDashboard } from './DonorCheckoutDashboard'

interface CheckoutControlPanelProps {
  eventId: string
}

function StatusBadge({ config }: { config: CheckoutConfiguration }) {
  if (config.status === 'open') {
    return (
      <Badge className='bg-green-100 text-green-700 hover:bg-green-100'>
        Open
      </Badge>
    )
  }
  if (config.status === 'scheduled') {
    return (
      <Badge className='bg-blue-100 text-blue-700 hover:bg-blue-100'>
        Scheduled
      </Badge>
    )
  }
  return <Badge variant='secondary'>Closed</Badge>
}

export function CheckoutControlPanel({ eventId }: CheckoutControlPanelProps) {
  const queryClient = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['checkout-config', eventId],
    queryFn: () => getCheckoutConfiguration(eventId),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['checkout-config', eventId] })

  const openMutation = useMutation({
    mutationFn: () => openCheckout(eventId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-config', eventId], updated)
      toast.success('Checkout is now open')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to open checkout'
      ),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeCheckout(eventId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-config', eventId], updated)
      toast.success('Checkout is now closed')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to close checkout'
      ),
  })

  // ── Schedule ────────────────────────────────────────────────────────────────

  const [scheduleValue, setScheduleValue] = useState('')

  const scheduleMutation = useMutation({
    mutationFn: (scheduledAt: string) =>
      scheduleCheckoutOpen(eventId, scheduledAt),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-config', eventId], updated)
      toast.success('Auto-open scheduled')
      setScheduleValue('')
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to schedule'),
  })

  const cancelScheduleMutation = useMutation({
    mutationFn: () => cancelScheduledOpen(eventId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-config', eventId], updated)
      toast.success('Scheduled auto-open cancelled')
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel schedule'
      ),
  })

  // ── Cash instructions ───────────────────────────────────────────────────────

  const [cashInstructions, setCashInstructions] = useState(
    config?.cash_instructions ?? ''
  )
  const [cashDirty, setCashDirty] = useState(false)

  useEffect(() => {
    if (config?.cash_instructions !== undefined) {
      setCashInstructions(config.cash_instructions ?? '')
      setCashDirty(false)
    }
  }, [config?.cash_instructions])

  const updateConfigMutation = useMutation({
    mutationFn: (cashInstr: string) =>
      updateCheckoutConfiguration(eventId, {
        cash_instructions: cashInstr || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checkout-config', eventId], updated)
      toast.success('Instructions saved')
      setCashDirty(false)
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to save instructions'
      ),
  })

  const isBusy =
    openMutation.isPending ||
    closeMutation.isPending ||
    scheduleMutation.isPending ||
    cancelScheduleMutation.isPending

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            {config?.status === 'open' ? (
              <LockOpen className='h-5 w-5 text-green-600' />
            ) : (
              <Lock className='text-muted-foreground h-5 w-5' />
            )}
            Checkout Control
          </CardTitle>
          <CardDescription>
            Manage donor checkout availability for this event
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-6'>
          {/* Status row */}
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium'>Status:</span>
              {isLoading ? (
                <span className='text-muted-foreground text-sm'>Loading…</span>
              ) : config ? (
                <StatusBadge config={config} />
              ) : null}
            </div>

            <div className='flex flex-wrap gap-2'>
              {config?.status !== 'open' && (
                <Button
                  size='sm'
                  disabled={isBusy}
                  onClick={() => openMutation.mutate()}
                >
                  {openMutation.isPending ? (
                    <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />
                  ) : (
                    <LockOpen className='mr-1.5 h-4 w-4' />
                  )}
                  Open Checkout
                </Button>
              )}
              {config?.status === 'open' && (
                <Button
                  variant='destructive'
                  size='sm'
                  disabled={isBusy}
                  onClick={() => closeMutation.mutate()}
                >
                  {closeMutation.isPending ? (
                    <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />
                  ) : (
                    <Lock className='mr-1.5 h-4 w-4' />
                  )}
                  Close Checkout
                </Button>
              )}
            </div>
          </div>

          {/* Schedule auto-open */}
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>Schedule Auto-Open</Label>
            {config?.scheduled_open_at ? (
              <div className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                <CalendarClock className='text-muted-foreground h-4 w-4 shrink-0' />
                <span className='flex-1'>
                  Scheduled:{' '}
                  {new Date(config.scheduled_open_at).toLocaleString()}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6 shrink-0'
                  disabled={cancelScheduleMutation.isPending}
                  onClick={() => cancelScheduleMutation.mutate()}
                  title='Cancel scheduled open'
                >
                  {cancelScheduleMutation.isPending ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <X className='h-3.5 w-3.5' />
                  )}
                </Button>
              </div>
            ) : (
              <div className='flex gap-2'>
                <Input
                  type='datetime-local'
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className='h-8 text-sm'
                />
                <Button
                  size='sm'
                  className='h-8 shrink-0'
                  disabled={!scheduleValue || scheduleMutation.isPending}
                  onClick={() => scheduleMutation.mutate(scheduleValue)}
                >
                  {scheduleMutation.isPending ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    'Schedule'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Cash instructions */}
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>
              Cash Payment Instructions
            </Label>
            <Textarea
              value={cashInstructions}
              onChange={(e) => {
                setCashInstructions(e.target.value)
                setCashDirty(true)
              }}
              placeholder='Instructions shown to donors who choose to pay cash…'
              className='min-h-[80px] text-sm'
            />
            {cashDirty && (
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  disabled={updateConfigMutation.isPending}
                  onClick={() => updateConfigMutation.mutate(cashInstructions)}
                >
                  {updateConfigMutation.isPending ? (
                    <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                  ) : null}
                  Save Instructions
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setCashInstructions(config?.cash_instructions ?? '')
                    setCashDirty(false)
                    void invalidate()
                  }}
                >
                  Discard
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* T046: show donor dashboard when checkout is open */}
      {config?.status === 'open' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <UserCheck className='h-5 w-5 shrink-0' />
              Donor Checkout Status
            </CardTitle>
            <CardDescription>
              Track and manage individual donor checkout sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DonorCheckoutDashboard eventId={eventId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
