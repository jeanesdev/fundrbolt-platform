/**
 * CustomOptionsManager
 * Component for managing custom ticket options (create, edit, delete, reorder)
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import apiClient from '@/lib/apiClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CustomOptionFormDialog } from './CustomOptionFormDialog';

interface CustomOption {
  id: string;
  package_id: string;
  option_type: 'boolean' | 'multi_select' | 'text_input';
  label: string;
  description?: string;
  choices?: string[];
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface CustomOptionsManagerProps {
  packageId: string;
  eventId?: string;
}

export function CustomOptionsManager({ packageId }: CustomOptionsManagerProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<CustomOption | null>(null);

  // Fetch options
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['custom-options', packageId],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/packages/${packageId}/options`);
      return response.data as CustomOption[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      await apiClient.delete(`/admin/packages/${packageId}/options/${optionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-options', packageId] });
      toast({
        title: 'Option deleted',
        description: 'Custom option has been deleted successfully.',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail;
      if (detail?.includes('responses')) {
        toast({
          title: 'Cannot delete',
          description: 'This option has responses and cannot be deleted.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Delete failed',
          description: detail || 'Failed to delete option',
          variant: 'destructive',
        });
      }
    },
  });

  const handleDelete = (option: CustomOption) => {
    if (confirm(`Delete "${option.label}"? This action cannot be undone.`)) {
      deleteMutation.mutate(option.id);
    }
  };

  const getOptionTypeBadge = (type: string) => {
    const variants = {
      boolean: 'default',
      multi_select: 'secondary',
      text_input: 'outline',
    } as const;

    const labels = {
      boolean: 'Yes/No',
      multi_select: 'Multiple Choice',
      text_input: 'Text Input',
    } as const;

    return (
      <Badge variant={variants[type as keyof typeof variants]}>
        {labels[type as keyof typeof labels]}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canAddMore = options.length < 4;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Custom Options</CardTitle>
            <CardDescription>
              Add up to 4 custom options for this ticket package ({options.length}/4 used)
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            disabled={!canAddMore}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {options.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No custom options yet.</p>
            <p className="text-sm mt-2">
              Add options like meal preferences, t-shirt sizes, or dietary restrictions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {options.map((option) => (
              <div
                key={option.id}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="cursor-move pt-1">
                  <GripVertical className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{option.label}</h4>
                    {option.is_required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                    {getOptionTypeBadge(option.option_type)}
                  </div>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {option.description}
                    </p>
                  )}
                  {option.option_type === 'multi_select' && option.choices && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {option.choices.map((choice, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {choice}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingOption(option)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(option)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <CustomOptionFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        packageId={packageId}
        mode="create"
      />

      {/* Edit Dialog */}
      {editingOption && (
        <CustomOptionFormDialog
          open={!!editingOption}
          onOpenChange={(open) => !open && setEditingOption(null)}
          packageId={packageId}
          mode="edit"
          option={editingOption}
        />
      )}
    </Card>
  );
}
