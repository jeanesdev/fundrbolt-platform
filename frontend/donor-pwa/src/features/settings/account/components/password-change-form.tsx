import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/axios'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

type PasswordChangeFormValues = {
  current_password?: string
  new_password: string
  confirm_password: string
}

interface PasswordChangeFormProps extends React.HTMLAttributes<HTMLFormElement> {
  collapsible?: boolean
  defaultOpen?: boolean
  title?: string
  description?: string
}

export function PasswordChangeForm({
  collapsible = false,
  defaultOpen = false,
  title,
  description,
  className,
  ...props
}: PasswordChangeFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const isBackupPasswordMode = user?.has_local_password === false

  const formSchema = z
    .object({
      current_password: z.string().optional(),
      new_password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be at most 100 characters')
        .regex(/[A-Za-z]/, 'Password must contain at least one letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
      confirm_password: z.string().min(1, 'Please confirm your password'),
    })
    .superRefine((data, ctx) => {
      if (!isBackupPasswordMode && !data.current_password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Current password is required',
          path: ['current_password'],
        })
      }

      if (data.new_password !== data.confirm_password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords don't match",
          path: ['confirm_password'],
        })
      }
    })

  const form = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  async function onSubmit(data: PasswordChangeFormValues) {
    setIsLoading(true)

    try {
      await apiClient.post('/auth/password/change', {
        current_password: data.current_password || undefined,
        new_password: data.new_password,
      })

      updateUser({ has_local_password: true })
      toast.success(
        isBackupPasswordMode ? 'Recovery password saved' : 'Password changed',
        {
          description: isBackupPasswordMode
            ? 'You can now use email and password as an alternate sign-in method.'
            : 'Your password has been updated successfully.',
        }
      )

      form.reset()
      setIsOpen(false)
    } catch (error) {
      const err = error as {
        response?: {
          data?: { detail?: { message?: string }; message?: string }
        }
      }
      const errorMessage =
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        'Failed to change password. Please try again.'

      toast.error('Change failed', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isBackupPasswordMode && collapsible) {
    return null
  }

  const formContent = (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        {!isBackupPasswordMode && (
          <FormField
            control={form.control}
            name='current_password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <FormControl>
                  <div className='relative'>
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder='Enter current password'
                      autoComplete='current-password'
                      {...field}
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                    >
                      {showCurrentPassword ? (
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
        )}

        <FormField
          control={form.control}
          name='new_password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isBackupPasswordMode ? 'Recovery Password' : 'New Password'}
              </FormLabel>
              <FormControl>
                <div className='relative'>
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder={
                      isBackupPasswordMode
                        ? 'Create recovery password'
                        : 'Enter new password'
                    }
                    autoComplete='new-password'
                    {...field}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
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
              <FormLabel>
                Confirm {isBackupPasswordMode ? 'Recovery' : 'New'} Password
              </FormLabel>
              <FormControl>
                <div className='relative'>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={
                      isBackupPasswordMode
                        ? 'Confirm recovery password'
                        : 'Confirm new password'
                    }
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

        <div className='mt-2 flex flex-col items-start gap-2'>
          <Button className='w-full sm:w-auto' disabled={isLoading}>
            {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isBackupPasswordMode
              ? 'Save recovery password'
              : 'Change password'}
          </Button>
          {!isBackupPasswordMode && (
            <Button asChild variant='link' className='h-auto px-0'>
              <Link to='/password-reset'>Forgot my password</Link>
            </Button>
          )}
        </div>
      </form>
    </Form>
  )

  if (!collapsible) {
    return formContent
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className='rounded-lg border'
    >
      <CollapsibleTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          className='flex h-auto w-full items-center justify-between px-4 py-3'
        >
          <div className='flex items-start gap-3 text-left'>
            <LockKeyhole className='mt-0.5 h-4 w-4 shrink-0' />
            <div>
              <p className='font-medium'>{title ?? 'Recovery Password'}</p>
              <p className='text-muted-foreground text-sm'>
                {description ??
                  'Optional. Save a password so you can also sign in without OAuth.'}
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='border-t px-4 py-4'>
        {formContent}
      </CollapsibleContent>
    </Collapsible>
  )
}
