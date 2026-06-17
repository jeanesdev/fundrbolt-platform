/**
 * SocialMediaLinksForm Component
 * Allows users to add/edit their social media profile links
 * Validates URLs using platform-specific patterns
 */
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Facebook, Globe, Instagram, Linkedin, Youtube } from 'lucide-react'
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

type XLogoIconProps = {
  className?: string
}

function XLogoIcon({ className }: XLogoIconProps) {
  return (
    <svg
      viewBox='0 0 24 24'
      aria-hidden='true'
      fill='currentColor'
      className={className}
    >
      <path d='M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.3L6.4 22H3.3l7.3-8.4L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.1 3.9H4.3L17.8 20Z' />
    </svg>
  )
}

const socialPlatforms = {
  facebook: {
    prefix: 'facebook.com/',
    toUrl: (u: string) => `https://facebook.com/${u.replace(/^@/, '')}`,
    toUsername: (url: string) =>
      url.match(/(?:facebook|fb)\.com\/([^/?#]+)/)?.[1] ?? '',
  },
  twitter: {
    prefix: 'x.com/',
    toUrl: (u: string) => `https://x.com/${u.replace(/^@/, '')}`,
    toUsername: (url: string) =>
      url.match(/(?:twitter|x)\.com\/@?([^/?#]+)/)?.[1] ?? '',
  },
  instagram: {
    prefix: 'instagram.com/',
    toUrl: (u: string) => `https://instagram.com/${u.replace(/^@/, '')}`,
    toUsername: (url: string) =>
      url.match(/instagram\.com\/([^/?#]+)/)?.[1] ?? '',
  },
  linkedin: {
    prefix: 'linkedin.com/in/',
    toUrl: (u: string) => `https://linkedin.com/in/${u.replace(/^@/, '')}`,
    toUsername: (url: string) =>
      url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/)?.[1] ?? '',
  },
  youtube: {
    prefix: 'youtube.com/@',
    toUrl: (u: string) => `https://youtube.com/@${u.replace(/^@/, '')}`,
    toUsername: (url: string) =>
      url.match(/youtube\.com\/@?([^/?#]+)/)?.[1] ?? '',
  },
} as const

const websitePattern = /^https?:\/\/[\w-.]+\.[a-z]{2,}(\/.*)?$/i

type SocialPlatform = keyof typeof socialPlatforms

const usernameField = z
  .string()
  .optional()
  .refine(
    (val) => !val || /^[\w.@-]+$/.test(val),
    'Usernames can only contain letters, numbers, dots, underscores, and hyphens'
  )

const socialMediaSchema = z.object({
  facebook: usernameField,
  twitter: usernameField,
  instagram: usernameField,
  linkedin: usernameField,
  youtube: usernameField,

  website: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || websitePattern.test(val),
      'Invalid website URL (e.g., https://example.com)'
    )
    .transform((val) => (val === '' ? undefined : val)),
})

export type SocialMediaLinksFormData = z.infer<typeof socialMediaSchema>

interface SocialMediaLinksFormProps {
  initialData?: Record<string, string> | null
  onSubmit: (data: Record<string, string>) => void
  isPending?: boolean
}

export function SocialMediaLinksForm({
  initialData,
  onSubmit,
  isPending = false,
}: SocialMediaLinksFormProps) {
  const form = useForm({
    resolver: zodResolver(socialMediaSchema),
    defaultValues: {
      facebook: initialData?.facebook
        ? socialPlatforms.facebook.toUsername(initialData.facebook)
        : '',
      twitter: initialData?.twitter
        ? socialPlatforms.twitter.toUsername(initialData.twitter)
        : '',
      instagram: initialData?.instagram
        ? socialPlatforms.instagram.toUsername(initialData.instagram)
        : '',
      linkedin: initialData?.linkedin
        ? socialPlatforms.linkedin.toUsername(initialData.linkedin)
        : '',
      youtube: initialData?.youtube
        ? socialPlatforms.youtube.toUsername(initialData.youtube)
        : '',
      website: initialData?.website || '',
    },
    mode: 'onBlur',
  })

  const handleSubmit = (data: SocialMediaLinksFormData) => {
    const socialMediaData = {
      facebook: data.facebook,
      twitter: data.twitter,
      instagram: data.instagram,
      linkedin: data.linkedin,
      youtube: data.youtube,
    }

    const filteredData = Object.entries(socialMediaData).reduce(
      (acc, [key, value]) => {
        if (value && value !== '') {
          const platform = key as SocialPlatform
          acc[key] = socialPlatforms[platform].toUrl(value)
        }
        return acc
      },
      {} as Record<string, string>
    )

    if (data.website && data.website !== '') {
      filteredData.website = data.website
    }

    onSubmit(filteredData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
        <div className='space-y-4'>
          <FormField
            control={form.control}
            name='facebook'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex items-center gap-2'>
                  <Facebook className='h-4 w-4' />
                  Facebook
                </FormLabel>
                <FormControl>
                  <div className='focus-within:ring-ring flex overflow-hidden rounded-md border focus-within:ring-1'>
                    <span className='bg-muted text-muted-foreground flex items-center border-r px-3 text-sm'>
                      {socialPlatforms.facebook.prefix}
                    </span>
                    <Input
                      className='rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
                      placeholder='username'
                      {...field}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>Your Facebook username</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='twitter'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex items-center gap-2'>
                  <XLogoIcon className='h-4 w-4' />X
                </FormLabel>
                <FormControl>
                  <div className='focus-within:ring-ring flex overflow-hidden rounded-md border focus-within:ring-1'>
                    <span className='bg-muted text-muted-foreground flex items-center border-r px-3 text-sm'>
                      {socialPlatforms.twitter.prefix}
                    </span>
                    <Input
                      className='rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
                      placeholder='username'
                      {...field}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>Your X username</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='instagram'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex items-center gap-2'>
                  <Instagram className='h-4 w-4' />
                  Instagram
                </FormLabel>
                <FormControl>
                  <div className='focus-within:ring-ring flex overflow-hidden rounded-md border focus-within:ring-1'>
                    <span className='bg-muted text-muted-foreground flex items-center border-r px-3 text-sm'>
                      {socialPlatforms.instagram.prefix}
                    </span>
                    <Input
                      className='rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
                      placeholder='username'
                      {...field}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>Your Instagram username</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='linkedin'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex items-center gap-2'>
                  <Linkedin className='h-4 w-4' />
                  LinkedIn
                </FormLabel>
                <FormControl>
                  <div className='focus-within:ring-ring flex overflow-hidden rounded-md border focus-within:ring-1'>
                    <span className='bg-muted text-muted-foreground flex items-center border-r px-3 text-sm'>
                      {socialPlatforms.linkedin.prefix}
                    </span>
                    <Input
                      className='rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
                      placeholder='username'
                      {...field}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>Your LinkedIn username</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='youtube'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='flex items-center gap-2'>
                  <Youtube className='h-4 w-4' />
                  YouTube
                </FormLabel>
                <FormControl>
                  <div className='focus-within:ring-ring flex overflow-hidden rounded-md border focus-within:ring-1'>
                    <span className='bg-muted text-muted-foreground flex items-center border-r px-3 text-sm'>
                      {socialPlatforms.youtube.prefix}
                    </span>
                    <Input
                      className='rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
                      placeholder='username'
                      {...field}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>Your YouTube username</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Your personal or business website
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex gap-4'>
          <Button type='submit' disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Social Links'}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => form.reset()}
            disabled={isPending}
          >
            Reset
          </Button>
        </div>
      </form>
    </Form>
  )
}
