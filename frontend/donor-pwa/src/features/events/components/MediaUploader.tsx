/**
 * MediaUploader Component
 * Drag-and-drop file uploader with progress tracking
 */
import { useCallback, useState } from 'react'
import type { EventMedia } from '@/types/event'
import {
  ChevronLeft,
  ChevronRight,
  FileImage,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MediaUploaderProps {
  media: EventMedia[]
  onUpload: (file: File) => Promise<void>
  onDelete: (mediaId: string) => Promise<void>
  uploadProgress?: Record<string, number>
  uploadingFiles?: Record<string, boolean>
  maxFileSize?: number // in MB
  acceptedTypes?: string[]
}

export function MediaUploader({
  media,
  onUpload,
  onDelete,
  uploadProgress = {},
  uploadingFiles = {},
  maxFileSize = 10,
  acceptedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/pdf',
  ],
}: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMedia, setViewMedia] = useState<EventMedia | null>(null)
  const [imageRetries, setImageRetries] = useState<Record<string, number>>({})
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  const getUploadErrorMessage = (error: unknown): string => {
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: unknown }).response !== null &&
      'data' in (error as { response: { data?: unknown } }).response
    ) {
      const data = (error as { response: { data?: { detail?: unknown } } })
        .response.data
      const detail = data?.detail
      if (typeof detail === 'string') return detail
      if (
        detail &&
        typeof detail === 'object' &&
        'message' in detail &&
        typeof (detail as { message?: unknown }).message === 'string'
      ) {
        return (detail as { message: string }).message
      }
    }

    if (error instanceof Error) return error.message
    return 'Unknown upload error'
  }

  const isImageMedia = (file: EventMedia) => {
    return (
      file.media_type === 'image' ||
      file.mime_type?.startsWith('image/') ||
      file.file_type?.startsWith('image/')
    )
  }

  const getImageSrc = (file: EventMedia) => {
    const retryCount = imageRetries[file.id] || 0
    if (!retryCount) return file.file_url
    const separator = file.file_url.includes('?') ? '&' : '?'
    return `${file.file_url}${separator}retry=${retryCount}`
  }

  const handleImageError = (file: EventMedia) => {
    const retryCount = imageRetries[file.id] || 0
    if (retryCount < 2) {
      setImageRetries((prev) => ({ ...prev, [file.id]: retryCount + 1 }))
      return
    }
    setFailedImages((prev) => ({ ...prev, [file.id]: true }))
  }

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxFileSize * 1024 * 1024) {
        return `File size must be under ${maxFileSize}MB`
      }
      if (!acceptedTypes.includes(file.type)) {
        return `File type not accepted. Allowed: ${acceptedTypes.join(', ')}`
      }
      return null
    },
    [maxFileSize, acceptedTypes]
  )

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      let uploadedCount = 0
      let failedCount = 0
      const failureReasons: string[] = []

      for (const file of fileArray) {
        const error = validateFile(file)
        if (error) {
          failedCount += 1
          failureReasons.push(`${file.name}: ${error}`)
          continue
        }

        try {
          await onUpload(file)
          uploadedCount += 1
        } catch (err) {
          failedCount += 1
          failureReasons.push(`${file.name}: ${getUploadErrorMessage(err)}`)
        }
      }

      if (uploadedCount > 0) {
        toast.success(
          `Uploaded ${uploadedCount} file${uploadedCount === 1 ? '' : 's'} successfully`
        )
      }

      if (failedCount > 0) {
        toast.error(
          `Failed to upload ${failedCount} file${failedCount === 1 ? '' : 's'}`
        )
        failureReasons.slice(0, 3).forEach((reason) => toast.error(reason))
      }
    },
    [onUpload, validateFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files)
    }
  }

  const handleDeleteClick = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    setDeletingId(mediaId)
    try {
      await onDelete(mediaId)
      toast.success('File deleted successfully')
    } catch (_err) {
      toast.error('Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className='h-5 w-5' />
    }
    return <Upload className='h-5 w-5' />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleNextMedia = () => {
    if (!viewMedia) return
    const currentIndex = media.findIndex((item) => item.id === viewMedia.id)
    const nextIndex = (currentIndex + 1) % media.length
    setViewMedia(media[nextIndex])
  }

  const handlePrevMedia = () => {
    if (!viewMedia) return
    const currentIndex = media.findIndex((item) => item.id === viewMedia.id)
    const prevIndex = (currentIndex - 1 + media.length) % media.length
    setViewMedia(media[prevIndex])
  }

  const getCurrentMediaIndex = () => {
    if (!viewMedia) return { current: 0, total: 0 }
    const currentIndex = media.findIndex((item) => item.id === viewMedia.id)
    return { current: currentIndex + 1, total: media.length }
  }

  return (
    <div className='space-y-4'>
      {/* Upload Zone */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className='flex flex-col items-center justify-center p-8 text-center'>
          <Upload
            className={`mb-4 h-12 w-12 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`}
          />

          <h3 className='mb-2 text-lg font-semibold'>
            {dragActive ? 'Drop files here' : 'Upload Event Media'}
          </h3>

          <p className='text-muted-foreground mb-4 text-sm'>
            Drag and drop files here, or click to browse
          </p>

          <input
            id='file-upload'
            type='file'
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleChange}
            className='hidden'
          />

          <Button type='button' variant='outline' asChild>
            <label htmlFor='file-upload' className='cursor-pointer'>
              Choose Files
            </label>
          </Button>

          <p className='text-muted-foreground mt-4 text-xs'>
            Max file size: {maxFileSize}MB | Accepted: Images, Videos, PDFs
          </p>
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {media.length > 0 && (
        <div className='space-y-2'>
          <h4 className='text-sm font-semibold'>
            Uploaded Files ({media.length})
          </h4>

          {media.filter(Boolean).map((file) => (
            <Card key={file.id}>
              <CardContent className='p-4'>
                <div className='flex items-center gap-4'>
                  {/* Thumbnail or File Icon */}
                  <div
                    className='flex-shrink-0 cursor-pointer'
                    onClick={() => isImageMedia(file) && setViewMedia(file)}
                  >
                    {isImageMedia(file) && !failedImages[file.id] ? (
                      <img
                        src={getImageSrc(file)}
                        alt={file.file_name}
                        className='h-16 w-16 rounded border object-cover transition-opacity hover:opacity-80'
                        onError={() => handleImageError(file)}
                      />
                    ) : null}
                    <div
                      className={
                        isImageMedia(file) && !failedImages[file.id]
                          ? 'hidden'
                          : ''
                      }
                    >
                      {getFileIcon(file.file_type)}
                    </div>
                  </div>

                  {/* File Info */}
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      {file.file_name}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {formatFileSize(file.file_size)} • {file.status}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className='flex-shrink-0'>
                    {file.status === 'scanning' && (
                      <span className='rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800'>
                        Scanning...
                      </span>
                    )}
                    {file.status === 'approved' && (
                      <span className='rounded bg-green-100 px-2 py-1 text-xs text-green-800'>
                        Approved
                      </span>
                    )}
                    {file.status === 'rejected' && (
                      <span className='rounded bg-red-100 px-2 py-1 text-xs text-red-800'>
                        Rejected
                      </span>
                    )}
                  </div>

                  {/* Delete Button */}
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => handleDeleteClick(file.id)}
                    disabled={deletingId === file.id}
                  >
                    {deletingId === file.id ? (
                      <X className='h-4 w-4 animate-spin' />
                    ) : (
                      <Trash2 className='h-4 w-4' />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {Object.entries(uploadingFiles).some(([_, uploading]) => uploading) && (
        <div className='space-y-2'>
          <h4 className='text-sm font-semibold'>Uploading...</h4>

          {Object.entries(uploadingFiles)
            .filter(([_, uploading]) => uploading)
            .map(([fileId]) => (
              <Card key={fileId}>
                <CardContent className='p-4'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <p className='text-sm font-medium'>
                        {fileId.split('-')[0]}
                      </p>
                      <p className='text-muted-foreground text-sm'>
                        {uploadProgress[fileId] || 0}%
                      </p>
                    </div>
                    <div className='bg-muted h-2 w-full overflow-hidden rounded-full'>
                      <div
                        className='bg-primary h-full transition-all'
                        style={{ width: `${uploadProgress[fileId] || 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Full-Size Media Modal */}
      <Dialog
        open={!!viewMedia}
        onOpenChange={(open) => !open && setViewMedia(null)}
      >
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-hidden p-0'>
          {viewMedia && (
            <>
              <DialogHeader className='p-6 pb-0'>
                <div className='flex items-center justify-between'>
                  <DialogTitle>{viewMedia.file_name}</DialogTitle>
                  <span className='text-muted-foreground text-sm'>
                    {getCurrentMediaIndex().current} /{' '}
                    {getCurrentMediaIndex().total}
                  </span>
                </div>
              </DialogHeader>

              <div className='group relative'>
                {/* Media Display */}
                <div className='bg-muted flex max-h-[60vh] min-h-[400px] items-center justify-center'>
                  {isImageMedia(viewMedia) && !failedImages[viewMedia.id] ? (
                    <img
                      src={getImageSrc(viewMedia)}
                      alt={viewMedia.file_name}
                      className='max-h-[60vh] max-w-full object-contain'
                      onError={() => handleImageError(viewMedia)}
                    />
                  ) : (
                    <div className='p-8 text-center'>
                      <FileImage className='text-muted-foreground mx-auto mb-4 h-16 w-16' />
                      <p className='text-muted-foreground'>
                        Preview not available for this file type
                      </p>
                    </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                {media.length > 1 && (
                  <>
                    <Button
                      variant='secondary'
                      size='icon'
                      className='absolute top-1/2 left-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100'
                      onClick={handlePrevMedia}
                    >
                      <ChevronLeft className='h-6 w-6' />
                    </Button>
                    <Button
                      variant='secondary'
                      size='icon'
                      className='absolute top-1/2 right-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100'
                      onClick={handleNextMedia}
                    >
                      <ChevronRight className='h-6 w-6' />
                    </Button>
                  </>
                )}
              </div>

              {/* File Details */}
              <div className='text-muted-foreground space-y-1 p-6 pt-4 text-sm'>
                <p>
                  <strong>File:</strong> {viewMedia.file_name}
                </p>
                <p>
                  <strong>Size:</strong> {formatFileSize(viewMedia.file_size)}
                </p>
                <p>
                  <strong>Type:</strong>{' '}
                  {viewMedia.mime_type || viewMedia.file_type}
                </p>
                <p>
                  <strong>Status:</strong> {viewMedia.status}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
