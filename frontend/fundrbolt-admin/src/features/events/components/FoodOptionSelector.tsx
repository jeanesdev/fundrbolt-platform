/**
 * FoodOptionSelector Component
 * Manage food/dietary options for events
 */
import { useState } from 'react'
import type { FoodOption, FoodOptionUpdateRequest } from '@/types/event'
import { Pencil, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FoodOptionSelectorProps {
  options: FoodOption[]
  onCreate: (data: {
    name: string
    description?: string
    icon?: string
    is_default?: boolean
  }) => Promise<void>
  onUpdate: (optionId: string, data: FoodOptionUpdateRequest) => Promise<void>
  onDelete: (optionId: string) => Promise<void>
}

export function FoodOptionSelector({
  options,
  onCreate,
  onUpdate,
  onDelete,
}: FoodOptionSelectorProps) {
  const [newOption, setNewOption] = useState({
    name: '',
    description: '',
  })
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [editingOption, setEditingOption] = useState({
    name: '',
    description: '',
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleCreate = async () => {
    if (!newOption.name.trim()) {
      return
    }

    setIsCreating(true)
    try {
      await onCreate({
        name: newOption.name,
        description: newOption.description || undefined,
      })
      setNewOption({ name: '', description: '' })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (optionId: string) => {
    if (!confirm('Remove this food option?')) return

    await onDelete(optionId)
  }

  const startEditing = (option: FoodOption) => {
    setEditingOptionId(option.id)
    setEditingOption({
      name: option.name,
      description: option.description ?? '',
    })
  }

  const cancelEditing = () => {
    setEditingOptionId(null)
    setEditingOption({ name: '', description: '' })
  }

  const handleUpdate = async (optionId: string) => {
    if (!editingOption.name.trim()) {
      return
    }

    setIsUpdating(true)
    try {
      await onUpdate(optionId, {
        name: editingOption.name,
        description: editingOption.description || undefined,
      })
      cancelEditing()
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className='space-y-4'>
      {/* Existing Options */}
      {options.length > 0 && (
        <div className='space-y-2'>
          <Label>Current Food Options</Label>
          {options.map((option) => (
            <Card key={option.id}>
              <CardContent className='p-4'>
                {editingOptionId === option.id ? (
                  <div className='space-y-3'>
                    <div className='space-y-2'>
                      <Input
                        placeholder='Option name'
                        value={editingOption.name}
                        onChange={(e) =>
                          setEditingOption({
                            ...editingOption,
                            name: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder='Description (optional)'
                        value={editingOption.description}
                        onChange={(e) =>
                          setEditingOption({
                            ...editingOption,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        onClick={() => handleUpdate(option.id)}
                        disabled={isUpdating || !editingOption.name.trim()}
                      >
                        <Save className='h-4 w-4' />
                        {isUpdating ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={cancelEditing}
                        disabled={isUpdating}
                      >
                        <X className='h-4 w-4' />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      {option.icon && (
                        <span className='text-lg'>{option.icon}</span>
                      )}
                      <div>
                        <p className='font-medium'>{option.name}</p>
                        {option.description && (
                          <p className='text-muted-foreground text-sm'>
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => startEditing(option)}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => handleDelete(option.id)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Option */}
      <Card>
        <CardContent className='space-y-4 p-4'>
          <Label>Add Food Option</Label>

          <div className='space-y-2'>
            <Input
              placeholder='Option name (e.g., Vegetarian, Gluten-Free)'
              value={newOption.name}
              onChange={(e) =>
                setNewOption({ ...newOption, name: e.target.value })
              }
            />
            <Input
              placeholder='Description (optional)'
              value={newOption.description}
              onChange={(e) =>
                setNewOption({ ...newOption, description: e.target.value })
              }
            />
          </div>

          <Button
            type='button'
            onClick={handleCreate}
            disabled={isCreating || !newOption.name}
          >
            {isCreating ? 'Adding...' : 'Add Option'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
