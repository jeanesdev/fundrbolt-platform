/**
 * Cloudflare Turnstile invisible CAPTCHA widget.
 *
 * Renders the invisible Cloudflare Turnstile widget, which automatically
 * verifies the user in the background and calls `onVerify` with the
 * resulting token. The token must be sent to the backend for server-side
 * verification.
 *
 * Site keys:
 * - Test key that always passes: 1x00000000000000000000AA
 * - Set VITE_TURNSTILE_SITE_KEY in your .env.local for production.
 */
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { forwardRef, useImperativeHandle, useRef } from 'react'

const SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'

export interface TurnstileWidgetHandle {
  /** Programmatically trigger the challenge (needed when execution='execute'). */
  execute: () => void
  /** Programmatically reset the widget (clears the current token). */
  reset: () => void
}

interface TurnstileWidgetProps {
  /** Called with the Turnstile verification token when challenge succeeds. */
  onVerify: (token: string) => void
  /** Called when the challenge expires. */
  onExpire?: () => void
  /** Called on an unrecoverable widget error. */
  onError?: (error: unknown) => void
}

/**
 * Invisible Turnstile widget.
 *
 * @example
 * ```tsx
 * const turnstileRef = useRef<TurnstileWidgetHandle>(null)
 * const [captchaToken, setCaptchaToken] = useState<string | null>(null)
 *
 * <TurnstileWidget ref={turnstileRef} onVerify={setCaptchaToken} />
 * ```
 */
export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(({ onVerify, onExpire, onError }, ref) => {
  const turnstileRef = useRef<TurnstileInstance>(null)

  useImperativeHandle(ref, () => ({
    execute: () => {
      turnstileRef.current?.execute()
    },
    reset: () => {
      turnstileRef.current?.reset()
    },
  }))

  return (
    <Turnstile
      ref={turnstileRef}
      siteKey={SITE_KEY}
      /* Invisible execution: challenge runs automatically on component mount. */
      options={{
        execution: 'execute',
        appearance: 'interaction-only',
      }}
      onSuccess={onVerify}
      onExpire={onExpire}
      onError={onError}
    />
  )
})

TurnstileWidget.displayName = 'TurnstileWidget'
