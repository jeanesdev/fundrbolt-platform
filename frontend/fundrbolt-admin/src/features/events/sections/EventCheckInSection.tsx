import { DataTableViewToggle } from '@/components/data-table/view-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useViewPreference } from '@/hooks/use-view-preference'
import { type Attendee, getEventAttendees } from '@/lib/api/admin-attendees'
import {
  assignBidderNumber,
  assignRegistrationBidderNumber,
} from '@/lib/api/admin-seating'
import { getErrorMessage } from '@/lib/error-utils'
import { checkinService } from '@/services/checkin-service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  Crown,
  Filter,
  Loader2,
  RotateCcw,
  Settings2,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useEventWorkspace } from '../useEventWorkspace'

function StatusBadge({ checkedIn }: { checkedIn: boolean }) {
  return checkedIn ? (
    <Badge variant='default'>Checked in</Badge>
  ) : (
    <Badge variant='secondary'>Not checked in</Badge>
  )
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function formatPhoneInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, '').slice(0, 10)

  if (!digitsOnly) return ''
  if (digitsOnly.length < 4) return digitsOnly
  if (digitsOnly.length < 7) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`
  }

  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
}

function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value) return '—'

  const digitsOnly = value.replace(/\D/g, '')
  if (digitsOnly.length === 10) {
    return formatPhoneInput(digitsOnly)
  }

  return value
}

type Filters = {
  confirmationCode: string
  name: string
  email: string
  phone: string
  guestOf: string
  checkedIn: 'all' | 'checked' | 'not_checked'
  tableNumber: string
  bidderNumber: string
  checkInTime: string
}

const defaultFilters: Filters = {
  confirmationCode: '',
  name: '',
  email: '',
  phone: '',
  guestOf: '',
  checkedIn: 'all',
  tableNumber: '',
  bidderNumber: '',
  checkInTime: '',
}

type EditFormState = {
  name: string
  email: string
  phone: string
  bidderNumber: string
  replacementEmail: string
}

const defaultEditForm: EditFormState = {
  name: '',
  email: '',
  phone: '',
  bidderNumber: '',
  replacementEmail: '',
}

export function EventCheckInSection() {
  const { currentEvent } = useEventWorkspace()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditForm)
  const [viewMode, setViewMode] = useViewPreference('check-in')
  const [cardFiltersOpen, setCardFiltersOpen] = useState(false)

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.name) count++
    if (filters.email) count++
    if (filters.phone) count++
    if (filters.guestOf) count++
    if (filters.checkedIn !== 'all') count++
    if (filters.tableNumber) count++
    if (filters.bidderNumber) count++
    if (filters.checkInTime) count++
    if (filters.confirmationCode) count++
    return count
  }, [filters])

  const clearAllFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['event-attendees', currentEvent.id],
    queryFn: async () => {
      const result = await getEventAttendees(currentEvent.id, false)
      if (result instanceof Blob) {
        throw new Error('Unexpected CSV response while loading registrants')
      }
      return result
    },
  })

  const updateCheckinMutation = useMutation({
    mutationFn: async ({
      targetId,
      attendeeType,
      undo,
    }: {
      targetId: string
      attendeeType: Attendee['attendee_type']
      undo: boolean
    }) => {
      if (attendeeType === 'guest') {
        if (undo) {
          return checkinService.undoCheckInGuest(targetId)
        }
        return checkinService.checkInGuest(targetId)
      }

      if (undo) {
        return checkinService.undoCheckInRegistration(targetId)
      }
      return checkinService.checkInRegistration(targetId)
    },
    onSuccess: (_response, variables) => {
      const noun = variables.attendeeType === 'guest' ? 'Guest' : 'Registration'
      toast.success(
        variables.undo ? `${noun} check-in undone` : `${noun} checked in`
      )
      queryClient.invalidateQueries({
        queryKey: ['event-attendees', currentEvent.id],
      })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to update check-in status'))
    },
  })

  const saveAttendeeMutation = useMutation({
    mutationFn: async (attendee: Attendee) => {
      if (attendee.attendee_type === 'registrant') {
        const trimmedName = editForm.name.trim()
        const nameParts = trimmedName.split(/\s+/).filter(Boolean)
        const firstName = nameParts[0] ?? ''
        const lastName = nameParts.slice(1).join(' ') || nameParts[0] || ''

        if (!firstName) {
          throw new Error('Name is required')
        }

        await checkinService.updateRegistrationDetails(
          currentEvent.id,
          attendee.registration_id,
          {
            first_name: firstName,
            last_name: lastName,
            email: editForm.email.trim() || undefined,
            phone: editForm.phone.trim() || undefined,
          }
        )
      } else {
        await checkinService.updateGuestDetails(currentEvent.id, attendee.id, {
          name: editForm.name.trim() || undefined,
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
        })
      }

      const nextBidderValue = editForm.bidderNumber.trim()
      if (!nextBidderValue) {
        return
      }

      const bidderNumber = Number.parseInt(nextBidderValue, 10)
      if (
        Number.isNaN(bidderNumber) ||
        bidderNumber < 100 ||
        bidderNumber > 999
      ) {
        throw new Error('Bidder number must be between 100 and 999')
      }

      if (bidderNumber === (attendee.bidder_number ?? null)) {
        return
      }

      if (attendee.attendee_type === 'registrant') {
        await assignRegistrationBidderNumber(
          currentEvent.id,
          attendee.registration_id,
          bidderNumber
        )
      } else {
        await assignBidderNumber(currentEvent.id, attendee.id, bidderNumber)
      }
    },
    onSuccess: () => {
      toast.success('Attendee saved')
      queryClient.invalidateQueries({
        queryKey: ['event-attendees', currentEvent.id],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to save attendee'))
    },
  })

  const replaceGuestMutation = useMutation({
    mutationFn: async (attendee: Attendee) => {
      if (attendee.attendee_type !== 'guest') {
        return
      }

      const email = editForm.replacementEmail.trim().toLowerCase()
      if (!email) {
        throw new Error('Replacement email is required')
      }

      await checkinService.replaceGuestUser(currentEvent.id, attendee.id, email)
    },
    onSuccess: () => {
      toast.success('Guest ticket replaced with user')
      queryClient.invalidateQueries({
        queryKey: ['event-attendees', currentEvent.id],
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to replace guest ticket'))
    },
  })

  const attendees = useMemo(() => {
    const attendees = (data?.attendees ?? []) as Attendee[]
    return attendees.filter(
      (attendee) =>
        attendee.status !== 'cancelled' && attendee.status !== 'canceled'
    )
  }, [data])

  const checkInSummary = useMemo(() => {
    const checkedInAttendees = attendees.filter((attendee) =>
      Boolean(attendee.checked_in || attendee.check_in_time)
    )
    const total = attendees.length
    const checkedIn = checkedInAttendees.length
    const percent = total === 0 ? 0 : Math.round((checkedIn / total) * 100)

    return { total, checkedIn, percent }
  }, [attendees])

  const filteredAttendees = useMemo(() => {
    const normalize = (value: string | null | undefined) =>
      (value ?? '').toLowerCase()

    return attendees.filter((row) => {
      const checkedIn = Boolean(row.checked_in || row.check_in_time)
      const partyOf =
        row.attendee_type === 'registrant' ? row.name : (row.guest_of ?? '')
      const tableNumber =
        row.table_number == null ? '' : String(row.table_number)
      const bidderNumber =
        row.bidder_number == null ? '' : String(row.bidder_number)
      const checkInTime = (row.check_in_time ?? '').toLowerCase()

      if (
        filters.confirmationCode &&
        !row.registration_id
          .toLowerCase()
          .includes(filters.confirmationCode.toLowerCase())
      ) {
        return false
      }
      if (
        filters.name &&
        !normalize(row.name).includes(filters.name.toLowerCase())
      ) {
        return false
      }
      if (
        filters.email &&
        !normalize(row.email).includes(filters.email.toLowerCase())
      ) {
        return false
      }
      if (
        filters.phone &&
        !normalize(row.phone).includes(filters.phone.toLowerCase())
      ) {
        return false
      }
      if (
        filters.guestOf &&
        !normalize(partyOf).includes(filters.guestOf.toLowerCase())
      ) {
        return false
      }
      if (filters.checkedIn === 'checked' && !checkedIn) {
        return false
      }
      if (filters.checkedIn === 'not_checked' && checkedIn) {
        return false
      }
      if (
        filters.tableNumber &&
        !tableNumber.includes(filters.tableNumber.trim())
      ) {
        return false
      }
      if (
        filters.bidderNumber &&
        !bidderNumber.includes(filters.bidderNumber.trim())
      ) {
        return false
      }
      if (
        filters.checkInTime &&
        !checkInTime.includes(filters.checkInTime.toLowerCase())
      ) {
        return false
      }

      return true
    })
  }, [attendees, filters])

  const handleToggleCheckIn = (attendee: Attendee, checkedIn: boolean) => {
    const targetId =
      attendee.attendee_type === 'guest'
        ? attendee.id
        : attendee.registration_id

    updateCheckinMutation.mutate({
      targetId,
      attendeeType: attendee.attendee_type,
      undo: checkedIn,
    })
  }

  const openManageDialog = (attendee: Attendee) => {
    setEditingAttendee(attendee)
    setEditForm({
      name: attendee.name ?? '',
      email: attendee.email ?? '',
      phone: formatPhoneInput(attendee.phone ?? ''),
      bidderNumber:
        attendee.bidder_number == null ? '' : String(attendee.bidder_number),
      replacementEmail: '',
    })
  }

  const closeManageDialog = () => {
    setEditingAttendee(null)
    setEditForm(defaultEditForm)
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className='p-6'>
          <p className='text-destructive'>Failed to load registrants</p>
          <p className='text-muted-foreground mt-2 text-sm'>
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-2 md:flex-row md:items-start md:justify-between'>
            <div>
              <CardTitle>Attendees</CardTitle>
              <CardDescription>
                Registrants and guests are shown together in one searchable
                table.
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <DataTableViewToggle value={viewMode} onChange={setViewMode} />
              <div className='rounded-md border px-3 py-2 text-sm'>
                <p className='font-medium'>Check-in Progress</p>
                <p className='text-muted-foreground'>
                  {checkInSummary.checkedIn} of {checkInSummary.total} attendees
                  checked-in ({checkInSummary.percent}%)
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'card' ? (
            <div className='space-y-3'>
              {/* Card-mode filter bar */}
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCardFiltersOpen((prev) => !prev)}
                  className='gap-1.5'
                >
                  <Filter className='h-4 w-4' />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge
                      variant='secondary'
                      className='ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-xs'
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                {activeFilterCount > 0 && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={clearAllFilters}
                    className='text-muted-foreground gap-1'
                  >
                    <X className='h-3.5 w-3.5' />
                    Clear all
                  </Button>
                )}
                <span className='text-muted-foreground ml-auto text-sm'>
                  {filteredAttendees.length} of {attendees.length} attendees
                </span>
              </div>
              {cardFiltersOpen && (
                <div className='bg-muted/30 rounded-md border p-3'>
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Name
                      </Label>
                      <Input
                        placeholder='Filter name…'
                        value={filters.name}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Email
                      </Label>
                      <Input
                        placeholder='Filter email…'
                        value={filters.email}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Phone
                      </Label>
                      <Input
                        placeholder='Filter phone…'
                        value={filters.phone}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Party Of
                      </Label>
                      <Input
                        placeholder='Filter party of…'
                        value={filters.guestOf}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            guestOf: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Status
                      </Label>
                      <select
                        className='border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm'
                        value={filters.checkedIn}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            checkedIn: e.target.value as Filters['checkedIn'],
                          }))
                        }
                      >
                        <option value='all'>All</option>
                        <option value='checked'>Checked in</option>
                        <option value='not_checked'>Not checked in</option>
                      </select>
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Table #
                      </Label>
                      <Input
                        placeholder='Filter table…'
                        value={filters.tableNumber}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            tableNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Bidder #
                      </Label>
                      <Input
                        placeholder='Filter bidder…'
                        value={filters.bidderNumber}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            bidderNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Checked In At
                      </Label>
                      <Input
                        placeholder='Filter time…'
                        value={filters.checkInTime}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            checkInTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-muted-foreground text-xs'>
                        Confirmation Code
                      </Label>
                      <Input
                        placeholder='Filter code…'
                        value={filters.confirmationCode}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            confirmationCode: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {filteredAttendees.length === 0 ? (
                  <div className='text-muted-foreground col-span-full rounded-md border py-8 text-center'>
                    No attendees match the current filters.
                  </div>
                ) : (
                  filteredAttendees.map((attendee) => {
                    const checkedIn = Boolean(
                      attendee.checked_in || attendee.check_in_time
                    )
                    const partyOf =
                      attendee.attendee_type === 'registrant'
                        ? attendee.name
                        : attendee.guest_of
                    return (
                      <div
                        key={attendee.id}
                        className='space-y-2 rounded-md border p-3'
                      >
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <Button
                              size='sm'
                              variant={checkedIn ? 'outline' : 'default'}
                              className='h-8 w-8 p-0'
                              onClick={() =>
                                handleToggleCheckIn(attendee, checkedIn)
                              }
                              disabled={updateCheckinMutation.isPending}
                              aria-label={
                                checkedIn
                                  ? 'Undo check-in'
                                  : 'Check in attendee'
                              }
                            >
                              {updateCheckinMutation.isPending ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                              ) : checkedIn ? (
                                <RotateCcw className='h-4 w-4' />
                              ) : (
                                <Check className='h-4 w-4' />
                              )}
                            </Button>
                            <span className='font-medium'>
                              {attendee.name || '—'}
                            </span>
                            {attendee.is_table_captain && (
                              <Badge
                                variant='outline'
                                className='h-5 w-5 justify-center p-0'
                                title='Table Captain'
                              >
                                <Crown className='h-3 w-3' />
                              </Badge>
                            )}
                          </div>
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-8 w-8 p-0'
                            onClick={() => openManageDialog(attendee)}
                            aria-label='Manage attendee'
                          >
                            <Settings2 className='h-4 w-4' />
                          </Button>
                        </div>
                        <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                          <dt className='text-muted-foreground'>Status</dt>
                          <dd>
                            <StatusBadge checkedIn={checkedIn} />
                          </dd>
                          <dt className='text-muted-foreground'>Party Of</dt>
                          <dd>{partyOf || '—'}</dd>
                          <dt className='text-muted-foreground'>Table #</dt>
                          <dd>{attendee.table_number ?? '—'}</dd>
                        </dl>
                        <Collapsible>
                          <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs'>
                            <ChevronDown className='h-3 w-3' />
                            More details
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <dl className='mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                              <dt className='text-muted-foreground'>Email</dt>
                              <dd className='truncate'>
                                {attendee.email || '—'}
                              </dd>
                              <dt className='text-muted-foreground'>Phone</dt>
                              <dd>{formatPhoneForDisplay(attendee.phone)}</dd>
                              <dt className='text-muted-foreground'>
                                Bidder #
                              </dt>
                              <dd>{attendee.bidder_number ?? '—'}</dd>
                              <dt className='text-muted-foreground'>
                                Checked In At
                              </dt>
                              <dd>{formatDateTime(attendee.check_in_time)}</dd>
                              <dt className='text-muted-foreground'>
                                Confirmation
                              </dt>
                              <dd className='font-mono text-xs'>
                                {attendee.registration_id}
                              </dd>
                            </dl>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Party Of</TableHead>
                    <TableHead>Checked In</TableHead>
                    <TableHead>Table #</TableHead>
                    <TableHead>Bidder #</TableHead>
                    <TableHead>Checked In At</TableHead>
                    <TableHead>Confirmation Code</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead>
                      <span className='text-muted-foreground text-xs'>
                        Action
                      </span>
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter name'
                        value={filters.name}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter email'
                        value={filters.email}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter phone'
                        value={filters.phone}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            phone: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter party of'
                        value={filters.guestOf}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            guestOf: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <select
                        className='border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm'
                        value={filters.checkedIn}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            checkedIn: event.target
                              .value as Filters['checkedIn'],
                          }))
                        }
                      >
                        <option value='all'>All</option>
                        <option value='checked'>Checked in</option>
                        <option value='not_checked'>Not checked in</option>
                      </select>
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter table'
                        value={filters.tableNumber}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            tableNumber: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter bidder'
                        value={filters.bidderNumber}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            bidderNumber: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter checked in at'
                        value={filters.checkInTime}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            checkInTime: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                    <TableHead>
                      <Input
                        placeholder='Filter code'
                        value={filters.confirmationCode}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            confirmationCode: event.target.value,
                          }))
                        }
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className='text-muted-foreground py-8 text-center'
                      >
                        No attendees match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttendees.map((attendee) => {
                      const checkedIn = Boolean(
                        attendee.checked_in || attendee.check_in_time
                      )
                      const partyOf =
                        attendee.attendee_type === 'registrant'
                          ? attendee.name
                          : attendee.guest_of
                      return (
                        <TableRow key={attendee.id}>
                          <TableCell>
                            <div className='flex items-center gap-1'>
                              <Button
                                size='sm'
                                variant={checkedIn ? 'outline' : 'default'}
                                className='h-8 w-8 p-0'
                                onClick={() =>
                                  handleToggleCheckIn(attendee, checkedIn)
                                }
                                disabled={updateCheckinMutation.isPending}
                                aria-label={
                                  checkedIn
                                    ? 'Undo check-in'
                                    : 'Check in attendee'
                                }
                                title={
                                  checkedIn
                                    ? 'Undo check-in'
                                    : 'Check in attendee'
                                }
                              >
                                {updateCheckinMutation.isPending ? (
                                  <Loader2 className='h-4 w-4 animate-spin' />
                                ) : checkedIn ? (
                                  <RotateCcw className='h-4 w-4' />
                                ) : (
                                  <Check className='h-4 w-4' />
                                )}
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                className='h-8 w-8 p-0'
                                onClick={() => openManageDialog(attendee)}
                                aria-label='Manage attendee'
                                title='Manage attendee'
                              >
                                <Settings2 className='h-4 w-4' />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <span>{attendee.name || '—'}</span>
                              {attendee.is_table_captain && (
                                <Badge
                                  variant='outline'
                                  className='h-5 w-5 justify-center p-0'
                                  title='Table Captain'
                                  aria-label='Table Captain'
                                >
                                  <Crown className='h-3 w-3' />
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{attendee.email || '—'}</TableCell>
                          <TableCell>
                            {formatPhoneForDisplay(attendee.phone)}
                          </TableCell>
                          <TableCell>{partyOf || '—'}</TableCell>
                          <TableCell>
                            <StatusBadge checkedIn={checkedIn} />
                          </TableCell>
                          <TableCell>{attendee.table_number ?? '—'}</TableCell>
                          <TableCell>{attendee.bidder_number ?? '—'}</TableCell>
                          <TableCell>
                            {formatDateTime(attendee.check_in_time)}
                          </TableCell>
                          <TableCell className='font-mono text-xs'>
                            {attendee.registration_id}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingAttendee)}
        onOpenChange={(open) => {
          if (!open) {
            closeManageDialog()
          }
        }}
      >
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>Manage Attendee</DialogTitle>
            <DialogDescription>
              Update bidder number and contact details from the check-in page.
            </DialogDescription>
          </DialogHeader>

          {editingAttendee && (
            <div className='space-y-6'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='edit-name'>Name</Label>
                  <Input
                    id='edit-name'
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-email'>Email</Label>
                  <Input
                    id='edit-email'
                    type='email'
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-phone'>Phone</Label>
                  <Input
                    id='edit-phone'
                    inputMode='tel'
                    value={editForm.phone}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        phone: formatPhoneInput(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-bidder'>Bidder Number</Label>
                  <Input
                    id='edit-bidder'
                    value={editForm.bidderNumber}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        bidderNumber: event.target.value,
                      }))
                    }
                    placeholder='100-999'
                  />
                </div>
              </div>

              {editingAttendee.attendee_type === 'guest' && (
                <div className='space-y-2 rounded-md border p-3'>
                  <Label htmlFor='replace-guest-email'>
                    Replace Guest Ticket with User Email
                  </Label>
                  <Input
                    id='replace-guest-email'
                    type='email'
                    value={editForm.replacementEmail}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        replacementEmail: event.target.value,
                      }))
                    }
                    placeholder='user@example.com'
                  />
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={replaceGuestMutation.isPending}
                    onClick={() => replaceGuestMutation.mutate(editingAttendee)}
                  >
                    {replaceGuestMutation.isPending && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    Replace Ticket
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant='outline'
              onClick={closeManageDialog}
              disabled={
                saveAttendeeMutation.isPending || replaceGuestMutation.isPending
              }
            >
              Close
            </Button>
            {editingAttendee && (
              <Button
                type='button'
                disabled={
                  saveAttendeeMutation.isPending ||
                  replaceGuestMutation.isPending
                }
                onClick={() => saveAttendeeMutation.mutate(editingAttendee)}
              >
                {saveAttendeeMutation.isPending && (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                )}
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
