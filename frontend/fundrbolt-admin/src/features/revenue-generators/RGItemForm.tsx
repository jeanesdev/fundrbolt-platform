import { useState } from 'react'
import { useForm } from 'react-hook-form'
import revenueGeneratorService, {
  type RGItem,
  type RGItemCreate,
} from '@/services/revenueGeneratorService'
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
  price_per_entry: string
  display_order: string
}

export function RGItemForm({ eventId, item, open, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price_per_entry: item ? String(item.price_per_entry) : '',
      display_order: item ? String(item.display_order) : '0',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      const payload: RGItemCreate = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        price_per_entry: parseFloat(values.price_per_entry),
        display_order: parseInt(values.display_order, 10),
      }
      if (item) {
        await revenueGeneratorService.updateItem(eventId, item.id, payload)
      } else {
        await revenueGeneratorService.createItem(eventId, payload)
      }
      reset()
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

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
              <Label htmlFor='rg-order'>Display Order</Label>
              <Input
                id='rg-order'
                type='number'
                min='0'
                {...register('display_order')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' type='button' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? 'Saving…' : item ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
