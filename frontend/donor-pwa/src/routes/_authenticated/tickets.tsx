/**
 * Ticket Inventory Page — /_authenticated/tickets
 * Shows all tickets the user has purchased across events.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Ticket,
  TicketCheck,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cancelAssignment } from '@/lib/api/ticket-assignments'
import { sendInvitation, resendInvitation } from '@/lib/api/ticket-invitations'
import {
  getMyInventory,
  type EventTicketSummary,
  type TicketDetail,
} from '@/lib/api/ticket-purchases'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { TicketAssignmentCard } from '@/components/tickets/TicketAssignmentCard'
import { TicketAssignmentForm } from '@/components/tickets/TicketAssignmentForm'

export const Route = createFileRoute('/_authenticated/tickets')({
  component: TicketInventoryPage,
})

function TicketInventoryPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(
    null
  )
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  const {
    data: inventory,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ticket-inventory'],
    queryFn: getMyInventory,
  })

  const sendInviteMutation = useMutation({
    mutationFn: (assignmentId: string) => sendInvitation(assignmentId),
    onSuccess: () => {
      toast.success('Invitation sent!')
      void queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] })
    },
    onError: () => {
      toast.error('Failed to send invitation')
    },
  })

  const resendInviteMutation = useMutation({
    mutationFn: (assignmentId: string) => resendInvitation(assignmentId),
    onSuccess: () => {
      toast.success('Invitation resent!')
      void queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] })
    },
    onError: () => {
      toast.error('Failed to resend invitation')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (assignmentId: string) => cancelAssignment(assignmentId),
    onSuccess: () => {
      toast.success('Assignment cancelled')
      void queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] })
    },
    onError: () => {
      toast.error('Failed to cancel assignment')
    },
  })

  const toggleSection = (eventId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className='container mx-auto max-w-2xl space-y-4 px-4 py-8'>
        <Skeleton className='h-8 w-40' />
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-32 w-full' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='container mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4 py-8'>
        <Card className='w-full text-center'>
          <CardContent className='space-y-4 py-8'>
            <AlertCircle className='text-destructive mx-auto h-10 w-10' />
            <p className='text-muted-foreground'>
              Unable to load your tickets. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!inventory || inventory.events.length === 0) {
    return (
      <div className='container mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4 py-8'>
        <Card className='w-full text-center'>
          <CardContent className='space-y-4 py-10'>
            <Ticket className='text-muted-foreground mx-auto h-12 w-12' />
            <h2 className='text-xl font-semibold'>
              You don&apos;t have any tickets yet
            </h2>
            <p className='text-muted-foreground'>
              Browse events to purchase tickets.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto max-w-2xl space-y-6 px-4 py-8'>
      <div className='flex items-center justify-between'>
        <h1 className='flex items-center gap-2 text-2xl font-bold'>
          <TicketCheck className='h-6 w-6' />
          My Tickets
        </h1>
        <div className='text-muted-foreground flex gap-2 text-sm'>
          <Badge variant='outline'>{inventory.total_tickets} total</Badge>
          <Badge variant='secondary'>
            {inventory.total_unassigned} unassigned
          </Badge>
        </div>
      </div>

      {inventory.events.map((evt: EventTicketSummary) => (
        <Collapsible
          key={evt.event_id}
          open={openSections.has(evt.event_id)}
          onOpenChange={() => toggleSection(evt.event_id)}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className='hover:bg-muted/50 cursor-pointer'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-1'>
                    <CardTitle className='text-lg'>{evt.event_name}</CardTitle>
                    <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                      <CalendarDays className='h-4 w-4' />
                      {new Date(evt.event_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline'>{evt.total_tickets} tickets</Badge>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        openSections.has(evt.event_id) ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className='space-y-4 border-t pt-4'>
                {evt.purchases.map((purchase) => (
                  <div key={purchase.id} className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='font-medium'>{purchase.package_name}</p>
                        <p className='text-muted-foreground text-sm'>
                          {purchase.quantity}{' '}
                          {purchase.quantity === 1 ? 'package' : 'packages'} ·
                          Purchased{' '}
                          {new Date(purchase.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className='space-y-2 pl-2'>
                      {purchase.tickets.map((ticket: TicketDetail) => (
                        <div key={ticket.id}>
                          {assigningTicketId === ticket.id ? (
                            <Card className='border-primary/50 bg-primary/5'>
                              <CardContent className='p-4'>
                                <TicketAssignmentForm
                                  ticketId={ticket.id}
                                  isSelfAssignment={false}
                                  defaultName=''
                                  defaultEmail=''
                                  onAssigned={() => {
                                    setAssigningTicketId(null)
                                    void queryClient.invalidateQueries({
                                      queryKey: ['ticket-inventory'],
                                    })
                                  }}
                                  onCancel={() => setAssigningTicketId(null)}
                                />
                              </CardContent>
                            </Card>
                          ) : ticket.assignment_status === 'unassigned' ? (
                            <Card>
                              <CardContent className='flex items-center justify-between p-4'>
                                <div className='flex items-center gap-2'>
                                  <span className='text-sm font-medium'>
                                    Ticket #{ticket.ticket_number}
                                  </span>
                                  <Badge variant='outline'>Unassigned</Badge>
                                </div>
                                <div className='flex gap-2'>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                      if (!user) return
                                      setAssigningTicketId(ticket.id)
                                    }}
                                  >
                                    <UserPlus className='mr-1 h-3 w-3' />
                                    Assign
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <TicketAssignmentCard
                              ticket={ticket}
                              onSendInvite={(id) =>
                                sendInviteMutation.mutate(id)
                              }
                              onResendInvite={(id) =>
                                resendInviteMutation.mutate(id)
                              }
                              onCancelAssignment={(id) =>
                                cancelMutation.mutate(id)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <Button asChild variant='outline' size='sm' className='w-full'>
                  <Link to='/events/$slug' params={{ slug: evt.event_slug }}>
                    View Event
                  </Link>
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  )
}
