/**
 * NotificationToastOverlay — renders notification toasts using vanilla DOM.
 *
 * Uses pure DOM manipulation (no React rendering) to avoid React 19
 * concurrent scheduling issues with socket.io state updates.
 * The CSS animations/keyframes come from index.css (Tailwind isn't available
 * for dynamically-created elements outside of the React tree, so we use
 * inline styles + the keyframe animations defined in the global stylesheet).
 */
import type { NotificationData } from '@/services/notification-service'
import { useEffect } from 'react'

const TOAST_DURATION = 5000
const MAX_VISIBLE = 3
const TOAST_EVENT = 'fundrbolt:show-toast'

/** Call this from anywhere to show a notification toast */
export function triggerNotificationToast(notification: NotificationData) {
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, { detail: notification }),
  )
}

// --- Module-level vanilla DOM toast renderer ---

let containerEl: HTMLDivElement | null = null
const activeToasts = new Map<
  string,
  { el: HTMLDivElement; timer: ReturnType<typeof setTimeout> }
>()

function getThemeColors(type: string) {
  switch (type) {
    case 'outbid':
      return {
        bg: '#fffbeb',
        border: '#fcd34d',
        glow: '0 0 20px rgba(251,191,36,0.25)',
        iconBg: '#fef3c7',
        iconColor: '#d97706',
        timerBar: '#fbbf24',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>`,
      }
    case 'item_won':
      return {
        bg: '#f0fdf4',
        border: '#86efac',
        glow: '0 0 20px rgba(34,197,94,0.25)',
        iconBg: '#dcfce7',
        iconColor: '#16a34a',
        timerBar: '#4ade80',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/><path d="M6 3h12"/><path d="M6 3a2 2 0 0 0-2 2c0 3.167-1.667 4-4 6.5 1 0 2 1 4 3 1.5 1.5 2.5 3 2.5 3"/><path d="M18 3a2 2 0 0 1 2 2c0 3.167 1.667 4 4 6.5-1 0-2 1-4 3-1.5 1.5-2.5 3-2.5 3"/></svg>`,
      }
    default:
      return {
        bg: '#eef2ff',
        border: '#a5b4fc',
        glow: '0 0 20px rgba(99,102,241,0.15)',
        iconBg: '#e0e7ff',
        iconColor: '#4f46e5',
        timerBar: '#818cf8',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
      }
  }
}

function ensureContainer() {
  if (!containerEl) {
    containerEl = document.createElement('div')
    containerEl.id = 'notification-toast-overlay'
    containerEl.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:9999;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 16px 0;'
    document.body.appendChild(containerEl)
  }
}

function enforceMaxVisible() {
  // Remove oldest toasts if over limit
  const ids = Array.from(activeToasts.keys())
  while (ids.length > MAX_VISIBLE) {
    const oldestId = ids.shift()!
    dismissToast(oldestId)
  }
}

