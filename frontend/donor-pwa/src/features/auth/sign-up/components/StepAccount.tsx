import { TermsOfServiceModal } from '@/components/legal/terms-of-service-modal'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

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
    acceptedTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof formSchema>

export interface AccountData {
  first_name: string
  last_name: string
  email: string
  password: string
  legalDocumentIds: { tosId: string; privacyId: string } | null
}

interface StepAccountProps {
  onNext: (data: AccountData) => void
  redirectTo?: string
}

export function StepAccount({ onNext, redirectTo }: StepAccountProps) {
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [legalDocumentIds, setLegalDocumentIds] = useState<{
    tosId: string
    privacyId: string
  } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
  })

  const handleAcceptLegal = async (tosId: string, privacyId: string) => {
    setLegalDocumentIds({ tosId, privacyId })
    form.setValue('acceptedTerms', true)
  }

  const onSubmit = (values: FormValues) => {
    const { confirmPassword: _c, acceptedTerms: _a, ...rest } = values
    onNext({ ...rest, legalDocumentIds })
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-bold'>Create your account</h2>
        <p className='text-muted-foreground text-sm'>
          Enter your name, email and a secure password.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='first_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input placeholder='Jane' autoFocus {...field} />
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
                    <Input placeholder='Smith' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='jane@example.com'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder='At least 8 characters'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder='Repeat your password'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='acceptedTerms'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-y-0 space-x-3'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel className='text-sm font-normal'>
                    I accept the{' '}
                    <Button
                      type='button'
                      variant='link'
                      className='h-auto p-0 text-sm font-normal underline'
                      onClick={() => setShowLegalModal(true)}
                    >
                      Terms of Service and Privacy Policy
                    </Button>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button type='submit' className='w-full'>
            Continue
          </Button>
        </form>
      </Form>

      <p className='text-muted-foreground text-center text-xs'>
        Already have an account?{' '}
        <Link
          to='/sign-in'
          search={{ redirect: redirectTo }}
          className='underline underline-offset-2'
        >
          Sign in
        </Link>
      </p>

      <TermsOfServiceModal
        open={showLegalModal}
        onOpenChange={setShowLegalModal}
        onAccept={handleAcceptLegal}
      />
    </div>
  )
}
