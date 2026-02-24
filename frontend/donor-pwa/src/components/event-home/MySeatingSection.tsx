/**
 * MySeatingSection Component (T077)
 *
 * Collapsible section displaying user's seating information:
 * - Table number
 * - Bidder number (if checked in)
 * - List of tablemates
 * - Pending assignment message if no table
 */
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { ChevronDown, ChevronUp, Hash, MapPin, Users } from 'lucide-react'
import { useState } from 'react'
import { TableAssignmentCard } from './TableAssignmentCard'
import { TableCaptainBadge } from './TableCaptainBadge'
import { TablemateCard } from './TablemateCard'

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

export function MySeatingSection({ seatingInfo }: MySeatingProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isTablematesOpen, setIsTablematesOpen] = useState(true)

  const seatingInfoRecord = seatingInfo as SeatingInfoResponse & {
    my_info?: {
      guest_id?: string
      full_name?: string | null
      bidder_number?: number | null
      table_number?: number | null
      checked_in?: boolean
    }
    table_capacity?: {
      current?: number
      max?: number
    }
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

  const myInfoSource = seatingInfo.myInfo ?? seatingInfoRecord.my_info
  const myInfo: MySeatingInfo = {
    guestId: myInfoSource?.guestId ?? myInfoSource?.guest_id ?? '',
    fullName: myInfoSource?.fullName ?? myInfoSource?.full_name ?? null,
    bidderNumber:
      myInfoSource?.bidderNumber ?? myInfoSource?.bidder_number ?? null,
    tableNumber: myInfoSource?.tableNumber ?? myInfoSource?.table_number ?? null,
    checkedIn: myInfoSource?.checkedIn ?? myInfoSource?.checked_in ?? false,
  }

  const tablematesSource = seatingInfo.tablemates ?? seatingInfoRecord.tablemates ?? []
  const tablemates: TablemateInfo[] = tablematesSource.map((tablemate) => ({
    guestId: tablemate.guestId ?? tablemate.guest_id ?? '',
    name: tablemate.name ?? null,
    bidderNumber: tablemate.bidderNumber ?? tablemate.bidder_number ?? null,
    company: tablemate.company ?? null,
    profileImageUrl:
      tablemate.profileImageUrl ?? tablemate.profile_image_url ?? null,
  }))

  const tableCapacitySource =
    seatingInfo.tableCapacity ?? seatingInfoRecord.table_capacity
  const tableCapacity = {
    current: tableCapacitySource?.current ?? 0,
    max: tableCapacitySource?.max ?? 0,
  }

  const hasTableAssignment =
    seatingInfo.hasTableAssignment ??
    seatingInfoRecord.has_table_assignment ??
    false
  const message = seatingInfo.message ?? seatingInfoRecord.message

  const tableAssignmentSource =
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

  const resolvedTableNumber = tableAssignment?.tableNumber ?? myInfo.tableNumber
  const hasResolvedTableAssignment = hasTableAssignment || !!resolvedTableNumber

  const showPendingMessage = !hasResolvedTableAssignment && !!message
  const showTableAssignmentSection = !!resolvedTableNumber
  const showFallbackState = !showPendingMessage && !showTableAssignmentSection

  const collapsedTableText = resolvedTableNumber
    ? `Table ${resolvedTableNumber}`
    : 'Table pending'
  const collapsedBidderText = myInfo.bidderNumber
    ? `Bidder ${myInfo.bidderNumber}`
    : 'Bidder pending'

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className='w-full'>
      <Card
        className='border'
        style={{
          backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
          borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
          color: 'var(--event-card-text, #FFFFFF)',
        }}
      >
        <CardHeader>
          <CollapsibleTrigger className='w-full'>
            <div className='flex items-center justify-between'>
              <CardTitle
                className='flex items-center gap-2'
                style={{ color: 'var(--event-card-text, #FFFFFF)' }}
              >
                <MapPin
                  className='h-5 w-5'
                  style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                />
                My Seating
              </CardTitle>
              {isOpen ? (
                <ChevronUp
                  className='h-5 w-5'
                  style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                />
              ) : (
                <ChevronDown
                  className='h-5 w-5'
                  style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                />
              )}
            </div>
          </CollapsibleTrigger>

          {!isOpen && (
            <div className='mt-2 flex items-center gap-6'>
              <div className='flex items-center gap-2'>
                <MapPin
                  className='h-4 w-4'
                  style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                />
                <span
                  className='text-sm font-medium'
                  style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                >
                  {collapsedTableText}
                </span>
              </div>
              <div className='flex items-center gap-2'>
                <Hash
                  className='h-4 w-4'
                  style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                />
                <span
                  className='text-sm font-medium'
                  style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                >
                  {collapsedBidderText}
                </span>
              </div>
            </div>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className='space-y-4'>
            {/* Pending Assignment Message */}
            {showPendingMessage && (
              <Alert
                className='border'
                style={{
                  backgroundColor:
                    'rgb(var(--event-background, 255, 255, 255))',
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                  color: 'var(--event-text-on-background, #000000)',
                }}
              >
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {/* Table Assignment */}
            {showTableAssignmentSection && (
              <div className='space-y-4'>
                <div
                  className='flex items-center justify-between rounded-md border px-3 py-2'
                  style={{
                    backgroundColor: 'rgb(var(--event-background, 255, 255, 255) / 0.12)',
                    borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.35)',
                  }}
                >
                  <div className='flex items-center gap-2'>
                    <MapPin
                      className='h-4 w-4'
                      style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                    />
                    <span
                      className='text-sm font-medium'
                      style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                    >
                      {collapsedTableText}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Hash
                      className='h-4 w-4'
                      style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                    />
                    <span
                      className='text-sm font-medium'
                      style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                    >
                      {collapsedBidderText}
                    </span>
                  </div>
                </div>

                {/* Table Customization Details (T063-T067) */}
                {tableAssignment && (
                  <>
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
                    <Separator
                      style={{
                        backgroundColor:
                          'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                      }}
                    />
                  </>
                )}

                <Separator
                  style={{
                    backgroundColor:
                      'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                  }}
                />

                {/* Tablemates */}
                <Collapsible
                  open={isTablematesOpen}
                  onOpenChange={setIsTablematesOpen}
                  className='space-y-3'
                >
                  <CollapsibleTrigger className='w-full'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Users
                          className='h-4 w-4'
                          style={{
                            color: 'var(--event-card-text-muted, #D1D5DB)',
                          }}
                        />
                        <h3
                          className='text-sm font-semibold'
                          style={{ color: 'var(--event-card-text, #FFFFFF)' }}
                        >
                          Your Tablemates
                        </h3>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Badge
                          variant='secondary'
                          className='text-xs'
                          style={{
                            backgroundColor:
                              'rgb(var(--event-background, 255, 255, 255))',
                            color: 'var(--event-text-on-background, #000000)',
                          }}
                        >
                          {tableCapacity.current}/{tableCapacity.max}
                        </Badge>
                        {isTablematesOpen ? (
                          <ChevronUp
                            className='h-4 w-4'
                            style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                          />
                        ) : (
                          <ChevronDown
                            className='h-4 w-4'
                            style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
                          />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className='space-y-3'>
                    {tablemates.length > 0 ? (
                      <div className='grid grid-cols-2 gap-2'>
                        {tablemates.map((tablemate) => (
                          <TablemateCard
                            key={tablemate.guestId}
                            name={tablemate.name}
                            bidderNumber={tablemate.bidderNumber}
                            company={tablemate.company}
                            profileImageUrl={tablemate.profileImageUrl}
                          />
                        ))}
                      </div>
                    ) : (
                      <Alert
                        className='border'
                        style={{
                          backgroundColor:
                            'rgb(var(--event-background, 255, 255, 255))',
                          borderColor:
                            'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                          color: 'var(--event-text-on-background, #000000)',
                        }}
                      >
                        <Users className='h-4 w-4' />
                        <AlertDescription>
                          You're the first at your table! More guests may be
                          assigned soon.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {showFallbackState && (
              <Alert
                className='border'
                style={{
                  backgroundColor:
                    'rgb(var(--event-background, 255, 255, 255))',
                  borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
                  color: 'var(--event-text-on-background, #000000)',
                }}
              >
                <AlertDescription>
                  Seating information is still being updated. Please check back
                  in a few moments.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
