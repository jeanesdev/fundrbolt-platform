/**
 * BidCardSizeDialog — select label size and trigger bid card PDF download.
 */
import { useState } from 'react'
import {
  type LabelSize,
  LABEL_SIZE_OPTIONS,
  reportService,
} from '@/services/reportService'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BidCardSizeDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  /** If provided, only generate cards for these item IDs. */
  selectedItemIds?: string[]
}

export function BidCardSizeDialog({
  open,
  onClose,
  eventId,
  selectedItemIds,
}: BidCardSizeDialogProps) {
  const [labelSize, setLabelSize] = useState<LabelSize>('3x5')
  const [isGenerating, setIsGenerating] = useState(false)

  const count = selectedItemIds?.length ?? 0
  const selectionLabel =
    count > 0 ? `${count} selected item${count !== 1 ? 's' : ''}` : 'all items'

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      await reportService.downloadBidCards(eventId, {
        label_size: labelSize,
        item_ids:
          selectedItemIds && selectedItemIds.length > 0
            ? selectedItemIds
            : null,
      })
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to generate bid cards. Please try again.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isGenerating) onClose()
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Print Bid Cards</DialogTitle>
          <DialogDescription>
            Select a label size to generate bid card PDFs for {selectionLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-2 gap-3 py-2'>
          {LABEL_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => setLabelSize(opt.value)}
              className={[
                'rounded-lg border-2 p-3 text-left transition-colors',
                labelSize === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted',
              ].join(' ')}
            >
              <div className='text-sm font-semibold'>{opt.label}</div>
              <div className='text-muted-foreground mt-0.5 text-xs'>
                {opt.description}
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant='ghost' onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className='mr-1.5 h-4 w-4 animate-spin' />
            ) : (
              <Printer className='mr-1.5 h-4 w-4' />
            )}
            {isGenerating ? 'Generating…' : 'Generate & Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
