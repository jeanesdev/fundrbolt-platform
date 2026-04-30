import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { checkinService } from '@/services/checkin-service'
import { Check, CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Attendee } from '@/lib/api/admin-attendees'
import {
  adminCreatePaymentProfile,
  adminCreatePaymentSession,
} from '@/lib/api/admin-payments'
import {
  assignBidderNumber,
  assignRegistrationBidderNumber,
} from '@/lib/api/admin-seating'
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
import { Separator } from '@/components/ui/separator'
import { InlineDonorLabels } from '@/components/admin/InlineDonorLabels'
import { getUser, updateUser } from '@/features/users/api/users-api'

function formatPhoneInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 10)
  if (!digitsOnly) return ''
  if (digitsOnly.length < 4) return digitsOnly
  if (digitsOnly.length < 7) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`
  }
  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
}

type EditFormState = {
  name: string
  email: string
  phone: string
  bidderNumber: string
  replacementEmail: string
  organizationName: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
}

const defaultEditForm: EditFormState = {
  name: '',
  email: '',
  phone: '',
  bidderNumber: '',
  replacementEmail: '',
  organizationName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
}

interface EditAttendeeDialogProps {
  eventId: string
  npoId?: string | null
  attendee: Attendee
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditComplete?: () => void
}

export function EditAttendeeDialog({
  eventId,
  npoId,
  attendee,
  open,
  onOpenChange,
  onEditComplete,
}: EditAttendeeDialogProps) {
  const queryClient = useQueryClient()
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditForm)
  const [addCardLoading, setAddCardLoading] = useState(false)
  const [addCardHpfUrl, setAddCardHpfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEditForm({
      name: attendee.name ?? '',
      email: attendee.email ?? '',
      phone: formatPhoneInput(attendee.phone ?? ''),
      bidderNumber:
        attendee.bidder_number == null ? '' : String(attendee.bidder_number),
      replacementEmail: '',
      organizationName: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    })
    if (attendee.user_id) {
      getUser(attendee.user_id)
        .then((user) => {
          setEditForm((prev) => ({
            ...prev,
            organizationName: user.organization_name ?? '',
            addressLine1: user.address_line1 ?? '',
            addressLine2: user.address_line2 ?? '',
            city: user.city ?? '',
            state: user.state ?? '',
            postalCode: user.postal_code ?? '',
            country: user.country ?? '',
          }))
        })
        .catch(() => {
          // User details not available, fields stay empty
        })
    }
  }, [open, attendee])

  const closeDialog = () => {
    onOpenChange(false)
    setEditForm(defaultEditForm)
  }

  const saveAttendeeMutation = useMutation({
    mutationFn: async () => {
      if (attendee.attendee_type === 'registrant') {
        const trimmedName = editForm.name.trim()
        const nameParts = trimmedName.split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] ?? ''
        const lastName = nameParts.slice(1).join(' ') || nameParts[0] || ''

        if (!firstName) {
          throw new Error('Name is required')
        }

        await checkinService.updateRegistrationDetails(
          eventId,
          attendee.registration_id,
          {
            first_name: firstName,
            last_name: lastName,
            email: editForm.email.trim() || undefined,
            phone: editForm.phone.trim() || undefined,
          }
        )
      } else {
        await checkinService.updateGuestDetails(eventId, attendee.id, {
          name: editForm.name.trim() || undefined,
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
        })
      }

      const nextBidderValue = editForm.bidderNumber.trim()
      if (nextBidderValue) {
        const bidderNumber = Number.parseInt(nextBidderValue, 10)
        if (
          Number.isNaN(bidderNumber) ||
          bidderNumber < 100 ||
          bidderNumber > 999
        ) {
          throw new Error('Bidder number must be between 100 and 999')
        }

        if (bidderNumber !== (attendee.bidder_number ?? null)) {
          if (attendee.attendee_type === 'registrant') {
            await assignRegistrationBidderNumber(
              eventId,
              attendee.registration_id,
              bidderNumber
            )
          } else {
            await assignBidderNumber(eventId, attendee.id, bidderNumber)
          }
        }
      }

      if (attendee.user_id) {
        await updateUser(attendee.user_id, {
          organization_name: editForm.organizationName.trim() || undefined,
          address_line1: editForm.addressLine1.trim() || undefined,
          address_line2: editForm.addressLine2.trim() || undefined,
          city: editForm.city.trim() || undefined,
          state: editForm.state.trim() || undefined,
          postal_code: editForm.postalCode.trim() || undefined,
          country: editForm.country.trim() || undefined,
        })
      }
    },
    onSuccess: () => {
      toast.success('Attendee saved')
      queryClient.invalidateQueries({
        queryKey: ['event-attendees', eventId],
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onEditComplete?.()
      closeDialog()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to save attendee'))
    },
  })

  const replaceGuestMutation = useMutation({
    mutationFn: async () => {
      if (attendee.attendee_type !== 'guest') return
      const email = editForm.replacementEmail.trim().toLowerCase()
      if (!email) throw new Error('Replacement email is required')
      await checkinService.replaceGuestUser(eventId, attendee.id, email)
    },
    onSuccess: () => {
      toast.success('Guest ticket replaced with user')
      queryClient.invalidateQueries({
        queryKey: ['event-attendees', eventId],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to replace guest ticket'))
    },
  })

  const handleOpenAddCard = async () => {
    if (!attendee.user_id || !npoId) return
    setAddCardLoading(true)
    try {
      const response = await adminCreatePaymentSession(attendee.user_id, {
        event_id: eventId,
        npo_id: npoId,
        line_items: [],
        save_profile: true,
        return_url: window.location.href,
        idempotency_key: `admin-edit-${attendee.id}-${Date.now()}`,
      })
      setAddCardHpfUrl(response.hpf_url)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start card entry'))
    } finally {
      setAddCardLoading(false)
    }
  }

  useEffect(() => {
    if (!addCardHpfUrl || !attendee.user_id || !npoId) return
    const handleMessage = async (event: MessageEvent) => {
      if (
        !event.data ||
        event.data.source !== 'fundrbolt-hpf' ||
        event.data.type !== 'hpf_complete'
      ) {
        return
      }
      const payload = event.data
      if (payload.status !== 'approved' || !payload.gatewayProfileId) {
        toast.error('Card entry was not completed')
        setAddCardHpfUrl(null)
        return
      }
      try {
        await adminCreatePaymentProfile(attendee.user_id!, {
          npo_id: npoId,
          gateway_profile_id: payload.gatewayProfileId,
          card_last4: payload.cardLast4 ?? '',
          card_brand: payload.cardBrand ?? '',
          card_expiry_month: payload.cardExpiryMonth ?? 0,
          card_expiry_year: payload.cardExpiryYear ?? 0,
          is_default: true,
        })
        toast.success('Card saved successfully')
        queryClient.invalidateQueries({
          queryKey: ['event-attendees', eventId],
        })
        setAddCardHpfUrl(null)
        onOpenChange(false)
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to save card'))
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [
    addCardHpfUrl,
    attendee.user_id,
    npoId,
    eventId,
    queryClient,
    onOpenChange,
  ])

  const isPending =
    saveAttendeeMutation.isPending || replaceGuestMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Manage Attendee</DialogTitle>
          <DialogDescription>
            Update attendee details, labels, and address information.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Donor Labels */}
          {attendee.user_id && npoId && (
            <div className='space-y-2'>
              <Label>Labels</Label>
              <InlineDonorLabels
                labels={attendee.donor_labels}
                userId={attendee.user_id}
                npoId={npoId}
              />
            </div>
          )}

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='edit-name'>Name</Label>
              <Input
                id='edit-name'
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-email'>Email</Label>
              <Input
                id='edit-email'
                type='email'
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-phone'>Cell Number</Label>
              <Input
                id='edit-phone'
                inputMode='tel'
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    phone: formatPhoneInput(e.target.value),
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-bidder'>Bidder Number</Label>
              <Input
                id='edit-bidder'
                value={editForm.bidderNumber}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    bidderNumber: e.target.value,
                  }))
                }
                placeholder='100-999'
              />
            </div>
          </div>

          {/* Address & Company */}
          {attendee.user_id && (
            <>
              <Separator />
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='edit-org'>Company / Organization</Label>
                  <Input
                    id='edit-org'
                    value={editForm.organizationName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        organizationName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='edit-addr1'>Address Line 1</Label>
                  <Input
                    id='edit-addr1'
                    value={editForm.addressLine1}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        addressLine1: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='edit-addr2'>Address Line 2</Label>
                  <Input
                    id='edit-addr2'
                    value={editForm.addressLine2}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        addressLine2: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-city'>City</Label>
                  <Input
                    id='edit-city'
                    value={editForm.city}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-state'>State</Label>
                  <Input
                    id='edit-state'
                    value={editForm.state}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        state: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-zip'>Postal Code</Label>
                  <Input
                    id='edit-zip'
                    value={editForm.postalCode}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        postalCode: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-country'>Country</Label>
                  <Input
                    id='edit-country'
                    value={editForm.country}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* Replace Guest Ticket */}
          {attendee.attendee_type === 'guest' && (
            <div className='space-y-2 rounded-md border p-3'>
              <Label htmlFor='replace-guest-email'>
                Replace Guest Ticket with User Email
              </Label>
              <Input
                id='replace-guest-email'
                type='email'
                value={editForm.replacementEmail}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    replacementEmail: e.target.value,
                  }))
                }
                placeholder='user@example.com'
              />
              <Button
                type='button'
                variant='secondary'
                disabled={replaceGuestMutation.isPending}
                onClick={() => replaceGuestMutation.mutate()}
              >
                {replaceGuestMutation.isPending && (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                )}
                Replace Ticket
              </Button>
            </div>
          )}

          {/* Payment Method */}
          {attendee.user_id && npoId && (
            <div className='space-y-2 rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <CreditCard className='text-muted-foreground h-4 w-4' />
                  <span className='text-sm font-medium'>Payment Method</span>
                </div>
                {attendee.has_payment_profile ? (
                  <span className='flex items-center gap-1 text-sm text-green-600'>
                    <Check className='h-3 w-3' />
                    Card on file
                  </span>
                ) : (
                  <span className='text-muted-foreground text-sm'>
                    No payment method
                  </span>
                )}
              </div>
              {!attendee.has_payment_profile && (
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={addCardLoading}
                  onClick={handleOpenAddCard}
                >
                  {addCardLoading ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <CreditCard className='mr-2 h-4 w-4' />
                  )}
                  Add Card
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={closeDialog} disabled={isPending}>
            Close
          </Button>
          <Button
            type='button'
            disabled={isPending}
            onClick={() => saveAttendeeMutation.mutate()}
          >
            {saveAttendeeMutation.isPending && (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
