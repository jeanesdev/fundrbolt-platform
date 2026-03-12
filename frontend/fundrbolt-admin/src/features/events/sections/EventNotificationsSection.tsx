import { useState } from 'react'
import { ComposeNotification } from '@/features/events/notifications/ComposeNotification'
import { NotificationHistory } from '@/features/events/notifications/NotificationHistory'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventNotificationsSection() {
  const { currentEvent } = useEventWorkspace()
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className='space-y-8'>
      <ComposeNotification
        eventId={currentEvent.id}
        onSent={() => setRefreshKey((k) => k + 1)}
      />
      <NotificationHistory eventId={currentEvent.id} refreshKey={refreshKey} />
    </div>
  )
}
