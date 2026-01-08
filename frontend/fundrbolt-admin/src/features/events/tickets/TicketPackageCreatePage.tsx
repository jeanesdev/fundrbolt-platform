/**
 * Ticket Package Management - Create Page
 * Form for creating new ticket packages
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const packageSchema = z.object({
  name: z.string().min(1, 'Package name is required').max(100),
  description: z.string().max(5000).optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format'),
  seats_per_package: z.coerce.number().min(1).max(100),
  quantity_limit: z.coerce.number().min(1).optional().nullable(),
  is_enabled: z.boolean().default(true),
});

type PackageFormData = z.infer<typeof packageSchema>;

export function TicketPackageCreatePage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/tickets/create' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '0.00',
      seats_per_package: 1,
      quantity_limit: null,
      is_enabled: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const response = await apiClient.post(`/admin/events/${eventId}/packages`, {
        ...data,
        event_id: eventId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-packages', eventId] });
      toast({
        title: 'Package created',
        description: 'Ticket package has been created successfully.',
      });
      navigate({
        to: '/events/$eventId/tickets',
        params: { eventId },
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast({
        title: 'Creation failed',
        description: error.response?.data?.detail || 'Failed to create package',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PackageFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() =>
          navigate({
            to: '/events/$eventId/tickets',
            params: { eventId },
          })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Packages
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create Ticket Package</CardTitle>
          <CardDescription>
            Define a new ticket package with pricing and seat allocation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., VIP Table, General Admission" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for this ticket package (max 100 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what's included in this package..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional description of package benefits and inclusions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (USD) *</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription>Price per package</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seats_per_package"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seats per Package *</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="100" {...field} />
                      </FormControl>
                      <FormDescription>1-100 seats</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="quantity_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity Limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum packages available (leave empty for unlimited)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enabled</FormLabel>
                      <FormDescription>
                        Make this package visible to donors
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

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: '/events/$eventId/tickets',
                      params: { eventId },
                    })
                  }
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Package'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
