/**
 * Ticket Package Management - Index Page
 * Lists all ticket packages for an event with CRUD operations
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PromoCodesManager } from '@/components/PromoCodesManager';

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
}

export function TicketPackagesIndexPage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/tickets/' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDisabled, setShowDisabled] = useState(false);

  // Fetch packages
  const { data: packages, isLoading } = useQuery({
    queryKey: ['ticket-packages', eventId, showDisabled],
    queryFn: async () => {
      const response = await apiClient.get<TicketPackage[]>(
        `/admin/events/${eventId}/packages`,
        {
          params: { include_disabled: showDisabled },
        }
      );
      return response.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (packageId: string) => {
      await apiClient.delete(`/admin/events/${eventId}/packages/${packageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-packages', eventId] });
      toast({
        title: 'Package deleted',
        description: 'Ticket package has been deleted successfully.',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast({
        title: 'Delete failed',
        description: error.response?.data?.detail || 'Failed to delete package',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (pkg: TicketPackage) => {
    if (pkg.sold_count > 0) {
      toast({
        title: 'Cannot delete',
        description: `This package has ${pkg.sold_count} tickets sold.`,
        variant: 'destructive',
      });
      return;
    }

    if (confirm(`Delete "${pkg.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(pkg.id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ticket Management</h1>
          <p className="text-muted-foreground">Manage ticket packages and promo codes for this event</p>
        </div>
      </div>

      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList>
          <TabsTrigger value="packages">Ticket Packages</TabsTrigger>
          <TabsTrigger value="promos">Promo Codes</TabsTrigger>
        </TabsList>

        {/* Ticket Packages Tab */}
        <TabsContent value="packages" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDisabled(!showDisabled)}
              >
                {showDisabled ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                {showDisabled ? 'Hide Disabled' : 'Show Disabled'}
              </Button>
            </div>
            <Button
              onClick={() =>
                navigate({
                  to: '/events/$eventId/tickets/create',
                  params: { eventId },
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              New Package
            </Button>
          </div>

          {!packages || packages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No ticket packages yet</p>
                <Button
                  onClick={() =>
                    navigate({
                      to: '/events/$eventId/tickets/create',
                      params: { eventId },
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Package
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card key={pkg.id} className={!pkg.is_enabled ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <div className="flex gap-1">
                        {!pkg.is_enabled && (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                        {pkg.sold_count > 0 && (
                          <Badge variant="default">{pkg.sold_count} Sold</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      {pkg.description?.substring(0, 100)}
                      {pkg.description && pkg.description.length > 100 ? '...' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-semibold">${pkg.price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Seats per package:</span>
                        <span>{pkg.seats_per_package}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available:</span>
                        <span>
                          {pkg.quantity_limit
                            ? `${pkg.quantity_limit - pkg.sold_count} / ${pkg.quantity_limit}`
                            : 'Unlimited'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          navigate({
                            to: '/events/$eventId/tickets/$packageId/edit',
                            params: { eventId, packageId: pkg.id },
                          })
                        }
                      >
                        <Pencil className="mr-2 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(pkg)}
                        disabled={pkg.sold_count > 0 || deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Promo Codes Tab */}
        <TabsContent value="promos">
          <PromoCodesManager eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
