import { useState } from 'react'
import {
  eventNotificationService,
  type RecipientCriteria,
} from '@/services/eventNotificationService'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'

const MAX_MESSAGE_LENGTH = 500

const RECIPIENT_TYPES = [
  { value: 'all_attendees', label: 'All Attendees' },
  { value: 'all_bidders', label: 'All Bidders' },
  { value: 'specific_table', label: 'Specific Table' },
  { value: 'individual', label: 'Individual' },
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
  const [userIds, setUserIds] = useState('')
  const [channels, setChannels] = useState<Set<string>>(new Set(['in_app']))
  const [isSending, setIsSending] = useState(false)

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
      const ids = userIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      if (ids.length === 0) {
        toast.error('Please enter at least one user ID')
        return
      }
      criteria.user_ids = ids
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
      setUserIds('')
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
            onValueChange={(v) =>
              setRecipientType(v as RecipientCriteria['type'])
            }
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
            <Input
              placeholder='User IDs (comma separated)'
              value={userIds}
              onChange={(e) => setUserIds(e.target.value)}
              className='mt-2'
            />
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
