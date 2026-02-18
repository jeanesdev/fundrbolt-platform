/**
 * PromotionEditor Component
 * Allows editing promotion badge and notice for auction items
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { auctionEngagementService } from '@/services/auctionEngagementService';
import type { AuctionItem } from '@/types/auction-item';
import type { ItemPromotionUpdate } from '@/types/auction-engagement';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Save, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface PromotionEditorProps {
  eventId: string;
  item: AuctionItem;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function PromotionEditor({
  eventId,
  item,
  onCancel,
  onSuccess,
}: PromotionEditorProps) {
  const queryClient = useQueryClient();
  const [badge, setBadge] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Initialize form with current values
  useEffect(() => {
    // Check if item has promotion fields (they might not be in the base type yet)
    const itemWithPromotion = item as AuctionItem & {
      promotion_badge?: string | null;
      promotion_notice?: string | null;
    };
    setBadge(itemWithPromotion.promotion_badge || '');
    setNotice(itemWithPromotion.promotion_notice || '');
  }, [item]);

  const updatePromotionMutation = useMutation({
    mutationFn: (data: ItemPromotionUpdate) =>
      auctionEngagementService.updatePromotion(eventId, item.id, data),
    onSuccess: () => {
      toast.success('Promotion updated successfully');
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['auction-item', eventId, item.id] });
      queryClient.invalidateQueries({ queryKey: ['auction-items', eventId] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update promotion'
      );
    },
  });

  const handleSave = () => {
    const data: ItemPromotionUpdate = {
      promotion_badge: badge.trim() || null,
      promotion_notice: notice.trim() || null,
    };
    updatePromotionMutation.mutate(data);
  };

  const handleClear = () => {
    setBadge('');
    setNotice('');
  };

  const badgeLength = badge.length;
  const noticeLength = notice.length;
  const isBadgeTooLong = badgeLength > 50;
  const isNoticeTooLong = noticeLength > 1000;
  const isValid = !isBadgeTooLong && !isNoticeTooLong;

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="badge">
            Promotion Badge <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="badge"
            placeholder="e.g., Hot Item, Super Deal, Featured"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            maxLength={60}
            className={isBadgeTooLong ? 'border-destructive' : ''}
          />
          <div className="flex justify-between items-center text-xs">
            <span
              className={
                isBadgeTooLong ? 'text-destructive' : 'text-muted-foreground'
              }
            >
              {badgeLength}/50 characters
            </span>
            {isBadgeTooLong && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Too long
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notice">
            Promotion Notice <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="notice"
            placeholder="Special message shown to donors about this item..."
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            maxLength={1100}
            rows={4}
            className={isNoticeTooLong ? 'border-destructive' : ''}
          />
          <div className="flex justify-between items-center text-xs">
            <span
              className={
                isNoticeTooLong ? 'text-destructive' : 'text-muted-foreground'
              }
            >
              {noticeLength}/1000 characters
            </span>
            {isNoticeTooLong && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Too long
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {badge && (
              <div>
                <Badge variant="default" className="font-semibold">
                  {badge}
                </Badge>
              </div>
            )}
            {notice && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {notice}
              </p>
            )}
            {!badge && !notice && (
              <p className="text-sm text-muted-foreground italic">
                No promotion set. Add a badge or notice above to see preview.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center gap-2">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={!badge && !notice}
        >
          Clear All
        </Button>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isValid || updatePromotionMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updatePromotionMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
