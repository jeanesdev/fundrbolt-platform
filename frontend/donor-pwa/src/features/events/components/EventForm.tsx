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
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ColorPicker } from './ColorPicker.tsx'
import { RichTextEditor } from './RichTextEditor.tsx'

// Phone number formatting helper
const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')
  if (phoneNumber.length === 0) return ''

  // Handle 11-digit numbers with +1
  if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    const digits = phoneNumber.slice(1)
    if (digits.length <= 3) return `+1(${digits}`
    if (digits.length <= 6)
      return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
    return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle 10-digit numbers
  if (phoneNumber.length <= 3) return `(${phoneNumber}`
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
  return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

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
  attire: z.string().optional(),
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  primary_contact_phone: z.string().optional(),
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
  // Refs for Google Maps Autocomplete
  const venueAddressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const isGoogleMapsInitialized = useRef(false)

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
      attire: event?.attire || '',
      primary_contact_name: event?.primary_contact_name || '',
      primary_contact_email: event?.primary_contact_email || '',
      primary_contact_phone: event?.primary_contact_phone || '',
      // Use event colors if editing, otherwise use NPO branding colors
      primary_color: event?.primary_color || npoBranding?.primary_color || '',
      secondary_color: event?.secondary_color || npoBranding?.secondary_color || '',
      background_color: event?.background_color || npoBranding?.background_color || '',
      accent_color: event?.accent_color || npoBranding?.accent_color || '',
    },
  })

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  const handleNameBlur = () => {
    const currentName = form.getValues('name')
    const currentSlug = form.getValues('slug')

    // Only auto-generate if slug is empty and name has content
    if (currentName && !currentSlug) {
      const generatedSlug = generateSlug(currentName)
      form.setValue('slug', generatedSlug)
    }
  }

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    const initAutocomplete = async () => {
      // Prevent multiple initializations
      if (!venueAddressInputRef.current || isGoogleMapsInitialized.current) return

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        return
      }

      try {
        // Set options for Google Maps (only once)
        if (!isGoogleMapsInitialized.current) {
          setOptions({ key: apiKey })
          isGoogleMapsInitialized.current = true
        }

        // Import places library
        const { Autocomplete } = (await importLibrary('places')) as any // eslint-disable-line @typescript-eslint/no-explicit-any

        const autocomplete = new Autocomplete(venueAddressInputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
        })

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()

          if (!place.address_components) {
            return
          }

          let street = ''
          let city = ''
          let state = ''
          let postalCode = ''

          // Parse address components
          for (const component of place.address_components) {
            const types = component.types

            if (types.includes('street_number')) {
              street = component.long_name + ' '
            } else if (types.includes('route')) {
              street += component.long_name
            } else if (types.includes('locality')) {
              city = component.long_name
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name
            } else if (types.includes('postal_code')) {
              postalCode = component.long_name
            }
          }

          // Update form values
          form.setValue('venue_address', street.trim())
          form.setValue('venue_city', city)
          form.setValue('venue_state', state)
          form.setValue('venue_zip', postalCode)
        })

        autocompleteRef.current = autocomplete
      } catch (_error) {
        // Error loading Google Places - silently fail
      }
    }

    initAutocomplete()
  }, [form])

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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 md:space-y-8">
        {/* Basic Information Section */}
        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-semibold">Basic Information</h3>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Name *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Spring Gala 2025"
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      handleNameBlur()
                    }}
                  />
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
                  Auto-generated from event name. Edit to customize the URL.
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
                <div className="w-full overflow-hidden">
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
          <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 md:h-5 md:w-5" />
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
                  <Input
                    placeholder="123 Main St"
                    {...field}
                    ref={(e) => {
                      field.ref(e)
                      venueAddressInputRef.current = e
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Start typing to search for addresses
                </FormDescription>
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

        {/* Event Details Section */}
        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-semibold">Event Details</h3>

          <FormField
            control={form.control}
            name="attire"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Attire (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Black Tie, Cocktail Attire, Business Casual" {...field} />
                </FormControl>
                <FormDescription>Dress code or recommended attire for guests</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact Information Section */}
        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-semibold">Primary Contact</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Contact information for event inquiries (optional)
          </p>

          <FormField
            control={form.control}
            name="primary_contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="primary_contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contact@example.com"
                      {...field}
                      onBlur={async () => {
                        field.onBlur()
                        await form.trigger('primary_contact_email')
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="primary_contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
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
                      onBlur={field.onBlur}
                      maxLength={17}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Branding Colors Section */}
        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-semibold">Branding Colors</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
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
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
