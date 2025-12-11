/**
 * NPO Creation Form Component
 * Multi-section form for creating a new NPO with validation
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { NPOCreateRequest } from '@/types/npo'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

// US States for dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
]

// Countries for dropdown
const COUNTRIES = [
  { value: 'United States', label: 'United States' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Finland', label: 'Finland' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Japan', label: 'Japan' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'India', label: 'India' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Chile', label: 'Chile' },
  { value: 'South Africa', label: 'South Africa' },
]

// Format phone number as user types (matches sign-up form)
const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')
  if (phoneNumber.length === 0) return ''

  // Handle 11-digit numbers with +1
  if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    const digits = phoneNumber.slice(1)
    if (digits.length <= 3) return `+1(${digits}`
    if (digits.length <= 6) return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
    return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle 10-digit numbers
  if (phoneNumber.length <= 3) return `(${phoneNumber}`
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
  return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

// Validation helpers
const isValidEmail = (email: string): boolean => {
  if (!email) return true // Empty is valid (will be caught by required validation)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isValidUrl = (url: string): boolean => {
  if (!url) return true // Empty is valid (optional field)
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

// Form validation schema
const npoFormSchema = z.object({
  // Required fields
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must not exceed 255 characters')
    .refine((val) => val.trim().length > 0, 'Name cannot be empty or whitespace'),
  email: z.string().email('Invalid email address'),

  // Optional basic info
  tagline: z
    .string()
    .max(255, 'Tagline must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional()
    .or(z.literal('')),
  mission_statement: z
    .string()
    .max(5000, 'Mission statement must not exceed 5000 characters')
    .optional()
    .or(z.literal('')),
  website_url: z
    .string()
    .url('Invalid URL format')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(20, 'Phone must not exceed 20 characters')
    .optional()
    .or(z.literal('')),

  // Optional legal/registration info
  tax_id: z
    .string()
    .max(50, 'Tax ID must not exceed 50 characters')
    .optional()
    .or(z.literal('')),
  registration_number: z
    .string()
    .max(100, 'Registration number must not exceed 100 characters')
    .optional()
    .or(z.literal('')),

  // Optional address
  address: z
    .object({
      street: z.string().optional().or(z.literal('')),
      street2: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      state: z.string().optional().or(z.literal('')),
      postal_code: z
        .string()
        .optional()
        .or(z.literal(''))
        .refine(
          (val) => !val || /^\d{5}(-\d{4})?$/.test(val),
          'Postal code must be in format 12345 or 12345-6789'
        ),
      country: z.string().optional().or(z.literal('')),
    })
    .optional(),
})

type NPOFormValues = z.infer<typeof npoFormSchema>

interface NPOCreationFormProps {
  onSubmit: (data: NPOCreateRequest) => Promise<void>
  isLoading?: boolean
  defaultValues?: Partial<NPOFormValues>
  submitButtonText?: string
}

export function NPOCreationForm({
  onSubmit,
  isLoading = false,
  defaultValues,
  submitButtonText = 'Create Organization',
}: NPOCreationFormProps) {
  // Validation state for real-time feedback
  const [emailError, setEmailError] = useState<string | null>(null)
  const [websiteError, setWebsiteError] = useState<string | null>(null)

  // Google Places Autocomplete
  const addressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const isGoogleMapsInitialized = useRef(false)

  const form = useForm<NPOFormValues>({
    resolver: zodResolver(npoFormSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      email: defaultValues?.email || '',
      tagline: defaultValues?.tagline || '',
      description: defaultValues?.description || '',
      mission_statement: defaultValues?.mission_statement || '',
      website_url: defaultValues?.website_url || '',
      phone: defaultValues?.phone || '',
      tax_id: defaultValues?.tax_id || '',
      registration_number: defaultValues?.registration_number || '',
      address: {
        street: defaultValues?.address?.street || '',
        street2: defaultValues?.address?.street2 || '',
        city: defaultValues?.address?.city || '',
        state: defaultValues?.address?.state || '',
        postal_code: defaultValues?.address?.postal_code || '',
        country: defaultValues?.address?.country || 'United States',
      },
    },
  })

  // Initialize Google Places Autocomplete
  useEffect(() => {
    const initAutocomplete = async () => {
      // Check if feature is enabled
      const isEnabled = import.meta.env.VITE_ENABLE_ADDRESS_AUTOCOMPLETE === 'true'
      if (!isEnabled) {
        return
      }

      // Prevent multiple initializations
      if (!addressInputRef.current || isGoogleMapsInitialized.current) return

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

        const autocomplete = new Autocomplete(addressInputRef.current, {
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
          let country = ''

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
            } else if (types.includes('country')) {
              country = component.long_name
            }
          }

          // Update form values
          form.setValue('address.street', street.trim(), { shouldValidate: true, shouldDirty: true })
          form.setValue('address.city', city, { shouldValidate: true, shouldDirty: true })
          form.setValue('address.state', state, { shouldValidate: true, shouldDirty: true })
          form.setValue('address.postal_code', postalCode, { shouldValidate: true, shouldDirty: true })
          form.setValue('address.country', country, { shouldValidate: true, shouldDirty: true })
        })

        autocompleteRef.current = autocomplete
      } catch (_error) {
        // Error loading Google Places
      }
    }

    initAutocomplete()
  }, [form])

  const handleSubmit = async (values: NPOFormValues) => {
    // Clean up empty strings and undefined values
    const cleanData: NPOCreateRequest = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
    }

    // Add optional fields only if they have values
    if (values.tagline?.trim()) {
      cleanData.tagline = values.tagline.trim()
    }
    if (values.description?.trim()) {
      cleanData.description = values.description.trim()
    }
    if (values.mission_statement?.trim()) {
      cleanData.mission_statement = values.mission_statement.trim()
    }
    if (values.website_url?.trim()) {
      cleanData.website_url = values.website_url.trim()
    }
    if (values.phone?.trim()) {
      cleanData.phone = values.phone.trim()
    }
    if (values.tax_id?.trim()) {
      cleanData.tax_id = values.tax_id.trim()
    }
    if (values.registration_number?.trim()) {
      cleanData.registration_number = values.registration_number.trim()
    }

    // Add address only if any field has a value
    if (values.address) {
      const hasAddressData = Object.values(values.address).some((val) => val?.trim())
      if (hasAddressData) {
        cleanData.address = {
          street: values.address.street?.trim(),
          street2: values.address.street2?.trim(),
          city: values.address.city?.trim(),
          state: values.address.state?.trim(),
          postal_code: values.address.postal_code?.trim(),
          country: values.address.country?.trim(),
        }
      }
    }

    await onSubmit(cleanData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
        {/* Basic Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Basic Information</CardTitle>
            <CardDescription className="text-sm">
              Essential details about your organization. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Community Food Bank"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    The official name of your non-profit organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="contact@yourorg.org"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur()
                        const value = e.target.value
                        if (value && !isValidEmail(value)) {
                          setEmailError('Please enter a valid email address')
                        } else {
                          setEmailError(null)
                        }
                      }}
                      className={emailError ? 'border-red-500' : ''}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Primary contact email for your organization
                  </FormDescription>
                  {emailError && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {emailError}
                    </p>
                  )}
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
                    <Input
                      placeholder="e.g., Fighting hunger in our community"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    A short, memorable phrase that describes your mission (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="(555)123-4567"
                      value={field.value ? formatPhoneNumber(field.value) : ''}
                      onChange={(e) => {
                        const rawDigits = e.target.value.replace(/\D/g, '')
                        field.onChange(rawDigits)
                      }}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>Contact phone number (optional)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://yourorg.org"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur()
                        const value = e.target.value
                        if (value && !isValidUrl(value)) {
                          setWebsiteError('Please enter a valid URL (must start with http:// or https://)')
                        } else {
                          setWebsiteError(null)
                        }
                      }}
                      className={websiteError ? 'border-red-500' : ''}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>Your organization's website (optional)</FormDescription>
                  {websiteError && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {websiteError}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Briefly describe your organization's activities and purpose..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    A brief overview of your organization (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mission_statement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mission Statement</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Our mission is to..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Your organization's mission and goals (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Legal Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Legal Information</CardTitle>
            <CardDescription className="text-sm">
              Registration and tax information for your organization (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="tax_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID / EIN</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="XX-XXXXXXX"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Tax identification number or EIN
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="registration_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="REG-12345"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Official registration number with governing body
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Address Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Address</CardTitle>
            <CardDescription className="text-sm">
              Physical address of your organization (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="address.street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main St"
                      {...field}
                      ref={(e) => {
                        field.ref(e)
                        addressInputRef.current = e
                      }}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address.street2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address Line 2</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Apartment, suite, unit, building, floor, etc."
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="San Francisco"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="address.postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="12345 or 12345-6789"
                        {...field}
                        disabled={isLoading}
                        onBlur={() => {
                          field.onBlur()
                          form.trigger('address.postal_code')
                        }}
                        className={
                          form.formState.errors.address?.postal_code
                            ? 'border-red-500'
                            : ''
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address.country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row sm:gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Reset
          </Button>
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Saving...' : submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  )
}
