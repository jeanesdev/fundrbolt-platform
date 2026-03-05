/**
 * MediaUploader Component
 * Drag-and-drop file uploader with progress tracking
 */
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  EventMedia,
  EventMediaUsageTag,
  MediaUpdateRequest,
} from '@/types/event'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

interface MediaUploaderProps {
  media: EventMedia[]
  onUpload: (file: File, usageTag: EventMediaUsageTag) => Promise<void>
  onUpdateMedia: (mediaId: string, data: MediaUpdateRequest) => Promise<void>
  onDelete: (mediaId: string) => Promise<void>
  usageTagFilter?: EventMediaUsageTag
  excludedUsageTags?: EventMediaUsageTag[]
  allowedUploadUsageTags?: EventMediaUsageTag[]
  defaultUploadUsageTag?: EventMediaUsageTag
  showUsageTagSelector?: boolean
  uploadProgress?: Record<string, number>
  uploadingFiles?: Record<string, boolean>
  maxFileSize?: number // in MB
  acceptedTypes?: string[]
}

export function MediaUploader({
  media,
  onUpload,
  onUpdateMedia,
  onDelete,
  usageTagFilter,
  excludedUsageTags = [],
  allowedUploadUsageTags,
  defaultUploadUsageTag = 'main_event_page_hero',
  showUsageTagSelector = true,
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
  const [updatingTagId, setUpdatingTagId] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [viewMedia, setViewMedia] = useState<EventMedia | null>(null)
  const [uploadUsageTag, setUploadUsageTag] = useState<EventMediaUsageTag>(
    defaultUploadUsageTag
  )
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

  const usageTagOptions: Array<{ value: EventMediaUsageTag; label: string }> = [
    { value: 'main_event_page_hero', label: 'Main Event Page Hero' },
    { value: 'event_layout_map', label: 'Event Layout Map' },
    { value: 'npo_logo', label: 'NPO Logo' },
    { value: 'event_logo', label: 'Event Logo' },
  ]

  const uploadTagOptions =
    allowedUploadUsageTags && allowedUploadUsageTags.length > 0
      ? usageTagOptions.filter((option) =>
        allowedUploadUsageTags.includes(option.value)
      )
      : usageTagOptions

  const filteredMedia = media.filter(Boolean).filter((item) => {
    if (usageTagFilter && item.usage_tag !== usageTagFilter) {
      return false
    }
    if (excludedUsageTags.includes(item.usage_tag)) {
      return false
    }
    return true
  })

  const mediaSignature = useMemo(
    () => filteredMedia.map((item) => `${item.id}:${item.file_url}`).join('|'),
    [filteredMedia]
  )

  useEffect(() => {
    setImageRetries({})
    setFailedImages({})
  }, [mediaSignature])

  const getUsageTagLabel = (usageTag: EventMediaUsageTag) => {
    return (
      usageTagOptions.find((option) => option.value === usageTag)?.label ??
      usageTag
    )
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
          const resolvedUsageTag = usageTagFilter ?? uploadUsageTag
          await onUpload(file, resolvedUsageTag)
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
    [onUpload, uploadUsageTag, usageTagFilter, validateFile]
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

  const handleUsageTagChange = async (
    mediaId: string,
    usageTag: EventMediaUsageTag
  ) => {
    setUpdatingTagId(mediaId)
    try {
      await onUpdateMedia(mediaId, { usage_tag: usageTag })
      toast.success('Media usage updated')
    } catch (_err) {
      toast.error('Failed to update media usage')
    } finally {
      setUpdatingTagId(null)
    }
  }

  const sortedMedia = [...filteredMedia].sort((a, b) => {
    if (a.usage_tag !== b.usage_tag) {
      return a.usage_tag.localeCompare(b.usage_tag)
    }
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order
    }
    return a.created_at.localeCompare(b.created_at)
  })

  const getTagGroup = (usageTag: EventMediaUsageTag) =>
    sortedMedia.filter((item) => item.usage_tag === usageTag)

  const handleReorder = async (file: EventMedia, direction: 'up' | 'down') => {
    const tagGroup = getTagGroup(file.usage_tag)
    const currentIndex = tagGroup.findIndex((item) => item.id === file.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= tagGroup.length) {
      return
    }

    const targetItem = tagGroup[targetIndex]
    setReorderingId(file.id)

    try {
      await onUpdateMedia(file.id, { display_order: targetItem.display_order })
      await onUpdateMedia(targetItem.id, { display_order: file.display_order })
      toast.success('Media order updated')
    } catch (_err) {
      toast.error('Failed to reorder media')
    } finally {
      setReorderingId(null)
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
    const currentIndex = sortedMedia.findIndex(
      (item) => item.id === viewMedia.id
    )
    const nextIndex = (currentIndex + 1) % sortedMedia.length
    setViewMedia(sortedMedia[nextIndex])
  }

  const handlePrevMedia = () => {
    if (!viewMedia) return
    const currentIndex = sortedMedia.findIndex(
      (item) => item.id === viewMedia.id
    )
    const prevIndex =
      (currentIndex - 1 + sortedMedia.length) % sortedMedia.length
    setViewMedia(sortedMedia[prevIndex])
  }

  const getCurrentMediaIndex = () => {
    if (!viewMedia) return { current: 0, total: 0 }
    const currentIndex = sortedMedia.findIndex(
      (item) => item.id === viewMedia.id
    )
    return { current: currentIndex + 1, total: sortedMedia.length }
  }

  return (
    <div className='space-y-4'>
      {/* Upload Zone */}
      <Card
        className={`border-2 border-dashed transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-muted'
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

          {showUsageTagSelector && (
            <div className='mb-4 w-full max-w-xs text-left'>
              <p className='text-muted-foreground mb-2 text-xs font-medium'>
                Usage Tag
              </p>
              <Select
                value={uploadUsageTag}
                onValueChange={(value) =>
                  setUploadUsageTag(value as EventMediaUsageTag)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {uploadTagOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
      {filteredMedia.length > 0 && (
        <div className='space-y-2'>
          <h4 className='text-sm font-semibold'>
            Uploaded Files ({filteredMedia.length})
          </h4>

          {sortedMedia.map((file) => {
            const tagGroup = getTagGroup(file.usage_tag)
            const positionInTag = tagGroup.findIndex(
              (item) => item.id === file.id
            )
            const canMoveUp = positionInTag > 0
            const canMoveDown =
              positionInTag >= 0 && positionInTag < tagGroup.length - 1

            return (
              <Card key={file.id}>
                <CardContent className='p-3 sm:p-4'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4'>
                    {/* Top row: Thumbnail + File Info */}
                    <div className='flex min-w-0 items-center gap-3'>
                      {/* Thumbnail or File Icon */}
                      <div
                        className='flex-shrink-0 cursor-pointer'
                        onClick={() => isImageMedia(file) && setViewMedia(file)}
                      >
                        {isImageMedia(file) && !failedImages[file.id] ? (
                          <img
                            src={getImageSrc(file)}
                            alt={file.file_name}
                            className='h-12 w-12 rounded border object-cover transition-opacity hover:opacity-80 sm:h-16 sm:w-16'
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
                        <p className='text-muted-foreground text-xs sm:hidden'>
                          Usage: {getUsageTagLabel(file.usage_tag)}
                        </p>
                      </div>

                      {/* Delete Button - visible on mobile in top row */}
                      <div className='flex-shrink-0 sm:hidden'>
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
                    </div>

                    {/* Bottom row on mobile / inline on desktop: Controls */}
                    <div className='flex items-center gap-2 sm:gap-4'>
                      <div className='flex-1 sm:w-52 sm:flex-none'>
                        <Select
                          value={file.usage_tag}
                          onValueChange={(value) =>
                            void handleUsageTagChange(
                              file.id,
                              value as EventMediaUsageTag
                            )
                          }
                          disabled={
                            updatingTagId === file.id || !!usageTagFilter
                          }
                        >
                          <SelectTrigger className='h-8'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {usageTagOptions
                              .filter(
                                (option) =>
                                  !excludedUsageTags.includes(option.value)
                              )
                              .map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className='flex items-center gap-1'>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                          onClick={() => void handleReorder(file, 'up')}
                          disabled={!canMoveUp || reorderingId === file.id}
                          title='Move up within this tag'
                        >
                          <ArrowUp className='h-4 w-4' />
                        </Button>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          className='h-8 w-8'
                          onClick={() => void handleReorder(file, 'down')}
                          disabled={!canMoveDown || reorderingId === file.id}
                          title='Move down within this tag'
                        >
                          <ArrowDown className='h-4 w-4' />
                        </Button>
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

                      {/* Delete Button - desktop only */}
                      <div className='hidden sm:block'>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
                {sortedMedia.length > 1 && (
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
