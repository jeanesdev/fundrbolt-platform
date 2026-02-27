/**
 * MySeatingSection — Premium redesign (native app style)
 *
 * Replaces collapsible card with a visually rich, always-visible section:
 * - Large bidder number pill
 * - Table name / number with captain badge
 * - Compact tablemates grid
 */
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Hash, MapPin, Users } from 'lucide-react'
import { TableAssignmentCard } from './TableAssignmentCard'
import { TableCaptainBadge } from './TableCaptainBadge'

interface MySeatingInfo {
  guestId: string
  fullName: string | null
  bidderNumber: number | null
  tableNumber: number | null
  checkedIn: boolean
}

interface TablemateInfo {
  guestId: string
  name: string | null
  bidderNumber: number | null
  company?: string | null
  profileImageUrl?: string | null
}

interface TableAssignment {
  tableNumber: number
  tableName: string | null
  captainFullName: string | null
  youAreCaptain: boolean
}

interface SeatingInfoResponse {
  myInfo: MySeatingInfo
  tablemates: TablemateInfo[]
  tableCapacity: {
    current: number
    max: number
  }
  hasTableAssignment: boolean
  message?: string | null
  tableAssignment?: TableAssignment | null
}

interface MySeatingProps {
  seatingInfo: SeatingInfoResponse
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const words = name.split(' ').filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0]?.[0] || '?').toUpperCase()
}

