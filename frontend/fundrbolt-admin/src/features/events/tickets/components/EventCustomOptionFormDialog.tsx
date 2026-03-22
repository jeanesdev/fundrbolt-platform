/**
 * EventCustomOptionFormDialog
 * Dialog form for creating and editing event-level custom options.
 * Uses event-level API endpoints instead of package-level ones.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import apiClient from '@/lib/axios'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const optionSchema = z.object({
  option_type: z.enum(['boolean', 'multi_select', 'text_input']),
  option_label: z
    .string()
    .min(1, 'Label is required')
    .max(100, 'Label too long'),
  choices: z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  display_order: z.number().optional(),
})

type OptionFormData = z.infer<typeof optionSchema>

interface CustomOption {
  id: string
  event_id: string
  option_type: 'boolean' | 'multi_select' | 'text_input'
  option_label: string
  choices?: string[]
  is_required: boolean
  display_order: number
  created_at: string
}

interface EventCustomOptionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  mode: 'create' | 'edit'
  option?: CustomOption
}

export function EventCustomOptionFormDialog({
  open,
  onOpenChange,
  eventId,
  mode,
  option,
}: EventCustomOptionFormDialogProps) {
  const queryClient = useQueryClient()
  const [newChoice, setNewChoice] = useState('')

  const form = useForm<OptionFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(optionSchema) as any,
    defaultValues: {
      option_type: option?.option_type || 'boolean',
      option_label: option?.option_label || '',
      choices: option?.choices || [],
      is_required: option?.is_required ?? false,
      display_order: option?.display_order,
    },
  })
  const optionType =
    useWatch({ control: form.control, name: 'option_type' }) ?? 'boolean'
  const choices = useWatch({ control: form.control, name: 'choices' }) || []

  useEffect(() => {
    if (open && option) {
      form.reset({
        option_type: option.option_type,
        option_label: option.option_label,
        choices: option.choices || [],
        is_required: option.is_required,
        display_order: option.display_order,
      })
    } else if (open && !option) {
      form.reset({
        option_type: 'boolean',
        option_label: '',
        choices: [],
        is_required: false,
      })
    }
  }, [open, option, form])

  const createMutation = useMutation({
    mutationFn: async (data: OptionFormData) => {
      const response = await apiClient.post(
        `/admin/events/${eventId}/options`,
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-custom-options', eventId],
      })
      toast.success('Question has been created successfully.')
      onOpenChange(false)
    },
    onError: (
      error: Error & { response?: { data?: { detail?: string } } }
    ) => {
      const detail = error.response?.data?.detail
      if (detail?.includes('Maximum')) {
        toast.error('Maximum number of event questions reached.')
      } else {
        toast.error(detail || 'Failed to create question')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: OptionFormData) => {
      const response = await apiClient.patch(
        `/admin/events/${eventId}/options/${option?.id}`,
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-custom-options', eventId],
      })
      toast.success('Question has been updated successfully.')
      onOpenChange(false)
    },
    onError: (
      error: Error & { response?: { data?: { detail?: string } } }
    ) => {
      const detail = error.response?.data?.detail
      if (detail?.includes('responses')) {
        toast.error('This question has responses and cannot be modified.')
      } else {
        toast.error(detail || 'Failed to update question')
      }
    },
  })

  const onSubmit = (data: OptionFormData) => {
    const submitData = {
      ...data,
      choices: data.option_type === 'multi_select' ? data.choices : undefined,
    }

    if (mode === 'create') {
      createMutation.mutate(submitData)
    } else {
      updateMutation.mutate(submitData)
    }
  }

  const addChoice = () => {
    if (newChoice.trim() && choices.length < 10) {
      form.setValue('choices', [...choices, newChoice.trim()])
      setNewChoice('')
    }
  }

  const removeChoice = (index: number) => {
    form.setValue(
      'choices',
      choices.filter((_, i) => i !== index)
    )
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? 'Add Universal Question'
              : 'Edit Universal Question'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'This question will appear on every registration for this event.'
              : 'Update the question details. Questions with responses cannot be modified.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='option_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={mode === 'edit'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select question type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='boolean'>Yes/No Question</SelectItem>
                      <SelectItem value='multi_select'>
                        Multiple Choice
                      </SelectItem>
                      <SelectItem value='text_input'>Text Input</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {mode === 'edit' && 'Type cannot be changed after creation'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='option_label'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Do you have any accessibility needs?'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The question shown to attendees during registration
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {optionType === 'multi_select' && (
              <div className='space-y-3'>
                <FormLabel>Choices</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add a choice'
                    value={newChoice}
                    onChange={(e) => setNewChoice(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addChoice()
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addChoice}
                    disabled={!newChoice.trim() || choices.length >= 10}
                    size='sm'
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {choices.map((choice, index) => (
                    <Badge
                      key={index}
                      variant='secondary'
                      className='pr-1 pl-2'
                    >
                      {choice}
                      <button
                        type='button'
                        onClick={() => removeChoice(index)}
                        className='ml-1 rounded-full p-0.5 hover:bg-gray-300'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
                {choices.length === 0 && (
                  <p className='text-destructive text-sm'>
                    At least one choice is required
                  </p>
                )}
                <p className='text-muted-foreground text-sm'>
                  Add up to 10 choices ({choices.length}/10)
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name='is_required'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Required</FormLabel>
                    <FormDescription>
                      Attendees must answer this question to complete
                      registration
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting
                  ? mode === 'create'
                    ? 'Creating...'
                    : 'Updating...'
                  : mode === 'create'
                    ? 'Add Question'
                    : 'Update Question'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
