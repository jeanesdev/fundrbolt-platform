import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  createQuickSale,
  type QuickSaleGuestInfo,
  type QuickSaleRequest,
} from '@/lib/api/quick-sale'
import apiClient from '@/lib/axios'
import { getErrorMessage } from '@/lib/error-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Mail, Phone, Ticket, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface TicketPackage {
  id: string
  name: string
  price: number
  quantity_limit: number | null
  available_quantity: number | null
  is_enabled: boolean
}

interface QuickSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
}

export function QuickSaleDialog({
  open,
  onOpenChange,
  eventId,
}: QuickSaleDialogProps) {
  const queryClient = useQueryClient()
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [checkInImmediately, setCheckInImmediately] = useState(true)
  const [notes, setNotes] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [guests, setGuests] = useState<QuickSaleGuestInfo[]>([])
  const [firstAttendeeManuallyEdited, setFirstAttendeeManuallyEdited] =
    useState(false)

  // Fetch available ticket packages (prefetch in background for instant loading)
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['ticket-packages', eventId],
    queryFn: async () => {
      const response = await apiClient.get<TicketPackage[]>(
        `/admin/events/${eventId}/packages`
      )
      return response.data
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  })

  const packages = packagesData?.filter((pkg) => pkg.is_enabled) ?? []
  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPackageId('')
      setBuyerName('')
      setBuyerEmail('')
      setBuyerPhone('')
      setPaymentMethod('cash')
      setCheckInImmediately(true)
      setNotes('')
      setQuantity(1)
      setGuests([])
      setFirstAttendeeManuallyEdited(false)
    }
  }, [open])

  // Quick sale mutation
  const quickSaleMutation = useMutation({
    mutationFn: async (payload: QuickSaleRequest) => {
      console.log('Quick sale payload:', payload)
      return createQuickSale(eventId, payload)
    },
    onSuccess: (response) => {
      console.log('Quick sale success:', response)
      toast.success(
        `Ticket sale complete! Confirmation code: ${response.confirmation_code}`
      )
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
      onOpenChange(false)
    },
    onError: (error) => {
      console.error('Quick sale error:', error)
      toast.error(getErrorMessage(error, 'Failed to complete ticket sale'))
    },
  })

  // Auto-adjust guest fields when quantity changes
  useEffect(() => {
    setGuests((prev) => {
      if (prev.length === quantity) return prev
      if (prev.length < quantity) {
        // Add more guests
        return [
          ...prev,
          ...Array(quantity - prev.length).fill({
            name: '',
            email: null,
            phone: null,
          }),
        ]
      } else {
        // Remove extra guests
        return prev.slice(0, quantity)
      }
    })
  }, [quantity])

  // Auto-copy buyer info to first attendee unless manually edited
  useEffect(() => {
    if (guests.length > 0 && !firstAttendeeManuallyEdited) {
      setGuests((prev) => [
        {
          name: buyerName,
          email: buyerEmail || null,
          phone: buyerPhone || null,
        },
        ...prev.slice(1),
      ])
    }
  }, [buyerName, buyerEmail, buyerPhone, firstAttendeeManuallyEdited])

  const copyBuyerToFirstAttendee = () => {
    if (guests.length > 0) {
      setGuests((prev) => [
        {
          name: buyerName,
          email: buyerEmail || null,
          phone: buyerPhone || null,
        },
        ...prev.slice(1),
      ])
      toast.success('Buyer info copied to first attendee')
    }
  }

  const updateGuest = (
    index: number,
    field: keyof QuickSaleGuestInfo,
    value: string
  ) => {
    // Mark first attendee as manually edited if user changes it
    if (index === 0) {
      setFirstAttendeeManuallyEdited(true)
    }
    
    setGuests((prev) =>
      prev.map((guest, i) =>
        i === index
          ? { ...guest, [field]: value === '' ? null : value }
          : guest
      )
    )
  }

  const formatPhoneInput = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10)
    if (!digitsOnly) return ''
    if (digitsOnly.length < 4) return digitsOnly
    if (digitsOnly.length < 7) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`
    }
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
  }

  const handleSubmit = () => {
    // Validation
    if (!selectedPackageId) {
      toast.error('Please select a ticket package')
      return
    }
    if (!buyerName.trim()) {
      toast.error('Please enter buyer name')
      return
    }
    if (!buyerEmail.trim()) {
      toast.error('Please enter buyer email')
      return
    }
    if (quantity < 1) {
      toast.error('Quantity must be at least 1')
      return
    }

    // Validate all attendee names
    const emptyGuestIndex = guests.findIndex(
      (guest) => !guest.name || !guest.name.trim()
    )
    if (emptyGuestIndex !== -1) {
      toast.error(`Please enter name for Attendee ${emptyGuestIndex + 1}`)
      return
    }

    // Trim guest values
    const trimmedGuests = guests.map((guest) => ({
      name: guest.name.trim(),
      email: guest.email?.trim() || null,
      phone: guest.phone?.trim() || null,
    }))

    const payload: QuickSaleRequest = {
      ticket_package_id: selectedPackageId,
      quantity: quantity,
      buyer_name: buyerName.trim(),
      buyer_email: buyerEmail.trim(),
      buyer_phone: buyerPhone.trim() || null,
      guests: trimmedGuests,
      payment_method: paymentMethod,
      check_in_immediately: checkInImmediately,
      notes: notes.trim() || null,
    }

    console.log('Submitting quick sale:', payload)
    quickSaleMutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Ticket className='h-5 w-5' />
            Quick Ticket Sale
          </DialogTitle>
          <DialogDescription>
            Quickly sell tickets and register attendees at check-in.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Ticket Package Selection */}
          <div className='space-y-2'>
            <Label htmlFor='package-select'>Ticket Package *</Label>
            {packagesLoading ? (
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading packages...
              </div>
            ) : packages.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                No active ticket packages available
              </p>
            ) : (
              <Select
                value={selectedPackageId}
                onValueChange={setSelectedPackageId}
              >
                <SelectTrigger id='package-select'>
                  <SelectValue placeholder='Select a ticket package' />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      <div className='flex items-center justify-between gap-2'>
                        <span>{pkg.name}</span>
                        <span className='text-muted-foreground'>
                          ${pkg.price.toFixed(2)}
                        </span>
                        {pkg.available_quantity !== null && (
                          <Badge variant='secondary' className='ml-2'>
                            {pkg.available_quantity} left
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quantity Selector */}
          <div className='space-y-2'>
            <Label htmlFor='quantity'>Number of Tickets *</Label>
            <Select
              value={quantity.toString()}
              onValueChange={(value) => setQuantity(parseInt(value, 10))}
            >
              <SelectTrigger id='quantity'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? 'Ticket' : 'Tickets'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Buyer Information */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h4 className='text-sm font-semibold'>Buyer Information</h4>
              <p className='text-xs text-muted-foreground'>
                (Billing contact - may or may not be attending)
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='buyer-name'>Full Name *</Label>
              <div className='relative'>
                <User className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='buyer-name'
                  placeholder='John Doe'
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className='pl-9'
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='buyer-email'>Email *</Label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='buyer-email'
                  type='email'
                  placeholder='john@example.com'
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className='pl-9'
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='buyer-phone'>Phone</Label>
              <div className='relative'>
                <Phone className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  id='buyer-phone'
                  placeholder='(555) 123-4567'
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(formatPhoneInput(e.target.value))}
                  className='pl-9'
                />
              </div>
            </div>
          </div>

          {/* Attendees */}
          <Separator />
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h4 className='text-sm font-semibold'>Attendees ({quantity})</h4>
              {quantity > 0 && buyerName && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={copyBuyerToFirstAttendee}
                >
                  <User className='mr-1 h-3 w-3' />
                  Copy Buyer to Attendee 1
                </Button>
              )}
            </div>
            <div className='space-y-3'>
              {guests.map((guest, index) => (
                <div key={index} className='rounded-lg border p-3 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>
                      Attendee {index + 1}
                    </span>
                  </div>
                      <Input
                        placeholder='Full Name *'
                        value={guest.name}
                        onChange={(e) =>
                          updateGuest(index, 'name', e.target.value)
                        }
                      />
                      <Input
                        placeholder='Email (optional)'
                        type='email'
                        value={guest.email ?? ''}
                        onChange={(e) =>
                          updateGuest(index, 'email', e.target.value)
                        }
                      />
                      <Input
                        placeholder='Phone (optional)'
                        value={guest.phone ?? ''}
                        onChange={(e) =>
                          updateGuest(
                            index,
                            'phone',
                            formatPhoneInput(e.target.value)
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

          <Separator />

          {/* Payment & Options */}
          <div className='space-y-3'>
            <div className='space-y-2'>
              <Label htmlFor='payment-method'>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id='payment-method'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='cash'>Cash</SelectItem>
                  <SelectItem value='check'>Check</SelectItem>
                  <SelectItem value='credit_card'>Credit Card</SelectItem>
                  <SelectItem value='other'>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='flex items-center gap-2'>
              <Checkbox
                id='check-in-immediately'
                checked={checkInImmediately}
                onCheckedChange={(checked) =>
                  setCheckInImmediately(checked === true)
                }
              />
              <Label
                htmlFor='check-in-immediately'
                className='text-sm font-normal cursor-pointer'
              >
                Check in attendees immediately
              </Label>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='notes'>Notes (optional)</Label>
              <Input
                id='notes'
                placeholder='Any additional notes...'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Summary */}
          {selectedPackage && quantity > 0 && (
            <div className='rounded-lg bg-muted p-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='font-medium'>Total:</span>
                <span className='font-bold'>
                  ${(selectedPackage.price * quantity).toFixed(2)}
                </span>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>
                {quantity} × {selectedPackage.name} @ $
                {selectedPackage.price.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={quickSaleMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              quickSaleMutation.isPending ||
              !selectedPackageId ||
              !buyerName.trim() ||
              !buyerEmail.trim() ||
              guests.some((g) => !g.name || !g.name.trim())
            }
          >
            {quickSaleMutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Processing...
              </>
            ) : (
              'Complete Sale'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
