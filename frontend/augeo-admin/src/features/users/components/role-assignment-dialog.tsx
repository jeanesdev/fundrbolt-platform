import { SelectDropdown } from '@/components/select-dropdown'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { zodResolver } from '@hookform/resolvers/zod'
import { Shield } from 'lucide-react'
import React from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import type { User } from '../api/users-api'
import { roles } from '../data/data'
import { useUpdateUserRole } from '../hooks/use-users'

const formSchema = z
  .object({
    role: z.string().min(1, 'Role is required'),
    npo_id: z.string().optional(),
  })
  .refine(
    (data) => {
      // npo_admin and event_coordinator require npo_id
      if (['npo_admin', 'event_coordinator'].includes(data.role)) {
        return data.npo_id && data.npo_id.trim().length > 0
      }
      return true
    },
    {
      message: 'NPO ID is required for NPO Admin and Event Coordinator roles',
      path: ['npo_id'],
    }
  )

type RoleAssignmentForm = z.infer<typeof formSchema>

type RoleAssignmentDialogProps = {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoleAssignmentDialog({
  user,
  open,
  onOpenChange,
}: RoleAssignmentDialogProps) {
  const updateRoleMutation = useUpdateUserRole()

  const form = useForm<RoleAssignmentForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: user?.role || '',
      npo_id: user?.npo_id || '',
    },
  })

  // Update form when user changes
  React.useEffect(() => {
    if (user) {
      form.reset({
        role: user.role,
        npo_id: user.npo_id || '',
      })
    }
  }, [user, form])

  const selectedRole = useWatch({ control: form.control, name: 'role' })
  const requiresNpoId = ['npo_admin', 'event_coordinator'].includes(
    selectedRole || ''
  )

  const onSubmit = async (values: RoleAssignmentForm) => {
    if (!user?.id) {
      // No user selected - dialog should not be open
      return
    }

    // Call mutation to update role
    await updateRoleMutation.mutateAsync({
      userId: user.id,
      data: {
        role: values.role,
        ...(requiresNpoId && values.npo_id ? { npo_id: values.npo_id } : {}),
      },
    })

    // Close dialog on success
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (user) {
          form.reset({
            role: user.role,
            npo_id: user.npo_id || '',
          })
        }
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <Shield /> Assign Role
          </DialogTitle>
          <DialogDescription>
            Change the role for {user?.first_name} {user?.last_name}. This will
            determine their access level and permissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='role-assignment-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
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
            {requiresNpoId && (
              <FormField
                control={form.control}
                name='npo_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NPO ID *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Enter NPO UUID (required)'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Required for NPO Admin and Event Coordinator roles
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline' disabled={updateRoleMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='submit'
            form='role-assignment-form'
            disabled={updateRoleMutation.isPending}
          >
            {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
