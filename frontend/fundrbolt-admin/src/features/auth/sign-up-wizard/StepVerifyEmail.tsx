/**
 * StepVerifyEmail — Step 2 of the NPO onboarding wizard.
 *
 * Instructs the user to check their inbox. Offers a resend link and
 * polls the backend every 10 s to detect when the email has been verified.
 */
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepVerifyEmailProps {
  /** Email address that was just registered. */
  email: string
  /** Advance to the next step (triggered when verification confirmed). */
  onNext: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepVerifyEmail({ email, onNext }: StepVerifyEmailProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isVerified, setIsVerified] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ------------------------------------------------------------------
  // Poll for verification
  // ------------------------------------------------------------------
  const checkVerification = async () => {
    try {
      // The /auth/me endpoint returns the current user; it includes email_verified.
      const { data } = await apiClient.get<{ email_verified: boolean }>(
        '/auth/me'
      )
      if (data.email_verified) {
        setIsVerified(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
        toast.success('Email verified!')
        // Short delay so the user sees the success state before advancing
        setTimeout(onNext, 1200)
      }
    } catch {
      // Silently ignore – user might not be logged in yet (race condition)
    }
  }

  useEffect(() => {
    // Start polling immediately
    checkVerification()
    intervalRef.current = setInterval(checkVerification, 10_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------------
  // Countdown helper for the resend cooldown
  // ------------------------------------------------------------------
  const startCooldown = (seconds: number) => {
    setResendCooldown(seconds)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1_000)
  }

  // ------------------------------------------------------------------
  // Resend handler
  // ------------------------------------------------------------------
  const handleResend = async () => {
    setIsResending(true)
    try {
      await apiClient.post('/auth/verify-email/resend')
      toast.success('Verification email sent.')
      startCooldown(60)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ||
        'Failed to resend verification email.'
      toast.error(msg)
    } finally {
      setIsResending(false)
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className='space-y-6 text-center'>
      <div className='flex flex-col items-center gap-4'>
        {isVerified ? (
          <CheckCircle2 className='text-primary h-14 w-14' />
        ) : (
          <Mail className='text-muted-foreground h-14 w-14' />
        )}

        <div className='space-y-1'>
          <h2 className='text-2xl font-bold'>
            {isVerified ? 'Email verified!' : 'Check your inbox'}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {isVerified ? (
              'Taking you to the next step…'
            ) : (
              <>
                We sent a verification link to{' '}
                <span className='text-foreground font-medium'>{email}</span>.
                Click the link in that email to continue.
              </>
            )}
          </p>
        </div>
      </div>

      {!isVerified && (
        <>
          <Alert className='text-left'>
            <AlertDescription>
              Can't find the email? Check your spam folder. The link expires in
              24 hours.
            </AlertDescription>
          </Alert>

          <div className='space-y-2'>
            <Button
              variant='outline'
              className='w-full'
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
            >
              {isResending ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Sending…
                </>
              ) : resendCooldown > 0 ? (
                `Resend email (${resendCooldown}s)`
              ) : (
                'Resend verification email'
              )}
            </Button>

            <p className='text-muted-foreground text-xs'>
              Waiting for verification
              <span className='ml-1 inline-flex gap-0.5'>
                <span className='animate-bounce [animation-delay:0ms]'>.</span>
                <span className='animate-bounce [animation-delay:150ms]'>
                  .
                </span>
                <span className='animate-bounce [animation-delay:300ms]'>
                  .
                </span>
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
