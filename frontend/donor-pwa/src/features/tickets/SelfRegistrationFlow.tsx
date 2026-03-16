/**
 * SelfRegistrationFlow component — assigns a ticket to self and registers
 * the current user as an attendee. Multi-step inline flow.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { assignTicket, selfRegister } from '@/lib/api/ticket-assignments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SelfRegistrationFlowProps {
  ticketId: string
  ticketNumber: number | string
  userName: string
  userEmail: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SelfRegistrationFlow({
  ticketId,
  ticketNumber,
  userName,
  userEmail,
  open,
  onOpenChange,
  onSuccess,
}: SelfRegistrationFlowProps) {
  const queryClient = useQueryClient()
  const [phone, setPhone] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      // Step 1: assign ticket to self
      const assignment = await assignTicket(ticketId, userName, userEmail)
      // Step 2: self-register using the assignment id
      await selfRegister(assignment.id, {
        phone: phone.trim() || null,
      })
    },
    onSuccess: () => {
      toast.success('Registered successfully!')
      void queryClient.invalidateQueries({ queryKey: ['ticket-inventory'] })
      onOpenChange(false)
      setPhone('')
      onSuccess?.()
    },
    onError: () => {
      toast.error('Registration failed. Please try again.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <UserCheck className='h-5 w-5' />
            Register for Ticket #{ticketNumber}
          </DialogTitle>
          <DialogDescription>
            You are registering yourself as an attendee for this ticket.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='rounded-lg border p-3'>
            <p className='text-sm font-medium'>{userName}</p>
            <p className='text-muted-foreground text-sm'>{userEmail}</p>
            <Badge variant='secondary' className='mt-1 text-xs'>
              Your account
            </Badge>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='phone'>
              Phone number{' '}
              <span className='text-muted-foreground font-normal'>
                (optional)
              </span>
            </Label>
            <Input
              id='phone'
              type='tel'
              placeholder='+1 (555) 000-0000'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Registering…
              </>
            ) : (
              'Register Myself'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
