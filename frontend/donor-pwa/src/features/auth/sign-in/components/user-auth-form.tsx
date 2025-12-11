import { PasswordInput } from '@/components/password-input'
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
import { getErrorMessage } from '@/lib/error-utils'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email' : undefined),
  }),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(7, 'Password must be at least 7 characters long'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    toast.promise(login(data), {
      loading: 'Signing in...',
      success: (response) => {
        setIsLoading(false)

        // Navigate using router instead of full page reload
        // The auth state is already set by the login function
        if (redirectTo && typeof redirectTo === 'string') {
          navigate({ to: redirectTo as any, replace: true })
        } else {
          navigate({ to: '/home', replace: true })
        }

        return `Welcome back, ${response.user.first_name || response.user.email}!`
      },
      error: (err) => {
        setIsLoading(false)

        // Extract error details
        const apiError = err as { response?: { data?: { detail?: { code?: string } } } }
        const errorCode = apiError?.response?.data?.detail?.code
        const errorMessage = getErrorMessage(err, 'Login failed. Please try again.')

        // Check if email verification is required
        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          // Show a more helpful message with action button
          const email = data.email
          toast.error(
            `Email verification required for ${email}`,
            {
              description: 'Please check your inbox for the verification link, or request a new one.',
              action: {
                label: 'Resend Email',
                onClick: () => {
                  // TODO: Implement resend verification email
                  toast.info('Redirecting to resend verification...')
                  navigate({ to: '/verify-email', search: { email } })
                },
              },
              duration: 10000, // Show for 10 seconds
            }
          )
          return // Don't show the error string, the custom toast handles it
        }

        return errorMessage
      },
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/password-reset'
                className='text-muted-foreground absolute end-0 -top-0.5 text-sm font-medium hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </Form>
  )
}
