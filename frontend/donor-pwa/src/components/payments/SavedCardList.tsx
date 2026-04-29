/**
 * SavedCardList — displays a donor's saved payment cards for an NPO.
 *
 * T029 — Phase 4.
 *
 * Shows:
 * - Card brand, last4, expiry with default ⭐ badge
 * - Expiry warning for expired / soon-to-expire cards
 * - Delete button with a confirmation step (warns about outstanding balance)
 * - "Add card" callback button
 */
import { useState } from 'react'
import type { PaymentProfile } from '@/types/payment'
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  PlusCircle,
  Star,
  Trash2,
} from 'lucide-react'
import {
  deletePaymentProfile,
  setDefaultPaymentProfile,
} from '@/lib/api/payments'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(month: number, year: number): boolean {
  const now = new Date()
  const expiry = new Date(year, month - 1, 1) // first of expiry month
  return expiry < new Date(now.getFullYear(), now.getMonth(), 1)
}

function isExpiringSoon(month: number, year: number): boolean {
  const now = new Date()
  const expiry = new Date(year, month - 1, 1)
  const threeMonths = new Date(now.getFullYear(), now.getMonth() + 3, 1)
  return (
    expiry >= new Date(now.getFullYear(), now.getMonth(), 1) &&
    expiry <= threeMonths
  )
}

function cardBrandIcon(brand: string): string {
  const icons: Record<string, string> = {
    Visa: '💳',
    Mastercard: '💳',
    Amex: '💳',
    Discover: '💳',
  }
  return icons[brand] ?? '💳'
}

// ── Card row ──────────────────────────────────────────────────────────────────

interface CardRowProps {
  profile: PaymentProfile
  npoId: string
  onDeleted: (id: string, warning: string | null) => void
  onSetDefault: (id: string) => void
  isSettingDefault: boolean
}

function CardRow({
  profile,
  npoId,
  onDeleted,
  onSetDefault,
  isSettingDefault,
}: CardRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null)

  const expired = isExpired(profile.card_expiry_month, profile.card_expiry_year)
  const expiringSoon =
    !expired &&
    isExpiringSoon(profile.card_expiry_month, profile.card_expiry_year)

  async function handleDeleteConfirm() {
    setIsDeleting(true)
    try {
      const result = await deletePaymentProfile(profile.id, npoId)
      onDeleted(profile.id, result.warning)
    } catch {
      setDeleteWarning('Failed to remove card. Please try again.')
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Card className={`transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
      <CardContent className='flex items-start gap-3 p-4'>
        <span
          className='mt-0.5 text-2xl'
          role='img'
          aria-label={profile.card_brand}
        >
          {cardBrandIcon(profile.card_brand)}
        </span>

        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='font-medium'>
              {profile.card_brand} •••• {profile.card_last4}
            </span>
            {profile.is_default && (
              <Badge
                variant='secondary'
                className='flex items-center gap-1 text-xs'
              >
                <Star className='h-3 w-3 fill-yellow-400 text-yellow-400' />
                Default
              </Badge>
            )}
            {expired && (
              <Badge variant='destructive' className='text-xs'>
                Expired
              </Badge>
            )}
            {expiringSoon && !expired && (
              <Badge
                variant='outline'
                className='border-amber-300 text-xs text-amber-700'
              >
                Expiring soon
              </Badge>
            )}
          </div>
          <p className='text-muted-foreground mt-0.5 text-sm'>
            Expires {String(profile.card_expiry_month).padStart(2, '0')}/
            {String(profile.card_expiry_year).slice(-2)}
            {profile.billing_name && ` · ${profile.billing_name}`}
          </p>

          {deleteWarning && (
            <Alert variant='destructive' className='mt-2'>
              <AlertDescription>{deleteWarning}</AlertDescription>
            </Alert>
          )}

          {confirmDelete && (
            <div className='border-destructive/30 bg-destructive/5 mt-3 rounded-md border p-3'>
              <p className='text-destructive text-sm font-medium'>
                Remove this card?
              </p>
              {deleteWarning && (
                <p className='mt-1 text-sm text-amber-700'>⚠ {deleteWarning}</p>
              )}
              <div className='mt-3 flex gap-2'>
                <Button
                  size='sm'
                  variant='destructive'
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className='h-3 w-3 animate-spin' />
                  ) : (
                    'Yes, remove'
                  )}
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className='flex shrink-0 items-center gap-1'>
          {!profile.is_default && (
            <Button
              size='sm'
              variant='ghost'
              onClick={() => onSetDefault(profile.id)}
              disabled={isSettingDefault}
              title='Set as default'
            >
              {isSettingDefault ? (
                <Loader2 className='h-3 w-3 animate-spin' />
              ) : (
                <Star className='h-4 w-4' />
              )}
            </Button>
          )}
          <Button
            size='sm'
            variant='ghost'
            className='text-muted-foreground hover:text-destructive'
            onClick={() => setConfirmDelete((v) => !v)}
            disabled={isDeleting}
            title='Remove card'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SavedCardListProps {
  npoId: string
  /** Initial list of profiles (e.g., pre-loaded by parent) */
  initialProfiles?: PaymentProfile[]
  /** Called when the user wants to add a new card */
  onAddCard: () => void
  /** Called when profiles change (e.g., so parent can refresh) */
  onProfilesChange?: (profiles: PaymentProfile[]) => void
}

export function SavedCardList({
  npoId,
  initialProfiles = [],
  onAddCard,
  onProfilesChange,
}: SavedCardListProps) {
  const [profiles, setProfiles] = useState<PaymentProfile[]>(initialProfiles)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)
  const [globalWarning, setGlobalWarning] = useState<string | null>(null)

  function updateProfiles(next: PaymentProfile[]) {
    setProfiles(next)
    onProfilesChange?.(next)
  }

  async function handleSetDefault(profileId: string) {
    setSettingDefaultId(profileId)
    try {
      const updated = await setDefaultPaymentProfile(profileId, npoId)
      updateProfiles(
        profiles.map((p) =>
          p.id === updated.id ? updated : { ...p, is_default: false }
        )
      )
    } finally {
      setSettingDefaultId(null)
    }
  }

  function handleDeleted(deletedId: string, warning: string | null) {
    const next = profiles.filter((p) => p.id !== deletedId)
    updateProfiles(next)
    if (warning) setGlobalWarning(warning)
  }

  if (profiles.length === 0) {
    return (
      <div className='flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center'>
        <CreditCard className='text-muted-foreground/50 h-10 w-10' />
        <div>
          <p className='font-medium'>No saved cards</p>
          <p className='text-muted-foreground text-sm'>
            Add a card to speed up future payments.
          </p>
        </div>
        <Button size='sm' onClick={onAddCard}>
          <PlusCircle className='mr-2 h-4 w-4' />
          Add a card
        </Button>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      {globalWarning && (
        <Alert className='border-amber-300 bg-amber-50 text-amber-800'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>{globalWarning}</AlertDescription>
        </Alert>
      )}

      {profiles.map((p) => (
        <CardRow
          key={p.id}
          profile={p}
          npoId={npoId}
          onDeleted={handleDeleted}
          onSetDefault={handleSetDefault}
          isSettingDefault={settingDefaultId === p.id}
        />
      ))}

      <Button
        variant='outline'
        size='sm'
        className='mt-1 self-start'
        onClick={onAddCard}
      >
        <PlusCircle className='mr-2 h-4 w-4' />
        Add another card
      </Button>
    </div>
  )
}
