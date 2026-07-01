/**
 * AuctionItemForm
 * Form for creating or editing an auction item
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import auctionItemMediaService from '@/services/auctionItemMediaService'
import {
  AuctionType,
  SlidePresentationLayout,
  type AuctionItem,
  type AuctionItemCreate,
  type AuctionItemMedia,
  type AuctionItemUpdate,
} from '@/types/auction-item'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MediaGallery } from './MediaGallery'
import { MediaUploadZone } from './MediaUploadZone'

interface AuctionItemFormProps {
  item?: AuctionItem
  eventId: string
  onSubmit: (
    data: AuctionItemCreate | AuctionItemUpdate
  ) => Promise<AuctionItem | void>
  onCancel: () => void
  onCreateSuccess?: () => void
  onUpdateSuccess?: () => void
  isSubmitting?: boolean
}

type AuctionTypeSelection = AuctionType | 'impact'

export function AuctionItemForm({
  item,
  eventId,
  onSubmit,
  onCancel,
  onCreateSuccess,
  onUpdateSuccess,
  isSubmitting = false,
}: AuctionItemFormProps) {
  const isEdit = !!item

  // Function to calculate bid increment based on starting bid
  const calculateBidIncrement = (startingBid: number): string => {
    if (startingBid <= 50) return '5.00'
    if (startingBid <= 150) return '10.00'
    if (startingBid <= 500) return '25.00'
    if (startingBid <= 1000) return '50.00'
    if (startingBid <= 2500) return '100.00'
    return '250.00'
  }

  interface FormData {
    title: string
    description: string
    auction_type: AuctionTypeSelection
    category: string
    starting_bid: string
    bid_increment: string
    donor_value: string
    cost: string
    buy_now_price: string
    buy_now_enabled: boolean
    quantity_available: string
    donated_by: string
    sponsor_id: string
    item_webpage: string
    display_priority: string
    slide_presentation_html: string
    slide_presentation_layout: SlidePresentationLayout
    display_starting_bid: boolean
    display_fair_market_value: boolean
  }

  const [formData, setFormData] = useState<FormData>({
    title: item?.title || '',
    description: item?.description || '',
    auction_type:
      item?.category?.trim().toLowerCase() === 'impact'
        ? 'impact'
        : (item?.auction_type ?? AuctionType.SILENT),
    category: item?.category || '',
    starting_bid: item?.starting_bid?.toString() || '',
    bid_increment:
      item?.bid_increment?.toString() ||
      (item?.starting_bid ? calculateBidIncrement(item.starting_bid) : '50.00'),
    donor_value: item?.donor_value?.toString() || '',
    cost: item?.cost?.toString() || '',
    buy_now_price: item?.buy_now_price?.toString() || '',
    buy_now_enabled: item?.buy_now_enabled || false,
    quantity_available:
      item?.quantity_available === 0
        ? ''
        : (item?.quantity_available?.toString() ?? ''),
    donated_by: item?.donated_by || '',
    sponsor_id: item?.sponsor_id || '',
    item_webpage: item?.item_webpage || '',
    display_priority: item?.display_priority?.toString() || '',
    slide_presentation_html: item?.slide_presentation_html || '',
    slide_presentation_layout:
      item?.slide_presentation_layout || SlidePresentationLayout.BELOW_IMAGE,
    display_starting_bid: item?.display_starting_bid || false,
    display_fair_market_value: item?.display_fair_market_value || false,
  })

  // Validation errors
  const [urlError, setUrlError] = useState<string | null>(null)
  const [numericErrors, setNumericErrors] = useState<{
    starting_bid?: string
    bid_increment?: string
    donor_value?: string
    cost?: string
    buy_now_price?: string
    quantity_available?: string
    display_priority?: string
  }>({})

  // Media management
  const [media, setMedia] = useState<AuctionItemMedia[]>([])
  const [pendingMediaUploads, setPendingMediaUploads] = useState<
    Array<{ id: string; file: File; mediaType: 'image' | 'video' }>
  >([])
  const pendingMediaUploadsRef = useRef<
    Array<{ id: string; file: File; mediaType: 'image' | 'video' }>
  >([])
  const [isProcessingPostSave, setIsProcessingPostSave] = useState(false)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [loadedMediaForId, setLoadedMediaForId] = useState<string | null>(null)
  const isImpactDonation = formData.auction_type === 'impact'
  const isFormBusy = isSubmitting || isProcessingPostSave

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Load media when editing an existing item
  useEffect(() => {
    if (item?.id && item.id !== loadedMediaForId) {
      loadMedia()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  const loadMedia = async () => {
    if (!item?.id || isLoadingMedia) return

    setIsLoadingMedia(true)
    try {
      const response = await auctionItemMediaService.listMedia(eventId, item.id)
      setMedia(response.items)
      setLoadedMediaForId(item.id)
    } catch {
      // Error loading media - silent fail, user can retry
    } finally {
      setIsLoadingMedia(false)
    }
  }

  const handleMediaUpload = async (
    file: File,
    mediaType: 'image' | 'video'
  ) => {
    const nextUpload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      mediaType,
    }
    const nextQueue = [...pendingMediaUploadsRef.current, nextUpload]
    pendingMediaUploadsRef.current = nextQueue
    setPendingMediaUploads(nextQueue)
  }

  const handleMediaReorder = async (mediaIds: string[]) => {
    if (!item?.id) return

    const response = await auctionItemMediaService.reorderMedia(
      eventId,
      item.id,
      { media_order: mediaIds }
    )
    setMedia(response.items)
  }

  const handleMediaDelete = async (mediaId: string) => {
    if (!item?.id) return

    await auctionItemMediaService.deleteMedia(eventId, item.id, mediaId)
    setMedia((prev) => prev.filter((m) => m.id !== mediaId))
  }

  const handlePendingMediaRemove = (pendingId: string) => {
    const nextQueue = pendingMediaUploadsRef.current.filter(
      (upload) => upload.id !== pendingId
    )
    pendingMediaUploadsRef.current = nextQueue
    setPendingMediaUploads(nextQueue)
  }

  const isValidUrl = (url: string): boolean => {
    if (!url) return true // Empty is valid (optional field)
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleUrlBlur = () => {
    if (formData.item_webpage && !isValidUrl(formData.item_webpage)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)')
    } else {
      setUrlError(null)
    }
  }

  const handleNumericBlur = (
    field: keyof typeof numericErrors,
    value: string,
    isInteger = false
  ) => {
    if (!value) {
      // Empty is allowed for optional fields
      setNumericErrors((prev) => ({ ...prev, [field]: undefined }))
      return
    }

    const num = isInteger ? parseInt(value, 10) : parseFloat(value)

    if (isNaN(num)) {
      setNumericErrors((prev) => ({
        ...prev,
        [field]: 'Please enter a valid number',
      }))
    } else if (field === 'bid_increment' && num <= 0) {
      // bid_increment must be positive (> 0)
      setNumericErrors((prev) => ({
        ...prev,
        [field]: 'Bid increment must be greater than zero',
      }))
    } else if (num < 0) {
      setNumericErrors((prev) => ({
        ...prev,
        [field]: 'Value cannot be negative',
      }))
    } else if (isInteger && !Number.isInteger(num)) {
      setNumericErrors((prev) => ({
        ...prev,
        [field]: 'Please enter a whole number',
      }))
    } else {
      setNumericErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  // Special handler for starting_bid changes - auto-calculate bid_increment
  const handleStartingBidChange = (value: string) => {
    setFormData((prev) => ({ ...prev, starting_bid: value }))

    // Auto-calculate bid_increment when starting_bid changes
    if (value) {
      const num = parseFloat(value)
      if (!isNaN(num) && num >= 0) {
        const newIncrement = calculateBidIncrement(num)
        setFormData((prev) => ({ ...prev, bid_increment: newIncrement }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate URL before submitting
    if (formData.item_webpage && !isValidUrl(formData.item_webpage)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)')
      return
    }

    // Check for any numeric validation errors
    const hasNumericErrors = Object.values(numericErrors).some(
      (error) => error !== undefined
    )
    if (hasNumericErrors) {
      return
    }

    // Validate starting_bid and bid_increment for silent auctions
    if (formData.auction_type === AuctionType.SILENT) {
      if (formData.starting_bid.trim() === '') {
        setNumericErrors((prev) => ({
          ...prev,
          starting_bid: 'Starting bid is required for silent auctions',
        }))
        return
      }
      if (formData.bid_increment.trim() === '') {
        setNumericErrors((prev) => ({
          ...prev,
          bid_increment: 'Bid increment is required for silent auctions',
        }))
        return
      }
    }

    if (isImpactDonation && formData.buy_now_price.trim() === '') {
      setNumericErrors((prev) => ({
        ...prev,
        buy_now_price: 'Buy now price is required for Impact Donations',
      }))
      return
    }

    const data = isEdit
      ? ({
        title: formData.title || undefined,
        description: formData.description || undefined,
        auction_type: isImpactDonation ? AuctionType.SILENT : formData.auction_type,
        category: isImpactDonation ? 'Impact' : (formData.category || null),
        starting_bid: isImpactDonation
          ? 0
          : (formData.starting_bid
            ? parseFloat(formData.starting_bid)
            : undefined),
        bid_increment: isImpactDonation
          ? 1
          : (formData.bid_increment
            ? parseFloat(formData.bid_increment)
            : undefined),
        donor_value: isImpactDonation
          ? null
          : (formData.donor_value
            ? parseFloat(formData.donor_value)
            : null),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        buy_now_price: formData.buy_now_price
          ? parseFloat(formData.buy_now_price)
          : null,
        buy_now_enabled: isImpactDonation ? true : formData.buy_now_enabled,
        quantity_available: isImpactDonation
          ? 1
          : formData.quantity_available.trim() === ''
            ? 0
            : parseInt(formData.quantity_available, 10),
        donated_by: formData.donated_by || null,
        sponsor_id: formData.sponsor_id || null,
        item_webpage: formData.item_webpage || null,
        display_priority: formData.display_priority
          ? parseInt(formData.display_priority, 10)
          : null,
        slide_presentation_html: formData.slide_presentation_html || null,
        slide_presentation_layout: formData.slide_presentation_layout,
        display_starting_bid: isImpactDonation
          ? false
          : formData.display_starting_bid,
        display_fair_market_value: isImpactDonation
          ? false
          : formData.display_fair_market_value,
      } as AuctionItemUpdate)
      : ({
        title: formData.title,
        description: formData.description,
        auction_type: isImpactDonation ? AuctionType.SILENT : formData.auction_type,
        category: isImpactDonation ? 'Impact' : (formData.category || null),
        starting_bid: isImpactDonation
          ? 0
          : (formData.starting_bid
            ? parseFloat(formData.starting_bid)
            : undefined),
        bid_increment: isImpactDonation
          ? 1
          : (formData.bid_increment
            ? parseFloat(formData.bid_increment)
            : undefined),
        donor_value: isImpactDonation
          ? null
          : (formData.donor_value
            ? parseFloat(formData.donor_value)
            : null),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        buy_now_price: formData.buy_now_price
          ? parseFloat(formData.buy_now_price)
          : null,
        buy_now_enabled: isImpactDonation ? true : formData.buy_now_enabled,
        quantity_available: isImpactDonation
          ? 1
          : formData.quantity_available.trim() === ''
            ? 0
            : parseInt(formData.quantity_available, 10),
        donated_by: formData.donated_by || undefined,
        sponsor_id: formData.sponsor_id || undefined,
        item_webpage: formData.item_webpage || undefined,
        display_priority: formData.display_priority
          ? parseInt(formData.display_priority, 10)
          : undefined,
        slide_presentation_html:
          formData.slide_presentation_html || undefined,
        slide_presentation_layout: formData.slide_presentation_layout,
        display_starting_bid: isImpactDonation
          ? false
          : formData.display_starting_bid,
        display_fair_market_value: isImpactDonation
          ? false
          : formData.display_fair_market_value,
      } as AuctionItemCreate)

    setIsProcessingPostSave(true)
    try {
      const result = await onSubmit(data)

      const uploadsToProcess = [...pendingMediaUploadsRef.current]

      if (uploadsToProcess.length > 0) {
        const uploadItemId = item?.id ?? result?.id

        if (!uploadItemId) {
          throw new Error(
            'Item was created, but media could not be uploaded because the item ID was unavailable.'
          )
        }

        let uploadErrors = 0
        for (const pendingUpload of uploadsToProcess) {
          try {
            const uploadedMedia = await auctionItemMediaService.uploadMedia(
              eventId,
              uploadItemId,
              pendingUpload.file,
              pendingUpload.mediaType
            )
            setMedia((prev) => [...prev, uploadedMedia])
          } catch (uploadErr) {
            uploadErrors++
            // Extract the real backend error detail if available
            let msg = 'Unknown upload error'
            if (
              uploadErr &&
              typeof uploadErr === 'object' &&
              'response' in uploadErr &&
              (uploadErr as { response?: { data?: { detail?: unknown } } }).response?.data
                ?.detail
            ) {
              const detail = (uploadErr as { response: { data: { detail: unknown } } }).response
                .data.detail
              msg = typeof detail === 'string' ? detail : JSON.stringify(detail)
            } else if (uploadErr instanceof Error) {
              msg = uploadErr.message
            }
            toast.error(`Failed to upload "${pendingUpload.file.name}": ${msg}`)
          }
        }

        pendingMediaUploadsRef.current = []
        setPendingMediaUploads([])

        if (uploadErrors > 0) {
          // Don't navigate if uploads failed — keep user on page to retry
          return
        }
      }

      if (isEdit) {
        onUpdateSuccess?.()
      } else {
        onCreateSuccess?.()
      }
    } finally {
      setIsProcessingPostSave(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {/* Basic Info */}
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2 sm:col-span-2'>
          <Label htmlFor='title'>
            Item Title <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='title'
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
            disabled={isFormBusy}
            placeholder='e.g., Weekend Getaway in Napa Valley'
            maxLength={200}
          />
        </div>

        <div className='space-y-2 sm:col-span-2'>
          <Label htmlFor='description'>
            Description <span className='text-destructive'>*</span>
          </Label>
          <RichTextEditor
            value={formData.description}
            onChange={(html) => setFormData({ ...formData, description: html })}
            placeholder='Provide a detailed description of the auction item...'
            disabled={isFormBusy}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='auction_type'>
            Auction Type <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={formData.auction_type}
            onValueChange={(value) =>
              setFormData((prev) => {
                const nextType = value as AuctionTypeSelection

                if (nextType === 'impact') {
                  return {
                    ...prev,
                    auction_type: 'impact',
                    category: 'Impact',
                    buy_now_enabled: true,
                    donor_value: '',
                    starting_bid: '',
                    bid_increment: '',
                    display_starting_bid: false,
                    display_fair_market_value: false,
                  }
                }

                return {
                  ...prev,
                  auction_type: nextType,
                  category:
                    prev.category.trim().toLowerCase() === 'impact'
                      ? ''
                      : prev.category,
                }
              })
            }
            disabled={isFormBusy}
          >
            <SelectTrigger id='auction_type'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AuctionType.LIVE}>Live Auction</SelectItem>
              <SelectItem value={AuctionType.SILENT}>Silent Auction</SelectItem>
              <SelectItem value='impact'>Impact Donation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='category'>Category</Label>
          <Input
            id='category'
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            disabled={isFormBusy || isImpactDonation}
            placeholder='Impact'
          />
          <p className='text-muted-foreground text-xs'>
            Use Impact for buy-now-only donation items.
          </p>
        </div>

        {!isImpactDonation && (
          <div className='space-y-2'>
            <Label htmlFor='quantity_available'>Quantity Available</Label>
            <Input
              id='quantity_available'
              type='number'
              min='0'
              step='1'
              value={formData.quantity_available}
              onChange={(e) =>
                setFormData({ ...formData, quantity_available: e.target.value })
              }
              onBlur={(e) =>
                handleNumericBlur('quantity_available', e.target.value, true)
              }
              disabled={isFormBusy}
              placeholder='Leave blank or 0 for unlimited'
            />
            <p className='text-muted-foreground text-xs'>
              Leave blank or enter 0 for unlimited quantity.
            </p>
            {numericErrors.quantity_available && (
              <p className='text-destructive text-xs'>
                {numericErrors.quantity_available}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className='space-y-4'>
        <h3 className='text-sm font-semibold'>Pricing Information</h3>
        <div className='grid gap-4 sm:grid-cols-2'>
          {!isImpactDonation && (
            <div className='space-y-2'>
              <Label htmlFor='starting_bid'>
                Starting Bid ($){' '}
                {formData.auction_type === AuctionType.SILENT && (
                  <span className='text-destructive'>*</span>
                )}
              </Label>
              <Input
                id='starting_bid'
                type='number'
                step='0.01'
                min='0'
                value={formData.starting_bid}
                onChange={(e) => handleStartingBidChange(e.target.value)}
                onBlur={(e) => handleNumericBlur('starting_bid', e.target.value)}
                required={formData.auction_type === AuctionType.SILENT}
                disabled={isFormBusy}
                placeholder='0.00'
              />
              {numericErrors.starting_bid && (
                <p className='text-destructive text-xs'>
                  {numericErrors.starting_bid}
                </p>
              )}
              {formData.auction_type === AuctionType.LIVE && (
                <p className='text-muted-foreground text-xs'>
                  Optional for live auctions
                </p>
              )}
            </div>
          )}

          {!isImpactDonation && (
            <div className='space-y-2'>
              <Label htmlFor='bid_increment'>
                Bid Increment ($){' '}
                {formData.auction_type === AuctionType.SILENT && (
                  <span className='text-destructive'>*</span>
                )}
              </Label>
              <Input
                id='bid_increment'
                type='number'
                step='0.01'
                min='0.01'
                value={formData.bid_increment}
                onChange={(e) =>
                  setFormData({ ...formData, bid_increment: e.target.value })
                }
                onBlur={(e) => handleNumericBlur('bid_increment', e.target.value)}
                required={formData.auction_type === AuctionType.SILENT}
                disabled={isFormBusy}
                placeholder='50.00'
              />
              {numericErrors.bid_increment && (
                <p className='text-destructive text-xs'>
                  {numericErrors.bid_increment}
                </p>
              )}
              <p className='text-muted-foreground text-xs'>
                {formData.auction_type === AuctionType.LIVE
                  ? 'Optional for live auctions'
                  : 'Auto-calculated based on starting bid (can be adjusted)'}
              </p>
            </div>
          )}

          {!isImpactDonation && (
            <div className='space-y-2'>
              <Label htmlFor='donor_value'>Fair Market Value ($)</Label>
              <Input
                id='donor_value'
                type='number'
                step='0.01'
                min='0'
                value={formData.donor_value}
                onChange={(e) =>
                  setFormData({ ...formData, donor_value: e.target.value })
                }
                onBlur={(e) => handleNumericBlur('donor_value', e.target.value)}
                disabled={isFormBusy}
                placeholder='0.00'
              />
              {numericErrors.donor_value && (
                <p className='text-destructive text-xs'>
                  {numericErrors.donor_value}
                </p>
              )}
              <p className='text-muted-foreground text-xs'>
                The value declared by the donor
              </p>
            </div>
          )}

          {!isImpactDonation && (
            <div className='space-y-2'>
              <Label htmlFor='cost'>Consignment Cost ($)</Label>
              <Input
                id='cost'
                type='number'
                step='0.01'
                min='0'
                value={formData.cost}
                onChange={(e) =>
                  setFormData({ ...formData, cost: e.target.value })
                }
                onBlur={(e) => handleNumericBlur('cost', e.target.value)}
                disabled={isFormBusy}
                placeholder='0.00'
              />
              {numericErrors.cost && (
                <p className='text-destructive text-xs'>{numericErrors.cost}</p>
              )}
              <p className='text-muted-foreground text-xs'>
                Internal cost tracking (not shown to bidders)
              </p>
            </div>
          )}

          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-2'>
              <Label htmlFor='buy_now_price'>Buy Now Price ($)</Label>
              {formData.donor_value && parseFloat(formData.donor_value) > 0 && (
                <button
                  type='button'
                  className='bg-primary/10 text-primary hover:bg-primary/20 rounded px-2 py-0.5 text-xs font-medium transition-colors'
                  onClick={() => {
                    const multiplierPct = parseFloat(
                      import.meta.env.VITE_BUY_NOW_PRICE_MULTIPLIER ?? '250'
                    )
                    const fmv = parseFloat(formData.donor_value)
                    const suggested = ((fmv * multiplierPct) / 100).toFixed(2)
                    setFormData({ ...formData, buy_now_price: suggested })
                  }}
                >
                  Calculate Suggested (
                  {parseFloat(
                    import.meta.env.VITE_BUY_NOW_PRICE_MULTIPLIER ?? '250'
                  )}
                  % FMV)
                </button>
              )}
            </div>
            <Input
              id='buy_now_price'
              type='number'
              step='0.01'
              min='0'
              value={formData.buy_now_price}
              onChange={(e) =>
                setFormData({ ...formData, buy_now_price: e.target.value })
              }
              onBlur={(e) => handleNumericBlur('buy_now_price', e.target.value)}
              disabled={isFormBusy}
              placeholder='0.00'
            />
            {numericErrors.buy_now_price && (
              <p className='text-destructive text-xs'>
                {numericErrors.buy_now_price}
              </p>
            )}
          </div>

          <div className='flex items-center space-x-2 sm:col-span-2'>
            <Switch
              id='buy_now_enabled'
              checked={isImpactDonation ? true : formData.buy_now_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, buy_now_enabled: checked })
              }
              disabled={isFormBusy || isImpactDonation}
            />
            <Label htmlFor='buy_now_enabled' className='cursor-pointer'>
              Enable "Buy Now" option
            </Label>
          </div>

          {formData.auction_type === AuctionType.LIVE && (
            <div className='flex items-center space-x-2 sm:col-span-2'>
              <Switch
                id='display_starting_bid'
                checked={formData.display_starting_bid}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, display_starting_bid: checked })
                }
                disabled={isFormBusy}
              />
              <Label htmlFor='display_starting_bid' className='cursor-pointer'>
                Display Starting Bid (show on donor app)
              </Label>
            </div>
          )}

          {!isImpactDonation && (
            <div className='flex items-center space-x-2 sm:col-span-2'>
              <Switch
                id='display_fair_market_value'
                checked={formData.display_fair_market_value}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    display_fair_market_value: checked,
                  })
                }
                disabled={isFormBusy}
              />
              <Label
                htmlFor='display_fair_market_value'
                className='cursor-pointer'
              >
                Display Fair Market Value (show on donor app)
              </Label>
            </div>
          )}
        </div>
      </div>

      {!isImpactDonation && (
        <>
          {/* Additional Info */}
          <div className='space-y-4'>
            <h3 className='text-sm font-semibold'>Additional Information</h3>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='donated_by'>Donated By</Label>
                <Input
                  id='donated_by'
                  value={formData.donated_by}
                  onChange={(e) =>
                    setFormData({ ...formData, donated_by: e.target.value })
                  }
                  disabled={isFormBusy}
                  placeholder='Donor name or organization'
                  maxLength={200}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='item_webpage'>Item Webpage URL</Label>
                <Input
                  id='item_webpage'
                  type='url'
                  value={formData.item_webpage}
                  onChange={(e) =>
                    setFormData({ ...formData, item_webpage: e.target.value })
                  }
                  onBlur={handleUrlBlur}
                  disabled={isFormBusy}
                  placeholder='https://example.com/item'
                  className={urlError ? 'border-red-500' : ''}
                />
                {urlError && <p className='text-sm text-red-500'>{urlError}</p>}
                <p className='text-muted-foreground text-xs'>
                  Link to more information about this item
                </p>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='display_priority'>Display Priority</Label>
                <Input
                  id='display_priority'
                  type='number'
                  step='1'
                  value={formData.display_priority}
                  onChange={(e) =>
                    setFormData({ ...formData, display_priority: e.target.value })
                  }
                  onBlur={(e) =>
                    handleNumericBlur('display_priority', e.target.value, true)
                  }
                  disabled={isFormBusy}
                  placeholder='0'
                />
                {numericErrors.display_priority && (
                  <p className='text-destructive text-xs'>
                    {numericErrors.display_priority}
                  </p>
                )}
                <p className='text-muted-foreground text-xs'>
                  Higher numbers appear first (default: 0)
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Media Management */}
      {isEdit && item?.id && (
        <div className='space-y-4'>
          <h3 className='text-sm font-semibold'>Media (Images & Videos)</h3>

          {isLoadingMedia ? (
            <div className='text-muted-foreground text-sm'>
              Loading media...
            </div>
          ) : (
            <>
              {/* Upload Zone */}
              <MediaUploadZone
                onUpload={handleMediaUpload}
                autoUploadOnSelect
                disabled={isFormBusy}
              />

              {pendingMediaUploads.length > 0 && (
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-xs'>
                    These files will upload when you click {isEdit ? 'Update Item' : 'Create Item'}.
                  </p>
                  <div className='space-y-2'>
                    {pendingMediaUploads.map((pendingUpload) => (
                      <div
                        key={pendingUpload.id}
                        className='bg-muted/40 flex items-center justify-between rounded-md px-3 py-2'
                      >
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-medium'>
                            {pendingUpload.file.name}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {pendingUpload.mediaType === 'image' ? 'Image' : 'Video'} •{' '}
                            {formatFileSize(pendingUpload.file.size)}
                          </p>
                        </div>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => handlePendingMediaRemove(pendingUpload.id)}
                          disabled={isFormBusy}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Media Gallery */}
              {media.length > 0 && (
                <div className='space-y-2'>
                  <p className='text-muted-foreground text-xs'>
                    Drag to reorder. First image will be the primary thumbnail.
                  </p>
                  <MediaGallery
                    media={media}
                    onReorder={handleMediaReorder}
                    onDelete={handleMediaDelete}
                    readOnly={isFormBusy}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isEdit && (
        <div className='space-y-4'>
          <h3 className='text-sm font-semibold'>Media (Images & Videos)</h3>
          <MediaUploadZone
            onUpload={handleMediaUpload}
            autoUploadOnSelect
            disabled={isFormBusy}
          />

          {pendingMediaUploads.length > 0 && (
            <div className='space-y-2'>
              <p className='text-muted-foreground text-xs'>
                These files will upload automatically after you create the item.
              </p>
              <div className='space-y-2'>
                {pendingMediaUploads.map((pendingUpload) => (
                  <div
                    key={pendingUpload.id}
                    className='bg-muted/40 flex items-center justify-between rounded-md px-3 py-2'
                  >
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>
                        {pendingUpload.file.name}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {pendingUpload.mediaType === 'image' ? 'Image' : 'Video'} •{' '}
                        {formatFileSize(pendingUpload.file.size)}
                      </p>
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => handlePendingMediaRemove(pendingUpload.id)}
                      disabled={isFormBusy}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className='flex justify-end gap-3'>
        <Button
          type='button'
          variant='outline'
          onClick={onCancel}
          disabled={isFormBusy}
        >
          Cancel
        </Button>
        <Button type='submit' disabled={isFormBusy}>
          {isFormBusy
            ? isEdit
              ? 'Updating...'
              : 'Creating...'
            : isEdit
              ? 'Update Item'
              : 'Create Item'}
        </Button>
      </div>
    </form>
  )
}
