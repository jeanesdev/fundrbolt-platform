/**
 * GuestProfileModal – read-only guest profile sheet.
 *
 * Shown when a donor taps on a tablemate or on a card in the "Other Guests"
 * section.  All data is supplied by the caller; no API calls are made here.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Crown, MapPin } from 'lucide-react'

export interface GuestProfileData {
  guestId: string
  name: string | null
  bidderNumber: number | null
  tableNumber: number | null
  tableName?: string | null
  company?: string | null
  profileImageUrl?: string | null
  isTableCaptain?: boolean
}

interface GuestProfileModalProps {
  guest: GuestProfileData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? '?'
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

export function GuestProfileModal({ guest, open, onOpenChange }: GuestProfileModalProps) {
  if (!guest) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='mx-auto max-w-lg rounded-t-3xl pb-8 outline-none'
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        <SheetHeader className='sr-only'>
          <SheetTitle>{guest.name ?? 'Guest Profile'}</SheetTitle>
        </SheetHeader>

        <div className='flex flex-col items-center gap-4 pt-6'>
          {/* Avatar */}
          <div className='relative'>
            <div
              className='flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 text-xl font-bold shadow-md'
              style={{
                borderColor: 'rgb(var(--event-primary, 59, 130, 246))',
                backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)',
                color: 'rgb(var(--event-primary, 59, 130, 246))',
              }}
            >
              {guest.profileImageUrl ? (
                <img
                  src={guest.profileImageUrl}
                  alt={guest.name ?? 'Guest'}
                  className='h-full w-full object-cover'
                  loading='lazy'
                  decoding='async'
                />
              ) : (
                <span>{getInitials(guest.name)}</span>
              )}
            </div>
            {guest.isTableCaptain && (
              <span
                className='absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-sm'
                style={{
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                  color: '#fff',
                }}
                title='Table Captain'
              >
                <Crown className='h-3.5 w-3.5' />
              </span>
            )}
          </div>

          {/* Name */}
          <div className='text-center'>
            <h2
              className='text-xl font-bold leading-tight'
              style={{ color: 'var(--event-text-on-background, #111827)' }}
            >
              {guest.name ?? 'Guest'}
            </h2>
            {guest.company && (
              <p
                className='mt-0.5 text-sm'
                style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
              >
                {guest.company}
              </p>
            )}
            {guest.isTableCaptain && (
              <span
                className='mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold'
                style={{
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.12)',
                  color: 'rgb(var(--event-primary, 59, 130, 246))',
                }}
              >
                <Crown className='h-3 w-3' />
                Table Captain
              </span>
            )}
          </div>

          {/* Details pills */}
          <div className='flex flex-wrap items-center justify-center gap-3'>
            {guest.bidderNumber !== null && (
              <div
                className='flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold'
                style={{
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.07)',
                  color: 'rgb(var(--event-primary, 59, 130, 246))',
                }}
              >
                Bidder #{guest.bidderNumber}
              </div>
            )}
            {guest.tableNumber !== null && (
              <div
                className='flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold'
                style={{
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.3)',
                  backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.07)',
                  color: 'rgb(var(--event-primary, 59, 130, 246))',
                }}
              >
                <MapPin className='h-3.5 w-3.5' />
                {guest.tableName ? `${guest.tableName} (Table ${guest.tableNumber})` : `Table ${guest.tableNumber}`}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
