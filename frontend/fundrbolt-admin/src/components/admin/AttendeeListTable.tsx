/**
 * AttendeeListTable Component
 *
 * Displays event attendees (registrants + guests) with meal selections,
 * CSV export, and guest invitation features.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  deleteGuest,
  downloadAttendeesCSV,
  getEventAttendees,
  sendGuestInvitation,
} from '@/lib/api/admin-attendees'
import { cancelRegistration } from '@/lib/api/cancel-registration'
import { getErrorMessage } from '@/lib/error-utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Hash, Loader2, Mail, PenLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AssignBidderNumberDialog } from './AssignBidderNumberDialog'
import { CancelAttendeesDialog, type CancelAttendeesPayload } from './CancelAttendeesDialog'
import { CancelRegistrationDialog } from './CancelRegistrationDialog'

interface AttendeeListTableProps {
  eventId: string
  includeMealSelections?: boolean
}

export function AttendeeListTable({
  eventId,
  includeMealSelections = true,
}: AttendeeListTableProps) {
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(
    new Set()
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [guestToDelete, setGuestToDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [bulkCancelDialogOpen, setBulkCancelDialogOpen] = useState(false)
  const [bulkCancelPending, setBulkCancelPending] = useState(false)
  const [bidderNumberDialogOpen, setBidderNumberDialogOpen] = useState(false)
  const [attendeeForBidderNumber, setAttendeeForBidderNumber] = useState<{
    id: string
    name: string
    bidder_number?: number | null
  } | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [registrantToCancel, setRegistrantToCancel] = useState<{
    registration_id: string
    name: string
  } | null>(null)
  // Cancel registration handler
  const handleCancelRegistrationClick = (registrationId: string, registrantName: string) => {
    setRegistrantToCancel({ registration_id: registrationId, name: registrantName })
    setCancelDialogOpen(true)
  }
  const handleCancelRegistrationComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
    setRegistrantToCancel(null)
  }
  const queryClient = useQueryClient()

  // Fetch attendees
  const { data, isLoading, error } = useQuery({
    queryKey: ['event-attendees', eventId, includeMealSelections],
    queryFn: async () => {
      const result = await getEventAttendees(eventId, includeMealSelections)
      if (result instanceof Blob) {
        throw new Error('Expected JSON response, got Blob')
      }
      return result
    },
  })

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: sendGuestInvitation,
    onSuccess: () => {
      toast.success('Invitation sent successfully')
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to send invitation: ${error.message}`)
    },
  })

  // Delete guest mutation
  const deleteGuestMutation = useMutation({
    mutationFn: ({ guestId, payload }: { guestId: string; payload: CancelAttendeesPayload }) =>
      deleteGuest(guestId, payload),
    onSuccess: () => {
      toast.success('Guest deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
      queryClient.invalidateQueries({ queryKey: ['meal-summary', eventId] })
      setDeleteDialogOpen(false)
      setGuestToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete guest: ${error.message}`)
    },
  })

  // Export CSV handler
  const handleExportCSV = async () => {
    try {
      await downloadAttendeesCSV(eventId, includeMealSelections)
      toast.success('Attendee list exported successfully')
    } catch {
      toast.error('Failed to export attendee list')
    }
  }

  // Send invitation handler
  const handleSendInvitation = (guestId: string) => {
    sendInvitationMutation.mutate(guestId)
  }

  // Delete guest handler
  const handleDeleteClick = (guestId: string, guestName: string) => {
    setGuestToDelete({ id: guestId, name: guestName })
    setDeleteDialogOpen(true)
  }

  // Bidder number assignment handler
  const handleAssignBidderNumber = (
    attendeeId: string,
    attendeeName: string,
    currentBidderNumber?: number | null
  ) => {
    setAttendeeForBidderNumber({
      id: attendeeId,
      name: attendeeName,
      bidder_number: currentBidderNumber,
    })
    setBidderNumberDialogOpen(true)
  }

  const handleBidderNumberAssignmentComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
    setAttendeeForBidderNumber(null)
  }

  const handleDeleteConfirm = (payload: CancelAttendeesPayload) => {
    if (guestToDelete) {
      deleteGuestMutation.mutate({ guestId: guestToDelete.id, payload })
    }
  }

  const handleBulkCancelConfirm = async (payload: CancelAttendeesPayload) => {
    const selected = attendees.filter((attendee) => selectedAttendees.has(attendee.id))
    if (selected.length === 0) {
      toast.error('No attendees selected')
      return
    }

    const toastId = toast.loading(`Cancelling ${selected.length} attendee(s)...`)
    setBulkCancelPending(true)
    try {
      const results = await Promise.allSettled(
        selected.map((attendee) => {
          const isCancelled =
            attendee.status === 'cancelled' || attendee.status === 'canceled'
          if (isCancelled) {
            return Promise.resolve()
          }
          if (attendee.attendee_type === 'registrant') {
            return cancelRegistration(attendee.registration_id, payload)
          }
          return deleteGuest(attendee.id, payload)
        })
      )

      const failures = results.filter((r) => r.status === 'rejected')
      if (failures.length > 0) {
        const failureMessages = failures
          .map((failure) =>
            getErrorMessage((failure as PromiseRejectedResult).reason, 'Cancel failed')
          )
          .slice(0, 3)
        const detail = failureMessages.length > 0 ? `: ${failureMessages.join(' • ')}` : ''
        toast.error(`Failed to cancel ${failures.length} attendee(s)${detail}`, { id: toastId })
      } else {
        toast.success(`Cancelled ${selected.length} attendee(s)`, { id: toastId })
      }

      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
      queryClient.invalidateQueries({ queryKey: ['meal-summary', eventId] })
      setSelectedAttendees(new Set())
      setBulkCancelDialogOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel selected attendees'), { id: toastId })
    } finally {
      setBulkCancelPending(false)
    }
  }

  // Toggle attendee selection
  const toggleSelection = (attendeeId: string) => {
    const newSelection = new Set(selectedAttendees)
    if (newSelection.has(attendeeId)) {
      newSelection.delete(attendeeId)
    } else {
      newSelection.add(attendeeId)
    }
    setSelectedAttendees(newSelection)
  }

  // Toggle all attendees selection
  const toggleAllSelection = () => {
    if (selectedAttendees.size === data?.attendees.length) {
      setSelectedAttendees(new Set())
    } else {
      setSelectedAttendees(
        new Set(data?.attendees.map((a) => a.id) || [])
      )
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-8 text-center'>
        <p className='text-destructive'>Error loading attendees</p>
        <p className='text-sm text-muted-foreground'>{error.message}</p>
      </div>
    )
  }

  const attendees = data?.attendees || []
  const totalAttendees = data?.total || 0
  const activeAttendees = attendees.filter(
    (attendee) => attendee.status !== 'cancelled' && attendee.status !== 'canceled'
  ).length

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          {totalAttendees} total attendees • {activeAttendees} active
          {selectedAttendees.size > 0 && (
            <span className='ml-2'>
              ({selectedAttendees.size} selected)
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setBulkCancelDialogOpen(true)}
            disabled={selectedAttendees.size === 0}
          >
            <Trash2 className='mr-2 h-4 w-4 text-destructive' />
            Cancel Selected
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleExportCSV}
          >
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <Checkbox
                  checked={
                    selectedAttendees.size === attendees.length &&
                    attendees.length > 0
                  }
                  onCheckedChange={toggleAllSelection}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Bidder #</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              {includeMealSelections && <TableHead>Meal Selection</TableHead>}
              <TableHead>Guest Of</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={includeMealSelections ? 10 : 9}
                  className='text-center'
                >
                  <p className='py-8 text-muted-foreground'>
                    No attendees registered yet
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              attendees.map((attendee) => {
                const isCancelled =
                  attendee.status === 'cancelled' || attendee.status === 'canceled'
                return (
                  <TableRow key={attendee.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAttendees.has(attendee.id)}
                        onCheckedChange={() => toggleSelection(attendee.id)}
                      />
                    </TableCell>
                    <TableCell className='font-medium'>
                      {attendee.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          attendee.attendee_type === 'registrant'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {attendee.attendee_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {attendee.bidder_number ? (
                          <Badge
                            variant='outline'
                            className='bg-amber-50 text-amber-700 border-amber-200 font-mono font-semibold'
                          >
                            <Hash className='mr-1 h-3 w-3' />
                            {attendee.bidder_number}
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-6 w-6 p-0'
                          onClick={() =>
                            handleAssignBidderNumber(
                              attendee.id,
                              attendee.name,
                              attendee.bidder_number
                            )
                          }
                          title={
                            attendee.bidder_number
                              ? 'Reassign bidder number'
                              : 'Assign bidder number'
                          }
                        >
                          <PenLine className='h-3 w-3' />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className='max-w-[200px] truncate'>
                      {attendee.email || '—'}
                    </TableCell>
                    <TableCell>{attendee.phone || '—'}</TableCell>
                    {includeMealSelections && (
                      <TableCell className='max-w-[150px] truncate'>
                        {attendee.meal_selection || '—'}
                      </TableCell>
                    )}
                    <TableCell>{attendee.guest_of || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          attendee.status === 'confirmed' ? 'default' : 'outline'
                        }
                      >
                        {attendee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        {attendee.attendee_type === 'guest' && attendee.email && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleSendInvitation(attendee.id)}
                            disabled={sendInvitationMutation.isPending}
                          >
                            {sendInvitationMutation.isPending &&
                              sendInvitationMutation.variables === attendee.id ? (
                              <Loader2 className='h-4 w-4 animate-spin' />
                            ) : (
                              <>
                                <Mail className='mr-2 h-4 w-4' />
                                Send Invite
                              </>
                            )}
                          </Button>
                        )}
                        {attendee.attendee_type === 'guest' && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleDeleteClick(attendee.id, attendee.name)}
                            disabled={deleteGuestMutation.isPending || isCancelled}
                            aria-label={isCancelled ? 'Guest cancelled' : 'Cancel guest'}
                          >
                            <Trash2 className='mr-2 h-4 w-4 text-destructive' />
                            {isCancelled ? 'Cancelled' : 'Cancel'}
                          </Button>
                        )}
                        {attendee.attendee_type === 'registrant' && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleCancelRegistrationClick(attendee.registration_id, attendee.name)}
                            disabled={isCancelled}
                            aria-label={isCancelled ? 'Registration cancelled' : 'Cancel registration'}
                          >
                            <Trash2 className='mr-2 h-4 w-4 text-destructive' />
                            {isCancelled ? 'Cancelled' : 'Cancel'}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Guest Dialog */}
      {guestToDelete && (
        <CancelAttendeesDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Cancel Guest"
          description={
            <>
              Are you sure you want to cancel <strong>{guestToDelete.name}</strong>?
              <br />
              This will also remove their meal selections.
            </>
          }
          confirmLabel={deleteGuestMutation.isPending ? 'Cancelling...' : 'Cancel Guest'}
          isPending={deleteGuestMutation.isPending}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Bidder Number Assignment Dialog */}
      {attendeeForBidderNumber && (
        <AssignBidderNumberDialog
          eventId={eventId}
          guestId={attendeeForBidderNumber.id}
          guestName={attendeeForBidderNumber.name}
          currentBidderNumber={attendeeForBidderNumber.bidder_number}
          open={bidderNumberDialogOpen}
          onOpenChange={setBidderNumberDialogOpen}
          onAssignmentComplete={handleBidderNumberAssignmentComplete}
        />
      )}
      {/* Cancel Registration Dialog */}
      {registrantToCancel && (
        <CancelRegistrationDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          registrationId={registrantToCancel.registration_id}
          registrantName={registrantToCancel.name}
          onCancelComplete={handleCancelRegistrationComplete}
        />
      )}
      {/* Bulk Cancel Dialog */}
      <CancelAttendeesDialog
        open={bulkCancelDialogOpen}
        onOpenChange={setBulkCancelDialogOpen}
        title="Cancel Selected Attendees"
        description={
          <>This will cancel {selectedAttendees.size} selected attendees.</>
        }
        confirmLabel={bulkCancelPending ? 'Cancelling...' : 'Cancel Selected'}
        isPending={bulkCancelPending}
        onConfirm={handleBulkCancelConfirm}
      />
    </div>
  )
}
