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
import { Textarea } from '@/components/ui/textarea'
import type { NPOCreateRequest } from '@/types/npo'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

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
      city: z.string().optional().or(z.literal('')),
      state: z.string().optional().or(z.literal('')),
      postal_code: z.string().optional().or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
    })
    .optional(),
})

type NPOFormValues = z.infer<typeof npoFormSchema>

interface NPOCreationFormProps {
  onSubmit: (data: NPOCreateRequest) => Promise<void>
  isLoading?: boolean
  defaultValues?: Partial<NPOFormValues>
}

export function NPOCreationForm({
  onSubmit,
  isLoading = false,
  defaultValues,
}: NPOCreationFormProps) {
  const form = useForm<NPOFormValues>({
    resolver: zodResolver(npoFormSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      email: defaultValues?.email || '',
      description: defaultValues?.description || '',
      mission_statement: defaultValues?.mission_statement || '',
      website_url: defaultValues?.website_url || '',
      phone: defaultValues?.phone || '',
      tax_id: defaultValues?.tax_id || '',
      registration_number: defaultValues?.registration_number || '',
      address: {
        street: defaultValues?.address?.street || '',
        city: defaultValues?.address?.city || '',
        state: defaultValues?.address?.state || '',
        postal_code: defaultValues?.address?.postal_code || '',
        country: defaultValues?.address?.country || '',
      },
    },
  })

  const handleSubmit = async (values: NPOFormValues) => {
    // Clean up empty strings and undefined values
    const cleanData: NPOCreateRequest = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
    }

    // Add optional fields only if they have values
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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
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
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Primary contact email for your organization
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
                      placeholder="+1-555-0100"
                      {...field}
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
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>Your organization's website (optional)</FormDescription>
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
            <CardTitle>Legal Information</CardTitle>
            <CardDescription>
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
                    Tax identification number or EIN (optional)
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
                    Official registration number with governing body (optional)
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
            <CardTitle>Address</CardTitle>
            <CardDescription>
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
                    <FormControl>
                      <Input
                        placeholder="CA"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
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
                        placeholder="94102"
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
                name="address.country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="United States"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isLoading}
          >
            Reset
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Organization'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
