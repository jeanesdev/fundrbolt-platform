/**
 * NotificationPreferencesForm (T061)
 *
 * Grid of notification types × delivery channels with toggle switches.
 * Loads preferences from GET /api/v1/notifications/preferences
 * Saves on each toggle change with PUT /api/v1/notifications/preferences
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { Switch } from '@/components/ui/switch'

interface Preference {
  notification_type: string
  channel: string
  enabled: boolean
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  outbid: 'Outbid',
  item_won: 'Item Won',
  auction_opened: 'Auction Opening',
  auction_closing_soon: 'Auction Closing',
  checkout_reminder: 'Checkout Reminder',
  custom: 'Admin Messages',
  bid_confirmation: 'Bid Confirmation',
  welcome: 'Welcome',
}

const NOTIFICATION_TYPE_ORDER = [
  'outbid',
  'item_won',
  'auction_opened',
  'auction_closing_soon',
  'checkout_reminder',
  'custom',
  'bid_confirmation',
  'welcome',
]

const CHANNEL_LABELS: Record<string, string> = {
  inapp: 'In-App',
  push: 'Push',
  email: 'Email',
  sms: 'SMS',
}

const CHANNELS = ['inapp', 'push', 'email', 'sms'] as const

export function NotificationPreferencesForm() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasPhone, setHasPhone] = useState<boolean | null>(null)
  const [pushStatus, setPushStatus] = useState<string>('unknown')

  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        preferences: Preference[]
        has_phone: boolean
      }>('/notifications/preferences')
      setPreferences(res.data.preferences)
      setHasPhone(res.data.has_phone ?? null)
    } catch {
      toast.error('Failed to load notification preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission)
    }
  }, [])

  const isEnabled = (type: string, channel: string): boolean => {
    const pref = preferences.find(
      (p) => p.notification_type === type && p.channel === channel
    )
    return pref?.enabled ?? false
  }

  const togglePreference = async (type: string, channel: string) => {
    if (channel === 'inapp') return

    const current = isEnabled(type, channel)
    const snapshot = preferences
    const updated = preferences.map((p) =>
      p.notification_type === type && p.channel === channel
        ? { ...p, enabled: !current }
        : p
    )
    setPreferences(updated)

    setSaving(true)
    try {
      await apiClient.put('/notifications/preferences', {
        preferences: [{ notification_type: type, channel, enabled: !current }],
      })
    } catch {
      setPreferences(snapshot)
      toast.error('Failed to save preference')
    } finally {
      setSaving(false)
    }
  }

  const notificationTypes = NOTIFICATION_TYPE_ORDER.filter((type) =>
    preferences.some((p) => p.notification_type === type)
  )
  // Include any types from server not in our predefined order
  const extraTypes = Array.from(
    new Set(preferences.map((p) => p.notification_type))
  ).filter((t) => !NOTIFICATION_TYPE_ORDER.includes(t))
  const allTypes = [...notificationTypes, ...extraTypes]

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-muted-foreground text-sm'>Loading preferences…</p>
      </div>
    )
  }

  if (allTypes.length === 0) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-muted-foreground text-sm'>
          No notification preferences available.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {pushStatus === 'denied' && (
        <div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'>
          <AlertTriangle className='h-4 w-4 flex-shrink-0' />
          Push notifications are blocked. Enable them in your browser settings.
        </div>
      )}

      {hasPhone === false && (
        <div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'>
          <AlertTriangle className='h-4 w-4 flex-shrink-0' />
          No phone number on file. SMS notifications require a verified phone
          number.
        </div>
      )}

      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b'>
              <th className='py-3 pr-4 text-left font-medium'>Type</th>
              {CHANNELS.map((ch) => (
                <th key={ch} className='px-3 py-3 text-center font-medium'>
                  {CHANNEL_LABELS[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTypes.map((type) => (
              <tr key={type} className='border-b last:border-b-0'>
                <td className='py-3 pr-4'>
                  {NOTIFICATION_TYPE_LABELS[type] ?? type}
                </td>
                {CHANNELS.map((ch) => (
                  <td key={ch} className='px-3 py-3 text-center'>
                    {ch === 'inapp' ? (
                      <Switch checked disabled className='mx-auto' />
                    ) : ch === 'sms' && hasPhone === false ? (
                      <Switch disabled className='mx-auto' />
                    ) : (
                      <Switch
                        checked={isEnabled(type, ch)}
                        onCheckedChange={() => void togglePreference(type, ch)}
                        disabled={saving}
                        className='mx-auto'
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
