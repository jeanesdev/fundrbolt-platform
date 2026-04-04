import { Button } from '@/components/ui/button'
import { ContentSection } from '@/features/settings/components/content-section'
import { NotificationPreferencesForm } from '@/features/settings/components/notification-preferences-form'
import { PushNotificationToggle } from '@/features/settings/components/push-notification-toggle'
import apiClient from '@/lib/axios'
import { createFileRoute } from '@tanstack/react-router'
import { AxiosError } from 'axios'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

function TestNotificationButton() {
  const [sending, setSending] = useState(false)

  const sendTest = async () => {
    setSending(true)
    try {
      const res = await apiClient.post<{
        push_sent?: boolean
        error?: string
        message?: string
      }>('/notifications/push/test')
      if (res.data.error) {
        toast.error(res.data.error)
      } else {
        toast.success(
          res.data.push_sent
            ? 'Test sent! You should receive a push notification shortly.'
            : 'Test sent (in-app only — push may not have been delivered).'
        )
      }
    } catch (err: unknown) {
      const detail =
        err instanceof AxiosError && typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : 'Failed to send test notification.'
      toast.error(detail)
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      variant='outline'
      size='sm'
      onClick={() => void sendTest()}
      disabled={sending}
      className='gap-2'
    >
      <Send className='h-4 w-4' />
      {sending ? 'Sending…' : 'Send Test Notification'}
    </Button>
  )
}

function SettingsNotifications() {
  return (
    <div className='space-y-8'>
      <ContentSection
        title='Push Notifications'
        desc='Receive alerts even when the app is closed.'
      >
        <div className='space-y-3'>
          <PushNotificationToggle />
          <div>
            <TestNotificationButton />
            <p className='text-muted-foreground mt-1 text-xs'>
              Sends a test push and in-app notification to verify delivery.
            </p>
          </div>
        </div>
      </ContentSection>
      <ContentSection
        title='Notification Preferences'
        desc='Choose how you want to be notified for each type of event.'
      >
        <NotificationPreferencesForm />
      </ContentSection>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  component: SettingsNotifications,
})
