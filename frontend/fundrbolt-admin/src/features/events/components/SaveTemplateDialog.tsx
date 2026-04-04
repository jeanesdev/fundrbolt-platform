/**
 * SaveTemplateDialog — Save event checklist as a reusable template
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { useChecklistStore } from '@/stores/checklistStore'
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

interface SaveTemplateDialogProps {
  eventId: string
  onClose: () => void
}

export default function SaveTemplateDialog({
  eventId,
  onClose,
}: SaveTemplateDialogProps) {
  const { saveAsTemplate } = useChecklistStore()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setIsSaving(true)
    try {
      await saveAsTemplate(eventId, { name: trimmed })
      toast.success(`Template "${trimmed}" saved`)
      onClose()
    } catch {
      toast.error('Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='template-name'>Template Name</Label>
            <Input
              id='template-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g., Annual Gala Checklist'
              maxLength={200}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
