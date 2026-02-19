/**
 * BuyNowEditor Component
 * Allows editing buy-now availability and quantity for auction items
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { auctionEngagementService } from '@/services/auctionEngagementService';
import type { AuctionItem } from '@/types/auction-item';
import type { BuyNowAvailabilityUpdate } from '@/types/auction-engagement';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface BuyNowEditorProps {
  eventId: string;
  item: AuctionItem;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function BuyNowEditor({
  eventId,
  item,
  onCancel,
  onSuccess,
}: BuyNowEditorProps) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState<boolean>(item.buy_now_enabled);
  const [quantity, setQuantity] = useState<number>(item.quantity_available);
  const [overrideReason, setOverrideReason] = useState<string>('');

  useEffect(() => {
    setEnabled(item.buy_now_enabled);
    setQuantity(item.quantity_available);
  }, [item]);

  const updateBuyNowMutation = useMutation({
    mutationFn: (data: BuyNowAvailabilityUpdate) =>
      auctionEngagementService.updateBuyNowAvailability(eventId, item.id, data),
    onSuccess: () => {
      toast.success('Buy-now settings updated successfully');
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['auction-item', eventId, item.id] });
      queryClient.invalidateQueries({ queryKey: ['auction-items', eventId] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update buy-now settings'
      );
    },
  });

  const handleSave = () => {
    const data: BuyNowAvailabilityUpdate = {
      buy_now_enabled: enabled,
      quantity_available: quantity,
      override_reason: overrideReason.trim() || null,
    };
    updateBuyNowMutation.mutate(data);
  };

  const hasChanges =
    enabled !== item.buy_now_enabled ||
    quantity !== item.quantity_available;

  const isQuantityValid = quantity >= 0;
  const showLowQuantityWarning = enabled && quantity > 0 && quantity <= 3;
  const showZeroQuantityWarning = enabled && quantity === 0;

  return (
    <div className="space-y-4">
      {/* Buy Now Price Display */}
      {item.buy_now_price && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm">
            <span className="text-muted-foreground">Buy Now Price:</span>{' '}
            <span className="font-semibold">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(item.buy_now_price)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Edit price on the item details form
          </p>
        </div>
      )}

      {!item.buy_now_price && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No buy-now price set. Enable buy-now by editing the item and setting a buy-now price.
          </AlertDescription>
        </Alert>
      )}

      {/* Enable/Disable Switch */}
      <div className="flex items-center justify-between space-x-2 p-4 border rounded-md">
        <div className="space-y-0.5">
          <Label htmlFor="buy-now-enabled" className="text-base">
            Buy Now Enabled
          </Label>
          <p className="text-sm text-muted-foreground">
            Allow donors to purchase this item instantly
          </p>
        </div>
        <Switch
          id="buy-now-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={!item.buy_now_price}
        />
      </div>

      {/* Quantity Input */}
      <div className="space-y-2">
        <Label htmlFor="quantity">
          Quantity Available
        </Label>
        <Input
          id="quantity"
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
          className={!isQuantityValid ? 'border-destructive' : ''}
        />
        <p className="text-xs text-muted-foreground">
          Number of items available for purchase
        </p>
      </div>

      {/* Warnings */}
      {showZeroQuantityWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Quantity is zero. Buy-now will be disabled for donors even if enabled here.
          </AlertDescription>
        </Alert>
      )}

      {showLowQuantityWarning && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Low quantity warning: Only {quantity} item{quantity !== 1 ? 's' : ''} remaining
          </AlertDescription>
        </Alert>
      )}

      {/* Override Reason */}
      <div className="space-y-2">
        <Label htmlFor="override-reason">
          Override Reason <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="override-reason"
          placeholder="Reason for changing availability (internal notes)..."
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Internal notes about why availability was changed
        </p>
      </div>

      {/* Current Status */}
      <div className="p-3 bg-muted rounded-md">
        <p className="text-sm font-medium mb-2">Current Status</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buy-Now Enabled:</span>
            <span className={item.buy_now_enabled ? 'text-green-600' : 'text-red-600'}>
              {item.buy_now_enabled ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Quantity:</span>
            <span>{item.quantity_available}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || !isQuantityValid || updateBuyNowMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {updateBuyNowMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
