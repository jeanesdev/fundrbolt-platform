/**
 * SponsorForm
 * Form for creating or editing a sponsor with logo upload
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LogoSize, type Sponsor, type SponsorCreateRequest, type SponsorUpdateRequest } from '@/types/sponsor'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
  if (!email) return true // Empty is valid (optional field)
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

const isValidPostalCode = (postalCode: string): boolean => {
  if (!postalCode) return true // Empty is valid (optional field)
  return /^\d{5}(-\d{4})?$/.test(postalCode)
}

interface SponsorFormProps {
  sponsor?: Sponsor
  onSubmit: (data: SponsorCreateRequest | SponsorUpdateRequest, logoFile?: File) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function SponsorForm({ sponsor, onSubmit, onCancel, isSubmitting = false }: SponsorFormProps) {
  const isEdit = !!sponsor

  interface FormData {
    name: string
    website_url: string
    logo_size: LogoSize
    sponsor_level: string
    contact_name: string
    contact_email: string
    contact_phone: string
    address_line1: string
    address_line2: string
    city: string
    state: string
    postal_code: string
    country: string
    donation_amount: string
    notes: string
  }

  const [formData, setFormData] = useState<FormData>({
    name: sponsor?.name || '',
    website_url: sponsor?.website_url || '',
    logo_size: sponsor?.logo_size || LogoSize.LARGE,
    sponsor_level: sponsor?.sponsor_level || '',
    contact_name: sponsor?.contact_name || '',
    contact_email: sponsor?.contact_email || '',
    contact_phone: sponsor?.contact_phone || '',
    address_line1: sponsor?.address_line1 || '',
    address_line2: sponsor?.address_line2 || '',
    city: sponsor?.city || '',
    state: sponsor?.state || '',
    postal_code: sponsor?.postal_code || '',
    country: sponsor?.country || '',
    donation_amount: sponsor?.donation_amount?.toString() || '',
    notes: sponsor?.notes || '',
  })

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(sponsor?.thumbnail_url || sponsor?.logo_url || null)

  // Validation errors
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null)

  // Google Places Autocomplete
  const addressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const isGoogleMapsInitialized = useRef(false)

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
          setFormData({
            ...formData,
            address_line1: street.trim(),
            city,
            state,
            postal_code: postalCode,
          })

          // Clear postal code error if autocomplete fills it
          if (postalCode) {
            setPostalCodeError(null)
          }
        })

        autocompleteRef.current = autocomplete
      } catch (_error) {
        // Error loading Google Places - silently fail
      }
    }

    initAutocomplete()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearLogo = () => {
    setLogoFile(null)
    setLogoPreview(sponsor?.thumbnail_url || sponsor?.logo_url || null)
  }

  const handleWebsiteBlur = () => {
    if (formData.website_url && !isValidUrl(formData.website_url)) {
      setWebsiteError('Please enter a valid URL (e.g., https://example.com)')
    } else {
      setWebsiteError(null)
    }
  }

  const handleEmailBlur = () => {
    if (formData.contact_email && !isValidEmail(formData.contact_email)) {
      setEmailError('Please enter a valid email address')
    } else {
      setEmailError(null)
    }
  }

  const handlePostalCodeBlur = () => {
    if (formData.postal_code && !isValidPostalCode(formData.postal_code)) {
      setPostalCodeError('Postal code must be in format 12345 or 12345-6789')
    } else {
      setPostalCodeError(null)
    }
  }

  const handlePhoneChange = (value: string) => {
    // Store raw digits only, format for display
    const formatted = formatPhoneNumber(value)
    setFormData({ ...formData, contact_phone: formatted })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate before submitting
    let hasErrors = false

    if (formData.website_url && !isValidUrl(formData.website_url)) {
      setWebsiteError('Please enter a valid URL (e.g., https://example.com)')
      hasErrors = true
    }

    if (formData.contact_email && !isValidEmail(formData.contact_email)) {
      setEmailError('Please enter a valid email address')
      hasErrors = true
    }

    if (formData.postal_code && !isValidPostalCode(formData.postal_code)) {
      setPostalCodeError('Postal code must be in format 12345 or 12345-6789')
      hasErrors = true
    }

    // Don't submit if there are validation errors
    if (hasErrors) {
      return
    }

    const data = isEdit
      ? ({
        name: formData.name || undefined,
        website_url: formData.website_url || null,
        logo_size: formData.logo_size,
        sponsor_level: formData.sponsor_level || null,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        country: formData.country || null,
        donation_amount: formData.donation_amount ? parseFloat(formData.donation_amount) : null,
        notes: formData.notes || null,
      } as SponsorUpdateRequest)
      : ({
        name: formData.name,
        logo_file_name: logoFile?.name || 'logo.png',
        logo_file_type: logoFile?.type || 'image/png',
        logo_file_size: logoFile?.size || 0,
        website_url: formData.website_url || undefined,
        logo_size: formData.logo_size,
        sponsor_level: formData.sponsor_level || undefined,
        contact_name: formData.contact_name || undefined,
        contact_email: formData.contact_email || undefined,
        contact_phone: formData.contact_phone || undefined,
        address_line1: formData.address_line1 || undefined,
        address_line2: formData.address_line2 || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postal_code: formData.postal_code || undefined,
        country: formData.country || undefined,
        donation_amount: formData.donation_amount ? parseFloat(formData.donation_amount) : undefined,
        notes: formData.notes || undefined,
      } as SponsorCreateRequest)

    await onSubmit(data, logoFile || undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Logo Upload */}
      <div className="space-y-2">
        <Label htmlFor="logo">Sponsor Logo {!isEdit && <span className="text-destructive">*</span>}</Label>
        <div className="flex gap-4">
          {logoPreview && (
            <div className="relative w-32 h-32 rounded-md bg-muted flex items-center justify-center overflow-hidden">
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
              {logoFile && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={clearLogo}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
          <div className="flex-1">
            <Input
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={handleLogoChange}
              disabled={isSubmitting}
              required={!isEdit && !logoFile}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground mt-1">
              PNG, JPG, SVG, or WebP. Max 5MB. Minimum 64x64, Maximum 2048x2048.
            </p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Sponsor Name <span className="text-destructive">*</span></Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled={isSubmitting}
            placeholder="Acme Corporation"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="website_url">Website URL</Label>
          <Input
            id="website_url"
            type="url"
            value={formData.website_url}
            onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
            onBlur={handleWebsiteBlur}
            disabled={isSubmitting}
            placeholder="https://example.com"
            className={websiteError ? 'border-red-500' : ''}
          />
          {websiteError && <p className="text-sm text-red-500">{websiteError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo_size">Logo Size <span className="text-destructive">*</span></Label>
          <Select
            value={formData.logo_size}
            onValueChange={(value) => setFormData({ ...formData, logo_size: value as LogoSize })}
            disabled={isSubmitting}
          >
            <SelectTrigger id="logo_size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LogoSize.XLARGE}>Extra Large</SelectItem>
              <SelectItem value={LogoSize.LARGE}>Large</SelectItem>
              <SelectItem value={LogoSize.MEDIUM}>Medium</SelectItem>
              <SelectItem value={LogoSize.SMALL}>Small</SelectItem>
              <SelectItem value={LogoSize.XSMALL}>Extra Small</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sponsor_level">Sponsor Level</Label>
          <Input
            id="sponsor_level"
            value={formData.sponsor_level}
            onChange={(e) => setFormData({ ...formData, sponsor_level: e.target.value })}
            disabled={isSubmitting}
            placeholder="Gold Sponsor"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="donation_amount">Donation Amount ($)</Label>
          <Input
            id="donation_amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.donation_amount}
            onChange={(e) => setFormData({ ...formData, donation_amount: e.target.value })}
            disabled={isSubmitting}
            placeholder="5000.00"
          />
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Contact Information</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              disabled={isSubmitting}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              onBlur={handleEmailBlur}
              disabled={isSubmitting}
              placeholder="john@example.com"
              className={emailError ? 'border-red-500' : ''}
            />
            {emailError && <p className="text-sm text-red-500">{emailError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              disabled={isSubmitting}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Address (Optional)</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              ref={addressInputRef}
              value={formData.address_line1}
              onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              disabled={isSubmitting}
              placeholder="123 Main St"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              value={formData.address_line2}
              onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              disabled={isSubmitting}
              placeholder="Suite 100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              disabled={isSubmitting}
              placeholder="San Francisco"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State/Province</Label>
            <Select
              value={formData.state}
              onValueChange={(value) => setFormData({ ...formData, state: value })}
              disabled={isSubmitting}
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              onBlur={handlePostalCodeBlur}
              disabled={isSubmitting}
              placeholder="94102"
              className={postalCodeError ? 'border-red-500' : ''}
            />
            {postalCodeError && <p className="text-sm text-red-500">{postalCodeError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              disabled={isSubmitting}
              placeholder="United States"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Internal Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          disabled={isSubmitting}
          placeholder="Additional information about this sponsor..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Sponsor' : 'Create Sponsor')}
        </Button>
      </div>
    </form>
  )
}
