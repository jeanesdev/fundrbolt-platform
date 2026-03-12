/**
 * SeatingLayoutModal Component
 *
 * Modal to view and upload event space layout image for seating reference.
 */
import { useRef, useState, useEffect } from 'react'
import { mediaApi } from '@/services/event-service'
import { Loader2, Maximize2, Upload, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useEventStore } from '@/stores/event-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SeatingLayoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  currentImageUrl?: string | null
  onImageUploaded: (url: string) => void | Promise<void>
}

export function SeatingLayoutModal({
  open,
  onOpenChange,
  eventId,
  currentImageUrl,
  onImageUploaded,
}: SeatingLayoutModalProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentImageUrl || null
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMediaGallery, setShowMediaGallery] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { currentEvent } = useEventStore()
  const eventMedia = currentEvent?.media || []

  useEffect(() => {
    setPreviewUrl(currentImageUrl || null)
  }, [currentImageUrl])

  const handleSelectFromGallery = async (mediaUrl: string) => {
    setPreviewUrl(mediaUrl)
    setUploading(true)
    try {
      await onImageUploaded(mediaUrl)
      toast.success('Layout image selected from gallery')
      onOpenChange(false) // Close modal to show fresh state on reopen
    } catch (_error) {
      toast.error('Failed to set layout image')
      setPreviewUrl(null) // Reset preview on error
    } finally {
      setUploading(false)
      setShowMediaGallery(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be smaller than 10MB')
      return
    }

    try {
      setUploading(true)

      // Step 1: Request pre-signed upload URL
      const uploadResponse = await mediaApi.requestUploadUrl(eventId, {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        media_type: 'image',
      })

      // Step 2: Upload file to Azure Blob Storage
      await mediaApi.uploadFile(uploadResponse.upload_url, file)

      // Step 3: Confirm upload
      const media = await mediaApi.confirmUpload(eventId, {
        media_id: uploadResponse.media_id,
      })

      // Update preview and notify parent
      setPreviewUrl(media.file_url)
      onImageUploaded(media.file_url)
      toast.success('Layout image uploaded successfully')
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to upload layout image. Please try again.'
      toast.error(errorMessage)
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onImageUploaded('')
    toast.success('Layout image removed')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-auto'>
          <DialogHeader>
            <DialogTitle>Event Space Layout</DialogTitle>
            <DialogDescription>
              Upload a floor plan or layout diagram to reference when assigning
              seats
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            {/* Upload or Select from Gallery */}
            <div className='flex gap-2'>
              <Button
                type='button'
                variant={showMediaGallery ? 'outline' : 'default'}
                size='sm'
                onClick={() => setShowMediaGallery(false)}
                className='flex-1'
              >
                <Upload className='mr-2 h-4 w-4' />
                Upload New
              </Button>
              <Button
                type='button'
                variant={showMediaGallery ? 'default' : 'outline'}
                size='sm'
                onClick={() => setShowMediaGallery(true)}
                disabled={eventMedia.length === 0}
                className='flex-1'
              >
                <ImageIcon className='mr-2 h-4 w-4' />
                Select from Gallery{' '}
                {eventMedia.length > 0 && `(${eventMedia.length})`}
              </Button>
            </div>

            {showMediaGallery ? (
              /* Gallery Selection */
              <div className='space-y-2'>
                <Label>Select from Event Media</Label>
                <div className='grid max-h-96 grid-cols-2 gap-3 overflow-y-auto rounded-lg border p-3 sm:grid-cols-3'>
                  {eventMedia.map((media) => (
                    <button
                      key={media.id}
                      type='button'
                      onClick={() => handleSelectFromGallery(media.file_url)}
                      className='group hover:border-primary relative aspect-square overflow-hidden rounded-lg border-2 transition-colors'
                    >
                      <img
                        src={media.file_url}
                        alt={media.file_name}
                        className='h-full w-full object-cover'
                      />
                      {previewUrl === media.file_url && (
                        <div className='bg-primary/20 absolute inset-0 flex items-center justify-center'>
                          <div className='bg-primary text-primary-foreground rounded-full p-2'>
                            ✓
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Upload Section - Hidden file input */
              <div className='space-y-2'>
                <Input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className='hidden'
                />
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Uploading layout image...
              </div>
            )}

            {/* Preview Section */}
            {previewUrl ? (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label>Preview</Label>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={handleRemove}
                    disabled={uploading}
                  >
                    <X className='mr-2 h-4 w-4' />
                    Remove Image
                  </Button>
                </div>
                <div className='bg-muted/50 group relative overflow-hidden rounded-lg border'>
                  <img
                    src={previewUrl}
                    alt='Event space layout'
                    className='h-auto max-h-[60vh] w-full cursor-pointer object-contain transition-opacity hover:opacity-90'
                    onClick={() => {
                      setIsFullscreen(true)
                      onOpenChange(false)
                    }}
                  />
                  <div className='pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100'>
                    <div className='rounded-full bg-white/90 p-3 shadow-lg'>
                      <Maximize2 className='h-6 w-6 text-gray-700' />
                    </div>
                  </div>
                </div>
                <p className='text-muted-foreground text-xs'>
                  Click image to view fullscreen
                </p>
              </div>
            ) : (
              <div className='text-muted-foreground rounded-lg border-2 border-dashed p-12 text-center'>
                <Upload className='mx-auto mb-4 h-12 w-12 opacity-50' />
                <p className='mb-4'>No layout image uploaded</p>
                {!showMediaGallery && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className='mr-2 h-4 w-4' />
                    Choose File
                  </Button>
                )}
                <p className='mt-4 text-sm'>
                  Upload a floor plan to help with seating assignments
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Overlay - Outside Dialog */}
      {isFullscreen && (
        <div
          className='fixed inset-0 flex items-center justify-center bg-black/95'
          style={{
            cursor: 'pointer',
            zIndex: 9999,
          }}
          onClickCapture={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation()
              setIsFullscreen(false)
              onOpenChange(true)
            }
          }}
        >
          <button
            type='button'
            className='absolute top-4 right-4 rounded-full border border-white/20 bg-white/20 p-3 text-white transition-colors hover:bg-white/30'
            style={{
              cursor: 'pointer',
              zIndex: 10000,
            }}
            onClickCapture={(e) => {
              e.stopPropagation()
              setIsFullscreen(false)
              onOpenChange(true)
            }}
          >
            <X className='h-6 w-6' />
          </button>
          <img
            src={previewUrl || ''}
            alt='Event space layout - fullscreen'
            className='max-h-full max-w-full object-contain p-4'
            style={{ pointerEvents: 'none' }}
          />
        </div>
      )}
    </>
  )
}
