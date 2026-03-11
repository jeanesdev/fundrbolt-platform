/**
 * PaymentMethodSelector — T036 Phase 6 (US4)
 *
 * Displays the donor's saved cards for a given NPO as a radio group.
 * Includes an "Add a new card" option that opens the HPF iframe in a
 * Radix Dialog drawer.  The newly-saved profile is automatically selected
 * after the HPF completes.
 */

import { HpfIframe } from '@/components/payments/HpfIframe'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { createPaymentProfile, createPaymentSession, listPaymentProfiles } from '@/lib/api/payments'
import type { HpfCompletePayload, LineItem, PaymentProfile } from '@/types/payment'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Loader2, PlusCircle, Star } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export interface PaymentMethodSelectorProps {
  /** NPO whose vault is queried */
  npoId: string
  /** The currently selected profile ID (null = "add new card") */
  selectedProfileId: string | null
  /** Called when the selection changes */
  onSelect: (profileId: string | null) => void
  /** Line items used to create the HPF session when donor adds a new card */
  lineItems?: LineItem[]
  /** Total amount for the HPF session (used to show on stub form) */
  totalAmount?: number
  /** Return URL forwarded to the HPF session */
  returnUrl?: string
}

const RADIO_NEW_CARD = '__new_card__'

export function PaymentMethodSelector({
  npoId,
  selectedProfileId,
  onSelect,
  lineItems = [],
  totalAmount: _totalAmount = 0,
  returnUrl = window.location.href,
}: PaymentMethodSelectorProps) {
  const queryClient = useQueryClient()
  const [addCardOpen, setAddCardOpen] = useState(false)
  const [hpfUrl, setHpfUrl] = useState<string | null>(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [, setPendingTransactionId] = useState<string | null>(null)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['payment-profiles', npoId],
    queryFn: () => listPaymentProfiles(npoId),
    enabled: !!npoId,
  })

  // Open HPF drawer for "Add a new card"
  async function handleAddCard() {
    setIsCreatingSession(true)
    try {
      const items: LineItem[] =
        lineItems.length > 0
          ? lineItems
          : [{ type: 'ticket', label: 'Card setup', amount: 0 }]

      const session = await createPaymentSession({
        event_id: null,
        npo_id: npoId,
        line_items: items,
        save_profile: true,
        return_url: returnUrl,
        idempotency_key: crypto.randomUUID(),
      })
      setHpfUrl(session.hpf_url)
      setPendingTransactionId(session.transaction_id)
      setAddCardOpen(true)
    } catch {
      toast.error('Could not start payment form. Please try again.')
    } finally {
      setIsCreatingSession(false)
    }
  }

  // Called when HPF iframe fires postMessage (approved or declined)
  async function handleHpfComplete(payload: HpfCompletePayload) {
    if (payload.status !== 'approved') {
      toast.error('Card declined: ' + (payload.declineReason ?? 'Unknown reason'))
      setAddCardOpen(false)
      return
    }

    // Save the vault token as a PaymentProfile
    try {
      const newProfile = await createPaymentProfile({
        npo_id: npoId,
        gateway_profile_id: payload.gatewayProfileId ?? '',
        card_last4: payload.cardLast4 ?? '0000',
        card_brand: payload.cardBrand ?? 'Card',
        card_expiry_month: payload.cardExpiryMonth ?? 12,
        card_expiry_year: payload.cardExpiryYear ?? 2099,
        is_default: profiles.length === 0,
      })

      // Refresh profiles list
      await queryClient.invalidateQueries({ queryKey: ['payment-profiles', npoId] })
      toast.success('Card saved successfully.')
      onSelect(newProfile.id)
      setAddCardOpen(false)
    } catch {
      toast.error('Could not save card details. Please try again.')
    }
  }

  // Handle invalid radio selection
  function handleRadioChange(value: string) {
    if (value === RADIO_NEW_CARD) {
      void handleAddCard()
    } else {
      onSelect(value)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading saved cards…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <RadioGroup
        value={selectedProfileId ?? ''}
        onValueChange={handleRadioChange}
        className="space-y-2"
      >
        {profiles.map((profile: PaymentProfile) => (
          <ProfileRadioItem
            key={profile.id}
            profile={profile}
            selected={selectedProfileId === profile.id}
          />
        ))}
      </RadioGroup>

      {profiles.length > 0 && <Separator />}

      {/* Add new card button — shown as a pseudo-radio option */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => void handleAddCard()}
        disabled={isCreatingSession}
      >
        {isCreatingSession ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <PlusCircle className="w-4 h-4" />
        )}
        Add a new card
      </Button>

      {/* HPF Drawer */}
      <Dialog open={addCardOpen} onOpenChange={setAddCardOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a payment method</DialogTitle>
            <DialogDescription>
              Enter your card details in the secure payment form below.
            </DialogDescription>
          </DialogHeader>
          {hpfUrl && (
            <HpfIframe
              hpfUrl={hpfUrl}
              onComplete={(p) => void handleHpfComplete(p)}
              onError={(msg) => {
                toast.error(msg)
                setAddCardOpen(false)
              }}
              className="min-h-[320px]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Profile radio item ─────────────────────────────────────────────────────

function ProfileRadioItem({
  profile,
  selected,
}: {
  profile: PaymentProfile
  selected: boolean
}) {
  const now = new Date()
  const isExpired =
    profile.card_expiry_year < now.getFullYear() ||
    (profile.card_expiry_year === now.getFullYear() &&
      profile.card_expiry_month < now.getMonth() + 1)

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
        } ${isExpired ? 'opacity-50' : ''}`}
    >
      <RadioGroupItem value={profile.id} id={`profile-${profile.id}`} />
      <Label
        htmlFor={`profile-${profile.id}`}
        className="flex flex-1 items-center gap-2 cursor-pointer"
      >
        <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1">
          <span className="font-medium">{profile.card_brand}</span>{' '}
          <span className="text-muted-foreground">ending {profile.card_last4}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {String(profile.card_expiry_month).padStart(2, '0')}/{profile.card_expiry_year}
        </span>
        {profile.is_default && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Star className="w-3 h-3" />
            Default
          </Badge>
        )}
        {isExpired && (
          <Badge variant="destructive" className="text-xs">
            Expired
          </Badge>
        )}
      </Label>
    </div>
  )
}
