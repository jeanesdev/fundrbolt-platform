import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateAttendeeDetails } from '@/lib/api/admin-attendees'
import { getErrorMessage } from '@/lib/error-utils'
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

interface EditAttendeeDialogProps {
  eventId: string
  attendee: {
    id: string
    name: string
    email: string
    phone: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditComplete?: () => void
}

export function EditAttendeeDialog({
  eventId,
  attendee,
  open,
  onOpenChange,
  onEditComplete,
}: EditAttendeeDialogProps) {
  const [name, setName] = useState(attendee.name || '')
  const [email, setEmail] = useState(attendee.email || '')
  const [phone, setPhone] = useState(attendee.phone || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(attendee.name || '')
      setEmail(attendee.email || '')
      setPhone(attendee.phone || '')
    }
  }, [open, attendee])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await updateAttendeeDetails(eventId, attendee.id, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      toast.success(`Updated ${name.trim()} successfully`)
      onOpenChange(false)
      onEditComplete?.()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update attendee'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit Attendee</DialogTitle>
          <DialogDescription>
            Update contact details for {attendee.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='edit-name'>Name</Label>
            <Input
              id='edit-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Full name'
              required
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='edit-email'>Email</Label>
            <Input
              id='edit-email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Email address'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='edit-phone'>Phone</Label>
            <Input
              id='edit-phone'
              type='tel'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='Phone number'
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
