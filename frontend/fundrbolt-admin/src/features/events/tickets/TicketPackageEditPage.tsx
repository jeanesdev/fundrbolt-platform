/**
 * Ticket Package Management - Edit Page
 * Form for editing existing ticket packages with optimistic locking
 */

import { packageImagesApi } from '@/api/packageImages';
import { ConflictDialog } from '@/components/ConflictDialog';
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
import apiClient from '@/lib/axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CustomOptionsManager } from './components/CustomOptionsManager';
import { ImageUploadProgress } from './components/ImageUploadProgress';
import { ImageUploadZone } from './components/ImageUploadZone';

const packageSchema = z.object({
  name: z.string().min(1, 'Package name is required').max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format').optional(),
  seats_per_package: z.coerce.number().min(1).max(100).optional(),
  quantity_limit: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.coerce.number().min(1).nullable().optional()
  ),
  is_enabled: z.boolean().optional(),
  is_sponsorship: z.boolean().optional(),
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
  is_sponsorship?: boolean;
}

export function TicketPackageEditPage() {
  const { eventId, packageId } = useParams({
    from: '/_authenticated/events/$eventId/tickets/$packageId/edit',
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

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

  // Set initial image preview from package
  const handleSetInitialImage = () => {
    if (pkg?.image_url && !imagePreview) {
      setImagePreview(pkg.image_url);
    }
  };

  handleSetInitialImage();

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
        is_sponsorship: pkg.is_sponsorship,
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
    onError: (error: Error & { response?: { status?: number; data?: { detail?: string } } }) => {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // Handle 409 Conflict - concurrent edit
      if (status === 409 || detail?.includes('Version mismatch')) {
        setShowConflictDialog(true);
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

  const imageUploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return;

      const response = await packageImagesApi.uploadImage(
        eventId,
        packageId,
        selectedFile,
        (progress) => setUploadProgress(progress)
      );
      return response;
    },
    onSuccess: () => {
      setUploadStatus('success');
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ['ticket-package', eventId, packageId] });
      toast({
        title: 'Image uploaded',
        description: 'Package image has been uploaded successfully.',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setUploadStatus('error');
      toast({
        title: 'Image upload failed',
        description: error.response?.data?.detail || 'Failed to upload image',
        variant: 'destructive',
      });
    },
  });

  const imageDeleteMutation = useMutation({
    mutationFn: async () => {
      const response = await packageImagesApi.deleteImage(eventId, packageId);
      return response;
    },
    onSuccess: () => {
      setImagePreview(null);
      setSelectedFile(null);
      setUploadProgress(0);
      setUploadStatus('idle');
      queryClient.invalidateQueries({ queryKey: ['ticket-package', eventId, packageId] });
      toast({
        title: 'Image deleted',
        description: 'Package image has been removed.',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast({
        title: 'Delete failed',
        description: error.response?.data?.detail || 'Failed to delete image',
        variant: 'destructive',
      });
    },
  });

  const handleImageFile = (file: File) => {
    setSelectedFile(file);
    setUploadStatus('uploading');
    setUploadProgress(0);
    // Trigger upload immediately
    imageUploadMutation.mutate();
  };

  const handleRemoveImage = () => {
    if (imagePreview && !imagePreview.startsWith('blob:')) {
      // Remove from server
      imageDeleteMutation.mutate();
    } else {
      // Just reset local state
      setImagePreview(null);
      setSelectedFile(null);
      setUploadProgress(0);
      setUploadStatus('idle');
    }
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

              <FormField
                control={form.control}
                name="is_sponsorship"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Sponsorship Package</FormLabel>
                      <FormDescription>
                        Mark this package as a sponsorship for reporting
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-lg border p-4 bg-blue-50">
                <div>
                  <FormLabel className="text-base">Package Image</FormLabel>
                  <FormDescription className="mt-1">
                    Upload or update your package image
                  </FormDescription>
                </div>

                {uploadStatus === 'idle' || uploadStatus === 'success' ? (
                  <ImageUploadZone
                    onFileSelected={handleImageFile}
                    disabled={updateMutation.isPending || imageUploadMutation.isPending || imageDeleteMutation.isPending}
                    preview={imagePreview}
                    onRemovePreview={handleRemoveImage}
                  />
                ) : null}

                {uploadStatus !== 'idle' && (
                  <ImageUploadProgress
                    progress={uploadProgress}
                    status={uploadStatus}
                    fileName={selectedFile?.name}
                  />
                )}
              </div>

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
                <Button type="submit" disabled={updateMutation.isPending || uploadStatus === 'uploading'}>
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

      {/* Conflict Dialog for concurrent edits */}
      <ConflictDialog
        isOpen={showConflictDialog}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['ticket-package', eventId, packageId] });
          setShowConflictDialog(false);
          // Reset form to latest values
          form.reset();
        }}
        onCancel={() => {
          setShowConflictDialog(false);
          navigate({
            to: '/events/$eventId/tickets',
            params: { eventId },
          });
        }}
      />
    </div>
  );
}
