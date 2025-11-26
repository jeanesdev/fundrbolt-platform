/**
 * AttendeeListTable Component
 *
 * Displays event attendees (registrants + guests) with meal selections,
 * CSV export, and guest invitation features.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Mail, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

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
    mutationFn: deleteGuest,
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

  const handleDeleteConfirm = () => {
    if (guestToDelete) {
      deleteGuestMutation.mutate(guestToDelete.id)
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

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          {totalAttendees} total attendees
          {selectedAttendees.size > 0 && (
            <span className='ml-2'>
              ({selectedAttendees.size} selected)
            </span>
          )}
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={handleExportCSV}
        >
          <Download className='mr-2 h-4 w-4' />
          Export CSV
        </Button>
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
                  colSpan={includeMealSelections ? 9 : 8}
                  className='text-center'
                >
                  <p className='py-8 text-muted-foreground'>
                    No attendees registered yet
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              attendees.map((attendee) => (
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
                          disabled={deleteGuestMutation.isPending}
                        >
                          <Trash2 className='h-4 w-4 text-destructive' />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{guestToDelete?.name}</strong>?
              This will also remove their meal selections. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteGuestMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteGuestMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteGuestMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Deleting...
                </>
              ) : (
                'Delete Guest'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
