import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailPlus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import { SelectDropdown } from '@/components/select-dropdown'
import { roles } from '../data/data'
import { useCreateUser } from '../hooks/use-users'

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z
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
  role: z.string().min(1, 'Role is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type UserInviteForm = z.infer<typeof formSchema>

type UserInviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Format phone number as user types
const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')
  if (phoneNumber.length === 0) return ''

  // Handle 11-digit numbers with +1
  if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    const digits = phoneNumber.slice(1)
    if (digits.length <= 3) return `+1(${digits}`
    if (digits.length <= 6) return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
    return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle 10-digit numbers
  if (phoneNumber.length <= 3) return `(${phoneNumber}`
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
  return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

export function UsersInviteDialog({
  open,
  onOpenChange,
}: UserInviteDialogProps) {
  const createUserMutation = useCreateUser()

  const form = useForm<UserInviteForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: '',
      password: '',
    },
  })

  const onSubmit = async (values: UserInviteForm) => {
    // Call mutation to create user
    await createUserMutation.mutateAsync({
      email: values.email,
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone || undefined,
      role: values.role,
      password: values.password,
    })

    // Close dialog and reset form on success
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <MailPlus /> Invite User
          </DialogTitle>
          <DialogDescription>
            Invite new user to join your team by sending them an email
            invitation. Assign a role to define their access level.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='user-invite-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='eg: john.doe@gmail.com'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='first_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder='John' {...field} />
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder='Doe' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='tel'
                      placeholder='(123)456-7890 or +1(123)456-7890'
                      value={field.value ? formatPhoneNumber(field.value) : ''}
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
                      maxLength={17}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select a role'
                    items={roles.map(({ label, value }) => ({
                      label,
                      value,
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temporary Password</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder='Min. 8 characters'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline' disabled={createUserMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='submit'
            form='user-invite-form'
            disabled={createUserMutation.isPending}
          >
            {createUserMutation.isPending ? 'Creating...' : 'Create User'}{' '}
            <Send />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
