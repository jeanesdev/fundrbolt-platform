import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DiscountType, type PromoCodeRead } from '@/types/ticket-management'
import {
  Calendar,
  DollarSign,
  Edit,
  Percent,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react'
import apiClient from '@/lib/axios'
import { PromoCodeFormDialog } from './PromoCodeFormDialog'

interface PromoCodesManagerProps {
  eventId: string
}

export function PromoCodesManager({ eventId }: PromoCodesManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<PromoCodeRead | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const queryClient = useQueryClient()

  // Fetch promo codes
  const { data: promoCodes = [], isLoading } = useQuery({
    queryKey: ['promoCodes', eventId, showInactive],
    queryFn: async () => {
      const response = await apiClient.get<PromoCodeRead[]>(
        `/admin/events/${eventId}/promo-codes`,
        { params: { include_inactive: showInactive } }
      )
      return response.data
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (codeId: string) => {
      await apiClient.delete(`/admin/events/${eventId}/promo-codes/${codeId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes', eventId] })
    },
  })

  const handleEdit = (code: PromoCodeRead) => {
    setEditingCode(code)
    setIsFormOpen(true)
  }

  const handleDelete = async (code: PromoCodeRead) => {
    if (code.used_count > 0) {
      alert('Cannot delete a promo code that has been used.')
      return
    }
    if (
      confirm(
        `Are you sure you want to delete promo code "${code.code}"? This action cannot be undone.`
      )
    ) {
      await deleteMutation.mutateAsync(code.id)
    }
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingCode(null)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDiscount = (code: PromoCodeRead) => {
    // Format just the number, icon is shown separately
    return code.discount_value.toString()
  }

  const getUsageStatus = (code: PromoCodeRead) => {
    if (code.max_uses === null) return 'Unlimited'
    const remaining = code.max_uses - code.used_count
    return `${code.used_count} / ${code.max_uses} used (${remaining} left)`
  }

  const isExpired = (code: PromoCodeRead) => {
    if (!code.valid_until) return false
    return new Date(code.valid_until) < new Date()
  }

  const isNotYetValid = (code: PromoCodeRead) => {
    if (!code.valid_from) return false
    return new Date(code.valid_from) > new Date()
  }

  if (isLoading) {
    return <div className='py-8 text-center'>Loading promo codes...</div>
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Promo Codes</h2>
          <p className='text-muted-foreground'>
            Create and manage discount codes for ticket purchases
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 transition-colors'
        >
          <Plus className='h-4 w-4' />
          Add Promo Code
        </button>
      </div>

      {/* Filter Toggle */}
      <div className='flex items-center gap-2'>
        <input
          type='checkbox'
          id='showInactive'
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className='rounded border-gray-300'
        />
        <label htmlFor='showInactive' className='cursor-pointer text-sm'>
          Show inactive promo codes
        </label>
      </div>

      {/* Promo Codes Grid */}
      {promoCodes.length === 0 ? (
        <div className='bg-muted/50 rounded-lg border border-dashed py-12 text-center'>
          <Tag className='text-muted-foreground mx-auto mb-4 h-12 w-12' />
          <h3 className='mb-2 text-lg font-semibold'>No promo codes yet</h3>
          <p className='text-muted-foreground mb-4'>
            Create your first promo code to offer discounts to attendees.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 transition-colors'
          >
            <Plus className='h-4 w-4' />
            Add Promo Code
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {promoCodes.map((code) => (
            <div
              key={code.id}
              className={`space-y-3 rounded-lg border p-4 ${
                !code.is_active || isExpired(code)
                  ? 'bg-muted/50 border-dashed'
                  : 'bg-card'
              }`}
            >
              {/* Code Header */}
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-lg font-bold'>
                      {code.code}
                    </span>
                    {!code.is_active && (
                      <span className='rounded bg-gray-200 px-2 py-0.5 text-xs'>
                        Inactive
                      </span>
                    )}
                    {isExpired(code) && code.is_active && (
                      <span className='rounded bg-red-100 px-2 py-0.5 text-xs text-red-700'>
                        Expired
                      </span>
                    )}
                    {isNotYetValid(code) && code.is_active && (
                      <span className='rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700'>
                        Not Yet Valid
                      </span>
                    )}
                  </div>
                </div>
                <div className='flex gap-1'>
                  <button
                    onClick={() => handleEdit(code)}
                    className='hover:bg-muted rounded p-1.5 transition-colors'
                    title='Edit'
                  >
                    <Edit className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => handleDelete(code)}
                    disabled={code.used_count > 0}
                    className='hover:bg-destructive/10 hover:text-destructive rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                    title={
                      code.used_count > 0
                        ? 'Cannot delete used promo code'
                        : 'Delete'
                    }
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              </div>

              {/* Discount Amount */}
              <div className='text-primary flex items-center gap-2 text-2xl font-bold'>
                {code.discount_type === DiscountType.PERCENTAGE ? (
                  <Percent className='h-5 w-5' />
                ) : (
                  <DollarSign className='h-5 w-5' />
                )}
                {formatDiscount(code)}
              </div>

              {/* Date Range */}
              {(code.valid_from || code.valid_until) && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Calendar className='h-4 w-4' />
                  <span>
                    {code.valid_from && formatDate(code.valid_from)}
                    {code.valid_from && code.valid_until && ' - '}
                    {code.valid_until && formatDate(code.valid_until)}
                  </span>
                </div>
              )}

              {/* Usage Stats */}
              <div className='text-sm'>
                <span className='text-muted-foreground'>Usage: </span>
                <span className='font-medium'>{getUsageStatus(code)}</span>
              </div>

              {/* Usage Bar */}
              {code.max_uses !== null && (
                <div className='bg-muted h-2 overflow-hidden rounded-full'>
                  <div
                    className='bg-primary h-full transition-all'
                    style={{
                      width: `${(code.used_count / code.max_uses) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <PromoCodeFormDialog
        eventId={eventId}
        open={isFormOpen}
        onClose={handleFormClose}
        editingCode={editingCode}
      />
    </div>
  )
}
