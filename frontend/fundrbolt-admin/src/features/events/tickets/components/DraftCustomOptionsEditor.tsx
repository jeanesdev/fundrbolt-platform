import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
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

const draftOptionSchema = z
  .object({
    option_type: z.enum(['boolean', 'multi_select', 'text_input']),
    option_label: z
      .string()
      .min(1, 'Label is required')
      .max(100, 'Label too long'),
    choices: z.array(z.string()).optional(),
    is_required: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (
      data.option_type === 'multi_select' &&
      (!data.choices || data.choices.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: 'At least one choice is required',
      })
    }
  })

type DraftOptionFormData = z.infer<typeof draftOptionSchema>

export interface DraftCustomOption {
  tempId: string
  option_type: 'boolean' | 'multi_select' | 'text_input'
  option_label: string
  choices?: string[]
  is_required: boolean
}

interface DraftCustomOptionsEditorProps {
  options: DraftCustomOption[]
  onChange: (options: DraftCustomOption[]) => void
  disabled?: boolean
}

const MAX_OPTIONS = 4

export function DraftCustomOptionsEditor({
  options,
  onChange,
  disabled = false,
}: DraftCustomOptionsEditorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTempId, setEditingTempId] = useState<string | null>(null)
  const [newChoice, setNewChoice] = useState('')

  const editingOption = useMemo(
    () => options.find((o) => o.tempId === editingTempId) ?? null,
    [editingTempId, options]
  )

  const form = useForm<DraftOptionFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(draftOptionSchema) as any,
    defaultValues: {
      option_type: 'boolean',
      option_label: '',
      choices: [],
      is_required: false,
    },
  })

  const optionType = useWatch({ control: form.control, name: 'option_type' })
  const choices = useWatch({ control: form.control, name: 'choices' }) || []

  const openCreate = () => {
    setEditingTempId(null)
    setNewChoice('')
    form.reset({
      option_type: 'boolean',
      option_label: '',
      choices: [],
      is_required: false,
    })
    setIsDialogOpen(true)
  }

  const openEdit = (tempId: string) => {
    const target = options.find((opt) => opt.tempId === tempId)
    if (!target) return

    setEditingTempId(tempId)
    setNewChoice('')
    form.reset({
      option_type: target.option_type,
      option_label: target.option_label,
      choices: target.choices || [],
      is_required: target.is_required,
    })
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingTempId(null)
    setNewChoice('')
    form.reset()
  }

  const addChoice = () => {
    if (!newChoice.trim() || choices.length >= 10) return
    form.setValue('choices', [...choices, newChoice.trim()])
    setNewChoice('')
  }

  const removeChoice = (index: number) => {
    form.setValue(
      'choices',
      choices.filter((_, i) => i !== index),
      { shouldValidate: true }
    )
  }

  const handleDelete = (tempId: string) => {
    onChange(options.filter((opt) => opt.tempId !== tempId))
  }

  const onSubmit = (data: DraftOptionFormData) => {
    const cleaned: DraftCustomOption = {
      tempId: editingTempId ?? crypto.randomUUID(),
      option_type: data.option_type,
      option_label: data.option_label,
      choices: data.option_type === 'multi_select' ? data.choices : undefined,
      is_required: data.is_required,
    }

    if (editingTempId) {
      onChange(
        options.map((opt) => (opt.tempId === editingTempId ? cleaned : opt))
      )
    } else {
      onChange([...options, cleaned])
    }

    closeDialog()
  }

  const getOptionTypeBadge = (type: DraftCustomOption['option_type']) => {
    const variants = {
      boolean: 'default',
      multi_select: 'secondary',
      text_input: 'outline',
    } as const

    const labels = {
      boolean: 'Yes/No',
      multi_select: 'Multiple Choice',
      text_input: 'Text Input',
    } as const

    return <Badge variant={variants[type]}>{labels[type]}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <CardTitle>Custom Options</CardTitle>
            <CardDescription>
              Configure options now and we will save them with this package (
              {options.length}/{MAX_OPTIONS} used)
            </CardDescription>
          </div>
          <Button
            type='button'
            size='sm'
            onClick={openCreate}
            disabled={disabled || options.length >= MAX_OPTIONS}
          >
            <Plus className='mr-2 h-4 w-4' />
            Add Option
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {options.length === 0 ? (
          <div className='text-muted-foreground py-6 text-sm'>
            Add options like dietary restrictions, t-shirt sizes, or
            accessibility notes.
          </div>
        ) : (
          <div className='space-y-3'>
            {options.map((option) => (
              <div
                key={option.tempId}
                className='hover:bg-muted/30 flex items-start gap-3 rounded-lg border p-4 transition-colors'
              >
                <div className='min-w-0 flex-1'>
                  <div className='mb-1 flex flex-wrap items-center gap-2'>
                    <h4 className='font-medium'>{option.option_label}</h4>
                    {option.is_required ? (
                      <Badge variant='destructive' className='text-xs'>
                        Required
                      </Badge>
                    ) : null}
                    {getOptionTypeBadge(option.option_type)}
                  </div>
                  {option.option_type === 'multi_select' &&
                  option.choices?.length ? (
                    <div className='mt-2 flex flex-wrap gap-1'>
                      {option.choices.map((choice, idx) => (
                        <Badge key={idx} variant='outline' className='text-xs'>
                          {choice}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => openEdit(option.tempId)}
                    disabled={disabled}
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => handleDelete(option.tempId)}
                    disabled={disabled}
                  >
                    <Trash2 className='h-4 w-4 text-red-600' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingOption ? 'Edit Custom Option' : 'Create Custom Option'}
            </DialogTitle>
            <DialogDescription>
              This option will be created automatically when you save the
              package.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='option_type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select option type' />
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
                      <Input placeholder='e.g., Meal Preference' {...field} />
                    </FormControl>
                    <FormDescription>
                      The prompt shown to purchasers.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {optionType === 'multi_select' ? (
                <div className='space-y-3'>
                  <FormLabel>Choices</FormLabel>
                  <div className='flex gap-2'>
                    <Input
                      placeholder='Add a choice'
                      value={newChoice}
                      onChange={(e) => setNewChoice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addChoice()
                        }
                      }}
                    />
                    <Button
                      type='button'
                      size='sm'
                      onClick={addChoice}
                      disabled={!newChoice.trim() || choices.length >= 10}
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
                  <p className='text-muted-foreground text-sm'>
                    Add up to 10 choices ({choices.length}/10)
                  </p>
                  {form.formState.errors.choices ? (
                    <p className='text-destructive text-sm'>
                      {form.formState.errors.choices.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <FormField
                control={form.control}
                name='is_required'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>Required</FormLabel>
                      <FormDescription>
                        Purchasers must provide a response.
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
                <Button type='button' variant='outline' onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type='submit'>
                  {editingOption ? 'Update Option' : 'Add Option'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
