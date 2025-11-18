/**
 * ProfileForm Component
 * Allows users to update their profile information with validation
 * Uses React Hook Form + Zod for form validation
 * Connects to PATCH /api/v1/users/me/profile endpoint
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { profileUpdateSchema, type ProfileUpdateFormData } from '@/schemas/profile'
import apiClient from '@/lib/axios'
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

interface ProfileFormProps {
  initialData?: Partial<ProfileUpdateFormData>
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  const form = useForm({
    resolver: zodResolver(profileUpdateSchema) as any,
    defaultValues: {
      first_name: initialData?.first_name || user?.first_name || '',
      last_name: initialData?.last_name || user?.last_name || '',
      phone: initialData?.phone || '',
      organization_name: initialData?.organization_name || '',
      address_line1: initialData?.address_line1 || '',
      address_line2: initialData?.address_line2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || '',
    },
    mode: 'onBlur', // Validate on blur per T048-T050
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateFormData) => {
      const response = await apiClient.patch('/api/v1/users/me/profile', data)
      return response.data
    },
    onSuccess: (data) => {
      // T053: Display success toast
      toast.success('Profile updated successfully!')

      // T055: Invalidate query cache to refresh UI
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })

      // Update auth store with new user data
      useAuthStore.getState().setUser(data.user || data)
    },
    onError: (error: any) => {
      // T054: Display inline error messages
      const errorMessage = error.response?.data?.detail || 'Failed to update profile'
      toast.error(errorMessage)
    },
  })

  const onSubmit = (data: ProfileUpdateFormData) => {
    updateProfileMutation.mutate(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        {/* Name fields */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='first_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
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
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder='Doe' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Phone field - T048: E.164 validation */}
        <FormField
          control={form.control}
          name='phone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input placeholder='+14155552671' {...field} value={field.value || ''} />
              </FormControl>
              <FormDescription>
                Phone number in E.164 format (e.g., +14155552671)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Organization name */}
        <FormField
          control={form.control}
          name='organization_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder='Acme Inc.' {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Address fields */}
        <div className='space-y-4'>
          <FormField
            control={form.control}
            name='address_line1'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input placeholder='123 Main St' {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='address_line2'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl>
                  <Input placeholder='Apt 4B' {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <FormField
              control={form.control}
              name='city'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder='San Francisco' {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='state'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder='CA' {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='postal_code'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder='94102' {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='country'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input placeholder='United States' {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex gap-4'>
          <Button type='submit' disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => form.reset()}
            disabled={updateProfileMutation.isPending}
          >
            Reset
          </Button>
        </div>
      </form>
    </Form>
  )
}
