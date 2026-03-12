/**
 * Promo Codes Management Page
 * Lists all promo codes for an event with CRUD operations
 */
import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import apiClient from '@/lib/axios'
import { getErrorMessage } from '@/lib/error-utils'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

interface PromoCode {
  id: string
  event_id: string
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: string
  max_uses: number | null
  used_count: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
}

interface PromoCodeFormData {
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: string
  max_uses: string
  valid_from: string
  valid_until: string
  is_active: boolean
}

const emptyForm: PromoCodeFormData = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  max_uses: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—'

const formatDiscount = (type: string, value: string) => {
  if (type === 'percentage') return `${value}%`
  return `$${Number(value).toFixed(2)}`
}

export function PromoCodesPage() {
  const { currentEvent } = useEventWorkspace()
  const eventId = currentEvent.id
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [form, setForm] = useState<PromoCodeFormData>(emptyForm)

  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ['promo-codes', eventId],
    queryFn: async () => {
      const response = await apiClient.get<PromoCode[]>(
        `/admin/events/${eventId}/promo-codes`
      )
      return response.data
    },
    enabled: Boolean(eventId),
  })

  const createMutation = useMutation({
    mutationFn: async (data: PromoCodeFormData) => {
      await apiClient.post(`/admin/events/${eventId}/promo-codes`, {
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses ? Number(data.max_uses) : null,
        valid_from: data.valid_from || null,
        valid_until: data.valid_until || null,
        is_active: data.is_active,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes', eventId] })
      toast({ title: 'Promo code created' })
      closeDialog()
    },
    onError: (error) => {
      toast({
        title: 'Create failed',
        description: getErrorMessage(error, 'Failed to create promo code'),
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      version,
    }: {
      id: string
      data: PromoCodeFormData
      version: number
    }) => {
      await apiClient.patch(`/admin/events/${eventId}/promo-codes/${id}`, {
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses ? Number(data.max_uses) : null,
        valid_from: data.valid_from || null,
        valid_until: data.valid_until || null,
        is_active: data.is_active,
        version,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes', eventId] })
      toast({ title: 'Promo code updated' })
      closeDialog()
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: getErrorMessage(error, 'Failed to update promo code'),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/events/${eventId}/promo-codes/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes', eventId] })
      toast({ title: 'Promo code deleted' })
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: getErrorMessage(error, 'Failed to delete promo code'),
        variant: 'destructive',
      })
    },
  })

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    setEditingPromo(null)
    setForm(emptyForm)
  }, [])

  const openCreate = () => {
    setEditingPromo(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (promo: PromoCode) => {
    setEditingPromo(promo)
    setForm({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      max_uses: promo.max_uses?.toString() ?? '',
      valid_from: promo.valid_from?.slice(0, 16) ?? '',
      valid_until: promo.valid_until?.slice(0, 16) ?? '',
      is_active: promo.is_active,
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.code || !form.discount_value) return
    if (editingPromo) {
      updateMutation.mutate({
        id: editingPromo.id,
        data: form,
        version: editingPromo.version,
      })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleDelete = (promo: PromoCode) => {
    if (promo.used_count > 0) {
      toast({
        title: 'Cannot delete',
        description: `This promo code has been used ${promo.used_count} time(s). Deactivate it instead.`,
        variant: 'destructive',
      })
      return
    }
    if (confirm(`Delete promo code "${promo.code}"? This cannot be undone.`)) {
      deleteMutation.mutate(promo.id)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({ title: 'Copied', description: `"${code}" copied to clipboard` })
  }

  if (isLoading) {
    return (
      <div className='animate-pulse space-y-4'>
        <div className='h-8 w-1/4 rounded bg-gray-200' />
        <div className='h-32 rounded bg-gray-200' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Promo Codes</h1>
          <p className='text-muted-foreground'>
            Create and manage discount codes for ticket purchases
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className='mr-2 h-4 w-4' />
          New Promo Code
        </Button>
      </div>

      {!promoCodes || promoCodes.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <p className='text-muted-foreground mb-4'>No promo codes yet</p>
            <Button onClick={openCreate}>
              <Plus className='mr-2 h-4 w-4' />
              Create First Promo Code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Promo Codes</CardTitle>
            <CardDescription>
              {promoCodes.length} promo code{promoCodes.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Valid From</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className='font-mono font-bold'>
                      <div className='flex items-center gap-2'>
                        {promo.code}
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6'
                          onClick={() => copyCode(promo.code)}
                        >
                          <Copy className='h-3 w-3' />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDiscount(
                        promo.discount_type,
                        promo.discount_value
                      )}
                    </TableCell>
                    <TableCell>
                      {promo.used_count}
                      {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                    </TableCell>
                    <TableCell>{formatDate(promo.valid_from)}</TableCell>
                    <TableCell>{formatDate(promo.valid_until)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={promo.is_active ? 'default' : 'secondary'}
                      >
                        {promo.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => openEdit(promo)}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => handleDelete(promo)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
            </DialogTitle>
            <DialogDescription>
              {editingPromo
                ? 'Update the discount settings for this promo code.'
                : 'Create a new discount code for ticket purchases.'}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='promo-code'>Code</Label>
              <Input
                id='promo-code'
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
                placeholder='e.g. VIP20'
                disabled={!!editingPromo}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='discount-type'>Discount Type</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      discount_type: v as PromoCodeFormData['discount_type'],
                    }))
                  }
                >
                  <SelectTrigger id='discount-type'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='percentage'>Percentage (%)</SelectItem>
                    <SelectItem value='fixed_amount'>
                      Fixed Amount ($)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='discount-value'>
                  {form.discount_type === 'percentage'
                    ? 'Percentage'
                    : 'Amount'}
                </Label>
                <Input
                  id='discount-value'
                  type='number'
                  step={form.discount_type === 'percentage' ? '1' : '0.01'}
                  min='0'
                  max={form.discount_type === 'percentage' ? '100' : undefined}
                  value={form.discount_value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discount_value: e.target.value }))
                  }
                  placeholder={
                    form.discount_type === 'percentage' ? '20' : '10.00'
                  }
                />
              </div>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='max-uses'>
                Max Uses (leave blank for unlimited)
              </Label>
              <Input
                id='max-uses'
                type='number'
                min='1'
                value={form.max_uses}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_uses: e.target.value }))
                }
                placeholder='Unlimited'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='valid-from'>Valid From</Label>
                <Input
                  id='valid-from'
                  type='datetime-local'
                  value={form.valid_from}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, valid_from: e.target.value }))
                  }
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='valid-until'>Valid Until</Label>
                <Input
                  id='valid-until'
                  type='datetime-local'
                  value={form.valid_until}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, valid_until: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Switch
                id='is-active'
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_active: checked }))
                }
              />
              <Label htmlFor='is-active'>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !form.code ||
                !form.discount_value ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingPromo ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
