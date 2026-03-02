/**
 * EventLinkForm Component
 * Form for adding/editing event links (video, website, social)
 */

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EventLink, EventLinkType } from '@/types/event'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const linkFormSchema = z.object({
  link_type: z.enum(['video', 'website', 'social_media']),
  url: z.string().url('Must be a valid URL'),
  label: z.string().optional(),
  platform: z.string().optional(),
  display_order: z.number().int().min(0).optional(),
})

type LinkFormValues = z.infer<typeof linkFormSchema>

interface EventLinkFormProps {
  link?: EventLink
  onSubmit: (data: LinkFormValues) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

export function EventLinkForm({ link, onSubmit, onCancel, isSubmitting }: EventLinkFormProps) {
  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      link_type: (link?.link_type as EventLinkType) || 'website',
      url: link?.url || '',
      label: link?.label || '',
      platform: link?.platform || '',
      display_order: link?.display_order || 0,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="link_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select link type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="video">Video (YouTube/Vimeo)</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Event Promo Video" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platform (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. YouTube, Facebook, Instagram" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : link ? 'Update Link' : 'Add Link'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
