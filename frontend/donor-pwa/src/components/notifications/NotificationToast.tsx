/**
 * NotificationToast — animated toast for incoming notifications
 *
 * Uses Sonner's toast.custom() for display.
 * Styled per notification type (outbid → amber, item_won → green, default → primary).
 * Includes slide-in entrance, icon bounce, accent glow, and auto-dismiss timer bar.
 * T064: Supports animation_type in data payload (confetti, flash, pulse).
 */
import type { NotificationData } from '@/services/notification-service'
import { Bell, Gavel, Trophy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfettiAnimation } from './ConfettiAnimation'

const TOAST_DURATION = 5000

interface ToastTheme {
  bg: string
  border: string
  glow: string
  iconBg: string
  iconColor: string
  timerBar: string
  icon: React.ReactNode
}

function getToastTheme(type: string): ToastTheme {
  switch (type) {
    case 'outbid':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/90',
        border: 'border-amber-300 dark:border-amber-700',
        glow: 'shadow-[0_0_20px_rgba(251,191,36,0.25)] dark:shadow-[0_0_20px_rgba(251,191,36,0.15)]',
        iconBg: 'bg-amber-100 dark:bg-amber-900/60',
        iconColor: 'text-amber-600 dark:text-amber-400',
        timerBar: 'bg-amber-400 dark:bg-amber-500',
        icon: <Gavel className='h-5 w-5' />,
      }
    case 'item_won':
      return {
        bg: 'bg-green-50 dark:bg-green-950/90',
        border: 'border-green-300 dark:border-green-700',
        glow: 'shadow-[0_0_20px_rgba(34,197,94,0.25)] dark:shadow-[0_0_20px_rgba(34,197,94,0.15)]',
        iconBg: 'bg-green-100 dark:bg-green-900/60',
        iconColor: 'text-green-600 dark:text-green-400',
        timerBar: 'bg-green-400 dark:bg-green-500',
        icon: <Trophy className='h-5 w-5' />,
      }
    default:
      return {
        bg: 'bg-background',
        border: 'border-primary/30 dark:border-primary/20',
        glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)] dark:shadow-[0_0_20px_rgba(129,140,248,0.1)]',
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
        timerBar: 'bg-primary/60',
        icon: <Bell className='h-5 w-5' />,
      }
  }
}

function getAnimationClass(animationType: string | undefined): string {
  switch (animationType) {
    case 'flash':
      return 'animate-outbid-flash'
    case 'pulse':
      return 'animate-bid-confirmed-pulse'
    default:
      return ''
  }
}

interface NotificationToastProps {
  notification: NotificationData
  onDismiss: () => void
}

export function NotificationToast({
  notification,
  onDismiss,
}: NotificationToastProps) {
  const theme = getToastTheme(notification.notification_type)
  const animationType = notification.data?.animation_type as string | undefined
  const animationClass = getAnimationClass(animationType)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const deepLink = notification.data?.deep_link as string | undefined

  const [visible, setVisible] = useState(false)

  // Trigger entrance animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Haptic feedback for outbid and item_won notifications
  useEffect(() => {
    const type = notification.notification_type
    if (type !== 'outbid' && type !== 'item_won') return
    if (prefersReducedMotion) return
    navigator.vibrate?.(200)
  }, [notification.notification_type, prefersReducedMotion])

  const handleClick = () => {
    onDismiss()
    if (deepLink) {
      // Navigate using the main app's history (works outside RouterProvider)
      window.location.href = deepLink
    }
  }

  return (
    <>
      {animationType === 'confetti' && !prefersReducedMotion && (
        <ConfettiAnimation />
      )}
      <div
        className={[
          // Layout
          'relative w-full overflow-hidden rounded-xl border backdrop-blur-sm',
          // Entrance animation
          prefersReducedMotion
            ? 'opacity-100'
            : 'transition-all duration-500 ease-out',
          visible && !prefersReducedMotion
            ? 'translate-y-0 scale-100 opacity-100'
            : !prefersReducedMotion
              ? '-translate-y-3 scale-95 opacity-0'
              : '',
          // Theme
          theme.bg,
          theme.border,
          theme.glow,
          // Extra animation
          animationClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type='button'
          onClick={handleClick}
          className='flex w-full items-start gap-3 p-4 text-left transition-colors active:opacity-80'
        >
          {/* Icon with bounce */}
          <div
            className={[
              'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
              theme.iconBg,
              theme.iconColor,
              !prefersReducedMotion && 'animate-toast-icon-bounce',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {theme.icon}
          </div>

          {/* Content */}
          <div className='min-w-0 flex-1'>
            <p className='text-foreground text-sm font-semibold leading-tight'>
              {notification.title}
            </p>
            <p className='text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed'>
              {notification.body}
            </p>
          </div>

          {/* Dismiss */}
          <div
            role='button'
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onDismiss()
              }
            }}
            className='text-muted-foreground/60 hover:text-foreground mt-0.5 flex-shrink-0 rounded-full p-0.5 transition-colors'
          >
            <X className='h-3.5 w-3.5' />
          </div>
        </button>

        {/* Timer bar */}
        {!prefersReducedMotion && (
          <div className='absolute inset-x-0 bottom-0 h-[3px] overflow-hidden'>
            <div
              className={`h-full ${theme.timerBar} animate-toast-timer origin-left rounded-full`}
              style={
                {
                  '--toast-duration': `${TOAST_DURATION}ms`,
                } as React.CSSProperties
              }
            />
          </div>
        )}
      </div>
    </>
  )
}
