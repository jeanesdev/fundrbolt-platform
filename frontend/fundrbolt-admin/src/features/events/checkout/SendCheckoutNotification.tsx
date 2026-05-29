/**
 * SendCheckoutNotification — T049
 *
 * Buttons to send checkout links / reminders to all or incomplete donors,
 * with confirmation dialogs.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Bell, HandHeart, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { sendCheckoutLink, sendCheckoutReminder } from '@/lib/api/checkout'
import { getEventAttendees } from '@/lib/api/admin-attendees'
import { getDonorPwaUrl } from '@/lib/donor-portal'
import { donorDashboardService } from '@/services/donor-dashboard'
import { eventNotificationService } from '@/services/eventNotificationService'
import { useNPOContextStore } from '@/stores/npo-context-store'
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
import { Textarea } from '@/components/ui/textarea'

interface SendCheckoutNotificationProps {
  eventId: string
}

export function SendCheckoutNotification({
  eventId,
}: SendCheckoutNotificationProps) {
  const [confirmLinkOpen, setConfirmLinkOpen] = useState(false)
  const [confirmReminderOpen, setConfirmReminderOpen] = useState(false)
  const [donationPleaOpen, setDonationPleaOpen] = useState(false)
  const [pleaMessage, setPleaMessage] = useState('')
  const [pleaLink, setPleaLink] = useState('')

  const { availableNpos, selectedNpoId } = useNPOContextStore((state) => ({
    availableNpos: state.availableNpos,
    selectedNpoId: state.selectedNpoId,
  }))

  const selectedNpoSlug = useMemo(() => {
    if (!selectedNpoId) return ''
    const selectedNpo = availableNpos.find((npo) => npo.id === selectedNpoId)
    return selectedNpo?.slug ?? ''
  }, [availableNpos, selectedNpoId])

  const defaultDonateNowLink = useMemo(() => {
    if (!selectedNpoSlug) return ''
    return new URL(
      `/npo/${selectedNpoSlug}/donate-now`,
      getDonorPwaUrl()
    ).toString()
  }, [selectedNpoSlug])

  const { data: donationPleaRecipients, isFetching: isLoadingRecipients } =
    useQuery({
      queryKey: ['checkout-donation-plea-recipients', eventId],
      queryFn: async () => {
        const attendeesResult = await getEventAttendees(eventId, false)
        if (attendeesResult instanceof Blob) {
          throw new Error('Expected attendee JSON payload')
        }

        const attendeeUserIds = Array.from(
          new Set(
            attendeesResult.attendees
              .filter(
                (attendee) =>
                  attendee.user_id &&
                  (attendee.status === 'confirmed' ||
                    attendee.status === 'active')
              )
              .map((attendee) => attendee.user_id as string)
          )
        )

        const firstPage = await donorDashboardService.getLeaderboard({
          event_id: eventId,
          page: 1,
          per_page: 200,
        })

        const leaderboardItems = [...firstPage.items]
        if (firstPage.pages > 1) {
          const extraPages = await Promise.all(
            Array.from({ length: firstPage.pages - 1 }, (_, index) =>
              donorDashboardService.getLeaderboard({
                event_id: eventId,
                page: index + 2,
                per_page: 200,
              })
            )
          )
          for (const page of extraPages) {
            leaderboardItems.push(...page.items)
          }
        }

        const donationTotalsByUserId = new Map<string, number>()
        for (const donor of leaderboardItems) {
          donationTotalsByUserId.set(donor.user_id, donor.donation_total)
        }

        const nonDonorUserIds = attendeeUserIds.filter(
          (userId) => (donationTotalsByUserId.get(userId) ?? 0) <= 0
        )

        return {
          userIds: nonDonorUserIds,
          attendeeCount: attendeeUserIds.length,
          nonDonorCount: nonDonorUserIds.length,
        }
      },
      enabled: donationPleaOpen,
    })

  const sendLinkMutation = useMutation({
    mutationFn: () => sendCheckoutLink(eventId),
    onSuccess: (result) => {
      toast.success(`Checkout links sent to ${result.dispatched} donor(s)`)
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
      toast.success(`Reminders sent to ${result.dispatched} donor(s)`)
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send reminders'
      )
    },
  })

  const sendDonationPleaMutation = useMutation({
    mutationFn: async () => {
      const recipientUserIds = donationPleaRecipients?.userIds ?? []
      if (recipientUserIds.length === 0) {
        throw new Error('No non-donor attendees found to notify')
      }

      const message = pleaMessage.trim()
      if (!message) {
        throw new Error('Please enter a message')
      }

      const link = pleaLink.trim()
      const finalMessage = link ? `${message}\n\nDonate now: ${link}` : message

      await eventNotificationService.sendNotification(eventId, {
        message: finalMessage,
        recipient_criteria: {
          type: 'individual',
          user_ids: recipientUserIds,
        },
        channels: ['in_app'],
      })

      return recipientUserIds.length
    },
    onSuccess: (recipientCount) => {
      toast.success(`Donation plea sent to ${recipientCount} attendee(s)`)
      setDonationPleaOpen(false)
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send donation plea'
      )
    },
  })

  const openDonationPleaDialog = () => {
    setPleaMessage(
      "Your support makes a difference. If you haven't donated yet, please consider making a gift today."
    )
    setPleaLink(defaultDonateNowLink)
    setDonationPleaOpen(true)
  }

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

      <Button
        variant='outline'
        size='sm'
        disabled={sendDonationPleaMutation.isPending}
        onClick={openDonationPleaDialog}
      >
        <HandHeart className='mr-1.5 h-3.5 w-3.5' />
        Send Donation Plea to Attendees who didn't donate
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

      <Dialog open={donationPleaOpen} onOpenChange={setDonationPleaOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <HandHeart className='h-5 w-5' />
              Send Donation Plea
            </DialogTitle>
            <DialogDescription>
              Notify attendees who have not made a donation yet with a message
              and direct donate-now link.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='rounded-md border bg-slate-50 p-3 text-sm dark:bg-slate-900/30'>
              {isLoadingRecipients ? (
                <div className='text-muted-foreground flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Loading attendees...
                </div>
              ) : (
                <>
                  <p>
                    Recipients:{' '}
                    <strong>{donationPleaRecipients?.nonDonorCount ?? 0}</strong>{' '}
                    non-donor attendee(s)
                  </p>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    Total active attendees checked:{' '}
                    {donationPleaRecipients?.attendeeCount ?? 0}
                  </p>
                </>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='donation-plea-message'>Message</Label>
              <Textarea
                id='donation-plea-message'
                rows={4}
                value={pleaMessage}
                onChange={(e) => setPleaMessage(e.target.value)}
                placeholder='Enter your donation plea message...'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='donation-plea-link'>Donate Now Link</Label>
              <Input
                id='donation-plea-link'
                value={pleaLink}
                onChange={(e) => setPleaLink(e.target.value)}
                placeholder='https://.../npo/{slug}/donate-now'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDonationPleaOpen(false)}
              disabled={sendDonationPleaMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendDonationPleaMutation.mutate()}
              disabled={
                sendDonationPleaMutation.isPending ||
                isLoadingRecipients ||
                !pleaMessage.trim() ||
                (donationPleaRecipients?.nonDonorCount ?? 0) === 0
              }
            >
              {sendDonationPleaMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Sending...
                </>
              ) : (
                <>
                  <HandHeart className='mr-2 h-4 w-4' />
                  Send Plea
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
