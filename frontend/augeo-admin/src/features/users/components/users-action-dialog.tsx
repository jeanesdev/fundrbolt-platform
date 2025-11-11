'use client'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { SelectDropdown } from '@/components/select-dropdown'
import { roles } from '../data/data'
import { type User } from '../data/schema'
import { useCreateUser, useUpdateUser } from '../hooks/use-users'

const formSchema = z
  .object({
    firstName: z.string().min(1, 'First Name is required.'),
    lastName: z.string().min(1, 'Last Name is required.'),
    phoneNumber: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          const digits = val.replace(/\D/g, '')
          return digits.length >= 10 && digits.length <= 11
        },
        { message: 'Phone must be 10 or 11 digits' }
      )
      .refine(
        (val) => {
          if (!val || val === '') return true
          const digits = val.replace(/\D/g, '')
          if (digits.length === 11) return digits.startsWith('1')
          return true
        },
        { message: '11-digit phone must start with 1' }
      ),
    organization_name: z
      .string()
      .max(255, 'Organization name must not exceed 255 characters')
      .optional(),
    address_line1: z
      .string()
      .max(255, 'Address line 1 must not exceed 255 characters')
      .optional(),
    address_line2: z
      .string()
      .max(255, 'Address line 2 must not exceed 255 characters')
      .optional(),
    city: z
      .string()
      .max(100, 'City must not exceed 100 characters')
      .optional(),
    state: z
      .string()
      .max(100, 'State must not exceed 100 characters')
      .optional(),
    postal_code: z
      .string()
      .max(20, 'Postal code must not exceed 20 characters')
      .optional(),
    country: z
      .string()
      .max(100, 'Country must not exceed 100 characters')
      .optional(),
    email: z.email({
      error: (iss) => (iss.input === '' ? 'Email is required.' : undefined),
    }),
    password: z.string().transform((pwd) => pwd.trim()),
    role: z.string().min(1, 'Role is required.'),
    confirmPassword: z.string().transform((pwd) => pwd.trim()),
    isEdit: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.isEdit && !data.password) return true
      return data.password.length > 0
    },
    {
      message: 'Password is required.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return password.length >= 8
    },
    {
      message: 'Password must be at least 8 characters long.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return /[a-z]/.test(password)
    },
    {
      message: 'Password must contain at least one lowercase letter.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password }) => {
      if (isEdit && !password) return true
      return /\d/.test(password)
    },
    {
      message: 'Password must contain at least one number.',
      path: ['password'],
    }
  )
  .refine(
    ({ isEdit, password, confirmPassword }) => {
      if (isEdit && !password) return true
      return password === confirmPassword
    },
    {
      message: "Passwords don't match.",
      path: ['confirmPassword'],
    }
  )
type UserForm = z.infer<typeof formSchema>

type UserActionDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const isEdit = !!currentRow
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          firstName: currentRow.first_name,
          lastName: currentRow.last_name,
          email: currentRow.email,
          role: currentRow.role,
          phoneNumber: currentRow.phone || '',
          password: '',
          confirmPassword: '',
          isEdit,
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          role: '',
          phoneNumber: '',
          password: '',
          confirmPassword: '',
          isEdit,
        },
  })

  const onSubmit = async (values: UserForm) => {
    try {
      if (isEdit) {
        // Update existing user
        const updateData: {
          first_name?: string
          last_name?: string
          phone?: string
          organization_name?: string
          address_line1?: string
          address_line2?: string
          city?: string
          state?: string
          postal_code?: string
          country?: string
          password?: string
        } = {
          first_name: values.firstName,
          last_name: values.lastName,
          phone: values.phoneNumber || undefined,
          organization_name: values.organization_name || undefined,
          address_line1: values.address_line1 || undefined,
          address_line2: values.address_line2 || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          postal_code: values.postal_code || undefined,
          country: values.country || undefined,
        }

        // Only include password if it was changed
        if (values.password) {
          updateData.password = values.password
        }

        await updateUser.mutateAsync({
          id: currentRow!.id,
          ...updateData,
        })
      } else {
        // Create new user
        // TODO: Add NPO selection field for npo_admin and event_coordinator roles
        // For now, these roles cannot be created without npo_id
        if (['npo_admin', 'event_coordinator'].includes(values.role)) {
          throw new Error(
            'NPO Admin and Event Coordinator roles require NPO selection. Please use Staff or Donor role for now.'
          )
        }

        const payload = {
          email: values.email,
          password: values.password,
          first_name: values.firstName,
          last_name: values.lastName,
          phone: values.phoneNumber || undefined,
          organization_name: values.organization_name || undefined,
          address_line1: values.address_line1 || undefined,
          address_line2: values.address_line2 || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          postal_code: values.postal_code || undefined,
          country: values.country || undefined,
          role: values.role,
        }
        await createUser.mutateAsync(payload)
      }

      form.reset()
      onOpenChange(false)
    } catch {
      // Error handling is done in the mutation hooks
    }
  }

  const isPasswordTouched = !!form.formState.dirtyFields.password

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the user here. ' : 'Create new user here. '}
            Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className='h-[26.25rem] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='firstName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      First Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='John'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='lastName'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Last Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Doe'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='john.doe@gmail.com'
                        className='col-span-4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='phoneNumber'
                render={({ field }) => {
                  const formatPhoneNumber = (value: string): string => {
                    const phoneNumber = value.replace(/\D/g, '')
                    if (phoneNumber.length === 0) return ''

                    // Handle 11-digit numbers with +1
                    if (
                      phoneNumber.length === 11 &&
                      phoneNumber.startsWith('1')
                    ) {
                      const digits = phoneNumber.slice(1)
                      if (digits.length <= 3) return `+1(${digits}`
                      if (digits.length <= 6)
                        return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
                      return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
                    }

                    // Handle 10-digit numbers
                    if (phoneNumber.length <= 3) return `(${phoneNumber}`
                    if (phoneNumber.length <= 6)
                      return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
                    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
                  }

                  return (
                    <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='(123)456-7890 or +1(123)456-7890'
                          className='col-span-4'
                          maxLength={17}
                          value={
                            field.value ? formatPhoneNumber(field.value) : ''
                          }
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '')
                            // Only allow 10 or 11 digits (11 must start with 1)
                            if (
                              digits.length <= 10 ||
                              (digits.length === 11 && digits.startsWith('1'))
                            ) {
                              field.onChange(digits)
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage className='col-span-4 col-start-3' />
                    </FormItem>
                  )
                }}
              />
              <FormField
                control={form.control}
                name='organization_name'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Organization Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Organization Name'
                        className='col-span-4'
                        autoComplete='organization'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='address_line1'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Street Address 1
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='123 Main St'
                        className='col-span-4'
                        autoComplete='address-line1'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='address_line2'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Street Address 2
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Apt 4B (optional)'
                        className='col-span-4'
                        autoComplete='address-line2'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='city'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      City
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='City'
                        className='col-span-4'
                        autoComplete='address-level2'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='state'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      State / Province
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='State / Province'
                        className='col-span-4'
                        autoComplete='address-level1'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='postal_code'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Postal Code
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='12345'
                        className='col-span-4'
                        autoComplete='postal-code'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='country'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      Country
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='United States'
                        className='col-span-4'
                        autoComplete='country-name'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>Role</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='Select a role'
                      className='col-span-4'
                      items={roles.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              {!isEdit && (
                <>
                  <FormField
                    control={form.control}
                    name='password'
                    render={({ field }) => (
                      <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                        <FormLabel className='col-span-2 text-end'>
                          Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder='e.g., S3cur3P@ssw0rd'
                            className='col-span-4'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className='col-span-4 col-start-3' />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='confirmPassword'
                    render={({ field }) => (
                      <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                        <FormLabel className='col-span-2 text-end'>
                          Confirm Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            disabled={!isPasswordTouched}
                            placeholder='e.g., S3cur3P@ssw0rd'
                            className='col-span-4'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className='col-span-4 col-start-3' />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='user-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
