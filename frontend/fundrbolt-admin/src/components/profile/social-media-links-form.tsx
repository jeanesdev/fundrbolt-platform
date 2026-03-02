/**
 * SocialMediaLinksForm Component
 * Allows users to add/edit their social media profile links
 * Validates URLs using platform-specific patterns
 */

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
import { zodResolver } from '@hookform/resolvers/zod'
import { Facebook, Globe, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// Social media URL validation patterns (matching backend patterns)
const socialMediaPatterns = {
  facebook: /^https?:\/\/(www\.)?(facebook|fb)\.com\/[\w-.]+\/?.*$/i,
  twitter: /^https?:\/\/(www\.)?(twitter|x)\.com\/[\w]+\/?.*$/i,
  instagram: /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?.*$/i,
  linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[\w-]+\/?.*$/i,
  youtube: /^https?:\/\/(www\.)?youtube\.com\/(c\/|@|channel\/|user\/)[\w-]+\/?.*$/i,
  website: /^https?:\/\/[\w-.]+\.[a-z]{2,}(\/.*)?$/i,
}

const socialMediaSchema = z.object({
  facebook: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || socialMediaPatterns.facebook.test(val),
      'Invalid Facebook URL (e.g., https://facebook.com/username)'
    )
    .transform((val) => (val === '' ? undefined : val)),

  twitter: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || socialMediaPatterns.twitter.test(val),
      'Invalid Twitter/X URL (e.g., https://twitter.com/username or https://x.com/username)'
    )
    .transform((val) => (val === '' ? undefined : val)),

  instagram: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || socialMediaPatterns.instagram.test(val),
      'Invalid Instagram URL (e.g., https://instagram.com/username)'
    )
    .transform((val) => (val === '' ? undefined : val)),

  linkedin: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || socialMediaPatterns.linkedin.test(val),
      'Invalid LinkedIn URL (e.g., https://linkedin.com/in/username)'
    )
    .transform((val) => (val === '' ? undefined : val)),

  youtube: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || socialMediaPatterns.youtube.test(val),
      'Invalid YouTube URL (e.g., https://youtube.com/@username)'
    )
    .transform((val) => (val === '' ? undefined : val)),

  website: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || socialMediaPatterns.website.test(val),
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
      facebook: initialData?.facebook || '',
      twitter: initialData?.twitter || '',
      instagram: initialData?.instagram || '',
      linkedin: initialData?.linkedin || '',
      youtube: initialData?.youtube || '',
      website: initialData?.website || '',
    },
    mode: 'onBlur',
  })

  const handleSubmit = (data: SocialMediaLinksFormData) => {
    // Filter out empty values
    const filteredData = Object.entries(data).reduce(
      (acc, [key, value]) => {
        if (value && value !== '') {
          acc[key] = value
        }
        return acc
      },
      {} as Record<string, string>
    )

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
                  <Input
                    placeholder='https://facebook.com/username'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>Your Facebook profile or page URL</FormDescription>
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
                  <Twitter className='h-4 w-4' />
                  Twitter / X
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder='https://twitter.com/username or https://x.com/username'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>Your Twitter (X) profile URL</FormDescription>
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
                  <Input
                    placeholder='https://instagram.com/username'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>Your Instagram profile URL</FormDescription>
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
                  <Input
                    placeholder='https://linkedin.com/in/username'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>Your LinkedIn profile URL</FormDescription>
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
                  <Input
                    placeholder='https://youtube.com/@username'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>Your YouTube channel URL</FormDescription>
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
                <FormDescription>Your personal or business website</FormDescription>
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
