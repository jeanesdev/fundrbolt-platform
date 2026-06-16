import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import npoService from '@/services/npo-service'
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

const NPO_SCOPED_ROLES = [
  'npo_admin',
  'event_coordinator',
  'staff',
  'auctioneer',
] as const

const formSchema = z
  .object({
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
    npo_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      NPO_SCOPED_ROLES.includes(
        data.role as (typeof NPO_SCOPED_ROLES)[number]
      ) &&
      !data.npo_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NPO is required for this role',
        path: ['npo_id'],
      })
    }
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

  const { data: npoList } = useQuery({
    queryKey: ['npos'],
    queryFn: () => npoService.listNPOs({ page_size: 200 }),
  })

  const form = useForm<UserInviteForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: '',
      npo_id: '',
    },
  })

  const selectedRole = form.watch('role')
  const requiresNpo = NPO_SCOPED_ROLES.includes(
    selectedRole as (typeof NPO_SCOPED_ROLES)[number]
  )

  const onSubmit = async (values: UserInviteForm) => {
    try {
      await createUserMutation.mutateAsync({
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone || undefined,
        role: values.role,
        npo_id: values.npo_id || undefined,
      })

      // Close dialog and reset form on success
      form.reset()
      onOpenChange(false)
    } catch {
      // Error is already handled in the mutation's onError callback
    }
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
                  <FormLabel>Cell Number (optional)</FormLabel>
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
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Clear npo_id when switching to a non-NPO-scoped role
                      if (
                        !NPO_SCOPED_ROLES.includes(
                          value as (typeof NPO_SCOPED_ROLES)[number]
                        )
                      ) {
                        form.setValue('npo_id', '')
                      }
                    }}
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
            {requiresNpo && (
              <FormField
                control={form.control}
                name='npo_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NPO</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='Select an NPO'
                      items={(npoList?.items ?? []).map((npo) => ({
                        label: npo.name,
                        value: npo.id,
                      }))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <p className='text-muted-foreground text-xs'>
              The user will receive an email to set up their own password and
              activate their account.
            </p>
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
