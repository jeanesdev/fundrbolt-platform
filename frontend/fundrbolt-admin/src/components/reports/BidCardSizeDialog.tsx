/**
 * BidCardSizeDialog — select label size, configure options, and trigger auction item display card PDF download.
 */
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  type BidCardRequest,
  type LabelSize,
  LABEL_SIZE_OPTIONS,
} from '@/services/reportService'
import { Printer } from 'lucide-react'
import { useState } from 'react'

interface BidCardSizeDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  /** Called when the user confirms generation — dialog closes immediately and parent runs generation in the background. */
  onStartGeneration: (request: BidCardRequest) => void
  /** If provided, only generate cards for these item IDs. */
  selectedItemIds?: string[]
}

interface BidCardOptions {
  includeLive: boolean
  showImage: boolean
  showValue: boolean
  showQr: boolean
  showStartingBid: boolean
  showMinBidIncrement: boolean
  showEventLogo: boolean
}

const TENT_SIZES: LabelSize[] = [
  'tent-8.5x11',
  'tent-8.5x11-long',
  'tent-8.5x11-2up',
]

const DEFAULT_OPTIONS: BidCardOptions = {
  includeLive: false,
  showImage: true,
  showValue: true,
  showQr: true,
  showStartingBid: true,
  showMinBidIncrement: false,
  showEventLogo: false,
}

export function BidCardSizeDialog({
  open,
  onClose,
  onStartGeneration,
  selectedItemIds,
}: BidCardSizeDialogProps) {
  const [labelSize, setLabelSize] = useState<LabelSize>('3x5')
  const [options, setOptions] = useState<BidCardOptions>(DEFAULT_OPTIONS)

  const toggle = (key: keyof BidCardOptions) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleSizeChange = (size: LabelSize) => {
    setLabelSize(size)
    // Auto-set event logo default based on whether the new size is a tent
    setOptions((prev) => ({
      ...prev,
      showEventLogo: TENT_SIZES.includes(size),
    }))
  }

  const count = selectedItemIds?.length ?? 0
  const selectionLabel =
    count > 0 ? `${count} selected item${count !== 1 ? 's' : ''}` : 'all items'

  const handleGenerate = () => {
    onStartGeneration({
      label_size: labelSize,
      item_ids:
        selectedItemIds && selectedItemIds.length > 0 ? selectedItemIds : null,
      include_live: options.includeLive,
      show_image: options.showImage,
      show_value: options.showValue,
      show_qr: options.showQr,
      show_starting_bid: options.showStartingBid,
      show_min_bid_increment: options.showMinBidIncrement,
      show_event_logo: options.showEventLogo,
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Print Auction Item Display Cards</DialogTitle>
          <DialogDescription>
            Select a label size and configure options for {selectionLabel}.
          </DialogDescription>
        </DialogHeader>

        {/* Label size selector */}
        <div className='grid grid-cols-2 gap-3 py-2'>
          {LABEL_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => handleSizeChange(opt.value)}
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

        <Separator />

        {/* Card content options */}
        <div className='space-y-2.5'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            Card Content
          </p>
          <CheckboxRow
            id='opt-live'
            label='Include Live Auction items'
            checked={options.includeLive}
            onToggle={() => toggle('includeLive')}
          />
          <CheckboxRow
            id='opt-image'
            label='Show item image'
            checked={options.showImage}
            onToggle={() => toggle('showImage')}
          />
          <CheckboxRow
            id='opt-starting-bid'
            label='Show Starting Bid'
            checked={options.showStartingBid}
            onToggle={() => toggle('showStartingBid')}
          />
          <CheckboxRow
            id='opt-value'
            label='Show Value (hidden if $0)'
            checked={options.showValue}
            onToggle={() => toggle('showValue')}
          />
          <CheckboxRow
            id='opt-increment'
            label='Show Min Bid Increment'
            checked={options.showMinBidIncrement}
            onToggle={() => toggle('showMinBidIncrement')}
          />
          <CheckboxRow
            id='opt-qr'
            label='Include QR code'
            checked={options.showQr}
            onToggle={() => toggle('showQr')}
          />
          <CheckboxRow
            id='opt-event-logo'
            label='Show event logo'
            checked={options.showEventLogo}
            onToggle={() => toggle('showEventLogo')}
          />
        </div>

        <DialogFooter>
          <Button variant='ghost' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate}>
            <Printer className='mr-1.5 h-4 w-4' />
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CheckboxRow({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className='flex items-center gap-2'>
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <Label htmlFor={id} className='cursor-pointer text-sm font-normal'>
        {label}
      </Label>
    </div>
  )
}
