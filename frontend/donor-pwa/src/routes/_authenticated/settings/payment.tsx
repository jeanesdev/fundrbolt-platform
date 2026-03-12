/**
 * Settings → Payment Methods page.
 *
 * T031 — Phase 4.
 *
 * Allows a donor to:
 *   - View their saved cards for their current NPO
 *   - Add a new card via the HPF iframe
 *   - Delete a card
 *   - Set a card as default
 */

import { createFileRoute } from '@tanstack/react-router'
import { CreditCard, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { HpfIframe } from '@/components/payments/HpfIframe'
import { SavedCardList } from '@/components/payments/SavedCardList'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createPaymentProfile,
  createPaymentSession,
  listPaymentProfiles,
} from '@/lib/api/payments'
import { useAuthStore } from '@/stores/auth-store'
import { useEventStore } from '@/stores/event-store'
import type { HpfCompletePayload, PaymentProfile } from '@/types/payment'

// ── Component ─────────────────────────────────────────────────────────────────

function SettingsPayment() {
  const user = useAuthStore((s) => s.user)
  const currentEvent = useEventStore((s) => s.currentEvent)
  // Donors don't have a fixed npo_id — derive it from the current event instead
  const npoId = user?.npo_id ?? currentEvent?.npo_id ?? null

  const [profiles, setProfiles] = useState<PaymentProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [hpfUrl, setHpfUrl] = useState<string | null>(null)
  const [hpfLoading, setHpfLoading] = useState(false)
  const [hpfError, setHpfError] = useState<string | null>(null)
  const [savingCard, setSavingCard] = useState(false)

  // Load profiles on mount
  useEffect(() => {
    if (!npoId) {
      setIsLoading(false)
      return
    }
    listPaymentProfiles(npoId)
      .then(setProfiles)
      .catch(() => setLoadError('Failed to load saved cards.'))
      .finally(() => setIsLoading(false))
  }, [npoId])

  // Open the "Add card" dialog and request an HPF session
  async function handleAddCard() {
    if (!npoId) return
    setHpfError(null)
    setHpfUrl(null)
    setAddOpen(true)
    setHpfLoading(true)
    try {
      const session = await createPaymentSession({
        event_id: null,
        npo_id: npoId,
        line_items: [{ type: 'card_setup', label: 'Save card on file', amount: 0 }],
        save_profile: true,
        return_url: window.location.href,
        idempotency_key: crypto.randomUUID(),
      })
      setHpfUrl(session.hpf_url)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to open payment form. Please try again.'
      setHpfError(msg)
    } finally {
      setHpfLoading(false)
    }
  }

  // Handle HPF completion message
  async function handleHpfComplete(payload: HpfCompletePayload) {
    if (payload.status !== 'approved' || !payload.gatewayProfileId || !npoId) {
      setHpfError(
        payload.declineReason ?? 'Payment was declined. Please try a different card.',
      )
      return
    }

    setSavingCard(true)
    try {
      const newProfile = await createPaymentProfile({
        npo_id: npoId,
        gateway_profile_id: payload.gatewayProfileId,
        card_last4: payload.cardLast4 ?? '????',
        card_brand: payload.cardBrand ?? 'Card',
        card_expiry_month: payload.cardExpiryMonth ?? 12,
        card_expiry_year: payload.cardExpiryYear ?? 2099,
        is_default: profiles.length === 0,
      })
      setProfiles((prev) => [...prev, newProfile])
      setAddOpen(false)
      setHpfUrl(null)
    } catch {
      setHpfError('Card was approved but could not be saved. Please try again.')
    } finally {
      setSavingCard(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!npoId) {
    return (
      <div className='w-full max-w-2xl'>
        <Alert>
          <CreditCard className='h-4 w-4' />
          <AlertDescription>
            Payment methods are linked to your organisation. Please contact support if you
            believe this is an error.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className='w-full max-w-2xl space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>Payment Methods</h3>
        <p className='text-sm text-muted-foreground'>
          Manage your saved cards for faster checkout at events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CreditCard className='h-5 w-5' />
            Saved Cards
          </CardTitle>
          <CardDescription>
            Cards are securely stored by our payment partner. We never see your full card
            number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Loading saved cards…
            </div>
          ) : loadError ? (
            <Alert variant='destructive'>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : (
            <SavedCardList
              npoId={npoId}
              initialProfiles={profiles}
              onAddCard={handleAddCard}
              onProfilesChange={setProfiles}
            />
          )}
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!savingCard) setAddOpen(v) }}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Add a Card</DialogTitle>
            <DialogDescription>
              Enter your card details in the secure form below. Your card information is
              handled directly by our payment partner.
            </DialogDescription>
          </DialogHeader>

          {hpfLoading && (
            <div className='flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Preparing secure form…
            </div>
          )}

          {hpfError && (
            <Alert variant='destructive'>
              <AlertDescription>{hpfError}</AlertDescription>
            </Alert>
          )}

          {savingCard && (
            <div className='flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Saving card…
            </div>
          )}

          {hpfUrl && !savingCard && (
            <HpfIframe
              hpfUrl={hpfUrl}
              onComplete={handleHpfComplete}
              onError={(err) => setHpfError(err)}
            />
          )}

          {hpfError && (
            <div className='flex justify-end'>
              <Button variant='outline' size='sm' onClick={handleAddCard}>
                Try again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/payment')({
  component: SettingsPayment,
})
