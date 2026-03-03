/**
 * AuctionItemsIndexPage
 * Page for listing all auction items for an event
 */

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuctionItemList } from '@/features/events/components/AuctionItemList';
import { useAuctionItemStore } from '@/stores/auctionItemStore';
import type { AuctionItem } from '@/types/auction-item';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function AuctionItemsIndexPage() {
  const navigate = useNavigate();
  const { eventSlug } = useParams({
    from: '/_authenticated/events/$eventSlug/auction-items/',
  });

  const { items, isLoading, error, fetchAuctionItems, deleteAuctionItem } =
    useAuctionItemStore();

  useEffect(() => {
    if (eventSlug) {
      fetchAuctionItems(eventSlug).catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load auction items'
        );
      });
    }
  }, [eventSlug, fetchAuctionItems]);

  const handleAdd = () => {
    navigate({
      to: '/events/$eventSlug/auction-items/create',
      params: { eventSlug },
    });
  };

  const handleEdit = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventSlug/auction-items/$itemId/edit',
      params: { eventSlug, itemId: item.id },
    });
  };

  const handleView = (item: AuctionItem) => {
    navigate({
      to: '/events/$eventSlug/auction-items/$itemId',
      params: { eventSlug, itemId: item.id },
    });
  };

  const handleDelete = async (item: AuctionItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${item.title}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteAuctionItem(eventSlug, item.id);
      toast.success('Auction item deleted successfully');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete auction item'
      );
    }
  };

  const handleBack = () => {
    navigate({ to: '/events/$eventSlug/edit', params: { eventSlug } });
  };

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-6xl">
      <div className="mb-4 md:mb-6 space-y-4">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 hover:bg-transparent"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Event
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Auction Items</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
              Manage auction items for this event
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Auction Items</CardTitle>
          <CardDescription>
            Live and silent auction items available for bidding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionItemList
            items={items}
            isLoading={isLoading}
            error={error}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
          />
        </CardContent>
      </Card>
    </div>
  );
}
