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
import apiClient from '@/lib/axios'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

interface EmailVerificationFormProps extends React.HTMLAttributes<HTMLFormElement> {
  token?: string
  email?: string
  redirectTo?: string
}

export function EmailVerificationForm({
  token = '',
  email,
  redirectTo,
  className,
  ...props
}: EmailVerificationFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [linkState, setLinkState] = useState<
    'idle' | 'auto_verifying' | 'expired' | 'success'
  >(token ? 'auto_verifying' : 'idle')
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoVerifiedTokenRef = useRef<string | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token,
    },
  })

  useEffect(() => {
    if (token && autoVerifiedTokenRef.current !== token) {
      autoVerifiedTokenRef.current = token
      setLinkState('auto_verifying')
      void handleVerify(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleVerify = async (verificationToken: string) => {
    setIsLoading(true)

    try {
      await apiClient.post('/auth/verify-email', {
        token: verificationToken,
      })

      setLinkState('success')
      toast.success('Email verified successfully', {
        description: 'You can now sign in to your account.',
      })

      setTimeout(
        () => navigate({ to: '/sign-in', search: { redirect: redirectTo } }),
        1500
      )
    } catch (error) {
      const err = error as {
        response?: {
          data?: {
            error?: { message?: string }
            detail?: {
              code?: string
              message?: string
              error?: { code?: string; message?: string }
            }
            message?: string
          }
        }
      }
      const errorCode =
        err.response?.data?.detail?.code ||
        err.response?.data?.detail?.error?.code
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.detail?.error?.message ||
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        'Failed to verify email. The token may have expired.'

      if (errorCode === 'ALREADY_VERIFIED') {
        setLinkState('success')
        toast.success('Your email is already verified. Redirecting to sign in…')
        setTimeout(
          () => navigate({ to: '/sign-in', search: { redirect: redirectTo } }),
          1500
        )
      } else if (
        errorCode === 'INVALID_TOKEN' ||
        errorCode === 'EXPIRED_TOKEN'
      ) {
        setLinkState('expired')
        toast.error('Verification link is no longer valid', {
          description:
            'Verification links last 24 hours and older resend links stop working immediately when a newer one is issued.',
        })
      } else if (errorCode === 'RATE_LIMIT_EXCEEDED') {
        setLinkState('idle')
        toast.error('Too many verification attempts', {
          description: errorMessage,
        })
      } else {
        setLinkState('idle')
        toast.error('Verification failed', {
          description: errorMessage,
        })
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
    const targetEmail = resendEmail || email
    if (!targetEmail) {
      toast.error('Email required', {
        description:
          'Please provide your email address to resend verification.',
      })
      return
    }

    setIsResending(true)

    try {
      await apiClient.post('/auth/verify-email/resend', {
        email: targetEmail,
      })

      toast.success('Verification email sent', {
        description: 'Check your inbox for the new verification link.',
      })
      startCooldown(60)
    } catch (error) {
      const err = error as {
        response?: {
          data?: {
            error?: { message?: string }
            detail?: {
              message?: string
              error?: { code?: string; message?: string }
            }
            message?: string
          }
        }
      }
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.detail?.error?.message ||
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        'Failed to resend verification email.'

      toast.error('Resend failed', {
        description: errorMessage,
      })
    } finally {
      setIsResending(false)
    }
  }

  if (!token && email) {
    return (
      <div className='space-y-5'>
        <div className='flex flex-col items-center gap-4 py-4 text-center'>
          <Mail className='text-muted-foreground h-12 w-12' />
          <div className='space-y-1'>
            <p className='text-lg font-medium'>Check your inbox</p>
            <p className='text-muted-foreground text-sm'>
              We sent a verification link to <strong>{email}</strong>. Open the
              latest email and tap the verification button to finish.
            </p>
          </div>
        </div>

        <Alert className='text-left'>
          <AlertDescription>
            Verification links last 24 hours, and if you request a new email,
            the previous link stops working immediately.
          </AlertDescription>
        </Alert>

        <div className='space-y-3'>
          <Button
            type='button'
            variant='outline'
            className='w-full'
            disabled={isResending || resendCooldown > 0}
            onClick={() => handleResend(email)}
          >
            {isResending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Resending...
              </>
            ) : resendCooldown > 0 ? (
              `Resend verification email (${resendCooldown}s)`
            ) : (
              'Resend verification email'
            )}
          </Button>

          <Button
            type='button'
            onClick={() =>
              navigate({ to: '/sign-in', search: { redirect: redirectTo } })
            }
          >
            I&apos;ve verified my email
          </Button>
        </div>
      </div>
    )
  }

  if (linkState === 'expired') {
    return (
      <div className='space-y-5'>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            This verification link is no longer valid. Links last 24 hours, and
            sending a new email immediately replaces the old link.
          </AlertDescription>
        </Alert>

        <div className='flex flex-col items-center gap-4 text-center'>
          <Mail className='text-muted-foreground h-12 w-12' />
          <div className='space-y-1'>
            <p className='font-medium'>Need a new verification link?</p>
            <p className='text-muted-foreground text-sm'>
              {email ? (
                <>
                  We&apos;ll send a fresh link to <strong>{email}</strong>.
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
                Sending...
              </>
            ) : resendCooldown > 0 ? (
              `Resend verification email (${resendCooldown}s)`
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

  if (linkState === 'auto_verifying') {
    return (
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        <Loader2 className='h-10 w-10 animate-spin' />
        <p className='text-muted-foreground text-sm'>Verifying your email…</p>
      </div>
    )
  }

  if (linkState === 'success') {
    return (
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        <CheckCircle2 className='h-12 w-12 text-green-600' />
        <p className='font-medium'>Email verified successfully!</p>
        <p className='text-muted-foreground text-sm'>Redirecting to sign in…</p>
      </div>
    )
  }

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
            disabled={isResending}
            onClick={() => handleResend(email)}
          >
            {isResending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Resending...
              </>
            ) : (
              'Resend verification email'
            )}
          </Button>
        )}
      </form>
    </Form>
  )
}
