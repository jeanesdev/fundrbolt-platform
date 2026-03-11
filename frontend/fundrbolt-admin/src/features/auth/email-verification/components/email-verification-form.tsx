import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

interface EmailVerificationFormProps extends React.HTMLAttributes<HTMLFormElement> {
  token?: string
  email?: string
}

export function EmailVerificationForm({
  token = '',
  email,
  className,
  ...props
}: EmailVerificationFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  // Distinguish: 'idle' | 'auto_verifying' | 'expired' | 'success'
  const [linkState, setLinkState] = useState<
    'idle' | 'auto_verifying' | 'expired' | 'success'
  >(token ? 'auto_verifying' : 'idle')
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { token },
  })

  // Auto-submit when a token arrives via URL (clicked verification link)
  useEffect(() => {
    if (token) {
      setLinkState('auto_verifying')
      handleVerify(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleVerify = async (tkn: string) => {
    setIsLoading(true)
    try {
      await apiClient.post('/auth/verify-email', { token: tkn })
      setLinkState('success')
      toast.success('Email verified! Redirecting to sign in…')
      setTimeout(() => navigate({ to: '/sign-in' }), 1500)
    } catch (error) {
      const err = error as {
        response?: {
          data?: {
            detail?: { code?: string; message?: string }
            error?: { message?: string }
          }
        }
      }
      const code = err.response?.data?.detail?.code
      const msg =
        err.response?.data?.detail?.message ||
        err.response?.data?.error?.message ||
        'Verification failed. The link may have expired.'

      if (code === 'ALREADY_VERIFIED') {
        setLinkState('success')
        toast.success('Your email is already verified. Redirecting…')
        setTimeout(() => navigate({ to: '/sign-in' }), 1500)
      } else if (code === 'INVALID_TOKEN' || code === 'EXPIRED_TOKEN') {
        // FR-015: friendly expired-link state with one-click resend
        setLinkState('expired')
      } else {
        setLinkState('idle')
        toast.error('Verification failed', { description: msg })
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    await handleVerify(data.token)
  }

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
    }, 1000)
  }

  async function handleResend(resendEmail?: string) {
    const target = resendEmail || email
    if (!target) {
      toast.error('Please enter your email address so we can resend the link.')
      return
    }

    setIsResending(true)
    try {
      await apiClient.post('/auth/verify-email/resend', { email: target })
      toast.success('Verification email sent! Check your inbox.')
      startCooldown(60)
    } catch (error) {
      const err = error as {
        response?: { data?: { detail?: { message?: string } } }
      }
      const errorMessage =
        err.response?.data?.detail?.message ||
        'Failed to resend verification email.'
      toast.error('Resend failed', { description: errorMessage })
    } finally {
      setIsResending(false)
    }
  }

  // ── Expired link state (FR-015) ──────────────────────────────────────
  if (linkState === 'expired') {
    return (
      <div className='space-y-5'>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            This verification link has expired or is invalid. Links are valid
            for 24 hours.
          </AlertDescription>
        </Alert>

        <div className='flex flex-col items-center gap-4 text-center'>
          <Mail className='text-muted-foreground h-12 w-12' />
          <div className='space-y-1'>
            <p className='font-medium'>Need a new verification link?</p>
            <p className='text-muted-foreground text-sm'>
              {email ? (
                <>
                  We'll send a fresh link to <strong>{email}</strong>.
                </>
              ) : (
                'Click below to request a new link.'
              )}
            </p>
          </div>

          <Button
            className='w-full'
            onClick={() => handleResend(email)}
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
              <>
                <Mail className='mr-2 h-4 w-4' />
                Send new verification email
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ── Auto-verifying state ──────────────────────────────────────────────
  if (linkState === 'auto_verifying') {
    return (
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        <Loader2 className='text-primary h-10 w-10 animate-spin' />
        <p className='text-muted-foreground text-sm'>Verifying your email…</p>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────
  if (linkState === 'success') {
    return (
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        <CheckCircle2 className='h-12 w-12 text-green-600' />
        <p className='font-medium'>Email verified successfully!</p>
        <p className='text-muted-foreground text-sm'>Redirecting to sign in…</p>
      </div>
    )
  }

  // ── Standard form (manual token entry) ───────────────────────────────
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='token'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verification Token</FormLabel>
              <FormControl>
                <Input
                  placeholder='Enter token from email'
                  autoComplete='off'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Copy the verification token from the email we sent you.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2' disabled={isLoading}>
          Verify email
          {isLoading ? <Loader2 className='animate-spin' /> : <ArrowRight />}
        </Button>

        {email && (
          <Button
            type='button'
            variant='outline'
            disabled={isResending || resendCooldown > 0}
            onClick={() => handleResend(email)}
          >
            {isResending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Resending…
              </>
            ) : resendCooldown > 0 ? (
              `Resend email (${resendCooldown}s)`
            ) : (
              'Resend verification email'
            )}
          </Button>
        )}
      </form>
    </Form>
  )
}
