/**
 * InviteGuestDialog Component
 *
 * Dialog for inviting a new guest to an event by admin.
 * Creates a guest record and sends them an invitation email.
 * Optionally includes tickets (paid or comped).
 */
import { useEffect, useState } from 'react'
import { Loader2, Ticket, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  getEventTicketPackages,
  inviteGuestToEvent,
} from '@/lib/api/admin-attendees'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TicketPackage {
  id: string
  name: string
  price: number
  seats_per_package: number
  quantity_limit: number | null
  is_sold_out: boolean
}

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

  // Ticket fields
  const [includeTickets, setIncludeTickets] = useState(false)
  const [ticketPackages, setTicketPackages] = useState<TicketPackage[]>([])
  const [ticketPackageId, setTicketPackageId] = useState<string>('')
  const [ticketQuantity, setTicketQuantity] = useState(1)
  const [isComped, setIsComped] = useState(false)
  const [loadingPackages, setLoadingPackages] = useState(false)

  useEffect(() => {
    if (open && includeTickets && ticketPackages.length === 0) {
      setLoadingPackages(true)
      getEventTicketPackages(eventId)
        .then((pkgs) => setTicketPackages(pkgs.filter((p) => !p.is_sold_out)))
        .catch(() => toast.error('Failed to load ticket packages'))
        .finally(() => setLoadingPackages(false))
    }
  }, [open, includeTickets, eventId, ticketPackages.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Name and email are required')
      return
    }

    if (includeTickets && !ticketPackageId) {
      toast.error('Please select a ticket package')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await inviteGuestToEvent(eventId, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        custom_message: formData.custom_message.trim() || undefined,
        ...(includeTickets && {
          ticket_package_id: ticketPackageId,
          ticket_quantity: ticketQuantity,
          is_comped: isComped,
        }),
      })

      if (result.email_sent) {
        toast.success(result.message || 'Invitation sent successfully!')
      } else {
        toast.warning(
          result.message ||
            'Guest created but email failed to send. Please try sending again.'
        )
      }

      resetForm()
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

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', custom_message: '' })
    setIncludeTickets(false)
    setTicketPackageId('')
    setTicketQuantity(1)
    setIsComped(false)
    setTicketPackages([])
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      setOpen(newOpen)
      if (!newOpen) resetForm()
    }
  }

  const selectedPackage = ticketPackages.find((p) => p.id === ticketPackageId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size='sm' className='shrink-0'>
          <UserPlus className='mr-2 h-4 w-4' />
          Invite Guest
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[460px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite New Guest</DialogTitle>
            <DialogDescription>
              Send an event invitation to a new guest. They'll receive an email
              with event details and a link to complete their account.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            {/* Contact fields */}
            <div className='grid gap-2'>
              <Label htmlFor='name'>
                Name <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='name'
                placeholder='John Doe'
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='email'>
                Email <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='email'
                type='email'
                placeholder='john@example.com'
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={isSubmitting}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='phone'>Cell Number (optional)</Label>
              <Input
                id='phone'
                type='tel'
                placeholder='(555) 123-4567'
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='custom_message'>
                Personal Message (optional)
              </Label>
              <textarea
                id='custom_message'
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                placeholder='Add a personal message to include in the invitation email...'
                value={formData.custom_message}
                onChange={(e) =>
                  setFormData({ ...formData, custom_message: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>

            {/* Ticket section */}
            <div className='border-t pt-3'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='include_tickets'
                  checked={includeTickets}
                  onCheckedChange={(v) => setIncludeTickets(!!v)}
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor='include_tickets'
                  className='flex cursor-pointer items-center gap-1.5'
                >
                  <Ticket className='h-4 w-4' />
                  Include tickets with this invitation
                </Label>
              </div>

              {includeTickets && (
                <div className='mt-3 grid gap-3'>
                  <div className='grid gap-2'>
                    <Label htmlFor='ticket_package'>Ticket Package</Label>
                    {loadingPackages ? (
                      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Loading packages…
                      </div>
                    ) : (
                      <Select
                        value={ticketPackageId}
                        onValueChange={setTicketPackageId}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger id='ticket_package'>
                          <SelectValue placeholder='Select a package' />
                        </SelectTrigger>
                        <SelectContent>
                          {ticketPackages.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.name} — ${pkg.price.toFixed(2)}
                              {pkg.seats_per_package > 1
                                ? ` (${pkg.seats_per_package} seats)`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='ticket_quantity'>Quantity</Label>
                    <Input
                      id='ticket_quantity'
                      type='number'
                      min={1}
                      max={20}
                      value={ticketQuantity}
                      onChange={(e) =>
                        setTicketQuantity(
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      disabled={isSubmitting}
                    />
                    {selectedPackage && selectedPackage.seats_per_package > 1 && (
                      <p className='text-muted-foreground text-xs'>
                        {ticketQuantity * selectedPackage.seats_per_package}{' '}
                        total seats
                      </p>
                    )}
                  </div>

                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='is_comped'
                      checked={isComped}
                      onCheckedChange={(v) => setIsComped(!!v)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor='is_comped' className='cursor-pointer'>
                      Complimentary (free) tickets
                    </Label>
                  </div>
                  {isComped && (
                    <p className='text-muted-foreground text-xs'>
                      Tickets will be issued immediately at no charge. The guest
                      will be taken to ticket management after completing their
                      account.
                    </p>
                  )}
                  {!isComped && ticketPackageId && (
                    <p className='text-muted-foreground text-xs'>
                      The guest will be taken to the ticket purchase page after
                      completing their account.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Sending…
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
