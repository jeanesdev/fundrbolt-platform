import type { NotificationData } from '@/services/notification-service'

const URL_PATTERN = /https?:\/\/[^\s)]+/gi
const INTERNAL_HOSTNAMES = new Set(['app.fundrbolt.com', 'localhost'])

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i)
  if (!match?.[0]) return null
  return match[0].replace(/[.,;!?]+$/, '')
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeNotificationHref(rawHref: string): string {
  // Already an app-relative route.
  if (rawHref.startsWith('/')) {
    return rawHref
  }

  try {
    const parsed = new URL(rawHref)
    const isInternalHost = INTERNAL_HOSTNAMES.has(parsed.hostname)
    const isEventsPath = parsed.pathname.startsWith('/events/')

    // Keep donor notification navigation inside the current app when
    // the link points to known app hosts or event deep links.
    if (isInternalHost || isEventsPath) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    return rawHref
  }

  return rawHref
}

export function getNotificationBodyText(
  notification: NotificationData
): string {
  const withoutUrls = compactWhitespace(
    notification.body
      .replace(URL_PATTERN, '')
      .replace(/[\s-:]+$/g, '')
      .trim()
  )

  if (withoutUrls.length > 0) {
    return withoutUrls
  }

  const itemTitle = notification.data?.item_title
  if (typeof itemTitle === 'string' && itemTitle.length > 0) {
    return itemTitle
  }

  return 'Tap to view details'
}

export function getNotificationLink(notification: NotificationData): {
  href: string
  label: string
} | null {
  const data = notification.data ?? {}

  const deepLink =
    typeof data.deep_link === 'string' && data.deep_link.length > 0
      ? data.deep_link
      : null

  const explicitUrl =
    typeof data.link_url === 'string' && data.link_url.length > 0
      ? data.link_url
      : null

  const messageUrl = extractFirstUrl(notification.body)
  const href = deepLink ?? explicitUrl ?? messageUrl
  if (!href) return null

  const label =
    typeof data.link_label === 'string' && data.link_label.length > 0
      ? data.link_label
      : typeof data.item_title === 'string' && data.item_title.length > 0
        ? 'View item details'
        : 'Open link'

  return { href: normalizeNotificationHref(href), label }
}
