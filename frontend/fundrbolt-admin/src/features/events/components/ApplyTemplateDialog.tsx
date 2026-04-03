/**
 * ApplyTemplateDialog — Select and apply a checklist template to an event
 */
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useChecklistStore } from '@/stores/checklistStore'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface ApplyTemplateDialogProps {
  eventId: string
  npoId: string
  onClose: () => void
}

export default function ApplyTemplateDialog({
  eventId,
  npoId,
  onClose,
}: ApplyTemplateDialogProps) {
  const { templates, templatesLoading, fetchTemplates, applyTemplate } =
    useChecklistStore()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    fetchTemplates(npoId).catch(() => {
      toast.error('Failed to load templates')
    })
  }, [npoId, fetchTemplates])

  const handleApply = async () => {
    if (!selectedTemplateId) return
    setIsApplying(true)
    try {
      await applyTemplate(eventId, {
        template_id: selectedTemplateId,
        mode,
      })
      toast.success('Template applied successfully')
      onClose()
    } catch {
      toast.error('Failed to apply template')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Checklist Template</DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label>Template</Label>
            {templatesLoading ? (
              <p className='text-muted-foreground text-sm'>
                Loading templates...
              </p>
            ) : templates.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                No templates available.
              </p>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a template...' />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{' '}
                      <span className='text-muted-foreground text-xs'>
                        ({t.item_count} items)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className='space-y-2'>
            <Label>Mode</Label>
            <div className='flex gap-4'>
              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='radio'
                  name='mode'
                  value='replace'
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className='accent-primary'
                />
                Replace existing items
              </label>
              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='radio'
                  name='mode'
                  value='append'
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                  className='accent-primary'
                />
                Append to existing items
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedTemplateId || isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
