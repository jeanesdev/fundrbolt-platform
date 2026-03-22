/**
 * TicketAssignmentCard — shows an assigned ticket with status and actions.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { TicketDetail } from '@/lib/api/ticket-purchases'
import { CheckCircle, Mail, MailPlus, Ticket, UserX } from 'lucide-react'

interface TicketAssignmentCardProps {
  ticket: TicketDetail
  onSendInvite: (assignmentId: string) => void
  onCancelAssignment: (assignmentId: string) => void
  onResendInvite: (assignmentId: string) => void
  canSelfRegister?: boolean
  onCancelRegistration?: (assignmentId: string) => void
  onSelfRegister?: (
    ticketId: string,
    ticketNumber: number,
    assignmentId: string
  ) => void
  isSendingInvite?: boolean
  isResendingInvite?: boolean
  isCancellingAssignment?: boolean
  isCancellingRegistration?: boolean
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'registered':
      return (
        <Badge className='bg-green-600 text-white'>
          <CheckCircle className='mr-1 h-3 w-3' />
          Registered
        </Badge>
      )
    case 'assigned':
      return (
        <Badge variant='secondary'>
          <Mail className='mr-1 h-3 w-3' />
          Assigned
        </Badge>
      )
    case 'invited':
      return (
        <Badge className='bg-blue-500 text-white'>
          <MailPlus className='mr-1 h-3 w-3' />
          Invited
        </Badge>
      )
    default:
      return (
        <Badge variant='outline'>
          <Ticket className='mr-1 h-3 w-3' />
          Unassigned
        </Badge>
      )
  }
}

export function TicketAssignmentCard({
  ticket,
  onSendInvite,
  onCancelAssignment,
  onResendInvite,
  canSelfRegister = false,
  onCancelRegistration,
  onSelfRegister,
  isSendingInvite = false,
  isResendingInvite = false,
  isCancellingAssignment = false,
  isCancellingRegistration = false,
}: TicketAssignmentCardProps) {
  const { assignment } = ticket
  const status = ticket.assignment_status
  const hasActiveAssignment =
    assignment !== undefined && assignment !== null && status !== 'cancelled'

  return (
    <Card>
      <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium'>
              Ticket #{ticket.ticket_number}
            </span>
            {getStatusBadge(status)}
          </div>

          {hasActiveAssignment && (
            <div className='text-muted-foreground text-sm'>
              <span>{assignment.guest_name}</span>
              <span className='mx-1'>·</span>
              <span>{assignment.guest_email}</span>
            </div>
          )}
        </div>

        {hasActiveAssignment && (
          <div className='flex gap-2'>
            {status === 'registered' && onCancelRegistration && (
              <Button
                size='sm'
                variant='destructive'
                disabled={isCancellingRegistration}
                onClick={() => onCancelRegistration(assignment.id)}
              >
                <UserX className='mr-1 h-3 w-3' />
                {isCancellingRegistration
                  ? 'Revoking…'
                  : canSelfRegister
                    ? 'Unregister'
                    : 'Revoke Ticket'}
              </Button>
            )}
            {status === 'assigned' && canSelfRegister && onSelfRegister && (
              <Button
                size='sm'
                variant='default'
                onClick={() =>
                  onSelfRegister(ticket.id, ticket.ticket_number, assignment.id)
                }
              >
                Register Myself
              </Button>
            )}
            {status === 'assigned' && !canSelfRegister && (
              <Button
                size='sm'
                variant='outline'
                disabled={isSendingInvite}
                onClick={() => onSendInvite(assignment.id)}
              >
                <MailPlus className='mr-1 h-3 w-3' />
                {isSendingInvite ? 'Sending…' : 'Send Invitation'}
              </Button>
            )}
            {status === 'invited' && !canSelfRegister && (
              <Button
                size='sm'
                variant='outline'
                disabled={isResendingInvite}
                onClick={() => onResendInvite(assignment.id)}
              >
                <Mail className='mr-1 h-3 w-3' />
                {isResendingInvite ? 'Sending…' : 'Resend Invitation'}
              </Button>
            )}
            {status === 'invited' && canSelfRegister && onSelfRegister && (
              <Button
                size='sm'
                variant='default'
                onClick={() =>
                  onSelfRegister(ticket.id, ticket.ticket_number, assignment.id)
                }
              >
                Complete Registration
              </Button>
            )}
            {(status === 'assigned' || status === 'invited') && (
              <Button
                size='sm'
                variant='destructive'
                disabled={isCancellingAssignment}
                onClick={() => onCancelAssignment(assignment.id)}
              >
                <UserX className='mr-1 h-3 w-3' />
                {isCancellingAssignment ? 'Revoking…' : 'Revoke Ticket'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
