/**
 * usePushNotifications — hook for managing Web Push subscription
 *
 * Provides subscribe/unsubscribe functionality and subscription state.
 */
import { useCallback, useEffect, useState } from 'react'
import apiClient from '@/lib/axios'

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

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSupported] = useState(
    () =>
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check current subscription status on mount
  useEffect(() => {
    if (!isSupported) return

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
      } catch {
        setIsSubscribed(false)
      }
    }

    void checkSubscription()
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported || isLoading) return

    setIsLoading(true)
    try {
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        return
      }

      // Get VAPID public key
      const vapidKey = await fetchVapidKey()
      if (!vapidKey) {
        return
      }

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready
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
    } catch {
      // Subscription failed - permission denied or VAPID error
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
    } catch {
      // Unsubscribe failed
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
