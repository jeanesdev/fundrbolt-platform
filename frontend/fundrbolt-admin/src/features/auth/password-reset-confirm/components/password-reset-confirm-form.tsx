import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
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

const formSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be at most 100 characters')
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  })

interface PasswordResetConfirmFormProps extends React.HTMLAttributes<HTMLFormElement> {
  token?: string
  mode?: 'setup'
}

type ApiError = {
  response?: {
    status?: number
    data?: {
      detail?: { message?: string; code?: string }
      error?: { message?: string }
      message?: string
    }
  }
}

export function PasswordResetConfirmForm({
  token = '',
  mode,
  className,
  ...props
}: PasswordResetConfirmFormProps) {
  const navigate = useNavigate()
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken)
  const setUser = useAuthStore((s) => s.setUser)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const isAccountSetup = mode === 'setup'

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token,
      new_password: '',
      confirm_password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      if (isAccountSetup) {
        // Account setup: call setup-account which returns JWT tokens for auto-login
        const response = await apiClient.post<{
          access_token: string
          refresh_token: string
          user: Parameters<typeof setUser>[0]
        }>('/auth/setup-account', {
          token: data.token,
          new_password: data.new_password,
        })

        const { access_token, refresh_token, user } = response.data
        setAccessToken(access_token)
        setRefreshToken(refresh_token)
        setUser(user)

        toast.success('Account activated!', {
          description: "Your password has been set. You're now signed in.",
        })

        navigate({ to: '/' })
      } else {
        // Standard password reset: just confirm and redirect to sign-in
        await apiClient.post('/auth/password/reset/confirm', {
          token: data.token,
          new_password: data.new_password,
        })

        toast.success('Password reset successful', {
          description: 'You can now sign in with your new password.',
        })

        form.reset()
        navigate({ to: '/sign-in' })
      }
    } catch (error) {
      const err = error as ApiError
      const status = err.response?.status
      const detail = err.response?.data?.detail

      let errorMessage: string
      if (status === 429) {
        const retryMsg = err.response?.data?.error?.message
        errorMessage =
          retryMsg || 'Too many attempts. Please wait a moment and try again.'
      } else {
        errorMessage =
          detail?.message ||
          err.response?.data?.message ||
          (isAccountSetup
            ? 'Account setup failed. Please contact your administrator for a new invite link.'
            : 'Failed to reset password. The link may have expired.')
      }

      toast.error(isAccountSetup ? 'Account setup failed' : 'Reset failed', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {!token && (
          <FormField
            control={form.control}
            name='token'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reset Token</FormLabel>
                <FormControl>
                  <Input
                    placeholder='Enter token from email'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Copy the token from the reset email you received.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name='new_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <div className='relative'>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder='Enter new password'
                    autoComplete='new-password'
                    {...field}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Must be 8-100 characters with at least one letter and one
                number.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='confirm_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <div className='relative'>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder='Confirm new password'
                    autoComplete='new-password'
                    {...field}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className='h-4 w-4' />
                    ) : (
                      <Eye className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2' disabled={isLoading}>
          {isAccountSetup ? 'Activate account' : 'Reset password'}
          {isLoading ? <Loader2 className='animate-spin' /> : <ArrowRight />}
        </Button>
      </form>
    </Form>
  )
}
