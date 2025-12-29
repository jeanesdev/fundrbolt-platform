/**
 * AuctionItemCard
 * Display card for a single auction item with actions
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuctionType, ItemStatus, type AuctionItem } from '@/types/auction-item';
import { Eye, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface AuctionItemCardProps {
  item: AuctionItem;
  onEdit?: (item: AuctionItem) => void;
  onDelete?: (item: AuctionItem) => void;
  onView?: (item: AuctionItem) => void;
  readOnly?: boolean;
}

// Helper to format currency
const formatCurrency = (amount: number | null): string => {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Status badge variants
const getStatusVariant = (status: ItemStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case ItemStatus.PUBLISHED:
      return 'default';
    case ItemStatus.DRAFT:
      return 'secondary';
    case ItemStatus.SOLD:
      return 'default'; // Use default variant for sold (green color needs custom styling)
    case ItemStatus.WITHDRAWN:
      return 'destructive';
    default:
      return 'outline';
  }
};

export function AuctionItemCard({
  item,
  onEdit,
  onDelete,
  onView,
  readOnly = false,
}: AuctionItemCardProps) {
  return (
    <Card className="flex flex-col">
      {/* Image Section */}
      {item.primary_image_url && (
        <div className="aspect-video bg-muted relative overflow-hidden">
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{item.title}</CardTitle>
            <CardDescription className="mt-1">
              Bid #{item.bid_number}
            </CardDescription>
          </div>
          {!readOnly && (onEdit || onDelete || onView) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(item)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {item.description || 'No description provided'}
        </p>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 items-start">
        {/* Status and Type Badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant={getStatusVariant(item.status)}>
            {item.status}
          </Badge>
          <Badge variant="outline">
            {item.auction_type === AuctionType.LIVE ? 'Live' : 'Silent'}
          </Badge>
        </div>

        {/* Pricing Info */}
        <div className="w-full grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Starting:</span>{' '}
            <span className="font-semibold">
              {formatCurrency(item.starting_bid)}
            </span>
          </div>
          {item.donor_value && (
            <div>
              <span className="text-muted-foreground">Value:</span>{' '}
              <span className="font-semibold">
                {formatCurrency(item.donor_value)}
              </span>
            </div>
          )}
          {item.buy_now_price && item.buy_now_enabled && (
            <div>
              <span className="text-muted-foreground">Buy Now:</span>{' '}
              <span className="font-semibold">
                {formatCurrency(item.buy_now_price)}
              </span>
            </div>
          )}
          {item.quantity_available > 1 && (
            <div>
              <span className="text-muted-foreground">Qty:</span>{' '}
              <span className="font-semibold">{item.quantity_available}</span>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
