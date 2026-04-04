import { useState } from 'react'
import { DONOR_LABEL_COLORS } from '@/themes/colors'
import { Check, ChevronsUpDown, Plus, Tag, Trash2, X } from 'lucide-react'
import { useNPOContextStore } from '@/stores/npo-context-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DonorLabel } from '../api/donor-labels-api'
import type { DonorLabelInfo } from '../api/users-api'
import {
  useCreateDonorLabel,
  useDeleteDonorLabel,
  useDonorLabels,
  useSetUserDonorLabels,
} from '../hooks/use-donor-labels'

const PRESET_COLORS = DONOR_LABEL_COLORS

function getLabelStyle(color: string | null) {
  if (!color) return {}
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}60`,
    color: color,
  }
}

export function DonorLabelsSection({
  userId,
  currentLabels,
}: {
  userId: string
  currentLabels: DonorLabelInfo[]
}) {
  const selectedNpoId = useNPOContextStore((state) => state.selectedNpoId)
  const { data: labelsData } = useDonorLabels(selectedNpoId)
  const setLabels = useSetUserDonorLabels(selectedNpoId)
  const createLabel = useCreateDonorLabel(selectedNpoId)
  const deleteLabel = useDeleteDonorLabel(selectedNpoId)

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  if (!selectedNpoId) return null

  const allLabels = labelsData?.items ?? []
  const currentLabelIds = currentLabels.map((l) => l.id)

  const handleToggleLabel = (labelId: string) => {
    const newIds = currentLabelIds.includes(labelId)
      ? currentLabelIds.filter((id) => id !== labelId)
      : [...currentLabelIds, labelId]
    setLabels.mutate({ userId, labelIds: newIds })
  }

  const handleRemoveLabel = (labelId: string) => {
    const newIds = currentLabelIds.filter((id) => id !== labelId)
    setLabels.mutate({ userId, labelIds: newIds })
  }

  const handleCreateLabel = () => {
    if (!newLabelName.trim()) return
    createLabel.mutate(
      { name: newLabelName.trim(), color: newLabelColor },
      {
        onSuccess: (created: DonorLabel) => {
          setNewLabelName('')
          setNewLabelColor(null)
          setCreateDialogOpen(false)
          // Also assign it to this user
          setLabels.mutate({
            userId,
            labelIds: [...currentLabelIds, created.id],
          })
        },
      }
    )
  }

  const handleDeleteLabel = (labelId: string) => {
    deleteLabel.mutate(labelId)
    setDeleteConfirmId(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <Tag className='h-5 w-5' />
              Donor Labels
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Current labels */}
          <div className='flex flex-wrap gap-2'>
            {currentLabels.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                No labels assigned
              </p>
            )}
            {currentLabels.map((label) => (
              <Badge
                key={label.id}
                variant='outline'
                className='gap-1 pr-1'
                style={getLabelStyle(label.color)}
              >
                {label.name}
                <button
                  onClick={() => handleRemoveLabel(label.id)}
                  className='hover:bg-foreground/10 ml-1 rounded-full p-0.5'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            ))}
          </div>

          {/* Add label popover */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant='outline' size='sm' className='gap-2'>
                <Plus className='h-4 w-4' />
                Add Label
                <ChevronsUpDown className='h-3 w-3 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-[250px] p-0' align='start'>
              <Command>
                <CommandInput placeholder='Search labels...' />
                <CommandList>
                  <CommandEmpty>
                    <p className='text-sm'>No labels found.</p>
                  </CommandEmpty>
                  <CommandGroup>
                    {allLabels.map((label) => (
                      <CommandItem
                        key={label.id}
                        onSelect={() => handleToggleLabel(label.id)}
                        className='flex items-center justify-between'
                      >
                        <div className='flex items-center gap-2'>
                          {label.color && (
                            <span
                              className='h-3 w-3 rounded-full'
                              style={{ backgroundColor: label.color }}
                            />
                          )}
                          <span>{label.name}</span>
                        </div>
                        <div className='flex items-center gap-1'>
                          {currentLabelIds.includes(label.id) && (
                            <Check className='h-4 w-4' />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(label.id)
                              setPopoverOpen(false)
                            }}
                            className='hover:text-destructive rounded p-1 opacity-50 hover:opacity-100'
                          >
                            <Trash2 className='h-3 w-3' />
                          </button>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                <div className='border-t p-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='w-full gap-2'
                    onClick={() => {
                      setPopoverOpen(false)
                      setCreateDialogOpen(true)
                    }}
                  >
                    <Plus className='h-4 w-4' />
                    Create new label
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Create label dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Donor Label</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Name</label>
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder='e.g. Major Donor'
                maxLength={100}
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Color (optional)</label>
              <div className='flex flex-wrap gap-2'>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() =>
                      setNewLabelColor(newLabelColor === color ? null : color)
                    }
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform',
                      newLabelColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            {newLabelName && (
              <div>
                <label className='text-sm font-medium'>Preview</label>
                <div className='mt-1'>
                  <Badge variant='outline' style={getLabelStyle(newLabelColor)}>
                    {newLabelName}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateLabel}
              disabled={!newLabelName.trim() || createLabel.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Label</DialogTitle>
          </DialogHeader>
          <p className='text-muted-foreground text-sm'>
            This will remove the label from all users. This action cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() =>
                deleteConfirmId && handleDeleteLabel(deleteConfirmId)
              }
              disabled={deleteLabel.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
