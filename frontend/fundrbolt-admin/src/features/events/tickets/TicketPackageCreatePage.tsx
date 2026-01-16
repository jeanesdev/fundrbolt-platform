/**
 * Ticket Package Management - Create Page
 * Form for creating new ticket packages
 */

import { packageImagesApi } from '@/api/packageImages';
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
import { getErrorMessage } from '@/lib/error-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ImageUploadProgress } from './components/ImageUploadProgress';
import { ImageUploadZone } from './components/ImageUploadZone';

const packageSchema = z.object({
  name: z.string().min(1, 'Package name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional().nullable(),
  price: z.string()
    .min(1, 'Price is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid number (e.g., 50.00)'),
  seats_per_package: z.coerce.number({
    message: 'Seats per package is required and must be a number',
  }).min(1, 'Must have at least 1 seat').max(100, 'Maximum 100 seats per package'),
  quantity_limit: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.coerce.number({
      message: 'Quantity must be a number',
    }).min(1, 'Quantity must be at least 1').nullable().optional()
  ),
  is_enabled: z.boolean().default(true),
  is_sponsorship: z.boolean().default(false),
});

type PackageFormData = z.infer<typeof packageSchema>;

export function TicketPackageCreatePage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/tickets/create' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [createdPackageId, setCreatedPackageId] = useState<string | null>(null);

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      price: '0.00',
      seats_per_package: 1,
      quantity_limit: null,
      is_enabled: true,
      is_sponsorship: false,
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
    onSuccess: (pkg) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-packages', eventId] });
      setCreatedPackageId(pkg.id);

      // If file selected, upload image before navigating
      if (selectedFile) {
        setUploadStatus('uploading');
        setUploadProgress(0);
      } else {
        toast({
          title: 'Package created',
          description: 'You can now add custom options and finalize your package.',
        });
        navigate({
          to: '/events/$eventId/tickets/$packageId/edit',
          params: { eventId, packageId: pkg.id },
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Creation failed',
        description: getErrorMessage(error, 'Failed to create package'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PackageFormData) => {
    createMutation.mutate(data);
  };

  // Upload image after package creation
  const imageUploadMutation = useMutation({
    mutationFn: async () => {
      if (!createdPackageId || !selectedFile) return;

      const response = await packageImagesApi.uploadImage(
        eventId,
        createdPackageId,
        selectedFile,
        (progress) => setUploadProgress(progress)
      );
      return response;
    },
    onSuccess: () => {
      setUploadStatus('success');
      setUploadProgress(100);
      toast({
        title: 'Image uploaded',
        description: 'You can now add custom options and finalize your package.',
      });
      setTimeout(() => {
        navigate({
          to: '/events/$eventId/tickets/$packageId/edit',
          params: { eventId, packageId: createdPackageId },
        });
      }, 1500);
    },
    onError: (error) => {
      setUploadStatus('error');
      toast({
        title: 'Image upload failed',
        description: getErrorMessage(error, 'Failed to upload image'),
        variant: 'destructive',
      });
    },
  });

  // Trigger image upload after package creation
  const handleImageFile = (file: File) => {
    setSelectedFile(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview((reader.result as string | null) ?? '');
    };
    reader.readAsDataURL(file);
  };

  // Handle navigation after image upload
  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setUploadProgress(0);
    setUploadStatus('idle');
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
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Package Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., VIP Table, General Admission"
                        {...field}
                        className={fieldState.error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
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
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Price (USD) *</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="0.00"
                          {...field}
                          className={fieldState.error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                      </FormControl>
                      <FormDescription>Price per package (e.g., 50.00)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seats_per_package"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Seats per Package *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          {...field}
                          className={fieldState.error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
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
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Quantity Limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        {...field}
                        value={field.value || ''}
                        className={fieldState.error ? 'border-red-500 focus-visible:ring-red-500' : ''}
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
                        checked={field.value ?? false}
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
                      <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-lg border p-4 bg-blue-50">
                <div>
                  <FormLabel className="text-base">Package Image</FormLabel>
                  <FormDescription className="mt-1">
                    Add a visual image for your package (optional)
                  </FormDescription>
                </div>

                {uploadStatus === 'idle' || uploadStatus === 'success' ? (
                  <ImageUploadZone
                    onFileSelected={handleImageFile}
                    disabled={createMutation.isPending}
                    preview={imagePreview}
                    onRemovePreview={handleRemoveImage}
                  />
                ) : null}

                {uploadStatus !== 'idle' && (
                  <ImageUploadProgress
                    progress={uploadProgress}
                    status={uploadStatus === 'uploading' ? 'uploading' : uploadStatus === 'success' ? 'success' : 'error'}
                    fileName={selectedFile?.name}
                  />
                )}
              </div>

              {/* Custom Options Preview (Disabled) */}
              <div className="mt-6 pt-6 border-t">
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-muted-foreground">
                      Custom Options
                    </CardTitle>
                    <CardDescription>
                      Add custom fields like "Dietary Restrictions" or "T-Shirt Size" after creating the package.
                      You'll be able to manage these options on the edit page.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50"></div>
                        <span>Add up to 4 custom fields</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50"></div>
                        <span>Choose from boolean, multi-select, or text input types</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50"></div>
                        <span>Mark fields as required or optional</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2 mt-6">
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
                <Button type="submit" disabled={createMutation.isPending || uploadStatus === 'uploading'}>
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
