/**
 * ChecklistItemForm — Inline add/edit form with title and optional date picker
 */
import { useState } from 'react'
import type { ChecklistItem } from '@/types/checklist'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChecklistItemFormProps {
  editingItem?: ChecklistItem | null
  onSubmit: (title: string, dueDate: string | null) => void
  onCancel: () => void
}

export function ChecklistItemForm({
  editingItem,
  onSubmit,
  onCancel,
}: ChecklistItemFormProps) {
  const [title, setTitle] = useState(editingItem?.title ?? '')
  const [dueDate, setDueDate] = useState(editingItem?.due_date ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit(trimmed, dueDate || null)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='flex items-center gap-2 rounded-lg border border-dashed p-2'
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder='Task title...'
        maxLength={200}
        className='h-8 flex-1 text-sm'
        autoFocus
      />
      <Input
        type='date'
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className='h-8 w-36 text-sm'
      />
      <Button type='submit' size='sm' variant='outline' className='h-8'>
        <Plus className='mr-1 h-3 w-3' />
        {editingItem ? 'Save' : 'Add'}
      </Button>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        className='h-8'
        onClick={onCancel}
      >
        <X className='h-3 w-3' />
      </Button>
    </form>
  )
}