export function MySeatingSection({ seatingInfo }: MySeatingProps) {
  // Normalise snake_case / camelCase from API
  const seatingInfoRecord = seatingInfo as SeatingInfoResponse & {
    my_info?: {
      guest_id?: string
      full_name?: string | null
      bidder_number?: number | null
      table_number?: number | null
      checked_in?: boolean
    }
    table_capacity?: { current?: number; max?: number }
    has_table_assignment?: boolean
    table_assignment?: {
      table_number?: number
      table_name?: string | null
      captain_full_name?: string | null
      you_are_captain?: boolean
    } | null
    tablemates?: Array<{
      guest_id?: string
      name?: string | null
      bidder_number?: number | null
      company?: string | null
      profile_image_url?: string | null
      profileImageUrl?: string | null
    }>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myInfoSource: any = seatingInfo.myInfo ?? seatingInfoRecord.my_info
  const myInfo: MySeatingInfo = {
    guestId: myInfoSource?.guestId ?? myInfoSource?.guest_id ?? '',
    fullName: myInfoSource?.fullName ?? myInfoSource?.full_name ?? null,
    bidderNumber: myInfoSource?.bidderNumber ?? myInfoSource?.bidder_number ?? null,
    tableNumber: myInfoSource?.tableNumber ?? myInfoSource?.table_number ?? null,
    checkedIn: myInfoSource?.checkedIn ?? myInfoSource?.checked_in ?? false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tablematesSource: any[] =
    seatingInfo.tablemates ?? seatingInfoRecord.tablemates ?? []
  const tablemates: TablemateInfo[] = tablematesSource.map((t) => ({
    guestId: t.guestId ?? t.guest_id ?? '',
    name: t.name ?? null,
    bidderNumber: t.bidderNumber ?? t.bidder_number ?? null,
    company: t.company ?? null,
    profileImageUrl: t.profileImageUrl ?? t.profile_image_url ?? null,
  }))

  const tableCapacitySource =
    seatingInfo.tableCapacity ?? seatingInfoRecord.table_capacity
  const tableCapacity = {
    current: tableCapacitySource?.current ?? 0,
    max: tableCapacitySource?.max ?? 0,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableAssignmentSource: any =
    seatingInfo.tableAssignment ?? seatingInfoRecord.table_assignment
  const tableAssignment: TableAssignment | null = tableAssignmentSource
    ? {
        tableNumber:
          tableAssignmentSource.tableNumber ??
          tableAssignmentSource.table_number ??
          0,
        tableName:
          tableAssignmentSource.tableName ??
          tableAssignmentSource.table_name ??
          null,
        captainFullName:
          tableAssignmentSource.captainFullName ??
          tableAssignmentSource.captain_full_name ??
          null,
        youAreCaptain:
          tableAssignmentSource.youAreCaptain ??
          tableAssignmentSource.you_are_captain ??
          false,
      }
    : null

  const resolvedTableNumber =
    tableAssignment?.tableNumber ?? myInfo.tableNumber
  const hasTable = !!resolvedTableNumber
  const message =
    seatingInfo.message ?? seatingInfoRecord.message

  return (
    <div className='space-y-4'>
      {/* Bidder Number — hero display */}
      <div
        className='relative overflow-hidden rounded-2xl p-5'
        style={{
          background: `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246) / 0.9) 0%, rgb(var(--event-secondary, 147, 51, 234) / 0.9) 100%)`,
        }}
      >
        <div className='pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-xl' />
        <div className='flex items-center justify-between'>
          <div>
            <p className='mb-1 text-xs font-semibold uppercase tracking-widest text-white/70'>
              Your Bidder Number
            </p>
            {myInfo.bidderNumber ? (
              <div className='flex items-center gap-2'>
                <Hash className='h-5 w-5 text-white/70' />
                <span className='text-4xl font-black tabular-nums text-white'>
                  {myInfo.bidderNumber}
                </span>
              </div>
            ) : (
              <p className='text-sm text-white/60 italic'>
                Check in at the event to receive your bidder number
              </p>
            )}
          </div>
          {hasTable && (
            <div className='text-right'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-widest text-white/70'>
                Table
              </p>
              <div className='flex items-center gap-1.5 justify-end'>
                <MapPin className='h-4 w-4 text-white/70' />
                <span className='text-2xl font-black text-white'>
                  {tableAssignment?.tableName ?? resolvedTableNumber}
                </span>
              </div>
              {tableAssignment?.tableName && (
                <p className='text-xs text-white/60'>
                  Table {tableAssignment.tableNumber}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* No table assigned yet */}
      {!hasTable && message && (
        <div
          className='rounded-xl border px-4 py-3'
          style={{
            backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
          }}
        >
          <p
            className='text-sm'
            style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
          >
            {message}
          </p>
        </div>
      )}

      {/* Table details */}
      {tableAssignment && (
        <div className='space-y-3'>
          <TableAssignmentCard
            tableNumber={tableAssignment.tableNumber}
            tableName={tableAssignment.tableName}
            currentOccupancy={tableCapacity.current}
            maxCapacity={tableCapacity.max}
          />
          <TableCaptainBadge
            captainFullName={tableAssignment.captainFullName}
            youAreCaptain={tableAssignment.youAreCaptain}
          />
        </div>
      )}

      {/* Tablemates */}
      {hasTable && (
        <div
          className='rounded-2xl border p-4'
          style={{
            backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
            borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
          }}
        >
          <div className='mb-3 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Users
                className='h-4 w-4'
                style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
              />
              <h3
                className='text-sm font-semibold'
                style={{ color: 'var(--event-card-text, #FFFFFF)' }}
              >
                Tablemates
              </h3>
            </div>
            <span
              className='rounded-full px-2 py-0.5 text-xs font-medium'
              style={{
                backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
                color: 'var(--event-card-text, #FFFFFF)',
              }}
            >
              {tableCapacity.current}/{tableCapacity.max}
            </span>
          </div>

          {tablemates.length > 0 ? (
            <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
              {tablemates.map((mate) => (
                <div key={mate.guestId} className='flex flex-col items-center gap-1'>
                  <div className='relative'>
                    <Avatar className='h-10 w-10 border-2 border-white/20'>
                      <AvatarImage
                        src={mate.profileImageUrl ?? undefined}
                        alt={mate.name ?? 'Guest'}
                      />
                      <AvatarFallback
                        className='text-xs font-bold text-white'
                        style={{
                          backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.5)',
                        }}
                      >
                        {getInitials(mate.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <p
                    className='text-center text-[10px] font-medium leading-tight line-clamp-2'
                    style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                  >
                    {mate.name ?? 'Guest'}
                  </p>
                  {mate.bidderNumber && (
                    <p
                      className='text-[10px]'
                      style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                    >
                      #{mate.bidderNumber}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p
              className='text-center text-sm italic'
              style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
            >
              You're the first at your table! 🎉
            </p>
          )}
        </div>
      )}
    </div>
  )
}
