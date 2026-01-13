/**
 * Ticket Package Management - Index Page
 * Lists all ticket packages for an event with CRUD operations
 */

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PromoCodesManager } from '@/components/PromoCodesManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Eye, EyeOff, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PurchasersList } from './components/PurchasersList';
import { SalesExportButton } from './components/SalesExportButton';
import { SalesSummaryCard } from './components/SalesSummaryCard';

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

export function TicketPackagesIndexPage() {
  const { eventId } = useParams({ from: '/_authenticated/events/$eventId/tickets/' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDisabled, setShowDisabled] = useState(false);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const togglePackageExpand = (packageId: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  };

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

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (packageIds: string[]) => {
      const response = await apiClient.post(
        `/admin/events/${eventId}/packages/reorder`,
        { package_ids: packageIds }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-packages', eventId] });
      toast({
        title: 'Order updated',
        description: 'Package order has been updated successfully.',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['ticket-packages', eventId] });
      toast({
        title: 'Reorder failed',
        description: error.response?.data?.detail || 'Failed to reorder packages',
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !packages) {
      return;
    }

    const oldIndex = packages.findIndex((pkg) => pkg.id === active.id);
    const newIndex = packages.findIndex((pkg) => pkg.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Create new order
    const reorderedPackages = [...packages];
    const [movedPackage] = reorderedPackages.splice(oldIndex, 1);
    reorderedPackages.splice(newIndex, 0, movedPackage);

    // Optimistic update
    queryClient.setQueryData(
      ['ticket-packages', eventId, showDisabled],
      reorderedPackages
    );

    // Call API
    const newOrder = reorderedPackages.map((pkg) => pkg.id);
    reorderMutation.mutate(newOrder);
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

      {/* Sales Summary */}
      <div className="mb-6">
        <SalesSummaryCard eventId={eventId} />
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
            <div className="flex gap-2">
              <SalesExportButton eventId={eventId} eventName="Event" />
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={packages.map((pkg) => pkg.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {packages.map((pkg) => {
                    const isExpanded = expandedPackages.has(pkg.id);

                    return (
                      <SortablePackageCard
                        key={pkg.id}
                        pkg={pkg}
                        isExpanded={isExpanded}
                        onToggleExpand={togglePackageExpand}
                        onDelete={handleDelete}
                        onEdit={() =>
                          navigate({
                            to: '/events/$eventId/tickets/$packageId/edit',
                            params: { eventId, packageId: pkg.id },
                          })
                        }
                        deleteMutation={deleteMutation}
                        eventId={eventId}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
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

// Sortable Package Card Component
interface SortablePackageCardProps {
  pkg: TicketPackage;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onDelete: (pkg: TicketPackage) => void;
  onEdit: () => void;
  deleteMutation: {
    isPending: boolean;
    mutate: (id: string) => void;
  };
  eventId: string;
}

function SortablePackageCard({
  pkg,
  isExpanded,
  onToggleExpand,
  onDelete,
  onEdit,
  deleteMutation,
  eventId,
}: SortablePackageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pkg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={!pkg.is_enabled ? 'opacity-60' : ''}
    >
      <CardHeader>
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <button
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-5 w-5" />
          </button>

          <div className="flex-1">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{pkg.name}</CardTitle>
              <div className="flex gap-1">
                {pkg.is_sponsorship && (
                  <Badge variant="secondary">Sponsorship</Badge>
                )}
                {!pkg.is_enabled && (
                  <Badge variant="secondary">Disabled</Badge>
                )}
                {pkg.is_sold_out && (
                  <Badge variant="destructive">Sold Out</Badge>
                )}
                {!pkg.quantity_limit && (
                  <Badge variant="outline">Unlimited</Badge>
                )}
                {pkg.sold_count > 0 && !pkg.is_sold_out && (
                  <Badge variant="default">{pkg.sold_count} Sold</Badge>
                )}
              </div>
            </div>
            <CardDescription>
              {pkg.description?.substring(0, 100)}
              {pkg.description && pkg.description.length > 100 ? '...' : ''}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Image thumbnail */}
        {pkg.image_url && (
          <div className="mb-4">
            <img
              src={pkg.image_url}
              alt={pkg.name}
              className="w-full h-32 object-cover rounded-md border border-gray-200"
            />
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Price:</span>
            <span className="font-semibold">${pkg.price}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Seats per package:</span>
            <span>{pkg.seats_per_package}</span>
          </div>

          {/* Availability with progress bar */}
          {pkg.quantity_limit !== null ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Availability:</span>
                <span className="font-medium">
                  {pkg.available_quantity} / {pkg.quantity_limit}
                </span>
              </div>
              <Progress
                value={(pkg.sold_count / pkg.quantity_limit) * 100}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{pkg.sold_count} sold</span>
                <span>
                  {pkg.is_sold_out
                    ? 'Sold out'
                    : `${pkg.available_quantity} remaining`}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sold:</span>
              <span>{pkg.sold_count} packages</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onEdit}
          >
            <Pencil className="mr-2 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(pkg)}
            disabled={pkg.sold_count > 0 || deleteMutation.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Expandable Sales Details */}
        {pkg.sold_count > 0 && (
          <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(pkg.id)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                {isExpanded ? 'Hide' : 'Show'} Purchasers
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <PurchasersList
                eventId={eventId}
                packageId={pkg.id}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