function addToast(notification: NotificationData) {
  if (activeToasts.has(notification.id)) return
  ensureContainer()

  const theme = getThemeColors(notification.notification_type)
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Create toast wrapper
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-toast-id', notification.id)
  wrapper.style.cssText = `
    pointer-events:auto;width:100%;max-width:28rem;
    animation: toast-slide-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  `

  // Toast card
  const isUrgent =
    notification.notification_type === 'outbid' ||
    notification.notification_type === 'item_won'
  const card = document.createElement('div')
  card.style.cssText = `
    position:relative;width:100%;overflow:hidden;border-radius:12px;
    border:1px solid ${theme.border};background:${theme.bg};
    box-shadow:${theme.glow}, 0 4px 6px -1px rgba(0,0,0,0.1);
    backdrop-filter:blur(8px);
    --toast-glow: ${theme.glow}, 0 4px 6px -1px rgba(0,0,0,0.1);
    --toast-glow-bright: ${theme.glow.replace(/0\.\d+\)/, '0.5)')}, 0 8px 16px -2px rgba(0,0,0,0.15);
    ${isUrgent && !prefersReduced ? 'animation: toast-glow-pulse 1.5s ease-in-out 0.5s 2;' : ''}
  `

  // Button (entire clickable area)
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.style.cssText = `
    display:flex;width:100%;align-items:flex-start;gap:12px;padding:16px;
    text-align:left;background:none;border:none;cursor:pointer;
    font-family:inherit;color:inherit;
    transition:opacity 0.15s;
  `
  btn.addEventListener('pointerdown', () => {
    btn.style.opacity = '0.8'
  })
  btn.addEventListener('pointerup', () => {
    btn.style.opacity = '1'
  })
  btn.addEventListener('click', () => {
    dismissToast(notification.id)
    const deepLink = notification.data?.deep_link as string | undefined
    if (deepLink) window.location.href = deepLink
  })

  // Leading visual: thumbnail image if available, otherwise icon circle
  const imageUrl = notification.data?.image_url as string | undefined
  let leadingEl: HTMLElement

  if (imageUrl) {
    const img = document.createElement('img')
    img.src = imageUrl
    img.alt = (notification.data?.item_title as string) || 'Item'
    img.style.cssText = `
      flex-shrink:0;width:44px;height:44px;border-radius:8px;margin-top:2px;
      object-fit:cover;background:${theme.iconBg};
    `
    if (!prefersReduced) {
      img.style.animation =
        'toast-icon-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both'
    }
    leadingEl = img
  } else {
    const iconWrap = document.createElement('div')
    iconWrap.style.cssText = `
      flex-shrink:0;display:flex;align-items:center;justify-content:center;
      width:36px;height:36px;border-radius:50%;margin-top:2px;
      background:${theme.iconBg};color:${theme.iconColor};
    `
    if (!prefersReduced) {
      iconWrap.style.animation =
        'toast-icon-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both'
    }
    iconWrap.innerHTML = theme.iconSvg
    leadingEl = iconWrap
  }

  // Text
  const textWrap = document.createElement('div')
  textWrap.style.cssText = 'flex:1;min-width:0;'

  const title = document.createElement('p')
  title.style.cssText =
    'margin:0;font-size:14px;font-weight:600;line-height:1.3;color:#111827;'
  title.textContent = notification.title

  const body = document.createElement('p')
  body.style.cssText =
    'margin:4px 0 0;font-size:12px;line-height:1.5;color:#6b7280;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;'
  body.textContent = notification.body

  textWrap.appendChild(title)
  textWrap.appendChild(body)

  // Dismiss X
  const dismiss = document.createElement('div')
  dismiss.setAttribute('role', 'button')
  dismiss.setAttribute('tabindex', '0')
  dismiss.style.cssText = `
    flex-shrink:0;padding:2px;border-radius:50%;cursor:pointer;
    margin-top:2px;color:#9ca3af;transition:color 0.15s;
  `
  dismiss.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
  dismiss.addEventListener('click', (e) => {
    e.stopPropagation()
    dismissToast(notification.id)
  })
  dismiss.addEventListener('mouseenter', () => {
    dismiss.style.color = '#111827'
  })
  dismiss.addEventListener('mouseleave', () => {
    dismiss.style.color = '#9ca3af'
  })

  btn.appendChild(leadingEl)
  btn.appendChild(textWrap)
  btn.appendChild(dismiss)
  card.appendChild(btn)

  // Timer bar
  if (!prefersReduced) {
    const timerWrap = document.createElement('div')
    timerWrap.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;height:3px;overflow:hidden;'
    const timerBar = document.createElement('div')
    timerBar.style.cssText = `
      height:100%;width:100%;background:${theme.timerBar};border-radius:9999px;
      transform-origin:left;
      animation:toast-timer ${TOAST_DURATION}ms linear forwards;
    `
    timerWrap.appendChild(timerBar)
    card.appendChild(timerWrap)
  }

  wrapper.appendChild(card)
  containerEl!.appendChild(wrapper)

  // Haptic feedback
  if (
    !prefersReduced &&
    (notification.notification_type === 'outbid' ||
      notification.notification_type === 'item_won')
  ) {
    navigator.vibrate?.(200)
  }

  // Auto-dismiss
  const timer = setTimeout(() => {
    dismissToast(notification.id)
  }, TOAST_DURATION)

  activeToasts.set(notification.id, { el: wrapper, timer })
  enforceMaxVisible()
}

function dismissToast(id: string) {
  const entry = activeToasts.get(id)
  if (!entry) return
  clearTimeout(entry.timer)
  activeToasts.delete(id)

  // Exit animation
  entry.el.style.animation = 'toast-slide-out 0.35s ease-in forwards'
  setTimeout(() => {
    entry.el.remove()
  }, 350)
}

// Listen for custom events — registered by the component's useEffect to
// survive HMR properly.

/**
 * NotificationToastOverlay — mounted in root layout to listen for toast events.
 * Rendering is 100% vanilla DOM to bypass React 19 scheduling issues.
 */
export function NotificationToastOverlay() {
  useEffect(() => {
    const handler = (e: Event) => {
      const notification = (e as CustomEvent<NotificationData>).detail
      addToast(notification)
    }
    window.addEventListener(TOAST_EVENT, handler)

    return () => {
      window.removeEventListener(TOAST_EVENT, handler)
      for (const entry of activeToasts.values()) {
        clearTimeout(entry.timer)
        entry.el.remove()
      }
      activeToasts.clear()
      if (containerEl) {
        containerEl.remove()
        containerEl = null
      }
    }
  }, [])

  return null
}
