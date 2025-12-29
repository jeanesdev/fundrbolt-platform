/**
 * InviteGuestDialog Component
 *
 * Dialog for inviting a new guest to an event by admin.
 * Creates a guest record and sends them an invitation email.
 */

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inviteGuestToEvent } from '@/lib/api/admin-attendees'
import { Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface InviteGuestDialogProps {
  eventId: string
  onGuestInvited?: () => void
}

interface GuestFormData {
  name: string
  email: string
  phone: string
  custom_message: string
}

export function InviteGuestDialog({
  eventId,
  onGuestInvited,
}: InviteGuestDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<GuestFormData>({
    name: '',
    email: '',
    phone: '',
    custom_message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await inviteGuestToEvent(eventId, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        custom_message: formData.custom_message.trim() || undefined,
      })

      if (result.email_sent) {
        toast.success(result.message || 'Invitation sent successfully!')
      } else {
        toast.warning(
          result.message ||
          'Guest created but email failed to send. Please try sending again.'
        )
      }

      // Reset form and close dialog
      setFormData({ name: '', email: '', phone: '', custom_message: '' })
      setOpen(false)

      if (onGuestInvited) {
        onGuestInvited()
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send invitation'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      setOpen(newOpen)
      if (!newOpen) {
        // Reset form when closing
        setFormData({ name: '', email: '', phone: '', custom_message: '' })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Guest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite New Guest</DialogTitle>
            <DialogDescription>
              Send an event invitation to a new guest. They'll receive an email
              with event details and registration link.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom_message">Personal Message (optional)</Label>
              <textarea
                id="custom_message"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Add a personal message to include in the invitation email..."
                value={formData.custom_message}
                onChange={(e) =>
                  setFormData({ ...formData, custom_message: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
