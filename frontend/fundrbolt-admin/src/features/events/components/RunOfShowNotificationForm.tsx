/**
 * RunOfShowNotificationForm — Expandable panel for managing a notification
 * attached to a single run-of-show item.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRosNotification,
  deleteRosNotification,
  getRosNotification,
} from '@/services/runOfShowService'
import type { RosNotificationCreate } from '@/types/run-of-show'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
  hasExistingNotification: boolean
  onClose: () => void
}

type RecipientType = RosNotificationCreate['recipient_type']

export function RunOfShowNotificationForm({
  eventId,
  itemId,
  hasExistingNotification,
  onClose,
}: RunOfShowNotificationFormProps) {
  const queryClient = useQueryClient()
  const [messageBody, setMessageBody] = useState('')
  const [recipientType, setRecipientType] =
    useState<RecipientType>('all_attendees')

  const { data: existingNotification, isLoading: loadingNotification } =
    useQuery({
      queryKey: ['ros-notification', eventId, itemId],
      queryFn: () => getRosNotification(eventId, itemId),
      enabled: hasExistingNotification,
      retry: false,
    })

  const createMutation = useMutation({
    mutationFn: (payload: RosNotificationCreate) =>
      createRosNotification(eventId, itemId, payload),
    onSuccess: () => {
      toast.success('Notification saved')
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
      void queryClient.invalidateQueries({
        queryKey: ['ros-notification', eventId, itemId],
      })
      onClose()
    },
    onError: () => toast.error('Failed to save notification'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRosNotification(eventId, itemId),
    onSuccess: () => {
      toast.success('Notification removed')
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
      void queryClient.invalidateQueries({
        queryKey: ['ros-notification', eventId, itemId],
      })
      onClose()
    },
    onError: () => toast.error('Failed to remove notification'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = messageBody.trim()
    if (!trimmed) return
    createMutation.mutate({
      message_body: trimmed,
      recipient_type: recipientType,
    })
  }

  if (loadingNotification) {
    return (
      <div className='flex items-center gap-2 py-2 text-sm'>
        <Loader2 className='h-4 w-4 animate-spin' />
        Loading notification...
      </div>
    )
  }

  if (existingNotification) {
    return (
      <div className='space-y-2 text-sm'>
        <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
          Notification
        </p>
        <p className='rounded bg-amber-50 p-2 dark:bg-amber-950'>
          {existingNotification.message_body}
        </p>
        <p className='text-muted-foreground text-xs'>
          Recipients: {existingNotification.recipient_type.replace('_', ' ')} ·
          Status: {existingNotification.delivery_status}
        </p>
        <div className='flex gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='h-7 text-red-500 hover:text-red-700'
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            ) : (
              <Trash2 className='mr-1 h-3 w-3' />
            )}
            Remove
          </Button>
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

  return (
    <form onSubmit={handleSubmit} className='space-y-2'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        Add Notification
      </p>
      <Textarea
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        placeholder='Notification message...'
        rows={2}
        className='text-sm'
        required
      />
      <div className='flex items-center gap-2'>
        <Label className='shrink-0 text-xs'>Recipients</Label>
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
          {createMutation.isPending && (
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
          )}
          Save
        </Button>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='h-8 shrink-0'
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
