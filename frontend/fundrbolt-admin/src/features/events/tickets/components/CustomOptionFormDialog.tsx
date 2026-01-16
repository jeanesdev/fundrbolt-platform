/**
 * CustomOptionFormDialog
 * Dialog form for creating and editing custom ticket options
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import apiClient from '@/lib/axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const optionSchema = z.object({
  option_type: z.enum(['boolean', 'multi_select', 'text_input']),
  option_label: z.string().min(1, 'Label is required').max(100, 'Label too long'),
  choices: z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  display_order: z.number().optional(),
});

type OptionFormData = z.infer<typeof optionSchema>;

interface CustomOption {
  id: string;
  ticket_package_id: string;
  option_type: 'boolean' | 'multi_select' | 'text_input';
  option_label: string;
  choices?: string[];
  is_required: boolean;
  display_order: number;
  created_at: string;
}

interface CustomOptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  eventId?: string;
  mode: 'create' | 'edit';
  option?: CustomOption;
}

export function CustomOptionFormDialog({
  open,
  onOpenChange,
  packageId,
  mode,
  option,
}: CustomOptionFormDialogProps) {
  const queryClient = useQueryClient();
  const [newChoice, setNewChoice] = useState('');

  const form = useForm<OptionFormData>({
    resolver: zodResolver(optionSchema) as any,
    defaultValues: {
      option_type: option?.option_type || 'boolean',
      option_label: option?.option_label || '',
      choices: option?.choices || [],
      is_required: option?.is_required ?? false,
      display_order: option?.display_order,
    },
  });

  const optionType = form.watch('option_type');
  const choices = form.watch('choices') || [];

  // Reset form when dialog opens/closes or option changes
  useEffect(() => {
    if (open && option) {
      form.reset({
        option_type: option.option_type,
        option_label: option.option_label,
        choices: option.choices || [],
        is_required: option.is_required,
        display_order: option.display_order,
      });
    } else if (open && !option) {
      form.reset({
        option_type: 'boolean',
        option_label: '',
        choices: [],
        is_required: false,
      });
    }
  }, [open, option, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: OptionFormData) => {
      const response = await apiClient.post(`/admin/packages/${packageId}/options`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-options', packageId] });
      toast.success('Custom option has been created successfully.');
      onOpenChange(false);
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail;
      if (detail?.includes('maximum')) {
        toast.error('Maximum 4 options per package allowed.');
      } else {
        toast.error(detail || 'Failed to create option');
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: OptionFormData) => {
      const response = await apiClient.patch(
        `/admin/packages/${packageId}/options/${option?.id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-options', packageId] });
      toast.success('Custom option has been updated successfully.');
      onOpenChange(false);
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail;
      if (detail?.includes('responses')) {
        toast.error('This option has responses and cannot be modified.');
      } else {
        toast.error(detail || 'Failed to update option');
      }
    },
  });

  const onSubmit = (data: OptionFormData) => {
    // Clean up choices for non-multi_select types
    const submitData = {
      ...data,
      choices: data.option_type === 'multi_select' ? data.choices : undefined,
    };

    if (mode === 'create') {
      createMutation.mutate(submitData);
    } else {
      updateMutation.mutate(submitData);
    }
  };

  const addChoice = () => {
    if (newChoice.trim() && choices.length < 10) {
      form.setValue('choices', [...choices, newChoice.trim()]);
      setNewChoice('');
    }
  };

  const removeChoice = (index: number) => {
    form.setValue(
      'choices',
      choices.filter((_, i) => i !== index)
    );
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Custom Option' : 'Edit Custom Option'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a custom field that purchasers will fill out when buying tickets.'
              : 'Update the custom option details. Note: Options with responses cannot be modified.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Option Type */}
            <FormField
              control={form.control}
              name="option_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Option Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={mode === 'edit'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select option type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="boolean">Yes/No Question</SelectItem>
                      <SelectItem value="multi_select">Multiple Choice</SelectItem>
                      <SelectItem value="text_input">Text Input</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {mode === 'edit' && 'Type cannot be changed after creation'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Label */}
            <FormField
              control={form.control}
              name="option_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Meal Preference" {...field} />
                  </FormControl>
                  <FormDescription>
                    The question or prompt shown to purchasers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Choices (for multi_select only) */}
            {optionType === 'multi_select' && (
              <div className="space-y-3">
                <FormLabel>Choices</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a choice"
                    value={newChoice}
                    onChange={(e) => setNewChoice(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChoice();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addChoice}
                    disabled={!newChoice.trim() || choices.length >= 10}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {choices.map((choice, index) => (
                    <Badge key={index} variant="secondary" className="pl-2 pr-1">
                      {choice}
                      <button
                        type="button"
                        onClick={() => removeChoice(index)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                {choices.length === 0 && (
                  <p className="text-sm text-destructive">
                    At least one choice is required
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Add up to 10 choices ({choices.length}/10)
                </p>
              </div>
            )}

            {/* Required Toggle */}
            <FormField
              control={form.control}
              name="is_required"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Required</FormLabel>
                    <FormDescription>
                      Purchasers must provide a response to this option
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === 'create'
                    ? 'Creating...'
                    : 'Updating...'
                  : mode === 'create'
                    ? 'Create Option'
                    : 'Update Option'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
