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
  downloadAttendeesCSV,
  getEventAttendees,
  sendGuestInvitation
} from '@/lib/api/admin-attendees'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Mail } from 'lucide-react'
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

  // Export CSV handler
  const handleExportCSV = async () => {
    try {
      await downloadAttendeesCSV(eventId, includeMealSelections)
      toast.success('Attendee list exported successfully')
    } catch (error) {
      toast.error('Failed to export attendee list')
      console.error('Export error:', error)
  }

  // Send invitation handler
  const handleSendInvitation = (guestId: string) => {
    sendInvitationMutation.mutate(guestId)
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
