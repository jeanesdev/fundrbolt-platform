/**
 * NPO Branding Page
 * Comprehensive branding configuration with colors, logo, and social media links
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { brandingApi } from '@/services/npo-service'
import { useNPOStore } from '@/stores/npo-store'
import type { BrandingUpdateRequest } from '@/types/npo'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Building2, Facebook, Instagram, Linkedin, Palette, Save, Twitter } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useDropzone } from 'react-dropzone'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'

// Helper to get full logo URL
function getLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null
  // If it's already a full URL, return as-is
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath
  }
  // Static files are served from the backend root, not under /api/v1
  // So we need to strip /api/v1 from VITE_API_URL
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace(/\/api\/v1$/, '')
  return `${baseUrl}${logoPath}`
}

// Validation functions
function isValidUrl(url: string): boolean {
  if (!url) return true // Empty is valid (optional field)
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

// Utility functions (available for future use)
// function isValidEmail(email: string): boolean {
//   if (!email) return true // Empty is valid (optional field)
//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
//   return emailRegex.test(email)
// }

// function formatPhoneNumber(phone: string): string {
//   const phoneNumber = phone.replace(/\D/g, '')
//   if (phoneNumber.length === 0) return ''
//
//   // Handle 11-digit numbers with +1
//   if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
//     const digits = phoneNumber.slice(1)
//     if (digits.length <= 3) return `+1(${digits}`
//     if (digits.length <= 6) return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
//     return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
//   }
//
//   // Handle 10-digit numbers
//   if (phoneNumber.length <= 3) return `(${phoneNumber}`
//   if (phoneNumber.length <= 6)
//     return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
//   return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
// }

// Helper function to calculate contrast ratio (WCAG AA requires 4.5:1)
function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff

    const rsRGB = r / 255
    const gsRGB = g / 255
    const bsRGB = b / 255

    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear
  }

  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

// Helper to create image from cropped area
async function createCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string
): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  // Set canvas size to match the crop area
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // Determine output format and quality
  // Use JPEG with 0.85 quality for better compression
  // This significantly reduces file size while maintaining good quality
  const outputType = 'image/jpeg'
  const quality = 0.85

  // Update filename extension to match output type
  const newFileName = fileName.replace(/\.[^.]+$/, '.jpg')

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        const file = new File([blob], newFileName, { type: outputType })
        resolve(file)
      },
      outputType,
      quality
    )
  })
}

// Helper to create an image element
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = url
  })
}

export default function NpoBrandingPage() {
  const { npoId } = useParams({ from: '/_authenticated/npos/$npoId/' })
  const { currentNPO, loadNPOById } = useNPOStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [primaryColor, setPrimaryColor] = useState('#3B82F6')
  const [secondaryColor, setSecondaryColor] = useState('#8B5CF6')
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [accentColor, setAccentColor] = useState('#F59E0B')
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(null)
  const [socialLinks, setSocialLinks] = useState({
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
  })

  // Image crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [originalFileName, setOriginalFileName] = useState<string>('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Validation errors
  const [urlErrors, setUrlErrors] = useState<Record<string, boolean>>({})

  // Validate social media URLs immediately
  const validateSocialUrl = (key: string, value: string) => {
    const isValid = isValidUrl(value)
    setUrlErrors((prev) => ({
      ...prev,
      [key]: !isValid && value.length > 0,
    }))
    return isValid
  }

  // Check if there are any validation errors
  const hasValidationErrors = Object.values(urlErrors).some((error) => error)

  // Load NPO and branding data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load NPO if not already loaded
        if (!currentNPO || currentNPO.id !== npoId) {
          await loadNPOById(npoId)
        }

        // Load branding
        const brandingData = await brandingApi.getBranding(npoId)

        // Set form state
        if (brandingData.primary_color) setPrimaryColor(brandingData.primary_color)
        if (brandingData.secondary_color) setSecondaryColor(brandingData.secondary_color)
        if (brandingData.background_color) setBackgroundColor(brandingData.background_color)
        if (brandingData.accent_color) setAccentColor(brandingData.accent_color)
        if (brandingData.logo_url) setLogoUrl(brandingData.logo_url)
        if (brandingData.social_media_links) {
          setSocialLinks({
            facebook: brandingData.social_media_links.facebook || '',
            twitter: brandingData.social_media_links.twitter || '',
            instagram: brandingData.social_media_links.instagram || '',
            linkedin: brandingData.social_media_links.linkedin || '',
          })
        }
      } catch (_error) {
        toast.error('Failed to load branding configuration')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [npoId, currentNPO, loadNPOById])

  // Handle logo upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image')
      return
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file)
    setImageToCrop(imageUrl)
    setOriginalFileName(file.name)
    setCropDialogOpen(true)
  }, [])

  // Handle crop complete
  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Handle crop save
  const handleCropSave = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) return

    try {
      // Create cropped image file
      const croppedFile = await createCroppedImage(
        imageToCrop,
        croppedAreaPixels,
        originalFileName
      )

      // Validate cropped file size
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (croppedFile.size > maxSize) {
        const sizeMB = (croppedFile.size / (1024 * 1024)).toFixed(2)
        toast.error(`Cropped image is too large (${sizeMB}MB). Please try a smaller crop area or lower resolution image.`)
        return
      }

      // Upload the cropped image
      const result = await brandingApi.uploadLogoLocal(npoId, croppedFile)

      // Update logo URL
      setLogoUrl(result.logo_url)

      // Invalidate NPO queries to refresh the logo in NpoSelector dropdown
      await queryClient.invalidateQueries({ queryKey: ['npos'] })

      // Close dialog and clean up
      setCropDialogOpen(false)
      URL.revokeObjectURL(imageToCrop)
      setImageToCrop(null)

      toast.success('Logo uploaded successfully')
    } catch (error: unknown) {
      // Extract detailed error message from backend
      const errorDetail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      let errorMsg = 'Failed to upload logo'

      if (errorDetail && typeof errorDetail === 'object' && 'message' in errorDetail) {
        errorMsg = String(errorDetail.message)
      } else if (typeof errorDetail === 'string') {
        errorMsg = errorDetail
      } else if (error instanceof Error && error.message) {
        errorMsg = error.message
      }

      toast.error(errorMsg, {
        duration: 5000, // Show for 5 seconds since it's an important message
      })
    }
  }, [npoId, imageToCrop, croppedAreaPixels, originalFileName, queryClient])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  })

  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true)

      // Check if there are any validation errors
      if (hasValidationErrors) {
        toast.error('Please fix invalid URLs before saving')
        return
      }

      const updateData: BrandingUpdateRequest = {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_color: backgroundColor,
        accent_color: accentColor,
        logo_url: logoUrl || undefined,
        social_media_links: {
          facebook: socialLinks.facebook || undefined,
          twitter: socialLinks.twitter || undefined,
          instagram: socialLinks.instagram || undefined,
          linkedin: socialLinks.linkedin || undefined,
        },
      }

      await brandingApi.updateBranding(npoId, updateData)
      toast.success('Branding saved successfully')

      // Navigate back to NPO detail page
      navigate({ to: '/npos/$npoId', params: { npoId } })
    } catch (_error) {
      toast.error('Failed to save branding')
    } finally {
      setSaving(false)
    }
  }

  // Calculate contrast ratio
  const contrastRatio = getContrastRatio(primaryColor, secondaryColor)
  const contrastMeetsWCAG = contrastRatio >= 4.5

  if (loading) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <Skeleton className="h-10 w-48 sm:h-12 sm:w-64" />
        <Skeleton className="h-64 w-full sm:h-96" />
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/npos/$npoId" params={{ npoId }}>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Branding</h1>
              <Palette className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
            </div>
            <p className="text-sm text-muted-foreground sm:text-base">{currentNPO?.name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || hasValidationErrors} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Left Column: Configuration */}
        <div className="space-y-4 sm:space-y-6">
          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Brand Colors</CardTitle>
              <CardDescription className="text-sm">Choose your primary and secondary brand colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Primary Color */}
              <div className="space-y-3">
                <Label>Primary Color</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="mx-auto sm:mx-0">
                    <HexColorPicker color={primaryColor} onChange={setPrimaryColor} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#3B82F6"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <div
                      className="h-16 w-full rounded-md border"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Secondary Color */}
              <div className="space-y-3">
                <Label>Secondary Color</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="mx-auto sm:mx-0">
                    <HexColorPicker color={secondaryColor} onChange={setSecondaryColor} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#8B5CF6"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <div
                      className="h-16 w-full rounded-md border"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Background Color */}
              <div className="space-y-3">
                <Label>Background Color</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="mx-auto sm:mx-0">
                    <HexColorPicker color={backgroundColor} onChange={setBackgroundColor} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#FFFFFF"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <div
                      className="h-16 w-full rounded-md border"
                      style={{ backgroundColor: backgroundColor }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Accent Color */}
              <div className="space-y-3">
                <Label>Accent Color</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="mx-auto sm:mx-0">
                    <HexColorPicker color={accentColor} onChange={setAccentColor} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#F59E0B"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <div
                      className="h-16 w-full rounded-md border"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contrast Warning */}
              <div className="rounded-md border p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium">Contrast Ratio (WCAG AA)</span>
                  <Badge variant={contrastMeetsWCAG ? 'default' : 'destructive'}>
                    {contrastRatio.toFixed(2)}:1
                  </Badge>
                </div>
                {!contrastMeetsWCAG && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ⚠️ For accessibility, a contrast ratio of at least 4.5:1 is recommended
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Logo</CardTitle>
              <CardDescription className="text-sm">
                Upload your organization's logo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
              >
                <input {...getInputProps()} />
                {logoUrl ? (
                  <div className="space-y-2">
                    <img
                      src={getLogoUrl(logoUrl) || undefined}
                      alt="Logo preview"
                      className="mx-auto h-32 w-auto object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      Click or drag to replace logo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop logo here' : 'Drag & drop logo, or click to select'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, GIF, WEBP up to 5MB
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Requirements */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Requirements:</p>
                <ul className="space-y-1 pl-4">
                  <li>• File types: PNG, JPG, JPEG, GIF, WEBP</li>
                  <li>• Maximum file size: 5MB</li>
                  <li>• Dimensions: 100x100px to 4000x4000px</li>
                  <li>• Recommended: Square format for best display</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Social Media Links</CardTitle>
              <CardDescription className="text-sm">Add your organization's social media profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Facebook className="h-4 w-4" />
                  Facebook
                </Label>
                <Input
                  value={socialLinks.facebook}
                  onChange={(e) => {
                    const value = e.target.value
                    setSocialLinks({ ...socialLinks, facebook: value })
                  }}
                  onBlur={(e) => validateSocialUrl('facebook', e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className={urlErrors.facebook ? 'border-red-500' : ''}
                />
                {urlErrors.facebook && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    Please enter a valid URL (e.g., https://facebook.com/yourpage)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter
                </Label>
                <Input
                  value={socialLinks.twitter}
                  onChange={(e) => {
                    const value = e.target.value
                    setSocialLinks({ ...socialLinks, twitter: value })
                  }}
                  onBlur={(e) => validateSocialUrl('twitter', e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                  className={urlErrors.twitter ? 'border-red-500' : ''}
                />
                {urlErrors.twitter && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    Please enter a valid URL (e.g., https://twitter.com/yourhandle)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </Label>
                <Input
                  value={socialLinks.instagram}
                  onChange={(e) => {
                    const value = e.target.value
                    setSocialLinks({ ...socialLinks, instagram: value })
                  }}
                  onBlur={(e) => validateSocialUrl('instagram', e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                  className={urlErrors.instagram ? 'border-red-500' : ''}
                />
                {urlErrors.instagram && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    Please enter a valid URL (e.g., https://instagram.com/yourhandle)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </Label>
                <Input
                  value={socialLinks.linkedin}
                  onChange={(e) => {
                    const value = e.target.value
                    setSocialLinks({ ...socialLinks, linkedin: value })
                  }}
                  onBlur={(e) => validateSocialUrl('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/company/yourcompany"
                  className={urlErrors.linkedin ? 'border-red-500' : ''}
                />
                {urlErrors.linkedin && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    Please enter a valid URL (e.g., https://linkedin.com/company/yourcompany)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Live Preview</CardTitle>
              <CardDescription className="text-sm">See how your branding looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Header Preview */}
              <div
                className="rounded-lg p-4 sm:p-6"
                style={{
                  backgroundColor: primaryColor,
                  color: '#ffffff',
                }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  {logoUrl && (
                    <img
                      src={getLogoUrl(logoUrl) || undefined}
                      alt="Logo"
                      className="h-10 w-auto object-contain sm:h-12"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-bold sm:text-xl">{currentNPO?.name}</h3>
                    <p className="mt-1 text-xs opacity-90 sm:text-sm">{currentNPO?.mission_statement}</p>
                  </div>
                </div>
              </div>

              {/* Button Preview */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Button Preview</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <button
                    className="w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 sm:w-auto"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Primary Button
                  </button>
                  <button
                    className="w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 sm:w-auto"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    Secondary Button
                  </button>
                  <button
                    className="w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 sm:w-auto"
                    style={{ backgroundColor: accentColor }}
                  >
                    Accent Button
                  </button>
                </div>
              </div>

              {/* Card Preview */}
              <div
                className="rounded-lg border p-4"
                style={{
                  borderColor: primaryColor,
                  backgroundColor: backgroundColor
                }}
              >
                <h4 className="font-semibold" style={{ color: primaryColor }}>
                  Sample Card
                </h4>
                <p className="mt-2 text-sm" style={{ color: backgroundColor === '#FFFFFF' ? '#6b7280' : '#374151' }}>
                  This is how content will look with your brand colors.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge style={{ backgroundColor: primaryColor, color: '#ffffff' }}>Primary</Badge>
                  <Badge style={{ backgroundColor: secondaryColor, color: '#ffffff' }}>
                    Secondary
                  </Badge>
                  <Badge style={{ backgroundColor: accentColor, color: '#ffffff' }}>
                    Accent
                  </Badge>
                </div>
              </div>

              {/* Social Media Links Preview */}
              {(socialLinks.facebook ||
                socialLinks.twitter ||
                socialLinks.instagram ||
                socialLinks.linkedin) && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Social Media</p>
                    <div className="flex flex-wrap gap-2">
                      {socialLinks.facebook && (
                        <a
                          href={socialLinks.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full p-2 transition-colors hover:opacity-80"
                          style={{ backgroundColor: primaryColor, color: '#ffffff' }}
                        >
                          <Facebook className="h-4 w-4" />
                        </a>
                      )}
                      {socialLinks.twitter && (
                        <a
                          href={socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full p-2 transition-colors hover:opacity-80"
                          style={{ backgroundColor: primaryColor, color: '#ffffff' }}
                        >
                          <Twitter className="h-4 w-4" />
                        </a>
                      )}
                      {socialLinks.instagram && (
                        <a
                          href={socialLinks.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full p-2 transition-colors hover:opacity-80"
                          style={{ backgroundColor: primaryColor, color: '#ffffff' }}
                        >
                          <Instagram className="h-4 w-4" />
                        </a>
                      )}
                      {socialLinks.linkedin && (
                        <a
                          href={socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full p-2 transition-colors hover:opacity-80"
                          style={{ backgroundColor: primaryColor, color: '#ffffff' }}
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Crop Logo</DialogTitle>
            <DialogDescription>
              Adjust the crop area to create a square logo. Use the slider to zoom.
            </DialogDescription>
          </DialogHeader>

          <div className="relative h-[400px] w-full bg-gray-100">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Zoom</Label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCropDialogOpen(false)
                if (imageToCrop) {
                  URL.revokeObjectURL(imageToCrop)
                  setImageToCrop(null)
                }
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCropSave}>
              Upload Cropped Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
