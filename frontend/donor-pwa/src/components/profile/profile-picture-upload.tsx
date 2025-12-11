/**
 * Profile Picture Upload Component
 * Allows users to upload and crop their profile picture
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'

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

// Helper to get full picture URL
function getPictureUrl(picturePath: string | null | undefined): string | null {
  if (!picturePath) return null
  if (picturePath.startsWith('http://') || picturePath.startsWith('https://')) {
    return picturePath
  }
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace(/\/api\/v1$/, '')
  return `${baseUrl}${picturePath}`
}

interface ProfilePictureUploadProps {
  userId: string
  currentPictureUrl?: string | null
  userInitials?: string
  onUploadComplete?: () => void
}

export function ProfilePictureUpload({
  userId,
  currentPictureUrl,
  userInitials = 'U',
  onUploadComplete,
}: ProfilePictureUploadProps) {
  const queryClient = useQueryClient()
  const updateUser = useAuthStore((state) => state.updateUser)

  // Image crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [originalFileName, setOriginalFileName] = useState<string>('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)

  // Handle picture upload
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
      setUploading(true)
      const croppedFile = await createCroppedImage(
        imageToCrop,
        croppedAreaPixels,
        originalFileName
      )

      // Validate cropped file size
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (croppedFile.size > maxSize) {
        const sizeMB = (croppedFile.size / (1024 * 1024)).toFixed(2)
        toast.error(
          `Cropped image is too large (${sizeMB}MB). Please try a smaller crop area or lower resolution image.`
        )
        return
      }

      // Upload via API
      const formData = new FormData()
      formData.append('file', croppedFile)

      const response = await apiClient.post(`/users/${userId}/profile-picture`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const newPictureUrl = response.data.profile_picture_url

      // Update auth store with new picture URL
      updateUser({ profile_picture_url: newPictureUrl })

      // Invalidate queries to refresh user data
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] })

      toast.success('Profile picture updated successfully')
      setCropDialogOpen(false)
      setImageToCrop(null)

      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (_error) {
      toast.error('Failed to upload profile picture')
    } finally {
      setUploading(false)
    }
  }, [
    imageToCrop,
    croppedAreaPixels,
    originalFileName,
    userId,
    updateUser,
    queryClient,
    onUploadComplete,
  ])

  const handleCropCancel = () => {
    setCropDialogOpen(false)
    setImageToCrop(null)
    setOriginalFileName('')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    multiple: false,
    disabled: uploading,
  })

  const fullPictureUrl = getPictureUrl(currentPictureUrl)

  return (
    <>
      <div className='flex flex-col items-center gap-4'>
        <div className='relative'>
          <Avatar className='h-32 w-32'>
            <AvatarImage src={fullPictureUrl || undefined} alt='Profile picture' />
            <AvatarFallback className='text-2xl'>{userInitials}</AvatarFallback>
          </Avatar>
          <Button
            size='icon'
            variant='secondary'
            className='absolute bottom-0 right-0 h-10 w-10 rounded-full border-2 border-background shadow-lg'
            {...getRootProps()}
            disabled={uploading}
          >
            <input {...getInputProps()} />
            <Camera className='h-5 w-5' />
          </Button>
        </div>

        <div
          {...getRootProps()}
          className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
            } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload className='h-8 w-8 text-muted-foreground' />
          <div className='text-sm'>
            <p className='font-medium'>
              {isDragActive ? 'Drop your image here' : 'Click to upload or drag and drop'}
            </p>
            <p className='text-muted-foreground'>PNG, JPG, GIF or WebP (max 5MB)</p>
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={handleCropCancel}>
        <DialogContent className='sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>Crop Profile Picture</DialogTitle>
            <DialogDescription>
              Adjust the crop area to select the portion of the image you want to use as your
              profile picture.
            </DialogDescription>
          </DialogHeader>

          <div className='relative h-[400px] w-full bg-muted'>
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1} // Square aspect ratio for profile pictures
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape='round' // Circular crop for profile pictures
                showGrid={false}
              />
            )}
          </div>

          <div className='space-y-2'>
            <Label>Zoom</Label>
            <input
              type='range'
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className='w-full'
            />
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={handleCropCancel} disabled={uploading}>
              <X className='mr-2 h-4 w-4' />
              Cancel
            </Button>
            <Button onClick={handleCropSave} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className='mr-2 h-4 w-4' />
                  Save Picture
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
