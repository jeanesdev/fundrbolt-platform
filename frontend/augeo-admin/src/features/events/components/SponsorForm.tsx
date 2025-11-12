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
import { X } from 'lucide-react'
import { useState } from 'react'

interface SponsorFormProps {
  sponsor?: Sponsor
  onSubmit: (data: SponsorCreateRequest | SponsorUpdateRequest, logoFile?: File) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function SponsorForm({ sponsor, onSubmit, onCancel, isSubmitting = false }: SponsorFormProps) {
  const isEdit = !!sponsor

  const [formData, setFormData] = useState<CreateSponsorRequest>({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
            disabled={isSubmitting}
            placeholder="https://example.com"
          />
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
              <SelectItem value={LogoSize.XLARGE}>Extra Large (Title Sponsor)</SelectItem>
              <SelectItem value={LogoSize.LARGE}>Large (Platinum)</SelectItem>
              <SelectItem value={LogoSize.MEDIUM}>Medium (Gold)</SelectItem>
              <SelectItem value={LogoSize.SMALL}>Small (Silver)</SelectItem>
              <SelectItem value={LogoSize.XSMALL}>Extra Small (Bronze)</SelectItem>
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
              disabled={isSubmitting}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
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
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              disabled={isSubmitting}
              placeholder="CA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              disabled={isSubmitting}
              placeholder="94102"
            />
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
