/**
 * usePushNotifications — hook for managing Web Push subscription
 *
 * Provides subscribe/unsubscribe functionality and subscription state.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'

interface UsePushNotificationsOptions {
  /** Whether the hook should run (defaults to true). Set false for unauthenticated contexts. */
  enabled?: boolean
}

interface UsePushNotificationsResult {
  /** Whether the browser supports push notifications */
  isSupported: boolean
  /** Whether the user is currently subscribed */
  isSubscribed: boolean
  /** Whether a subscribe/unsubscribe operation is in progress */
  isLoading: boolean
  /** Subscribe to push notifications */
  subscribe: () => Promise<void>
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>
}

async function fetchVapidKey(): Promise<string> {
  const response = await apiClient.get<{ public_key: string }>(
    '/notifications/push/vapid-key'
  )
  return response.data.public_key
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications(
  options?: UsePushNotificationsOptions
): UsePushNotificationsResult {
  const { enabled = true } = options ?? {}
  const [isSupported] = useState(
    () =>
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check current subscription status on mount and auto-restore if needed
  // (e.g. after PWA reinstall: permission was granted but subscription is gone)
  useEffect(() => {
    if (!isSupported || !enabled) return

    const checkAndRestore = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          // Re-register with backend to ensure ownership matches the
          // currently logged-in user (covers login-as-different-user).
          try {
            const subJson = subscription.toJSON()
            await apiClient.post('/notifications/push/subscribe', {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh ?? '',
                auth: subJson.keys?.auth ?? '',
              },
              platform: 'web',
            })
          } catch {
            // Best effort — the subscription may still work
          }
          setIsSubscribed(true)
          return
        }

        // No active subscription — if permission was previously granted,
        // silently re-subscribe (covers PWA reinstall / SW replacement).
        if (Notification.permission === 'granted') {
          try {
            const vapidKey = await fetchVapidKey()
            if (!vapidKey) return

            const newSub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            const subJson = newSub.toJSON()
            await apiClient.post('/notifications/push/subscribe', {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh ?? '',
                auth: subJson.keys?.auth ?? '',
              },
              platform: 'web',
            })

            setIsSubscribed(true)
          } catch {
            // Silent failure — user can still manually re-enable via settings
            setIsSubscribed(false)
          }
        } else {
          setIsSubscribed(false)
        }
      } catch {
        setIsSubscribed(false)
      }
    }

    void checkAndRestore()
  }, [isSupported, enabled])

  const subscribe = useCallback(async () => {
    if (!isSupported || isLoading) return

    setIsLoading(true)
    try {
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error(
          permission === 'denied'
            ? 'Notifications blocked. Enable them in your browser/device settings.'
            : 'Notification permission was not granted.'
        )
        return
      }

      // Get VAPID public key
      const vapidKey = await fetchVapidKey()
      if (!vapidKey) {
        toast.error('Push notifications are not configured on the server.')
        return
      }

      // Subscribe to push
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Service worker not available')),
            5000
          )
        ),
      ])
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      // Send subscription to backend
      const subJson = subscription.toJSON()
      await apiClient.post('/notifications/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh ?? '',
          auth: subJson.keys?.auth ?? '',
        },
        platform: 'web',
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('Push subscribe failed:', err)
      toast.error('Failed to enable push notifications. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, isLoading])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || isLoading) return

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Notify backend
        await apiClient.post('/notifications/push/unsubscribe', {
          endpoint: subscription.endpoint,
        })
        // Unsubscribe locally
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe failed:', err)
      toast.error('Failed to disable push notifications.')
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, isLoading])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  }
}
