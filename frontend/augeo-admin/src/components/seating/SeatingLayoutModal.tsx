/**
 * SeatingLayoutModal Component
 *
 * Modal to view and upload event space layout image for seating reference.
 */

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
import { mediaApi } from '@/services/event-service'
import { Loader2, Maximize2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

interface SeatingLayoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  currentImageUrl?: string | null
  onImageUploaded: (url: string) => void
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    } catch (error: any) {
      console.error('Failed to upload layout image:', error)
      toast.error(
        error?.response?.data?.detail ||
        'Failed to upload layout image. Please try again.'
      )
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Event Space Layout</DialogTitle>
            <DialogDescription>
              Upload a floor plan or layout diagram to reference when assigning
              seats
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload Section */}
            <div className="space-y-2">
              <Label htmlFor="layout-image">Layout Image</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="layout-image"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="flex-1"
                />
                {previewUrl && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRemove}
                    disabled={uploading}
                    title="Remove layout image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Accepted formats: JPG, PNG, GIF. Max size: 10MB
              </p>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading layout image...
              </div>
            )}

            {/* Preview Section */}
            {previewUrl ? (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg overflow-hidden bg-muted/50 relative group">
                  <img
                    src={previewUrl}
                    alt="Event space layout"
                    className="w-full h-auto object-contain max-h-[60vh] cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => {
                      setIsFullscreen(true)
                      onOpenChange(false)
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-black/10">
                    <div className="bg-white/90 rounded-full p-3 shadow-lg">
                      <Maximize2 className="h-6 w-6 text-gray-700" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click image to view fullscreen
                </p>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No layout image uploaded</p>
                <p className="text-sm mt-2">
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
          className="fixed inset-0 bg-black/95 flex items-center justify-center"
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
            type="button"
            className="absolute top-4 right-4 p-3 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/20"
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
            <X className="h-6 w-6" />
          </button>
          <img
            src={previewUrl || ''}
            alt="Event space layout - fullscreen"
            className="max-w-full max-h-full object-contain p-4"
            style={{ pointerEvents: 'none' }}
          />
        </div>
      )}
    </>
  )
}
