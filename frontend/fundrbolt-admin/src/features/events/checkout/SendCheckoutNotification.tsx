/**
 * SendCheckoutNotification — T049
 *
 * Buttons to send checkout links / reminders to all or incomplete donors,
 * with confirmation dialogs.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, Send } from 'lucide-react'
import { toast } from 'sonner'
import { sendCheckoutLink, sendCheckoutReminder } from '@/lib/api/checkout'
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
import { Button } from '@/components/ui/button'

interface SendCheckoutNotificationProps {
  eventId: string
}

export function SendCheckoutNotification({
  eventId,
}: SendCheckoutNotificationProps) {
  const [confirmLinkOpen, setConfirmLinkOpen] = useState(false)
  const [confirmReminderOpen, setConfirmReminderOpen] = useState(false)

  const sendLinkMutation = useMutation({
    mutationFn: () => sendCheckoutLink(eventId),
    onSuccess: (result) => {
      toast.success(
        result.message ||
          `Checkout links queued for ${result.queued_count} donor(s)`
      )
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send checkout links'
      )
    },
  })

  const sendReminderMutation = useMutation({
    mutationFn: () => sendCheckoutReminder(eventId),
    onSuccess: (result) => {
      toast.success(
        result.message || `Reminders queued for ${result.queued_count} donor(s)`
      )
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send reminders'
      )
    },
  })

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        disabled={sendLinkMutation.isPending}
        onClick={() => setConfirmLinkOpen(true)}
      >
        <Send className='mr-1.5 h-3.5 w-3.5' />
        Send Checkout Link to All
      </Button>

      <Button
        variant='outline'
        size='sm'
        disabled={sendReminderMutation.isPending}
        onClick={() => setConfirmReminderOpen(true)}
      >
        <Bell className='mr-1.5 h-3.5 w-3.5' />
        Send Reminder to Incomplete
      </Button>

      {/* Confirm send link */}
      <AlertDialog open={confirmLinkOpen} onOpenChange={setConfirmLinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Checkout Links</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a checkout link to all registered donors. Are you
              sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLinkOpen(false)
                sendLinkMutation.mutate()
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm send reminder */}
      <AlertDialog
        open={confirmReminderOpen}
        onOpenChange={setConfirmReminderOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Reminders</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a reminder to donors who have not yet completed
              checkout. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReminderOpen(false)
                sendReminderMutation.mutate()
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
