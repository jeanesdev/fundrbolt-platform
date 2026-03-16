/**
 * StepVerifyEmail — Step 2 of the NPO onboarding wizard.
 *
 * Primary flow: user enters the 6-digit code from their email.
 * Fallback: clicking the link in the email also works (polling detects it).
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepVerifyEmailProps {
  /** Email address that was just registered. */
  email: string
  /** Advance to the next step (triggered when verification confirmed). */
  onNext: () => void
  /** Optional onboarding session token — linked to the verified user on the backend. */
  sessionToken?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepVerifyEmail({ email, onNext, sessionToken }: StepVerifyEmailProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setUser = useAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isVerified, setIsVerified] = useState(false)
  const [code, setCode] = useState('')
  const [isSubmittingCode, setIsSubmittingCode] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const verifiedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ------------------------------------------------------------------
  // Poll for verification (handles link-click flow)
  // ------------------------------------------------------------------
  const checkVerification = async () => {
    if (!isAuthenticated || verifiedRef.current) {
      return
    }

    try {
      const { data } = await apiClient.get<{ email_verified: boolean }>(
        '/users/me'
      )
      if (data.email_verified && !verifiedRef.current) {
        verifiedRef.current = true
        setIsVerified(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
        toast.success('Email verified!')
        setTimeout(onNext, 1200)
      }
    } catch {
      // Silently ignore
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    void checkVerification()
    intervalRef.current = setInterval(() => {
      void checkVerification()
    }, 10_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // ------------------------------------------------------------------
  // OTP code submission
  // ------------------------------------------------------------------
  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    setCodeError(null)
    if (digits.length === 6) {
      void submitCode(digits)
    }
  }

  const submitCode = async (codeValue: string) => {
    setIsSubmittingCode(true)
    setCodeError(null)
    try {
      const { data } = await apiClient.post<{
        message: string
        access_token?: string
        refresh_token?: string
        user?: Parameters<typeof setUser>[0]
      }>('/auth/verify-email/code', {
        email,
        code: codeValue,
        session_token: sessionToken ?? null,
      })
      // Auto-login: store returned tokens so the wizard session can be linked
      verifiedRef.current = true
      if (data.user) setUser(data.user)
      if (data.access_token) setAccessToken(data.access_token)
      if (data.refresh_token) setRefreshToken(data.refresh_token)
      setIsVerified(true)
      if (intervalRef.current) clearInterval(intervalRef.current)
      toast.success('Email verified!')
      setTimeout(onNext, 1200)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: { message?: string } } } })
          .response?.data?.detail?.message ||
        'Invalid or expired code. Please try again.'
      setCodeError(msg)
      setCode('')
    } finally {
      setIsSubmittingCode(false)
    }
  }

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
    setCode('')
    setCodeError(null)
    try {
      await apiClient.post('/auth/verify-email/resend', { email })
      toast.success('New verification code sent.')
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
                We sent a 6-digit verification code to{' '}
                <span className='text-foreground font-medium'>{email}</span>.
              </>
            )}
          </p>
        </div>
      </div>

      {!isVerified && (
        <>
          <div className='space-y-3'>
            <div className='space-y-1'>
              <Input
                type='text'
                inputMode='numeric'
                placeholder='000000'
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={isSubmittingCode}
                maxLength={6}
                className='h-16 text-center font-mono text-3xl tracking-[0.5em]'
                aria-label='6-digit verification code'
                autoFocus
              />
              {isSubmittingCode && (
                <p className='text-muted-foreground flex items-center justify-center gap-1 text-sm'>
                  <Loader2 className='h-3 w-3 animate-spin' />
                  Verifying…
                </p>
              )}
              {codeError && (
                <p className='text-destructive text-sm'>{codeError}</p>
              )}
            </div>

            <p className='text-muted-foreground text-xs'>
              Enter the code from the email — or click the link in the email to
              verify automatically.
            </p>
          </div>

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
                `Resend code (${resendCooldown}s)`
              ) : (
                'Resend verification code'
              )}
            </Button>

            {!isAuthenticated && (
              <Button asChild className='w-full'>
                <Link to='/sign-in' search={{ redirect: '/register-npo' }}>
                  I&apos;ve verified my email, sign in to continue
                </Link>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
