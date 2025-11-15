/**
 * AuctionItemForm
 * Form for creating or editing an auction item
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import auctionItemMediaService from '@/services/auctionItemMediaService';
import {
  AuctionType,
  type AuctionItem,
  type AuctionItemCreate,
  type AuctionItemMedia,
  type AuctionItemUpdate,
} from '@/types/auction-item';
import { useEffect, useState } from 'react';
import { MediaGallery } from './MediaGallery';
import { MediaUploadZone } from './MediaUploadZone';

interface AuctionItemFormProps {
  item?: AuctionItem;
  eventId: string;
  onSubmit: (data: AuctionItemCreate | AuctionItemUpdate) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function AuctionItemForm({
  item,
  eventId,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AuctionItemFormProps) {
  const isEdit = !!item;

  interface FormData {
    title: string;
    description: string;
    auction_type: AuctionType;
    starting_bid: string;
    donor_value: string;
    cost: string;
    buy_now_price: string;
    buy_now_enabled: boolean;
    quantity_available: string;
    donated_by: string;
    sponsor_id: string;
    item_webpage: string;
    display_priority: string;
  }

  const [formData, setFormData] = useState<FormData>({
    title: item?.title || '',
    description: item?.description || '',
    auction_type: item?.auction_type || AuctionType.SILENT,
    starting_bid: item?.starting_bid?.toString() || '',
    donor_value: item?.donor_value?.toString() || '',
    cost: item?.cost?.toString() || '',
    buy_now_price: item?.buy_now_price?.toString() || '',
    buy_now_enabled: item?.buy_now_enabled || false,
    quantity_available: item?.quantity_available?.toString() || '1',
    donated_by: item?.donated_by || '',
    sponsor_id: item?.sponsor_id || '',
    item_webpage: item?.item_webpage || '',
    display_priority: item?.display_priority?.toString() || '',
  });

  // Validation errors
  const [urlError, setUrlError] = useState<string | null>(null);
  const [numericErrors, setNumericErrors] = useState<{
    starting_bid?: string;
    donor_value?: string;
    cost?: string;
    buy_now_price?: string;
    quantity_available?: string;
    display_priority?: string;
  }>({});

  // Media management
  const [media, setMedia] = useState<AuctionItemMedia[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  // Load media when editing an existing item
  useEffect(() => {
    if (item?.id) {
      loadMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const loadMedia = async () => {
    if (!item?.id) return;

    setIsLoadingMedia(true);
    try {
      const response = await auctionItemMediaService.listMedia(eventId, item.id);
      setMedia(response.items);
    } catch {
      // Error loading media - silent fail, user can retry
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const handleMediaUpload = async (file: File, mediaType: 'image' | 'video') => {
    if (!item?.id) {
      throw new Error('Please save the item first before uploading media');
    }

    const newMedia = await auctionItemMediaService.uploadMedia(
      eventId,
      item.id,
      file,
      mediaType
    );
    setMedia((prev) => [...prev, newMedia]);
  };

  const handleMediaReorder = async (mediaIds: string[]) => {
    if (!item?.id) return;

    const response = await auctionItemMediaService.reorderMedia(
      eventId,
      item.id,
      { media_order: mediaIds }
    );
    setMedia(response.items);
  };

  const handleMediaDelete = async (mediaId: string) => {
    if (!item?.id) return;

    await auctionItemMediaService.deleteMedia(eventId, item.id, mediaId);
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (optional field)
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleUrlBlur = () => {
    if (formData.item_webpage && !isValidUrl(formData.item_webpage)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
    } else {
      setUrlError(null);
    }
  };

  const handleNumericBlur = (field: keyof typeof numericErrors, value: string, isInteger = false) => {
    if (!value) {
      // Empty is allowed for optional fields
      setNumericErrors((prev) => ({ ...prev, [field]: undefined }));
      return;
    }

    const num = isInteger ? parseInt(value, 10) : parseFloat(value);

    if (isNaN(num)) {
      setNumericErrors((prev) => ({ ...prev, [field]: 'Please enter a valid number' }));
    } else if (num < 0) {
      setNumericErrors((prev) => ({ ...prev, [field]: 'Value cannot be negative' }));
    } else if (isInteger && !Number.isInteger(num)) {
      setNumericErrors((prev) => ({ ...prev, [field]: 'Please enter a whole number' }));
    } else {
      setNumericErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate URL before submitting
    if (formData.item_webpage && !isValidUrl(formData.item_webpage)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    // Check for any numeric validation errors
    const hasNumericErrors = Object.values(numericErrors).some((error) => error !== undefined);
    if (hasNumericErrors) {
      return;
    }

    const data = isEdit
      ? ({
        title: formData.title || undefined,
        description: formData.description || undefined,
        auction_type: formData.auction_type,
        starting_bid: formData.starting_bid
          ? parseFloat(formData.starting_bid)
          : undefined,
        donor_value: formData.donor_value
          ? parseFloat(formData.donor_value)
          : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        buy_now_price: formData.buy_now_price
          ? parseFloat(formData.buy_now_price)
          : null,
        buy_now_enabled: formData.buy_now_enabled,
        quantity_available: formData.quantity_available
          ? parseInt(formData.quantity_available, 10)
          : undefined,
        donated_by: formData.donated_by || null,
        sponsor_id: formData.sponsor_id || null,
        item_webpage: formData.item_webpage || null,
        display_priority: formData.display_priority
          ? parseInt(formData.display_priority, 10)
          : null,
      } as AuctionItemUpdate)
      : ({
        title: formData.title,
        description: formData.description,
        auction_type: formData.auction_type,
        starting_bid: parseFloat(formData.starting_bid),
        donor_value: formData.donor_value
          ? parseFloat(formData.donor_value)
          : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        buy_now_price: formData.buy_now_price
          ? parseFloat(formData.buy_now_price)
          : null,
        buy_now_enabled: formData.buy_now_enabled,
        quantity_available: parseInt(formData.quantity_available, 10),
        donated_by: formData.donated_by || undefined,
        sponsor_id: formData.sponsor_id || undefined,
        item_webpage: formData.item_webpage || undefined,
        display_priority: formData.display_priority
          ? parseInt(formData.display_priority, 10)
          : undefined,
      } as AuctionItemCreate);

    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">
            Item Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            disabled={isSubmitting}
            placeholder="e.g., Weekend Getaway in Napa Valley"
            maxLength={200}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
            disabled={isSubmitting}
            placeholder="Provide a detailed description of the auction item..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auction_type">
            Auction Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.auction_type}
            onValueChange={(value) =>
              setFormData({ ...formData, auction_type: value as AuctionType })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger id="auction_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AuctionType.LIVE}>Live Auction</SelectItem>
              <SelectItem value={AuctionType.SILENT}>Silent Auction</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity_available">
            Quantity Available <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quantity_available"
            type="number"
            min="1"
            step="1"
            value={formData.quantity_available}
            onChange={(e) =>
              setFormData({ ...formData, quantity_available: e.target.value })
            }
            onBlur={(e) => handleNumericBlur('quantity_available', e.target.value, true)}
            required
            disabled={isSubmitting}
          />
          {numericErrors.quantity_available && (
            <p className="text-xs text-destructive">{numericErrors.quantity_available}</p>
          )}
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Pricing Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="starting_bid">
              Starting Bid ($) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="starting_bid"
              type="number"
              step="0.01"
              min="0"
              value={formData.starting_bid}
              onChange={(e) =>
                setFormData({ ...formData, starting_bid: e.target.value })
              }
              onBlur={(e) => handleNumericBlur('starting_bid', e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="0.00"
            />
            {numericErrors.starting_bid && (
              <p className="text-xs text-destructive">{numericErrors.starting_bid}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor_value">Donor Value ($)</Label>
            <Input
              id="donor_value"
              type="number"
              step="0.01"
              min="0"
              value={formData.donor_value}
              onChange={(e) =>
                setFormData({ ...formData, donor_value: e.target.value })
              }
              onBlur={(e) => handleNumericBlur('donor_value', e.target.value)}
              disabled={isSubmitting}
              placeholder="0.00"
            />
            {numericErrors.donor_value && (
              <p className="text-xs text-destructive">{numericErrors.donor_value}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The value declared by the donor
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Cost to NPO ($)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              onBlur={(e) => handleNumericBlur('cost', e.target.value)}
              disabled={isSubmitting}
              placeholder="0.00"
            />
            {numericErrors.cost && (
              <p className="text-xs text-destructive">{numericErrors.cost}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Internal cost tracking (not shown to bidders)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buy_now_price">Buy Now Price ($)</Label>
            <Input
              id="buy_now_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.buy_now_price}
              onChange={(e) =>
                setFormData({ ...formData, buy_now_price: e.target.value })
              }
              onBlur={(e) => handleNumericBlur('buy_now_price', e.target.value)}
              disabled={isSubmitting}
              placeholder="0.00"
            />
            {numericErrors.buy_now_price && (
              <p className="text-xs text-destructive">{numericErrors.buy_now_price}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:col-span-2">
            <Switch
              id="buy_now_enabled"
              checked={formData.buy_now_enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, buy_now_enabled: checked })
              }
              disabled={isSubmitting}
            />
            <Label htmlFor="buy_now_enabled" className="cursor-pointer">
              Enable "Buy Now" option
            </Label>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Additional Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="donated_by">Donated By</Label>
            <Input
              id="donated_by"
              value={formData.donated_by}
              onChange={(e) =>
                setFormData({ ...formData, donated_by: e.target.value })
              }
              disabled={isSubmitting}
              placeholder="Donor name or organization"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item_webpage">Item Webpage URL</Label>
            <Input
              id="item_webpage"
              type="url"
              value={formData.item_webpage}
              onChange={(e) =>
                setFormData({ ...formData, item_webpage: e.target.value })
              }
              onBlur={handleUrlBlur}
              disabled={isSubmitting}
              placeholder="https://example.com/item"
              className={urlError ? 'border-red-500' : ''}
            />
            {urlError && <p className="text-sm text-red-500">{urlError}</p>}
            <p className="text-xs text-muted-foreground">
              Link to more information about this item
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_priority">Display Priority</Label>
            <Input
              id="display_priority"
              type="number"
              step="1"
              value={formData.display_priority}
              onChange={(e) =>
                setFormData({ ...formData, display_priority: e.target.value })
              }
              onBlur={(e) => handleNumericBlur('display_priority', e.target.value, true)}
              disabled={isSubmitting}
              placeholder="0"
            />
            {numericErrors.display_priority && (
              <p className="text-xs text-destructive">{numericErrors.display_priority}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Higher numbers appear first (default: 0)
            </p>
          </div>
        </div>
      </div>

      {/* Media Management */}
      {isEdit && item?.id && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Media (Images & Videos)</h3>

          {isLoadingMedia ? (
            <div className="text-sm text-muted-foreground">Loading media...</div>
          ) : (
            <>
              {/* Upload Zone */}
              <MediaUploadZone
                onUpload={handleMediaUpload}
                disabled={isSubmitting}
              />

              {/* Media Gallery */}
              {media.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Drag to reorder. First image will be the primary thumbnail.
                  </p>
                  <MediaGallery
                    media={media}
                    onReorder={handleMediaReorder}
                    onDelete={handleMediaDelete}
                    readOnly={isSubmitting}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isEdit && (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6">
          <p className="text-sm text-muted-foreground text-center">
            Save the item first to upload images and videos
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? 'Updating...'
              : 'Creating...'
            : isEdit
              ? 'Update Item'
              : 'Create Item'}
        </Button>
      </div>
    </form>
  );
}
