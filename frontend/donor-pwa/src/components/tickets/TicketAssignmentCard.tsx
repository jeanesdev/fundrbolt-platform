/**
 * TicketAssignmentCard — shows an assigned ticket with status and actions.
 */
import { CheckCircle, Mail, MailPlus, Ticket, UserX } from 'lucide-react'
import type { TicketDetail } from '@/lib/api/ticket-purchases'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface TicketAssignmentCardProps {
  ticket: TicketDetail
  onSendInvite: (assignmentId: string) => void
  onCancelAssignment: (assignmentId: string) => void
  onResendInvite: (assignmentId: string) => void
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
}: TicketAssignmentCardProps) {
  const { assignment } = ticket
  const status = ticket.assignment_status

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

          {assignment && (
            <div className='text-muted-foreground text-sm'>
              <span>{assignment.guest_name}</span>
              <span className='mx-1'>·</span>
              <span>{assignment.guest_email}</span>
            </div>
          )}
        </div>

        {assignment && status !== 'registered' && (
          <div className='flex gap-2'>
            {status === 'assigned' && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => onSendInvite(assignment.id)}
              >
                <MailPlus className='mr-1 h-3 w-3' />
                Send Invite
              </Button>
            )}
            {status === 'invited' && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => onResendInvite(assignment.id)}
              >
                <Mail className='mr-1 h-3 w-3' />
                Resend
              </Button>
            )}
            <Button
              size='sm'
              variant='ghost'
              className='text-destructive'
              onClick={() => onCancelAssignment(assignment.id)}
            >
              <UserX className='mr-1 h-3 w-3' />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
