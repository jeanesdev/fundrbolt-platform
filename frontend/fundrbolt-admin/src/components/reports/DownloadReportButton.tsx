/**
 * DownloadReportButton — triggers a PDF report download with a loading overlay.
 */
import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface DownloadReportButtonProps {
  /** Called to fetch the PDF. Should trigger the download (or throw on error). */
  onDownload: () => Promise<void>
  /** Button label */
  label?: string
  /** Variant forwarded to Button */
  variant?:
  | 'default'
  | 'outline'
  | 'ghost'
  | 'secondary'
  | 'destructive'
  | 'link'
  /** Size forwarded to Button */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function DownloadReportButton({
  onDownload,
  label = 'Download Report',
  variant = 'outline',
  size = 'sm',
  className,
}: DownloadReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleClick = async () => {
    setIsGenerating(true)
    try {
      await onDownload()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to generate report. Please try again.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      {/* Full-page generating overlay */}
      {isGenerating && (
        <div className='bg-background/70 fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 backdrop-blur-sm'>
          <Loader2 className='text-primary h-10 w-10 animate-spin' />
          <p className='text-muted-foreground text-sm font-medium'>
            Generating PDF, please wait…
          </p>
        </div>
      )}

      <Button
        type='button'
        variant={variant}
        size={size}
        className={className}
        disabled={isGenerating}
        onClick={() => void handleClick()}
      >
        {isGenerating ? (
          <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />
        ) : (
          <FileText className='mr-1.5 h-4 w-4' />
        )}
        {label}
      </Button>
    </>
  )
}
