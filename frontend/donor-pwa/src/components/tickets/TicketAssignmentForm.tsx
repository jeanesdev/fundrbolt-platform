/**
 * TicketAssignmentForm — form for assigning a ticket to a guest.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { assignTicket } from '@/lib/api/ticket-assignments'
import { sendInvitation } from '@/lib/api/ticket-invitations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TicketAssignmentFormProps {
  ticketId: string
  onAssigned: () => void
  onCancel: () => void
  isSelfAssignment?: boolean
  defaultName?: string
  defaultEmail?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function TicketAssignmentForm({
  ticketId,
  onAssigned,
  onCancel,
  isSelfAssignment = false,
  defaultName = '',
  defaultEmail = '',
}: TicketAssignmentFormProps) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)

  const assignMutation = useMutation({
    mutationFn: async () => {
      const assignment = await assignTicket(ticketId, name.trim(), email.trim())

      if (isSelfAssignment) {
        return {
          assignment,
          invitationSent: false,
          inviteErrorMessage: null,
        }
      }

      try {
        await sendInvitation(assignment.id)
        return {
          assignment,
          invitationSent: true,
          inviteErrorMessage: null,
        }
      } catch (error) {
        return {
          assignment,
          invitationSent: false,
          inviteErrorMessage: getErrorMessage(
            error,
            'Invitation could not be sent automatically'
          ),
        }
      }
    },
    onSuccess: ({ invitationSent, inviteErrorMessage }) => {
      if (isSelfAssignment) {
        toast.success('Ticket assigned successfully')
      } else if (invitationSent) {
        toast.success('Guest assigned and invitation sent')
      } else {
        toast.error(
          inviteErrorMessage ?? 'Guest assigned, but invitation failed to send'
        )
      }

      onAssigned()
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(
        err,
        isSelfAssignment ? 'Failed to assign ticket' : 'Failed to assign guest'
      )
      toast.error(message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    assignMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='guest-name'>Guest Name</Label>
        <Input
          id='guest-name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Enter guest name'
          required
          disabled={isSelfAssignment}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='guest-email'>Guest Email</Label>
        <Input
          id='guest-email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='Enter guest email'
          required
          disabled={isSelfAssignment}
        />
      </div>

      <div className='flex gap-2'>
        <Button
          type='submit'
          disabled={assignMutation.isPending || !name.trim() || !email.trim()}
          className='flex-1'
        >
          {assignMutation.isPending ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Assigning…
            </>
          ) : isSelfAssignment ? (
            'Assign to Me'
          ) : (
            'Assign Guest & Send Invitation'
          )}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={onCancel}
          disabled={assignMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
