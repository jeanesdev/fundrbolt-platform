import { ProfilePictureUpload } from '@/components/profile/profile-picture-upload'
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
import { Separator } from '@/components/ui/separator'
import apiClient from '@/lib/axios'
import { profileUpdateSchema } from '@/schemas/profile'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ContentSection } from '../components/content-section'

// Social media platform config: prefix shown in UI, URL builder, and username extractor
const socialPlatforms = {
  facebook: {
    prefix: 'facebook.com/',
    toUrl: (u: string) => `https://facebook.com/${u}`,
    toUsername: (url: string) =>
      url.match(/(?:facebook|fb)\.com\/([^/?#]+)/)?.[1] ?? '',
  },
  twitter: {
    prefix: 'x.com/',
    toUrl: (u: string) => `https://x.com/${u}`,
    toUsername: (url: string) =>
      url.match(/(?:twitter|x)\.com\/@?([^/?#]+)/)?.[1] ?? '',
  },
  instagram: {
    prefix: 'instagram.com/',
    toUrl: (u: string) => `https://instagram.com/${u}`,
    toUsername: (url: string) =>
      url.match(/instagram\.com\/([^/?#]+)/)?.[1] ?? '',
  },
  linkedin: {
    prefix: 'linkedin.com/in/',
    toUrl: (u: string) => `https://linkedin.com/in/${u}`,
    toUsername: (url: string) =>
      url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/)?.[1] ?? '',
  },
  youtube: {
    prefix: 'youtube.com/@',
    toUrl: (u: string) => `https://youtube.com/@${u}`,
    toUsername: (url: string) =>
      url.match(/youtube\.com\/@?([^/?#]+)/)?.[1] ?? '',
  },
} as const

type SocialPlatform = keyof typeof socialPlatforms

const usernameField = z
  .string()
  .optional()
  .refine(
    (v) => !v || /^[\w.@-]+$/.test(v),
    'Usernames can only contain letters, numbers, dots, underscores, and hyphens'
  )

const combinedSchema = profileUpdateSchema.extend({
  facebook: usernameField,
  twitter: usernameField,
  instagram: usernameField,
  linkedin: usernameField,
  youtube: usernameField,
  website: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/[\w-.]+\.[a-z]{2,}(\/.*)?$/i.test(v),
      'Enter a valid URL (e.g. https://example.com)'
    ),
})

type CombinedFormData = z.input<typeof combinedSchema>

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  // More than 10 digits — assume country code
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`
}

function phoneDisplayToE164(display: string): string {
  const digits = display.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return display // already E.164 or unknown format
}

export function SettingsProfile() {
  const user = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const spoofedUser = useDebugSpoofStore((state) => state.spoofedUser)
  const queryClient = useQueryClient()

  const effectiveUserId = spoofedUser?.id ?? null

  // Fetch current user data — the axios interceptor automatically sends X-Spoof-User-Id
  // when spoofing is active, so /users/me returns the spoofed user's data.
  // Calling the admin /users/{id} endpoint directly breaks because the spoof header
  // causes the backend to authenticate as the (donor) spoofed user, who lacks admin role.
  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', 'me', effectiveUserId ?? 'self'],
    queryFn: async () => {
      const response = await apiClient.get('/users/me')
      return response.data
    },
    enabled: !!user,
  })

  // Sync profile picture URL to auth store when own userData changes
  useEffect(() => {
    if (
      !effectiveUserId &&
      userData?.profile_picture_url &&
      userData.profile_picture_url !== user?.profile_picture_url
    ) {
      updateUser({ profile_picture_url: userData.profile_picture_url })
    }
  }, [
    effectiveUserId,
    userData?.profile_picture_url,
    user?.profile_picture_url,
    updateUser,
  ])

  const form = useForm<CombinedFormData>({
    resolver: zodResolver(combinedSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      organization_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      facebook: '',
      twitter: '',
      instagram: '',
      linkedin: '',
      youtube: '',
      website: '',
    },
    mode: 'onBlur',
  })

  // Reset form when userData loads
  useEffect(() => {
    if (userData) {
      const links =
        (userData.social_media_links as Record<string, string> | null) ?? {}
      form.reset({
        first_name: userData.first_name ?? '',
        last_name: userData.last_name ?? '',
        phone: userData.phone ?? '',
        organization_name: userData.organization_name ?? '',
        address_line1: userData.address_line1 ?? '',
        address_line2: userData.address_line2 ?? '',
        city: userData.city ?? '',
        state: userData.state ?? '',
        postal_code: userData.postal_code ?? '',
        country: userData.country ?? '',
        facebook: links.facebook
          ? socialPlatforms.facebook.toUsername(links.facebook)
          : '',
        twitter: links.twitter
          ? socialPlatforms.twitter.toUsername(links.twitter)
          : '',
        instagram: links.instagram
          ? socialPlatforms.instagram.toUsername(links.instagram)
          : '',
        linkedin: links.linkedin
          ? socialPlatforms.linkedin.toUsername(links.linkedin)
          : '',
        youtube: links.youtube
          ? socialPlatforms.youtube.toUsername(links.youtube)
          : '',
        website: links.website ?? '',
      })
    }
  }, [userData, form])

  const saveProfileMutation = useMutation({
    mutationFn: async (data: CombinedFormData) => {
      const {
        facebook,
        twitter,
        instagram,
        linkedin,
        youtube,
        website,
        ...profileFields
      } = data
      // Convert usernames to full URLs for storage
      const usernameFields = { facebook, twitter, instagram, linkedin, youtube }
      const socialMediaLinks: Record<string, string> = {}
      for (const [platform, username] of Object.entries(usernameFields)) {
        if (username && username !== '') {
          socialMediaLinks[platform] = socialPlatforms[
            platform as SocialPlatform
          ].toUrl(username)
        }
      }
      if (website && website !== '') socialMediaLinks.website = website

      // Convert formatted phone back to E.164
      const phoneE164 = profileFields.phone
        ? phoneDisplayToE164(profileFields.phone)
        : undefined

      const response = await apiClient.patch('/users/me/profile', {
        ...profileFields,
        phone: phoneE164 || undefined,
        social_media_links:
          Object.keys(socialMediaLinks).length > 0
            ? socialMediaLinks
            : undefined,
      })
      return response.data
    },
    onSuccess: (data) => {
      toast.success('Profile saved!')
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      useAuthStore.getState().setUser(data.user || data)
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Failed to save profile')
    },
  })

  const onSubmit = (data: CombinedFormData) => {
    saveProfileMutation.mutate(data)
  }

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

  // Derive initials: prefer spoofed user label, fall back to auth user
  const userInitials = spoofedUser
    ? spoofedUser.label
        .split(' ')
        .map((n) => n[0] ?? '')
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user
      ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
      : 'U'

  const displayUserId = effectiveUserId ?? user?.id ?? ''

  return (
    <ContentSection
      title='Profile'
      desc='Update your profile information and picture. Email cannot be changed here.'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          {/* Profile Picture */}
          <div>
            <h3 className='text-lg font-medium'>Profile Picture</h3>
            <p className='text-muted-foreground text-sm'>
              Upload a picture to personalize your profile
            </p>
            <div className='mt-4'>
              <ProfilePictureUpload
                userId={displayUserId}
                currentPictureUrl={userData?.profile_picture_url}
                userInitials={userInitials}
              />
            </div>
          </div>

          <Separator />

          {/* Personal Information */}
          <div className='space-y-4'>
            <h3 className='text-lg font-medium'>Personal Information</h3>
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

            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='(555) 555-5555'
                      {...field}
                      value={field.value ? formatPhoneNumber(field.value) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        field.onChange(raw ? `+1${raw}` : '')
                      }}
                      inputMode='tel'
                    />
                  </FormControl>
                  <FormDescription>Your contact phone number</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='organization_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Acme Inc.'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='address_line1'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='123 Main St'
                      {...field}
                      value={field.value ?? ''}
                    />
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
                    <Input
                      placeholder='Apt 4B'
                      {...field}
                      value={field.value ?? ''}
                    />
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
                      <Input
                        placeholder='San Francisco'
                        {...field}
                        value={field.value ?? ''}
                      />
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
                      <Input
                        placeholder='CA'
                        {...field}
                        value={field.value ?? ''}
                      />
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
                    <FormLabel>ZIP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='94102'
                        {...field}
                        value={field.value ?? ''}
                      />
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
                    <Input
                      placeholder='United States'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Social Media Links */}
          <div className='space-y-4'>
            <h3 className='text-lg font-medium'>Social Media Links</h3>
            <p className='text-muted-foreground text-sm'>
              Add your social media profiles to connect with others
            </p>

            {(
              [
                { name: 'facebook' as const, icon: Facebook, label: 'Facebook' },
                { name: 'twitter' as const, icon: Twitter, label: 'Twitter / X' },
                {
                  name: 'instagram' as const,
                  icon: Instagram,
                  label: 'Instagram',
                },
                { name: 'linkedin' as const, icon: Linkedin, label: 'LinkedIn' },
                { name: 'youtube' as const, icon: Youtube, label: 'YouTube' },
              ] as const
            ).map(({ name, icon: Icon, label }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='flex items-center gap-2'>
                      <Icon className='h-4 w-4' />
                      {label}
                    </FormLabel>
                    <FormControl>
                      <div className='flex overflow-hidden rounded-md border focus-within:ring-1 focus-within:ring-ring'>
                        <span className='flex items-center border-r bg-muted px-3 text-sm text-muted-foreground'>
                          {socialPlatforms[name].prefix}
                        </span>
                        <Input
                          className='rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
                          placeholder='username'
                          {...field}
                          value={field.value ?? ''}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            {/* Website — keep as full URL */}
            <FormField
              control={form.control}
              name='website'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className='flex items-center gap-2'>
                    <Globe className='h-4 w-4' />
                    Website
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://example.com'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Single unified save button */}
          <div className='flex gap-4'>
            <Button type='submit' disabled={saveProfileMutation.isPending}>
              {saveProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => form.reset()}
              disabled={saveProfileMutation.isPending}
            >
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </ContentSection>
  )
}
