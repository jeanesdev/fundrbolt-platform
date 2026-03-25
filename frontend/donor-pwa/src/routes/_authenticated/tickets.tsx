/**
 * Ticket Inventory Page — /_authenticated/tickets
 * Shows all tickets the user has purchased across events.
 */
import { TicketAssignmentCard } from '@/components/tickets/TicketAssignmentCard'
import { TicketAssignmentForm } from '@/components/tickets/TicketAssignmentForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { SelfRegistrationFlow } from '@/features/tickets/SelfRegistrationFlow'
import {
  cancelAssignment,
  cancelRegistration,
} from '@/lib/api/ticket-assignments'
import { resendInvitation, sendInvitation } from '@/lib/api/ticket-invitations'
import {
  getMyInventory,
  type EventTicketSummary,
  type TicketDetail,
} from '@/lib/api/ticket-purchases'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
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
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/tickets')({
  component: TicketInventoryPage,
})

function TicketInventoryPage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const queryClient = useQueryClient()

  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(
    null
  )
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [selfRegTicket, setSelfRegTicket] = useState<{
    id: string
    ticketNumber: number
    eventSlug: string
    packageId: string
    assignmentId?: string | null
  } | null>(null)
  const [pendingAssignmentCancel, setPendingAssignmentCancel] = useState<{
    assignmentId: string
    ticketNumber: number
    eventName: string
    guestName: string
    guestEmail: string
  } | null>(null)
  const [pendingRegistrationCancel, setPendingRegistrationCancel] = useState<{
    assignmentId: string
    ticketNumber: number
    eventName: string
    guestName: string
    guestEmail: string
    isSelfRegistration: boolean
  } | null>(null)

  const {
    data: inventory,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ticket-inventory'],
    queryFn: getMyInventory,
  })

  const { data: currentUserData } = useQuery({
    queryKey: ['user', 'me', 'tickets'],
    queryFn: async () => {
      const response = await apiClient.get('/users/me')
      return response.data as {
        communications_email?: string | null
        communications_email_verified?: boolean
        phone?: string | null
      }
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (!currentUserData) return

    updateUser({
      communications_email: currentUserData.communications_email,
      communications_email_verified:
        currentUserData.communications_email_verified,
      phone: currentUserData.phone,
    })
  }, [currentUserData, updateUser])

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
      toast.success('Ticket revoked')
      setPendingAssignmentCancel(null)
      void queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] })
    },
    onError: () => {
      toast.error('Failed to revoke ticket')
    },
  })

  const cancelRegistrationMutation = useMutation({
    mutationFn: (assignmentId: string) => cancelRegistration(assignmentId),
    onSuccess: async () => {
      toast.success('Registration cancelled and ticket revoked')
      setPendingRegistrationCancel(null)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] }),
        queryClient.invalidateQueries({
          queryKey: ['ticket-inventory', 'event-context'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['registrations', 'events-with-branding'],
        }),
      ])
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to cancel registration'
      toast.error(message)
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

  const currentUserEmails = [
    currentUserData?.communications_email?.trim().toLowerCase(),
    user?.communications_email?.trim().toLowerCase(),
    user?.email?.trim().toLowerCase(),
  ].filter((value): value is string => Boolean(value))

  const ticketBelongsToCurrentUser = (ticket: TicketDetail) => {
    const guestEmail = ticket.assignment?.guest_email?.trim().toLowerCase()
    if (!guestEmail) return false
    return currentUserEmails.includes(guestEmail)
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
        <div className='flex items-center gap-2'>
          <div className='text-muted-foreground flex gap-2 text-sm'>
            <Badge variant='outline'>{inventory.total_tickets} total</Badge>
            <Badge variant='secondary'>
              {inventory.total_unassigned} unassigned
            </Badge>
          </div>
          <Button asChild variant='outline' size='sm'>
            <Link to='/tickets/history'>History</Link>
          </Button>
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
                      className={`h-5 w-5 transition-transform ${openSections.has(evt.event_id) ? 'rotate-180' : ''
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
                                    variant='default'
                                    onClick={() => {
                                      setSelfRegTicket({
                                        id: ticket.id,
                                        ticketNumber: ticket.ticket_number,
                                        eventSlug: evt.event_slug,
                                        packageId: purchase.package_id,
                                        assignmentId: null,
                                      })
                                    }}
                                  >
                                    Register Myself
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                      if (!user) return
                                      setAssigningTicketId(ticket.id)
                                    }}
                                  >
                                    <UserPlus className='mr-1 h-3 w-3' />
                                    Assign Guest
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <TicketAssignmentCard
                              ticket={ticket}
                              canSelfRegister={ticketBelongsToCurrentUser(
                                ticket
                              )}
                              onSelfRegister={(
                                ticketId,
                                ticketNumber,
                                assignmentId
                              ) => {
                                setSelfRegTicket({
                                  id: ticketId,
                                  ticketNumber,
                                  eventSlug: evt.event_slug,
                                  packageId: purchase.package_id,
                                  assignmentId,
                                })
                              }}
                              onSendInvite={(id) =>
                                sendInviteMutation.mutate(id)
                              }
                              isSendingInvite={sendInviteMutation.isPending}
                              onCancelRegistration={(assignmentId) =>
                                setPendingRegistrationCancel({
                                  assignmentId,
                                  ticketNumber: ticket.ticket_number,
                                  eventName: evt.event_name,
                                  guestName:
                                    ticket.assignment?.guest_name ?? 'This guest',
                                  guestEmail:
                                    ticket.assignment?.guest_email ?? '',
                                  isSelfRegistration:
                                    ticketBelongsToCurrentUser(ticket),
                                })
                              }
                              onResendInvite={(id) =>
                                resendInviteMutation.mutate(id)
                              }
                              isResendingInvite={
                                resendInviteMutation.isPending
                              }
                              onCancelAssignment={(id) =>
                                setPendingAssignmentCancel({
                                  assignmentId: id,
                                  ticketNumber: ticket.ticket_number,
                                  eventName: evt.event_name,
                                  guestName:
                                    ticket.assignment?.guest_name ?? 'This guest',
                                  guestEmail:
                                    ticket.assignment?.guest_email ?? '',
                                })
                              }
                              isCancellingAssignment={
                                cancelMutation.isPending
                              }
                              isCancellingRegistration={
                                cancelRegistrationMutation.isPending
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

      {selfRegTicket && user && (
        <SelfRegistrationFlow
          ticketId={selfRegTicket.id}
          assignmentId={selfRegTicket.assignmentId}
          eventSlug={selfRegTicket.eventSlug}
          packageId={selfRegTicket.packageId}
          ticketNumber={selfRegTicket.ticketNumber}
          userName={`${user.first_name} ${user.last_name}`.trim()}
          userEmail={
            currentUserData?.communications_email?.trim() ||
            user.communications_email?.trim() ||
            user.email
          }
          userPhone={currentUserData?.phone ?? user.phone}
          open={!!selfRegTicket}
          onOpenChange={(open) => {
            if (!open) setSelfRegTicket(null)
          }}
        />
      )}

      <AlertDialog
        open={pendingAssignmentCancel !== null}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) {
            setPendingAssignmentCancel(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this guest ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAssignmentCancel
                ? `This will revoke ticket #${pendingAssignmentCancel.ticketNumber} in ${pendingAssignmentCancel.eventName} from ${pendingAssignmentCancel.guestName}${pendingAssignmentCancel.guestEmail ? ` (${pendingAssignmentCancel.guestEmail})` : ''}. They will not be able to register unless you assign the ticket again.`
                : 'This will revoke the ticket and prevent that guest from registering.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm'>
            <p className='font-medium text-destructive'>Important</p>
            <p className='text-muted-foreground mt-1'>
              Any invitation link already sent for this ticket will stop
              working after you revoke it.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Keep Ticket Assigned
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={(event) => {
                event.preventDefault()
                if (!pendingAssignmentCancel) {
                  return
                }
                cancelMutation.mutate(pendingAssignmentCancel.assignmentId)
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Revoking...' : 'Revoke Ticket'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRegistrationCancel !== null}
        onOpenChange={(open) => {
          if (!open && !cancelRegistrationMutation.isPending) {
            setPendingRegistrationCancel(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRegistrationCancel?.isSelfRegistration
                ? 'Unregister from event?'
                : 'Revoke this registered ticket?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRegistrationCancel
                ? pendingRegistrationCancel.isSelfRegistration
                  ? `This will cancel your registration for ticket #${pendingRegistrationCancel.ticketNumber} in ${pendingRegistrationCancel.eventName} and make the ticket unassigned again.`
                  : `This will cancel ${pendingRegistrationCancel.guestName}'s registration for ticket #${pendingRegistrationCancel.ticketNumber} in ${pendingRegistrationCancel.eventName}, revoke their ticket, and make the ticket unassigned again.`
                : 'This will cancel the registration and free the ticket.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!pendingRegistrationCancel?.isSelfRegistration && (
            <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm'>
              <p className='font-medium text-destructive'>Important</p>
              <p className='text-muted-foreground mt-1'>
                The guest will receive an email confirming that their
                registration was cancelled and their ticket was revoked.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelRegistrationMutation.isPending}>
              {pendingRegistrationCancel?.isSelfRegistration
                ? 'Keep Registration'
                : 'Keep Ticket Active'}
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={(event) => {
                event.preventDefault()
                if (!pendingRegistrationCancel) {
                  return
                }
                cancelRegistrationMutation.mutate(
                  pendingRegistrationCancel.assignmentId
                )
              }}
              disabled={cancelRegistrationMutation.isPending}
            >
              {cancelRegistrationMutation.isPending
                ? 'Revoking...'
                : pendingRegistrationCancel?.isSelfRegistration
                  ? 'Unregister'
                  : 'Revoke Ticket'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
