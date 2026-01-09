/**
 * Ticket Package Management - Edit Page
 * Form for editing existing ticket packages with optimistic locking
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CustomOptionsManager } from './components/CustomOptionsManager';

const packageSchema = z.object({
  name: z.string().min(1, 'Package name is required').max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format').optional(),
  seats_per_package: z.coerce.number().min(1).max(100).optional(),
  quantity_limit: z.coerce.number().min(1).optional().nullable(),
  is_enabled: z.boolean().optional(),
  version: z.number(),
});

type PackageFormData = z.infer<typeof packageSchema>;

interface TicketPackage {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: string;
  seats_per_package: number;
  quantity_limit: number | null;
  sold_count: number;
  display_order: number;
  image_url: string | null;
  is_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  is_sold_out: boolean;
  available_quantity: number | null;
}

export function TicketPackageEditPage() {
  const { eventId, packageId } = useParams({
    from: '/_authenticated/events/$eventId/tickets/$packageId/edit',
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch package
  const { data: pkg, isLoading } = useQuery({
    queryKey: ['ticket-package', eventId, packageId],
    queryFn: async () => {
      const response = await apiClient.get<TicketPackage>(
        `/admin/events/${eventId}/packages/${packageId}`
      );
      return response.data;
    },
  });

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    values: pkg
      ? {
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        seats_per_package: pkg.seats_per_package,
        quantity_limit: pkg.quantity_limit,
        is_enabled: pkg.is_enabled,
        version: pkg.version,
      }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const response = await apiClient.patch(
        `/admin/events/${eventId}/packages/${packageId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-packages', eventId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-package', eventId, packageId] });
      toast({
        title: 'Package updated',
        description: 'Ticket package has been updated successfully.',
      });
      navigate({
        to: '/events/$eventId/tickets',
        params: { eventId },
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail;
      if (detail?.includes('Version mismatch')) {
        toast({
          title: 'Conflict detected',
          description: 'Package was modified by another user. Please refresh and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Update failed',
          description: detail || 'Failed to update package',
          variant: 'destructive',
        });
      }
    },
  });

  const onSubmit = (data: PackageFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Package not found</p>
            <Button
              className="mt-4"
              onClick={() =>
                navigate({
                  to: '/events/$eventId/tickets',
                  params: { eventId },
                })
              }
            >
              Back to Packages
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <CardTitle>Edit Ticket Package</CardTitle>
          <CardDescription>
            Update package details (sold: {pkg.sold_count})
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
                    <FormLabel>Package Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., VIP Table, General Admission" {...field} />
                    </FormControl>
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
                        placeholder="Describe what's included..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
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
                      <FormLabel>Price (USD)</FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seats_per_package"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seats per Package</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="100" {...field} />
                      </FormControl>
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
                        min={pkg.sold_count}
                        placeholder="Unlimited"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Cannot reduce below sold count ({pkg.sold_count})
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
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Custom Options Section */}
      <div className="mt-6">
        <CustomOptionsManager packageId={packageId} eventId={eventId} />
      </div>
    </div>
  );
}
