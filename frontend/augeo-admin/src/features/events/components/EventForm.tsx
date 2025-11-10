/**
 * EventForm Component
 * Comprehensive form for creating and editing events with all fields
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NPOBranding } from '@/services/event-service'
import type { EventCreateRequest, EventDetail, EventUpdateRequest } from '@/types/event'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ColorPicker } from './ColorPicker'
import { RichTextEditor } from './RichTextEditor'

// Form validation schema
const eventFormSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  slug: z.string().optional(),
  tagline: z.string().max(200, 'Tagline must be under 200 characters').optional(),
  description: z.string().optional(),
  event_datetime: z.string().min(1, 'Event date and time is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  venue_city: z.string().optional(),
  venue_state: z.string().optional(),
  venue_zip: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  background_color: z.string().optional(),
  accent_color: z.string().optional(),
})

type EventFormValues = z.infer<typeof eventFormSchema>

interface EventFormProps {
  event?: EventDetail
  npoId: string
  npoBranding?: NPOBranding | null
  onSubmit: (data: EventCreateRequest & Partial<EventUpdateRequest>) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

export function EventForm({
  event,
  npoId,
  npoBranding,
  onSubmit,
  onCancel,
  isSubmitting,
}: EventFormProps) {
  // Initialize form with existing event data or NPO branding defaults
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: event?.name || '',
      slug: event?.slug || '',
      tagline: event?.tagline || '',
      description: event?.description || '',
      event_datetime: event?.event_datetime
        ? new Date(event.event_datetime).toISOString().slice(0, 16)
        : '',
      timezone: event?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      venue_name: event?.venue_name || '',
      venue_address: event?.venue_address || '',
      venue_city: event?.venue_city || '',
      venue_state: event?.venue_state || '',
      venue_zip: event?.venue_zip || '',
      // Use event colors if editing, otherwise use NPO branding colors
      primary_color: event?.primary_color || npoBranding?.primary_color || '',
      secondary_color: event?.secondary_color || npoBranding?.secondary_color || '',
      background_color: event?.background_color || npoBranding?.background_color || '',
      accent_color: event?.accent_color || npoBranding?.accent_color || '',
    },
  })

  const handleSubmit = async (values: EventFormValues) => {
    const baseData = {
      ...values,
      npo_id: npoId,
      // Convert datetime-local to ISO string
      event_datetime: new Date(values.event_datetime).toISOString(),
    }

    // Add version for optimistic locking on updates
    if (event) {
      await onSubmit({ ...baseData, version: event.version })
    } else {
      await onSubmit(baseData)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* Basic Information Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Basic Information</h3>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Spring Gala 2025" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug (URL)</FormLabel>
                <FormControl>
                  <Input placeholder="spring-gala-2025" {...field} />
                </FormControl>
                <FormDescription>
                  Leave blank to auto-generate from event name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tagline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tagline</FormLabel>
                <FormControl>
                  <Input placeholder="An Evening of Elegance and Impact" {...field} />
                </FormControl>
                <FormDescription>Short catchy phrase (max 200 characters)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <Label>Description</Label>
                <div>
                  <RichTextEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Enter event description..."
                  />
                </div>
                <FormDescription>
                  Full event description with formatting (Markdown supported)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Date, Time & Location Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date, Time & Location
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="event_datetime"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="event_datetime">Event Date & Time *</Label>
                  <FormControl>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="event_datetime"
                        type="datetime-local"
                        className="pl-10"
                        autoComplete="off"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="timezone">Timezone *</Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    name={field.name}
                  >
                    <FormControl>
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        United States
                      </div>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Phoenix">Arizona Time (No DST)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                      <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-2">
                        International
                      </div>
                      <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                      <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                      <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Select event timezone</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="venue_name"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="venue_name">Venue Name</Label>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="venue_name"
                      placeholder="Grand Ballroom"
                      className="pl-10"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="venue_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Venue Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="venue_city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="New York" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue_state"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="venue_state">State</Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    name={field.name}
                  >
                    <FormControl>
                      <SelectTrigger id="venue_state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AL">Alabama</SelectItem>
                      <SelectItem value="AK">Alaska</SelectItem>
                      <SelectItem value="AZ">Arizona</SelectItem>
                      <SelectItem value="AR">Arkansas</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="CO">Colorado</SelectItem>
                      <SelectItem value="CT">Connecticut</SelectItem>
                      <SelectItem value="DE">Delaware</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                      <SelectItem value="GA">Georgia</SelectItem>
                      <SelectItem value="HI">Hawaii</SelectItem>
                      <SelectItem value="ID">Idaho</SelectItem>
                      <SelectItem value="IL">Illinois</SelectItem>
                      <SelectItem value="IN">Indiana</SelectItem>
                      <SelectItem value="IA">Iowa</SelectItem>
                      <SelectItem value="KS">Kansas</SelectItem>
                      <SelectItem value="KY">Kentucky</SelectItem>
                      <SelectItem value="LA">Louisiana</SelectItem>
                      <SelectItem value="ME">Maine</SelectItem>
                      <SelectItem value="MD">Maryland</SelectItem>
                      <SelectItem value="MA">Massachusetts</SelectItem>
                      <SelectItem value="MI">Michigan</SelectItem>
                      <SelectItem value="MN">Minnesota</SelectItem>
                      <SelectItem value="MS">Mississippi</SelectItem>
                      <SelectItem value="MO">Missouri</SelectItem>
                      <SelectItem value="MT">Montana</SelectItem>
                      <SelectItem value="NE">Nebraska</SelectItem>
                      <SelectItem value="NV">Nevada</SelectItem>
                      <SelectItem value="NH">New Hampshire</SelectItem>
                      <SelectItem value="NJ">New Jersey</SelectItem>
                      <SelectItem value="NM">New Mexico</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="NC">North Carolina</SelectItem>
                      <SelectItem value="ND">North Dakota</SelectItem>
                      <SelectItem value="OH">Ohio</SelectItem>
                      <SelectItem value="OK">Oklahoma</SelectItem>
                      <SelectItem value="OR">Oregon</SelectItem>
                      <SelectItem value="PA">Pennsylvania</SelectItem>
                      <SelectItem value="RI">Rhode Island</SelectItem>
                      <SelectItem value="SC">South Carolina</SelectItem>
                      <SelectItem value="SD">South Dakota</SelectItem>
                      <SelectItem value="TN">Tennessee</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="UT">Utah</SelectItem>
                      <SelectItem value="VT">Vermont</SelectItem>
                      <SelectItem value="VA">Virginia</SelectItem>
                      <SelectItem value="WA">Washington</SelectItem>
                      <SelectItem value="WV">West Virginia</SelectItem>
                      <SelectItem value="WI">Wisconsin</SelectItem>
                      <SelectItem value="WY">Wyoming</SelectItem>
                      <SelectItem value="DC">District of Columbia</SelectItem>
                      <SelectItem value="PR">Puerto Rico</SelectItem>
                      <SelectItem value="VI">Virgin Islands</SelectItem>
                      <SelectItem value="GU">Guam</SelectItem>
                      <SelectItem value="AS">American Samoa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue_zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl>
                    <Input placeholder="10001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Branding Colors Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Branding Colors</h3>
          <p className="text-sm text-muted-foreground">
            Customize the event page appearance with your organization's colors
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="primary_color"
              render={({ field }) => (
                <FormItem>
                  <Label>Primary Color</Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label="Primary"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secondary_color"
              render={({ field }) => (
                <FormItem>
                  <Label>Secondary Color</Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label="Secondary"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="background_color"
              render={({ field }) => (
                <FormItem>
                  <Label>Background Color</Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label="Background"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accent_color"
              render={({ field }) => (
                <FormItem>
                  <Label>Accent Color</Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label="Accent"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
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
