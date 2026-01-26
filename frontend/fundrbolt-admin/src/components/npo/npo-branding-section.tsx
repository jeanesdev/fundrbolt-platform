/**
 * NPO Branding Section Component
 * Branding configuration for use within edit page
 */

import { colors as brandColors } from '@fundrbolt/shared/assets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { brandingApi } from '@/services/npo-service'
import type { BrandingUpdateRequest } from '@/types/npo'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Facebook, Instagram, Linkedin, Save, Twitter, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useDropzone } from 'react-dropzone'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'

const DEFAULT_PRIMARY = brandColors.primary.navy
const DEFAULT_SECONDARY = brandColors.accent.violet
const DEFAULT_BACKGROUND = brandColors.secondary.white
const DEFAULT_ACCENT = brandColors.primary.gold

// Helper to get full logo URL
function getLogoUrl(logoPath: string | null): string | null {
  if (!logoPath) return null
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace(/\/api\/v1$/, '')
  return `${baseUrl}${logoPath}`
}

// Validation functions
function isValidUrl(url: string): boolean {
  if (!url) return true
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

// Helper function to calculate contrast ratio
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

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

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

  // Use JPEG with 0.85 quality for better compression
  const outputType = 'image/jpeg'
  const quality = 0.85
  const newFileName = fileName.replace(/\.[^.]+$/, '.jpg')

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

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = url
  })
}

interface NPOBrandingSectionProps {
  npoId: string
  onSave?: () => void
}

export function NPOBrandingSection({ npoId, onSave }: NPOBrandingSectionProps) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY)
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY)
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND)
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
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

  const validateSocialUrl = (key: string, value: string) => {
    const isValid = isValidUrl(value)
    setUrlErrors((prev) => ({
      ...prev,
      [key]: !isValid && value.length > 0,
    }))
    return isValid
  }

  const hasValidationErrors = Object.values(urlErrors).some((error) => error)

  // Load branding data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const brandingData = await brandingApi.getBranding(npoId)

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
        // Error loading branding
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [npoId])

  // Handle logo upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('File must be an image')
      return
    }

    const imageUrl = URL.createObjectURL(file)
    setImageToCrop(imageUrl)
    setOriginalFileName(file.name)
    setCropDialogOpen(true)
  }, [])

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropSave = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) return

    try {
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

      const result = await brandingApi.uploadLogoLocal(npoId, croppedFile)
      setLogoUrl(result.logo_url)

      // Invalidate NPO queries to refresh the logo in NpoSelector dropdown
      await queryClient.invalidateQueries({ queryKey: ['npos'] })

      setCropDialogOpen(false)
      URL.revokeObjectURL(imageToCrop)
      setImageToCrop(null)

      toast.success('Logo uploaded successfully')
    } catch (error: unknown) {
      const errorDetail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      let errorMsg = 'Failed to upload logo'

      if (errorDetail && typeof errorDetail === 'object' && 'message' in errorDetail) {
        errorMsg = String(errorDetail.message)
      } else if (typeof errorDetail === 'string') {
        errorMsg = errorDetail
      } else if (error instanceof Error && error.message) {
        errorMsg = error.message
      }

      toast.error(errorMsg, { duration: 5000 })
    }
  }, [npoId, imageToCrop, croppedAreaPixels, originalFileName, queryClient])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  })

  const handleSave = async () => {
    try {
      setSaving(true)

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
      onSave?.()
    } catch (_error) {
      toast.error('Failed to save branding')
    } finally {
      setSaving(false)
    }
  }

  const contrastRatio = getContrastRatio(primaryColor, secondaryColor)
  const contrastMeetsWCAG = contrastRatio >= 4.5

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading branding...</div>
  }

  return (
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
                  placeholder={DEFAULT_PRIMARY.toUpperCase()}
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
                  placeholder={DEFAULT_SECONDARY.toUpperCase()}
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
                  placeholder={DEFAULT_BACKGROUND.toUpperCase()}
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
                  placeholder={DEFAULT_ACCENT.toUpperCase()}
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
                />
                <p className="text-sm text-muted-foreground">Click or drag to replace logo</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isDragActive ? 'Drop logo here' : 'Drag & drop logo, or click to select'}
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WEBP up to 5MB</p>
              </div>
            )}
          </div>

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
          <CardDescription className="text-sm">
            Add your organization's social media profiles
          </CardDescription>
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
                setSocialLinks({ ...socialLinks, facebook: e.target.value })
                validateSocialUrl('facebook', e.target.value)
              }}
              placeholder="https://facebook.com/yourorg"
              className={urlErrors.facebook ? 'border-red-500' : ''}
            />
            {urlErrors.facebook && (
              <p className="text-xs text-red-500">Please enter a valid URL</p>
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
                setSocialLinks({ ...socialLinks, twitter: e.target.value })
                validateSocialUrl('twitter', e.target.value)
              }}
              placeholder="https://twitter.com/yourorg"
              className={urlErrors.twitter ? 'border-red-500' : ''}
            />
            {urlErrors.twitter && (
              <p className="text-xs text-red-500">Please enter a valid URL</p>
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
                setSocialLinks({ ...socialLinks, instagram: e.target.value })
                validateSocialUrl('instagram', e.target.value)
              }}
              placeholder="https://instagram.com/yourorg"
              className={urlErrors.instagram ? 'border-red-500' : ''}
            />
            {urlErrors.instagram && (
              <p className="text-xs text-red-500">Please enter a valid URL</p>
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
                setSocialLinks({ ...socialLinks, linkedin: e.target.value })
                validateSocialUrl('linkedin', e.target.value)
              }}
              placeholder="https://linkedin.com/company/yourorg"
              className={urlErrors.linkedin ? 'border-red-500' : ''}
            />
            {urlErrors.linkedin && (
              <p className="text-xs text-red-500">Please enter a valid URL</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || hasValidationErrors}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Branding'}
        </Button>
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop Logo</DialogTitle>
            <DialogDescription>Adjust the crop area to get a square logo</DialogDescription>
          </DialogHeader>
          <div className="relative h-96 w-full">
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
                if (imageToCrop) URL.revokeObjectURL(imageToCrop)
                setImageToCrop(null)
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleCropSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Cropped Logo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
