import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/axios'
import { ContentSection } from '../components/content-section'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { useAuthStore } from '@/stores/auth-store'

export function SettingsProfile() {
  const user = useAuthStore((state) => state.user)

  // T047: Fetch current user data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me')
      return response.data
    },
    enabled: !!user, // Only fetch if user is authenticated
  })

  if (isLoading) {
    return (
      <ContentSection
        title='Profile'
        desc='This is how others will see you on the site.'
      >
        <div>Loading...</div>
      </ContentSection>
    )
  }

  return (
    <ContentSection
      title='Profile'
      desc='Update your profile information. Email cannot be changed here.'
    >
      <ProfileForm initialData={userData} />
    </ContentSection>
  )
}
