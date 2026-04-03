/**
 * TemplateManagementDialog — List, rename, delete, and set-default templates
 */
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useChecklistStore } from '@/stores/checklistStore'
import type { ChecklistTemplate } from '@/types/checklist'
import { Check, Pencil, Shield, Star, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface TemplateManagementDialogProps {
  npoId: string
  onClose: () => void
}

export default function TemplateManagementDialog({
  npoId,
  onClose,
}: TemplateManagementDialogProps) {
  const {
    templates,
    templatesLoading,
    fetchTemplates,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
  } = useChecklistStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    fetchTemplates(npoId).catch(() => {
      toast.error('Failed to load templates')
    })
  }, [npoId, fetchTemplates])

  const handleStartEdit = (template: ChecklistTemplate) => {
    setEditingId(template.id)
    setEditName(template.name)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return
    try {
      await updateTemplate(npoId, editingId, { name: editName.trim() })
      setEditingId(null)
      toast.success('Template renamed')
    } catch {
      toast.error('Failed to rename template')
    }
  }

  const handleDelete = async (templateId: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return
    try {
      await deleteTemplate(npoId, templateId)
      toast.success('Template deleted')
    } catch {
      toast.error('Failed to delete template')
    }
  }

  const handleSetDefault = async (templateId: string) => {
    try {
      await setDefaultTemplate(npoId, templateId)
      toast.success('Default template updated')
    } catch {
      toast.error('Failed to set default template')
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Manage Checklist Templates</DialogTitle>
        </DialogHeader>

        <div className='space-y-2 py-4'>
          {templatesLoading && (
            <p className='text-muted-foreground text-sm'>Loading...</p>
          )}

          {!templatesLoading && templates.length === 0 && (
            <p className='text-muted-foreground text-sm'>No templates found.</p>
          )}

          {templates.map((template) => (
            <div
              key={template.id}
              className='flex items-center gap-2 rounded-lg border px-3 py-2'
            >
              {editingId === template.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className='h-8 flex-1 text-sm'
                    maxLength={200}
                    autoFocus
                  />
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-8'
                    onClick={handleSaveEdit}
                  >
                    <Check className='h-3 w-3' />
                  </Button>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-8'
                    onClick={() => setEditingId(null)}
                  >
                    <X className='h-3 w-3' />
                  </Button>
                </>
              ) : (
                <>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='truncate text-sm font-medium'>
                        {template.name}
                      </span>
                      {template.is_system_default && (
                        <Shield className='h-3.5 w-3.5 shrink-0 text-blue-500' />
                      )}
                      {template.is_default && (
                        <Star className='h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400' />
                      )}
                    </div>
                    <span className='text-muted-foreground text-xs'>
                      {template.item_count} items
                    </span>
                  </div>

                  <div className='flex shrink-0 gap-1'>
                    {!template.is_system_default && !template.is_default && (
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-7 px-2'
                        onClick={() => handleSetDefault(template.id)}
                        title='Set as default'
                      >
                        <Star className='h-3 w-3' />
                      </Button>
                    )}
                    {!template.is_system_default && (
                      <>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-7 px-2'
                          onClick={() => handleStartEdit(template)}
                          title='Rename'
                        >
                          <Pencil className='h-3 w-3' />
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-7 px-2 text-red-500 hover:text-red-700'
                          onClick={() =>
                            handleDelete(template.id, template.name)
                          }
                          title='Delete'
                        >
                          <Trash2 className='h-3 w-3' />
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
