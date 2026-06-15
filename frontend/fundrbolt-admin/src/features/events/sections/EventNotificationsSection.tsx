import { useState } from 'react'
import { Route } from '@/routes/_authenticated/events/$eventId/notifications'
import { ComposeNotification } from '@/features/events/notifications/ComposeNotification'
import { NotificationHistory } from '@/features/events/notifications/NotificationHistory'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventNotificationsSection() {
  const { currentEvent } = useEventWorkspace()
  const { audience, item_id, rg_item_id } = Route.useSearch()
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className='space-y-8'>
      <ComposeNotification
        eventId={currentEvent.id}
        initialAudience={audience}
        initialItemId={item_id}
        initialRgItemId={rg_item_id}
        onSent={() => setRefreshKey((k) => k + 1)}
      />
      <NotificationHistory eventId={currentEvent.id} refreshKey={refreshKey} />
    </div>
  )
}
