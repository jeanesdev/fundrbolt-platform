import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { cn } from '@/lib/utils'
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

interface EmailVerificationFormProps
  extends React.HTMLAttributes<HTMLFormElement> {
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token,
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      await apiClient.post('/auth/verify-email', {
        token: data.token,
      })

      toast.success('Email verified successfully', {
        description: 'You can now sign in to your account.',
      })

      form.reset()
      navigate({ to: '/sign-in' })
    } catch (error) {
      const err = error as {
        response?: {
          data?: {
            error?: { message?: string }
            detail?: { message?: string }
            message?: string
          }
        }
      }
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        'Failed to verify email. The token may have expired.'

      toast.error('Verification failed', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (!email) {
      toast.error('Email required', {
        description:
          'Please provide your email address to resend verification.',
      })
      return
    }

    setIsResending(true)

    try {
      await apiClient.post('/auth/verify-email/resend', {
        email,
      })

      toast.success('Verification email sent', {
        description: 'Check your inbox for the new verification link.',
      })
    } catch (error) {
      const err = error as {
        response?: {
          data?: {
            error?: { message?: string }
            detail?: { message?: string }
            message?: string
          }
        }
      }
      const errorMessage =
        err.response?.data?.error?.message ||
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
            onClick={handleResend}
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
