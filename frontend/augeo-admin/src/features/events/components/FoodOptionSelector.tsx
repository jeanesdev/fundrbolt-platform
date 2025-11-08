/**
 * FoodOptionSelector Component
 * Manage food/dietary options for events
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FoodOption } from '@/types/event'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface FoodOptionSelectorProps {
  options: FoodOption[]
  onCreate: (data: { name: string; description?: string; icon?: string; is_default?: boolean }) => Promise<void>
  onDelete: (optionId: string) => Promise<void>
}

export function FoodOptionSelector({ options, onCreate, onDelete }: FoodOptionSelectorProps) {
  const [newOption, setNewOption] = useState({ name: '', description: '', icon: '' })
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!newOption.name.trim()) {
      toast.error('Option name is required')
      return
    }

    setIsCreating(true)
    try {
      await onCreate({
        name: newOption.name,
        description: newOption.description || undefined,
        icon: newOption.icon || undefined,
      })
      setNewOption({ name: '', description: '', icon: '' })
      toast.success('Food option added')
    } catch (_err) {
      toast.error('Failed to add food option')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (optionId: string) => {
    if (!confirm('Remove this food option?')) return

    try {
      await onDelete(optionId)
      toast.success('Food option removed')
    } catch (_err) {
      toast.error('Failed to remove food option')
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing Options */}
      {options.length > 0 && (
        <div className="space-y-2">
          <Label>Current Food Options</Label>
          {options.map((option) => (
            <Card key={option.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {option.icon && <span className="text-lg">{option.icon}</span>}
                    <div>
                      <p className="font-medium">{option.name}</p>
                      {option.description && (
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(option.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Option */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <Label>Add Food Option</Label>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Option name (e.g., Vegetarian, Gluten-Free)"
              value={newOption.name}
              onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
            />
            <Input
              placeholder="Description (optional)"
              value={newOption.description}
              onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
            />
            <Input
              placeholder="Icon emoji (optional, e.g., 🥗)"
              value={newOption.icon}
              onChange={(e) => setNewOption({ ...newOption, icon: e.target.value })}
              maxLength={2}
            />
          </div>

          <Button type="button" onClick={handleCreate} disabled={isCreating || !newOption.name}>
            {isCreating ? 'Adding...' : 'Add Option'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
