import { createFileRoute } from '@tanstack/react-router'
import { ContentSection } from '@/features/settings/components/content-section'
import { NotificationPreferencesForm } from '@/features/settings/components/notification-preferences-form'

function SettingsNotifications() {
  return (
    <div className='space-y-8'>
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
