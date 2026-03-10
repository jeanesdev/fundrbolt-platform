import DOMPurify from 'dompurify'

const CONTROL_AND_ZERO_WIDTH_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g

const TEXT_LIKE_INPUT_TYPES = new Set([
  '',
  'email',
  'password',
  'search',
  'tel',
  'text',
  'url',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function sanitizeTextInput(value: string): string {
  return value.normalize('NFKC').replace(CONTROL_AND_ZERO_WIDTH_PATTERN, '')
}

export function isSanitizableTextInputType(type?: string | null): boolean {
  return TEXT_LIKE_INPUT_TYPES.has((type ?? '').toLowerCase())
}

export function sanitizeInputValueByType(
  value: string,
  type?: string | null
): string {
  if (!isSanitizableTextInputType(type)) {
    return value
  }

  return sanitizeTextInput(value)
}

export function sanitizeRequestPayload<T>(payload: T): T {
  if (typeof payload === 'string') {
    return sanitizeTextInput(payload) as T
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeRequestPayload(item)) as T
  }

  if (payload instanceof URLSearchParams) {
    const sanitizedParams = new URLSearchParams()

    for (const [key, value] of payload.entries()) {
      sanitizedParams.append(key, sanitizeTextInput(value))
    }

    return sanitizedParams as T
  }

  if (
    payload instanceof Date ||
    payload instanceof Blob ||
    payload instanceof File ||
    payload instanceof FormData
  ) {
    return payload
  }

  if (isPlainObject(payload)) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        sanitizeRequestPayload(value),
      ])
    ) as T
  }

  return payload
}

export function escapeHtml(value: string): string {
  return sanitizeTextInput(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeUrl(url: string): string | null {
  const normalized = sanitizeTextInput(url).trim()

  if (!normalized) {
    return null
  }

  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(normalized)) {
    return normalized
  }

  return null
}

export function sanitizeHtmlFragment(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: false,
  })
}

export function renderMarkdownToSafeHtml(markdown: string): string {
  const sanitizedMarkdown = sanitizeTextInput(markdown)

  if (!sanitizedMarkdown.trim()) {
    return ''
  }

  let html = escapeHtml(sanitizedMarkdown)

  html = html
    .replace(
      /^###\s+(.+)$/gim,
      '<h3 class="mt-4 mb-2 text-base font-semibold">$1</h3>'
    )
    .replace(
      /^##\s+(.+)$/gim,
      '<h2 class="mt-4 mb-2 text-lg font-semibold">$1</h2>'
    )
    .replace(/^#\s+(.+)$/gim, '<h1 class="mt-4 mb-2 text-xl font-bold">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, rawUrl) => {
      const safeUrl = sanitizeUrl(rawUrl)

      if (!safeUrl) {
        return label
      }

      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="underline">${label}</a>`
    })
    .replace(/^(?:- |\* )(.+)$/gim, '<li>$1</li>')

  html = html.replace(
    /(<li>.*<\/li>)/gims,
    '<ul class="my-2 list-disc pl-5 space-y-1">$1</ul>'
  )

  const blocks = html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return sanitizeHtmlFragment(
    blocks
      .map((block) => {
        if (
          block.startsWith('<h1') ||
          block.startsWith('<h2') ||
          block.startsWith('<h3') ||
          block.startsWith('<ul')
        ) {
          return block
        }

        return `<p class="mb-2 leading-relaxed">${block.replace(/\n/g, '<br />')}</p>`
      })
      .join('')
  )
}
