/**
 * MediaUploader Component
 * Drag-and-drop file uploader with progress tracking
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { EventMedia } from '@/types/event'
import { FileImage, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

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
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
}: MediaUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size must be under ${maxFileSize}MB`
    }
    if (!acceptedTypes.includes(file.type)) {
      return `File type not accepted. Allowed: ${acceptedTypes.join(', ')}`
    }
    return null
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast.error(error)
        continue
      }

      try {
        await onUpload(file)
        toast.success(`${file.name} uploaded successfully`)
      } catch (_err) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }, [onUpload, validateFile])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

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
      return <FileImage className="h-5 w-5" />
    }
    return <Upload className="h-5 w-5" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
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
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Upload className={`h-12 w-12 mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />

          <h3 className="text-lg font-semibold mb-2">
            {dragActive ? 'Drop files here' : 'Upload Event Media'}
          </h3>

          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop files here, or click to browse
          </p>

          <input
            id="file-upload"
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleChange}
            className="hidden"
          />

          <Button type="button" variant="outline" asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              Choose Files
            </label>
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            Max file size: {maxFileSize}MB | Accepted: Images, PDFs
          </p>
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {media.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Uploaded Files ({media.length})</h4>

          {media.map((file) => (
            <Card key={file.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {getFileIcon(file.file_type)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file_size)} • {file.status}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {file.status === 'scanning' && (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                        Scanning...
                      </span>
                    )}
                    {file.status === 'approved' && (
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                        Approved
                      </span>
                    )}
                    {file.status === 'rejected' && (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                        Rejected
                      </span>
                    )}
                  </div>

                  {/* Delete Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(file.id)}
                    disabled={deletingId === file.id}
                  >
                    {deletingId === file.id ? (
                      <X className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
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
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Uploading...</h4>

          {Object.entries(uploadingFiles)
            .filter(([_, uploading]) => uploading)
            .map(([fileId]) => (
              <Card key={fileId}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{fileId.split('-')[0]}</p>
                      <p className="text-sm text-muted-foreground">
                        {uploadProgress[fileId] || 0}%
                      </p>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${uploadProgress[fileId] || 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
