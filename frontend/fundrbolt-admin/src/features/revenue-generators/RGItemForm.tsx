import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import revenueGeneratorService, {
  type RGItem,
  type RGItemCreate,
} from '@/services/revenueGeneratorService'
import { ImageIcon, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

interface Props {
  eventId: string
  item?: RGItem
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface FormValues {
  name: string
  description: string
  post_purchase_instructions: string
  price_per_entry: string
  max_entries: string
  max_entries_per_person: string
  display_order: string
}

export function RGItemForm({ eventId, item, open, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    item?.image_url ?? null
  )
  const [imageUploading, setImageUploading] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      post_purchase_instructions: item?.post_purchase_instructions ?? '',
      price_per_entry: item ? String(item.price_per_entry) : '',
      max_entries: item?.max_entries != null ? String(item.max_entries) : '',
      max_entries_per_person:
        item?.max_entries_per_person != null
          ? String(item.max_entries_per_person)
          : '',
      display_order: item ? String(item.display_order) : '0',
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setRemoveImage(false)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setRemoveImage(true)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async (savedItemId: string, file: File) => {
    setImageUploading(true)
    try {
      const { upload_url, blob_name } =
        await revenueGeneratorService.getImageUploadUrl(
          eventId,
          savedItemId,
          file
        )
      await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type,
        },
        body: file,
      })
      await revenueGeneratorService.confirmImageUpload(
        eventId,
        savedItemId,
        blob_name,
        file.name
      )
    } finally {
      setImageUploading(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      const payload: RGItemCreate = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        post_purchase_instructions:
          values.post_purchase_instructions.trim() || null,
        price_per_entry: parseFloat(values.price_per_entry),
        max_entries: values.max_entries.trim()
          ? parseInt(values.max_entries, 10)
          : null,
        max_entries_per_person: values.max_entries_per_person.trim()
          ? parseInt(values.max_entries_per_person, 10)
          : null,
        display_order: parseInt(values.display_order, 10),
      }

      let savedItemId: string
      if (item) {
        await revenueGeneratorService.updateItem(eventId, item.id, payload)
        savedItemId = item.id
      } else {
        const created = await revenueGeneratorService.createItem(
          eventId,
          payload
        )
        savedItemId = created.id
      }

      // Handle image changes
      if (removeImage && item?.image_url) {
        await revenueGeneratorService.deleteImage(eventId, savedItemId)
      } else if (imageFile) {
        await uploadImage(savedItemId, imageFile)
      }

      reset()
      setImageFile(null)
      setRemoveImage(false)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isBusy = saving || imageUploading

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? 'Edit Item' : 'New Revenue Generator Item'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          <div className='space-y-1'>
            <Label htmlFor='rg-name'>Name *</Label>
            <Input id='rg-name' {...register('name', { required: true })} />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='rg-desc'>Description</Label>
            <Textarea id='rg-desc' rows={3} {...register('description')} />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='rg-post-purchase-instructions'>
              Post-Purchase Popup Message
            </Label>
            <Textarea
              id='rg-post-purchase-instructions'
              rows={3}
              maxLength={500}
              placeholder='Example: Make sure to go by the front booth to pick out your mystery wine bottle!'
              {...register('post_purchase_instructions')}
            />
          </div>

          {/* Image upload */}
          <div className='space-y-1'>
            <Label>Image</Label>
            {imagePreview ? (
              <div className='relative w-full overflow-hidden rounded-md border'>
                <img
                  src={imagePreview}
                  alt='Item image'
                  className='h-40 w-full object-cover'
                />
                <button
                  type='button'
                  onClick={handleRemoveImage}
                  className='absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            ) : (
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                className='border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60 flex h-24 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-sm'
              >
                <ImageIcon className='h-6 w-6' />
                <span>Click to upload image</span>
                <span className='text-xs'>JPEG, PNG, WebP · max 10 MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp'
              className='hidden'
              onChange={handleFileChange}
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <Label htmlFor='rg-price'>Price per Entry ($) *</Label>
              <Input
                id='rg-price'
                type='number'
                step='0.01'
                min='0.01'
                {...register('price_per_entry', { required: true })}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='rg-max-entries'>
                Max Qty{' '}
                <span className='text-muted-foreground font-normal'>
                  (blank = unlimited)
                </span>
              </Label>
              <Input
                id='rg-max-entries'
                type='number'
                min='1'
                step='1'
                placeholder='Unlimited'
                {...register('max_entries')}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='rg-max-entries-person'>
                Max Per Person{' '}
                <span className='text-muted-foreground font-normal'>
                  (blank = unlimited)
                </span>
              </Label>
              <Input
                id='rg-max-entries-person'
                type='number'
                min='1'
                step='1'
                placeholder='Unlimited'
                {...register('max_entries_per_person')}
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='rg-order'>Display Order</Label>
            <Input
              id='rg-order'
              type='number'
              min='0'
              {...register('display_order')}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' type='button' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {imageUploading ? 'Uploading image…' : 'Saving…'}
                </>
              ) : item ? (
                'Save Changes'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
