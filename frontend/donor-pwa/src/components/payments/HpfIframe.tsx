/**
 * HpfIframe — renders a hosted payment form in an iframe.
 *
 * T028 — Phase 4.
 *
 * Embeds the gateway-provided HPF URL in an iframe and listens for the
 * `fundrbolt-hpf` postMessage event to know when the form is complete.
 *
 * Fallback: If the iframe takes longer than 30 seconds to interact with,
 * an "Open in browser" link is shown.
 */

import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { HpfCompletePayload } from '@/types/payment'

export interface HpfIframeProps {
  /** The HPF URL returned by POST /payments/session */
  hpfUrl: string
  /** Called when the HPF reports completion (approved or declined) */
  onComplete: (payload: HpfCompletePayload) => void
  /** Called on unrecoverable load errors */
  onError: (error: string) => void
  /** Class applied to the iframe wrapper div */
  className?: string
  /** Seconds before "open in browser" fallback appears (default 30) */
  timeoutSeconds?: number
}

export function HpfIframe({
  hpfUrl,
  onComplete,
  onError,
  className = '',
  timeoutSeconds = 30,
}: HpfIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Keep refs up-to-date without re-registering the listener
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  // postMessage listener
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Validate that the message comes from the HPF origin
      try {
        const hpfOrigin = new URL(hpfUrl).origin
        if (event.origin !== hpfOrigin) return
      } catch {
        // Malformed URL — accept all origins (stub mode uses localhost)
      }

      const data = event.data as Partial<HpfCompletePayload>
      if (data?.source !== 'fundrbolt-hpf' || data?.type !== 'hpf_complete') return

      onCompleteRef.current(data as HpfCompletePayload)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [hpfUrl])

  // Fallback timer
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isLoading || !showFallback) {
        setShowFallback(true)
      }
    }, timeoutSeconds * 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutSeconds])

  function handleLoad() {
    setIsLoading(false)
    setLoadError(null)
  }

  function handleError() {
    const msg = 'Payment form failed to load. Please try again or use the link below.'
    setLoadError(msg)
    setIsLoading(false)
    setShowFallback(true)
    onErrorRef.current(msg)
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {isLoading && (
        <div className='flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Loading secure payment form…
        </div>
      )}

      {loadError && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <iframe
        ref={iframeRef}
        src={hpfUrl}
        title='Secure Payment Form'
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full rounded-md border bg-white transition-opacity ${
          isLoading ? 'h-0 opacity-0' : 'min-h-[420px] opacity-100'
        }`}
        sandbox='allow-scripts allow-forms allow-same-origin allow-popups'
        allow='payment'
      />

      {showFallback && !loadError && (
        <div className='flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
          <span>Having trouble? Open the payment form in a new tab.</span>
          <Button variant='outline' size='sm' asChild>
            <a href={hpfUrl} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='mr-1 h-3 w-3' />
              Open
            </a>
          </Button>
        </div>
      )}

      {loadError && (
        <div className='flex justify-center'>
          <Button variant='outline' size='sm' asChild>
            <a href={hpfUrl} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='mr-1 h-3 w-3' />
              Open payment form in new tab
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
