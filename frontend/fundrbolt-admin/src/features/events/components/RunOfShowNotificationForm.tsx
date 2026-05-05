/**
 * RunOfShowNotificationForm — Panel for managing multiple timed notifications
 * attached to a single run-of-show item. Each notification fires N minutes
 * before the item's scheduled time.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createRosNotification,
  deleteRosNotification,
} from '@/services/runOfShowService'
import type {
  RosNotification,
  RosNotificationCreate,
} from '@/types/run-of-show'
import { Bell, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface RunOfShowNotificationFormProps {
  eventId: string
  itemId: string
  existingNotifications: RosNotification[]
  onClose: () => void
}

type RecipientType = RosNotificationCreate['recipient_type']

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  all_attendees: 'All attendees',
  donors: 'Donors only',
  auctioneer: 'Auctioneer only',
}

function formatMinutesBefore(minutes: number): string {
  if (minutes === 0) return 'At item time'
  if (minutes === 1) return '1 min before'
  return `${minutes} min before`
}

export function RunOfShowNotificationForm({
  eventId,
  itemId,
  existingNotifications,
  onClose,
}: RunOfShowNotificationFormProps) {
  const queryClient = useQueryClient()
  const [messageBody, setMessageBody] = useState('')
  const [recipientType, setRecipientType] =
    useState<RecipientType>('all_attendees')
  const [minutesBefore, setMinutesBefore] = useState(15)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: RosNotificationCreate) =>
      createRosNotification(eventId, itemId, payload),
    onSuccess: () => {
      toast.success('Notification added')
      setMessageBody('')
      setMinutesBefore(15)
      invalidate()
    },
    onError: () => toast.error('Failed to add notification'),
  })

  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) =>
      deleteRosNotification(eventId, itemId, notificationId),
    onSuccess: () => {
      toast.success('Notification removed')
      invalidate()
    },
    onError: () => toast.error('Failed to remove notification'),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = messageBody.trim()
    if (!trimmed) return
    createMutation.mutate({
      message_body: trimmed,
      recipient_type: recipientType,
      minutes_before: minutesBefore,
    })
  }

  // Sort notifications by minutes_before descending (earliest → furthest from item time)
  const sorted = [...existingNotifications].sort(
    (a, b) => b.minutes_before - a.minutes_before
  )

  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        Notifications
      </p>

      {/* Existing notifications list */}
      {sorted.length > 0 && (
        <ul className='space-y-2'>
          {sorted.map((n) => (
            <li
              key={n.id}
              className='bg-muted/50 flex items-start gap-2 rounded p-2 text-sm'
            >
              <Bell className='text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0' />
              <div className='min-w-0 flex-1'>
                <p className='leading-tight font-medium'>{n.message_body}</p>
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  {formatMinutesBefore(n.minutes_before)} ·{' '}
                  {RECIPIENT_LABELS[n.recipient_type as RecipientType] ??
                    n.recipient_type}{' '}
                  ·{' '}
                  <span
                    className={
                      n.delivery_status === 'delivered'
                        ? 'text-green-600'
                        : n.delivery_status === 'failed'
                          ? 'text-red-500'
                          : n.delivery_status === 'cancelled'
                            ? 'text-gray-400'
                            : 'text-muted-foreground'
                    }
                  >
                    {n.delivery_status}
                  </span>
                </p>
              </div>
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-6 w-6 shrink-0 text-red-400 hover:text-red-600'
                onClick={() => deleteMutation.mutate(n.id)}
                disabled={deleteMutation.isPending}
                title='Remove notification'
              >
                {deleteMutation.isPending ? (
                  <Loader2 className='h-3 w-3 animate-spin' />
                ) : (
                  <Trash2 className='h-3 w-3' />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new notification form */}
      <form onSubmit={handleAdd} className='space-y-2 border-t pt-2'>
        <p className='text-muted-foreground text-xs'>Add interval</p>
        <Textarea
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          placeholder='Notification message...'
          rows={2}
          className='text-sm'
          required
        />
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1'>
            <Label className='shrink-0 text-xs'>Min before</Label>
            <Input
              type='number'
              min={0}
              max={1440}
              value={minutesBefore}
              onChange={(e) => setMinutesBefore(Number(e.target.value))}
              className='h-8 w-20 text-xs'
            />
          </div>
          <Select
            value={recipientType}
            onValueChange={(v) => setRecipientType(v as RecipientType)}
          >
            <SelectTrigger className='h-8 flex-1 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all_attendees'>All attendees</SelectItem>
              <SelectItem value='donors'>Donors only</SelectItem>
              <SelectItem value='auctioneer'>Auctioneer only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type='submit'
            size='sm'
            variant='outline'
            className='h-8 shrink-0'
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            ) : (
              <Plus className='mr-1 h-3 w-3' />
            )}
            Add
          </Button>
        </div>
      </form>

      <div className='flex justify-end'>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='h-7'
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  )
}
