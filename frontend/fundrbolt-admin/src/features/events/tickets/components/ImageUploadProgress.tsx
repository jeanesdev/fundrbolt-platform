/**
 * Image Upload Progress Component
 * Shows upload progress bar and status
 */
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react'

interface ImageUploadProgressProps {
  progress: number // 0-100
  status: 'uploading' | 'success' | 'error'
  error?: string
  fileName?: string
}

export function ImageUploadProgress({
  progress,
  status,
  error,
  fileName,
}: ImageUploadProgressProps) {
  if (status === 'success') {
    return (
      <div className='flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3'>
        <CheckCircle2 className='h-5 w-5 flex-shrink-0 text-green-600' />
        <div className='flex-1'>
          <p className='text-sm font-medium text-green-900'>
            Upload successful
          </p>
          {fileName && <p className='text-xs text-green-700'>{fileName}</p>}
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3'>
        <AlertCircle className='h-5 w-5 flex-shrink-0 text-red-600' />
        <div className='flex-1'>
          <p className='text-sm font-medium text-red-900'>Upload failed</p>
          {error && <p className='text-xs text-red-700'>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <Loader className='h-4 w-4 animate-spin text-blue-600' />
        <p className='text-sm font-medium text-gray-900'>Uploading...</p>
        <span className='text-muted-foreground ml-auto text-xs'>
          {progress}%
        </span>
      </div>
      <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200'>
        <div
          className='h-full rounded-full bg-blue-600 transition-all duration-300'
          style={{ width: `${progress}%` }}
        />
      </div>
      {fileName && <p className='text-muted-foreground text-xs'>{fileName}</p>}
    </div>
  )
}
