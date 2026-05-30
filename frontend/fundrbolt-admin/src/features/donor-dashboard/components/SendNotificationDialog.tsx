import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  eventNotificationService,
  type RecipientCriteria,
} from '@/services/eventNotificationService'
import { Bell, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const MAX_MESSAGE_LENGTH = 500

const CHANNELS = [
  { value: 'in_app', label: 'In-App', alwaysOn: true },
  { value: 'push', label: 'Push', alwaysOn: false },
  { value: 'email', label: 'Email', alwaysOn: false },
  { value: 'sms', label: 'SMS', alwaysOn: false },
]

const SMS_LIMIT = 160

interface SendNotificationDialogProps {
  eventId: string | undefined
  userIds: string[]
  donorNames?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: () => void
}

export function SendNotificationDialog({
  eventId,
  userIds,
  donorNames,
  open,
  onOpenChange,
  onSent,
}: SendNotificationDialogProps) {
  const [message, setMessage] = useState('')
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
    if (!eventId) {
      toast.error('An event must be selected to send notifications')
      return
    }
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }
    if (userIds.length === 0) {
      toast.error('No recipients selected')
      return
    }

    const criteria: RecipientCriteria = {
      type: 'individual',
      user_ids: userIds,
    }

    setIsSending(true)
    try {
      await eventNotificationService.sendNotification(eventId, {
        message: message.trim(),
        recipient_criteria: criteria,
        channels: Array.from(channels),
      })
      toast.success(
        `Notification sent to ${userIds.length} donor${userIds.length !== 1 ? 's' : ''}`
      )
      setMessage('')
      setChannels(new Set(['in_app']))
      onOpenChange(false)
      onSent?.()
    } catch {
      toast.error('Failed to send notification')
    } finally {
      setIsSending(false)
    }
  }

  const recipientPreview =
    donorNames && donorNames.length > 0
      ? donorNames.length <= 3
        ? donorNames.join(', ')
        : `${donorNames.slice(0, 3).join(', ')} +${donorNames.length - 3} more`
      : `${userIds.length} donor${userIds.length !== 1 ? 's' : ''}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Bell className='h-5 w-5' />
            Send Notification
          </DialogTitle>
          <DialogDescription>
            Sending to: <span className='font-medium'>{recipientPreview}</span>
          </DialogDescription>
        </DialogHeader>

        {!eventId && (
          <div className='rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'>
            Select an event first to enable notifications.
          </div>
        )}

        <div className='space-y-4'>
          {/* Message */}
          <div className='space-y-2'>
            <Label htmlFor='notif-message'>Message</Label>
            <Textarea
              id='notif-message'
              placeholder='Enter your notification message...'
              value={message}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
              }
              rows={4}
              disabled={!eventId}
            />
            <p className='text-muted-foreground text-xs'>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>

          {/* Channels */}
          <div className='space-y-2'>
            <Label>Delivery Channels</Label>
            <div className='flex flex-wrap gap-4'>
              {CHANNELS.map((ch) => (
                <div key={ch.value} className='flex items-center gap-2'>
                  <Checkbox
                    id={`ch-${ch.value}`}
                    checked={channels.has(ch.value)}
                    disabled={ch.alwaysOn || !eventId}
                    onCheckedChange={() => toggleChannel(ch.value)}
                  />
                  <Label
                    htmlFor={`ch-${ch.value}`}
                    className='cursor-pointer text-sm font-normal'
                  >
                    {ch.label}
                    {ch.alwaysOn && (
                      <span className='text-muted-foreground ml-1 text-xs'>
                        (always on)
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
            {channels.has('sms') && message.length > SMS_LIMIT && (
              <p className='text-xs text-amber-600 dark:text-amber-400'>
                SMS messages over {SMS_LIMIT} characters will be truncated.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={isSending || !eventId || !message.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Sending…
              </>
            ) : (
              <>
                <Bell className='mr-2 h-4 w-4' />
                Send to {userIds.length}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
