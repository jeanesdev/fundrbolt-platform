/**
 * TicketAssignmentForm — form for assigning a ticket to a guest.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { assignTicket } from '@/lib/api/ticket-assignments'
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
    mutationFn: () => assignTicket(ticketId, name.trim(), email.trim()),
    onSuccess: () => {
      toast.success('Ticket assigned successfully')
      onAssigned()
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Failed to assign ticket'
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
            'Assign Ticket'
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
