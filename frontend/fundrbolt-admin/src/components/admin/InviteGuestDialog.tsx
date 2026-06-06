/**
 * InviteGuestDialog Component
 *
 * Dialog for inviting a new guest to an event by admin.
 * Creates a guest record and generates an invite link.
 * Optionally sends the invitation via email.
 */
import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Mail, Ticket, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  getEventTicketPackages,
  inviteGuestToEvent,
  sendGuestInvitation,
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

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

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
  onClose?: () => void
}

interface GuestFormData {
  name: string
  email: string
  phone: string
  custom_message: string
}

type Step = 'form' | 'success'

export function InviteGuestDialog({
  eventId,
  onGuestInvited,
  onClose,
}: InviteGuestDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [createdGuestId, setCreatedGuestId] = useState('')
  const [createdGuestName, setCreatedGuestName] = useState('')
  const [createdGuestEmail, setCreatedGuestEmail] = useState('')
  const [copied, setCopied] = useState(false)

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

  const createGuest = async (sendEmail: boolean) => {
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
        send_email: sendEmail,
        ...(includeTickets && {
          ticket_package_id: ticketPackageId,
          ticket_quantity: ticketQuantity,
        }),
      })

      setCreatedGuestId(result.guest_id)
      setCreatedGuestName(result.name)
      setCreatedGuestEmail(result.email)
      setInviteLink(result.invite_link)
      setEmailSent(result.email_sent)
      setStep('success')

      if (onGuestInvited) {
        onGuestInvited()
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create invitation'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendEmail = async () => {
    if (!createdGuestId) return
    setIsSendingEmail(true)
    try {
      await sendGuestInvitation(createdGuestId)
      setEmailSent(true)
      toast.success(`Invitation email sent to ${createdGuestEmail}`)
    } catch {
      toast.error('Failed to send email. You can still share the link above.')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleCopyLink = () => {
    // Try navigator.clipboard first; fall back to execCommand
    const attemptCopy = () => {
      if (navigator.clipboard) {
        return navigator.clipboard.writeText(inviteLink)
      }
      return Promise.reject(new Error('clipboard unavailable'))
    }

    attemptCopy()
      .catch(() => {
        // execCommand fallback
        const el = document.createElement('textarea')
        el.value = inviteLink
        el.setAttribute('readonly', '')
        el.style.cssText =
          'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
        document.body.appendChild(el)
        el.focus()
        el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        if (!ok) throw new Error('execCommand copy failed')
      })
      .then(() => {
        setCopied(true)
        toast.success('Link copied to clipboard!')
        setTimeout(() => setCopied(false), 3000)
      })
      .catch(() => {
        toast.error(
          'Could not copy automatically — please select and copy the link manually.'
        )
      })
  }

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', custom_message: '' })
    setIncludeTickets(false)
    setTicketPackageId('')
    setTicketQuantity(1)
    setTicketPackages([])
    setStep('form')
    setInviteLink('')
    setCreatedGuestId('')
    setCreatedGuestName('')
    setCreatedGuestEmail('')
    setEmailSent(false)
    setCopied(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting && !isSendingEmail) {
      setOpen(newOpen)
      if (!newOpen) {
        const wasOnSuccessStep = step === 'success'
        resetForm()
        if (wasOnSuccessStep) {
          onClose?.()
        }
      }
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
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite New Guest</DialogTitle>
              <DialogDescription>
                Create an invite link for a new guest. You can copy the link to
                share however you'd like, or send it via email.
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
                    setFormData({
                      ...formData,
                      phone: formatPhone(e.target.value),
                    })
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
                    Include complimentary tickets
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
                      {selectedPackage &&
                        selectedPackage.seats_per_package > 1 && (
                          <p className='text-muted-foreground text-xs'>
                            {ticketQuantity * selectedPackage.seats_per_package}{' '}
                            total seats
                          </p>
                        )}
                    </div>

                    <p className='text-muted-foreground text-xs'>
                      Tickets will be issued as complimentary. The guest will be
                      taken to ticket management after completing their account.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className='flex-col gap-2 sm:flex-row'>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className='sm:mr-auto'
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => createGuest(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Copy className='mr-2 h-4 w-4' />
                )}
                Copy Link
              </Button>
              <Button
                type='button'
                onClick={() => createGuest(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Mail className='mr-2 h-4 w-4' />
                )}
                Send via Email
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invitation Created</DialogTitle>
              <DialogDescription>
                {createdGuestName} ({createdGuestEmail}) has been added.
                {emailSent && ' An invitation email has been sent.'}
              </DialogDescription>
            </DialogHeader>

            <div className='grid gap-4 py-4'>
              {/* Link row: full URL text + copy icon button */}
              <div className='grid gap-2'>
                <Label>Invite Link</Label>
                <div className='flex items-start gap-2'>
                  <p className='border-input bg-muted text-foreground min-h-[60px] w-full rounded-md border px-3 py-2 text-xs leading-relaxed break-all'>
                    {inviteLink}
                  </p>
                  <Button
                    type='button'
                    size='icon'
                    variant='outline'
                    onClick={handleCopyLink}
                    title='Copy link'
                    className='mt-0 shrink-0'
                  >
                    {copied ? (
                      <Check className='h-4 w-4 text-green-600' />
                    ) : (
                      <Copy className='h-4 w-4' />
                    )}
                  </Button>
                </div>
                {copied && (
                  <p className='text-xs text-green-600'>Link copied!</p>
                )}
              </div>

              {/* Send via Email */}
              {!emailSent ? (
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail className='mr-2 h-4 w-4' />
                      Send via Email
                    </>
                  )}
                </Button>
              ) : (
                <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                  <Check className='h-4 w-4 text-green-600' />
                  Invitation email sent to {createdGuestEmail}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type='button' onClick={() => handleOpenChange(false)}>
                OK
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
