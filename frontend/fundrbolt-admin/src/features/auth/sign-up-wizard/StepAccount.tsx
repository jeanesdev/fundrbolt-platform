/**
 * StepAccount — Step 1 of the NPO onboarding wizard.
 *
 * Collects: first_name, last_name, email, password, confirmPassword.
 * Integrates Cloudflare Turnstile CAPTCHA.
 * On success: registers user via auth store, persists step data to the
 * onboarding session, then calls onNext.
 */
import { useCallback, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { updateStep } from '@/lib/api/onboarding'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../../npo-onboarding/TurnstileWidget'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const formSchema = z
  .object({
    first_name: z.string().min(1, 'Please enter your first name'),
    last_name: z.string().min(1, 'Please enter your last name'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof formSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepAccountProps {
  /** Onboarding session token (used to persist step data). */
  sessionToken: string
  /** Advance to the next step. */
  onNext: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepAccount({ sessionToken, onNext }: StepAccountProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [emailExists, setEmailExists] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)
  const register = useAuthStore((s) => s.register)

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token)
  }, [])

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null)
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    setErrorMsg(null)
    setEmailExists(false)

    // If no token yet (edge case), trigger execution and bail — user retries
    if (!captchaToken) {
      turnstileRef.current?.execute()
      setErrorMsg('Security check in progress. Please try again in a moment.')
      setIsLoading(false)
      return
    }

    try {
      // Register the user
      await register({
        email: values.email,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name,
      })

      // Persist step data into the onboarding session (no password stored)
      try {
        await updateStep(sessionToken, 'account', {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
        })
      } catch {
        // Non-fatal – session might have expired; proceed anyway
      }

      toast.success('Account created! Please verify your email.')
      onNext()
    } catch (err: unknown) {
      turnstileRef.current?.reset()
      setCaptchaToken(null)

      const status = (err as { response?: { status?: number } }).response
        ?.status
      const detail =
        (
          err as {
            response?: {
              data?: { error?: { message?: string; detail?: string } }
            }
          }
        ).response?.data?.error?.message ||
        (err as { message?: string }).message ||
        'Registration failed. Please try again.'

      if (status === 409 || detail.toLowerCase().includes('already')) {
        setEmailExists(true)
      } else {
        setErrorMsg(detail)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-bold'>Create your account</h2>
        <p className='text-muted-foreground text-sm'>
          Step 1 of 4 — We'll use this to keep you updated on your application.
        </p>
      </div>

      {/* Email-already-exists banner */}
      {emailExists && (
        <Alert
          variant='default'
          className='border-amber-500 bg-amber-50 text-amber-900'
        >
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            An account with that email already exists.{' '}
            <Link
              to='/sign-in'
              className='font-medium underline underline-offset-2'
            >
              Sign in instead
            </Link>{' '}
            to continue your application.
          </AlertDescription>
        </Alert>
      )}

      {/* Generic error banner */}
      {errorMsg && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          {/* Name row */}
          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='first_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Jane'
                      autoComplete='given-name'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='last_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Doe'
                      autoComplete='family-name'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Email */}
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='jane@example.org'
                    autoComplete='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder='Min 8 chars, include a letter and number'
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Confirm password */}
          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder='Re-enter your password'
                    autoComplete='new-password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Turnstile widget (auto-executes, fires onVerify when challenge passes) */}
          <TurnstileWidget
            ref={turnstileRef}
            onVerify={handleCaptchaVerify}
            onExpire={handleCaptchaExpire}
          />

          <Button type='submit' className='w-full' disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating account…
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </Form>

      <p className='text-muted-foreground text-center text-xs'>
        Already have an account?{' '}
        <Link to='/sign-in' className='underline underline-offset-2'>
          Sign in
        </Link>
      </p>
    </div>
  )
}
