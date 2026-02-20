import { ProfileForm } from '@/components/profile/ProfileForm'
import { ProfilePictureUpload } from '@/components/profile/profile-picture-upload'
import { SocialMediaLinksForm } from '@/components/profile/social-media-links-form'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { useEventContextStore } from '@/stores/event-context-store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { ContentSection } from '../components/content-section'

export function SettingsProfile() {
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const selectedEventSlug = useEventContextStore((state) => state.selectedEventSlug)
  const queryClient = useQueryClient()

  // T047: Fetch current user data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const response = await apiClient.get('/users/me')
      return response.data
    },
    enabled: !!user, // Only fetch if user is authenticated
  })

  // Sync profile picture URL to auth store when userData changes
  useEffect(() => {
    if (userData?.profile_picture_url && userData.profile_picture_url !== user?.profile_picture_url) {
      updateUser({ profile_picture_url: userData.profile_picture_url })
    }
  }, [userData?.profile_picture_url, user?.profile_picture_url, updateUser])

  // Mutation for updating social media links
  const updateSocialMediaMutation = useMutation({
    mutationFn: async (socialLinks: Record<string, string>) => {
      const response = await apiClient.patch('/users/me/profile', {
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        phone: userData?.phone,
        organization_name: userData?.organization_name,
        address_line1: userData?.address_line1,
        address_line2: userData?.address_line2,
        city: userData?.city,
        state: userData?.state,
        postal_code: userData?.postal_code,
        country: userData?.country,
        social_media_links: socialLinks,
      })
      return response.data
    },
    onSuccess: (data) => {
      toast.success('Social media links updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      useAuthStore.getState().setUser(data.user || data)
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } }
      const errorMessage = err.response?.data?.detail || 'Failed to update social media links'
      toast.error(errorMessage)
    },
  })

  if (isLoading) {
    return (
      <ContentSection title='Profile' desc='This is how others will see you on the site.'>
        <div>Loading...</div>
      </ContentSection>
    )
  }

  const userInitials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  return (
    <ContentSection
      title='Profile'
      desc='Update your profile information and picture. Email cannot be changed here.'
    >
      <div className='space-y-6'>
        {selectedEventSlug && (
          <div>
            <Button asChild variant='outline' className='gap-2'>
              <Link to='/events/$eventSlug' params={{ eventSlug: selectedEventSlug }}>
                <ArrowLeft className='h-4 w-4' />
                Back to Event
              </Link>
            </Button>
          </div>
        )}

        <div>
          <h3 className='text-lg font-medium'>Profile Picture</h3>
          <p className='text-muted-foreground text-sm'>
            Upload a picture to personalize your profile
          </p>
          <div className='mt-4'>
            <ProfilePictureUpload
              userId={user?.id || ''}
              currentPictureUrl={userData?.profile_picture_url}
              userInitials={userInitials}
            />
          </div>
        </div>

        <Separator />

        <div>
          <h3 className='text-lg font-medium'>Personal Information</h3>
          <p className='text-muted-foreground text-sm'>Update your personal details</p>
          <div className='mt-4'>
            <ProfileForm initialData={userData} />
          </div>
        </div>

        <Separator />

        <div>
          <h3 className='text-lg font-medium'>Social Media Links</h3>
          <p className='text-muted-foreground text-sm'>
            Add your social media profiles to connect with others
          </p>
          <div className='mt-4'>
            <SocialMediaLinksForm
              initialData={userData?.social_media_links}
              onSubmit={updateSocialMediaMutation.mutate}
              isPending={updateSocialMediaMutation.isPending}
            />
          </div>
        </div>
      </div>
    </ContentSection>
  )
}
