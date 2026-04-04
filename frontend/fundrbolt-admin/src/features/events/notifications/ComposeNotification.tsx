import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  eventNotificationService,
  type RecipientCriteria,
} from '@/services/eventNotificationService'
import { ArrowUpDown, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { type Attendee, getEventAttendees } from '@/lib/api/admin-attendees'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const MAX_MESSAGE_LENGTH = 500

const RECIPIENT_TYPES = [
  { value: 'all_attendees', label: 'All Attendees' },
  { value: 'all_bidders', label: 'All Bidders' },
  { value: 'specific_table', label: 'Specific Table' },
  { value: 'individual', label: 'Select Recipients' },
] as const

interface ComposeNotificationProps {
  eventId: string
  onSent: () => void
}

export function ComposeNotification({
  eventId,
  onSent,
}: ComposeNotificationProps) {
  const [message, setMessage] = useState('')
  const [recipientType, setRecipientType] =
    useState<RecipientCriteria['type']>('all_attendees')
  const [tableNumber, setTableNumber] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [channels, setChannels] = useState<Set<string>>(new Set(['in_app']))
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'email' | 'table'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Fetch attendees for the individual selection table
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ['event-attendees', eventId, false],
    queryFn: async () => {
      const result = await getEventAttendees(eventId, false)
      if (result instanceof Blob) throw new Error('Expected JSON')
      return result
    },
    enabled: recipientType === 'individual',
  })

  // Deduplicate attendees by user_id (a user may appear as registrant + guest)
  const uniqueAttendees = useMemo(() => {
    if (!attendeesData?.attendees) return []
    const seen = new Map<string, Attendee>()
    for (const a of attendeesData.attendees) {
      if (
        a.user_id &&
        (a.status === 'confirmed' || a.status === 'active') &&
        !seen.has(a.user_id)
      ) {
        seen.set(a.user_id, a)
      }
    }
    return Array.from(seen.values())
  }, [attendeesData])

  // Filter and sort
  const filteredAttendees = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = q
      ? uniqueAttendees.filter(
          (a) =>
            a.name?.toLowerCase().includes(q) ||
            a.email?.toLowerCase().includes(q) ||
            String(a.table_number ?? '').includes(q) ||
            String(a.bidder_number ?? '').includes(q)
        )
      : uniqueAttendees

    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name ?? '').localeCompare(b.name ?? '')
      else if (sortKey === 'email')
        cmp = (a.email ?? '').localeCompare(b.email ?? '')
      else if (sortKey === 'table')
        cmp = (a.table_number ?? 0) - (b.table_number ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [uniqueAttendees, searchQuery, sortKey, sortDir])

  const allFilteredSelected =
    filteredAttendees.length > 0 &&
    filteredAttendees.every((a) => a.user_id && selectedUserIds.has(a.user_id))

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        for (const a of filteredAttendees) {
          if (a.user_id) next.delete(a.user_id)
        }
        return next
      })
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev)
        for (const a of filteredAttendees) {
          if (a.user_id) next.add(a.user_id)
        }
        return next
      })
    }
  }

  const handleSort = (key: 'name' | 'email' | 'table') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const toggleChannel = (channel: string) => {
    setChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) {
        next.delete(channel)
      } else {
        next.add(channel)
      }
      return next
    })
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    const criteria: RecipientCriteria = { type: recipientType }
    if (recipientType === 'specific_table') {
      const num = parseInt(tableNumber, 10)
      if (isNaN(num) || num < 1) {
        toast.error('Please enter a valid table number')
        return
      }
      criteria.table_number = num
    }
    if (recipientType === 'individual') {
      if (selectedUserIds.size === 0) {
        toast.error('Please select at least one recipient')
        return
      }
      criteria.user_ids = Array.from(selectedUserIds)
    }

    setIsSending(true)
    try {
      await eventNotificationService.sendNotification(eventId, {
        message: message.trim(),
        recipient_criteria: criteria,
        channels: Array.from(channels),
      })
      toast.success('Notification sent successfully')
      setMessage('')
      setTableNumber('')
      setSelectedUserIds(new Set())
      setRecipientType('all_attendees')
      setChannels(new Set(['in_app']))
      onSent()
    } catch {
      toast.error('Failed to send notification')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Notification</CardTitle>
        <CardDescription>
          Compose and send a custom notification to event donors.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Message */}
        <div className='space-y-2'>
          <Label htmlFor='notification-message'>Message</Label>
          <Textarea
            id='notification-message'
            placeholder='Enter your notification message...'
            value={message}
            onChange={(e) =>
              setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
            }
            rows={4}
          />
          <p className='text-muted-foreground text-sm'>
            {message.length}/{MAX_MESSAGE_LENGTH} characters
          </p>
        </div>

        {/* Recipient type */}
        <div className='space-y-3'>
          <Label>Recipients</Label>
          <RadioGroup
            value={recipientType}
            onValueChange={(v) => {
              setRecipientType(v as RecipientCriteria['type'])
              if (v !== 'individual') setSelectedUserIds(new Set())
            }}
          >
            {RECIPIENT_TYPES.map((type) => (
              <div key={type.value} className='flex items-center gap-2'>
                <RadioGroupItem
                  value={type.value}
                  id={`recipient-${type.value}`}
                />
                <Label htmlFor={`recipient-${type.value}`}>{type.label}</Label>
              </div>
            ))}
          </RadioGroup>

          {recipientType === 'specific_table' && (
            <Input
              type='number'
              min={1}
              placeholder='Table number'
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className='mt-2 max-w-[200px]'
            />
          )}

          {recipientType === 'individual' && (
            <div className='mt-3 space-y-3'>
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
                  <Input
                    placeholder='Search by name, email, table, or bidder #...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-9'
                  />
                </div>
                <span className='text-muted-foreground text-sm whitespace-nowrap'>
                  {selectedUserIds.size} selected
                </span>
              </div>

              {attendeesLoading ? (
                <div className='flex items-center justify-center py-6'>
                  <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                </div>
              ) : (
                <div className='max-h-72 overflow-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-10'>
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={toggleAllFiltered}
                            aria-label='Select all visible'
                          />
                        </TableHead>
                        <TableHead
                          className='hover:bg-muted/50 cursor-pointer'
                          onClick={() => handleSort('name')}
                        >
                          <div className='flex items-center gap-1'>
                            Name
                            <ArrowUpDown className='h-3 w-3' />
                            {sortKey === 'name' && (
                              <span className='text-xs'>
                                {sortDir === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className='hover:bg-muted/50 cursor-pointer'
                          onClick={() => handleSort('email')}
                        >
                          <div className='flex items-center gap-1'>
                            Email
                            <ArrowUpDown className='h-3 w-3' />
                            {sortKey === 'email' && (
                              <span className='text-xs'>
                                {sortDir === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className='hover:bg-muted/50 cursor-pointer'
                          onClick={() => handleSort('table')}
                        >
                          <div className='flex items-center gap-1'>
                            Table
                            <ArrowUpDown className='h-3 w-3' />
                            {sortKey === 'table' && (
                              <span className='text-xs'>
                                {sortDir === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Bidder #</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendees.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className='text-muted-foreground py-6 text-center'
                          >
                            {searchQuery
                              ? 'No attendees match your search'
                              : 'No attendees found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAttendees.map((attendee) => (
                          <TableRow
                            key={attendee.user_id}
                            className='cursor-pointer'
                            onClick={() =>
                              attendee.user_id && toggleUser(attendee.user_id)
                            }
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={
                                  !!attendee.user_id &&
                                  selectedUserIds.has(attendee.user_id)
                                }
                                onCheckedChange={() =>
                                  attendee.user_id &&
                                  toggleUser(attendee.user_id)
                                }
                                aria-label={`Select ${attendee.name}`}
                              />
                            </TableCell>
                            <TableCell className='font-medium'>
                              {attendee.name}
                            </TableCell>
                            <TableCell className='text-muted-foreground'>
                              {attendee.email}
                            </TableCell>
                            <TableCell>
                              {attendee.table_number ?? '—'}
                            </TableCell>
                            <TableCell>
                              {attendee.bidder_number ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className='space-y-3'>
          <Label>Channels</Label>
          <div className='flex flex-wrap gap-4'>
            <div className='flex items-center gap-2'>
              <Checkbox id='ch-in_app' checked disabled />
              <Label htmlFor='ch-in_app' className='text-muted-foreground'>
                In-app
              </Label>
            </div>
            {['push', 'email', 'sms'].map((ch) => (
              <div key={ch} className='flex items-center gap-2'>
                <Checkbox
                  id={`ch-${ch}`}
                  checked={channels.has(ch)}
                  onCheckedChange={() => toggleChannel(ch)}
                />
                <Label htmlFor={`ch-${ch}`} className='capitalize'>
                  {ch === 'sms' ? 'SMS' : ch}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Send */}
        <Button onClick={handleSend} disabled={isSending || !message.trim()}>
          {isSending ? 'Sending...' : 'Send Notification'}
        </Button>
      </CardContent>
    </Card>
  )
}
