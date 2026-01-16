/**
 * Purchasers List Component
 * Displays list of ticket purchasers with details
 */

import { salesTrackingApi } from '@/api/salesTracking';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Mail,
  Tag,
  Ticket,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { PurchasersListSkeleton } from './SalesDataSkeleton';

interface PurchasersListProps {
  eventId: string;
  packageId: string;
}

export function PurchasersList({ eventId, packageId }: PurchasersListProps) {
  const [page, setPage] = useState(1);
  const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['package-sales', eventId, packageId, page],
    queryFn: () => salesTrackingApi.getPackageSalesDetails(eventId, packageId, page),
  });

  const toggleExpand = (purchaseId: string) => {
    setExpandedPurchases((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseId)) {
        next.delete(purchaseId);
      } else {
        next.add(purchaseId);
      }
      return next;
    });
  };

  if (isLoading) {
    return <PurchasersListSkeleton />;
  }

  if (!data || data.purchasers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No purchases yet for this package</p>
        </CardContent>
      </Card>
    );
  }

  const { purchasers, total_count, per_page } = data;
  const totalPages = Math.ceil(total_count / per_page);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Purchasers ({total_count})
        </h3>
      </div>

      {/* Purchasers List */}
      <div className="space-y-2">
        {purchasers.map((purchaser) => {
          const isExpanded = expandedPurchases.has(purchaser.purchase_id);

          return (
            <Card key={purchaser.purchase_id}>
              <CardContent className="p-4">
                {/* Main Info */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{purchaser.purchaser_name}</span>
                      <Badge
                        variant={
                          purchaser.payment_status === 'completed'
                            ? 'default'
                            : purchaser.payment_status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {purchaser.payment_status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{purchaser.purchaser_email}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" />
                        <span>{purchaser.quantity} tickets</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span className="font-semibold">
                          ${Number(purchaser.total_price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(purchaser.purchase_id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Purchase Date</p>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(purchaser.purchased_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {purchaser.promo_code && (
                        <div>
                          <p className="text-muted-foreground mb-1">Promo Code</p>
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            <Badge variant="secondary">{purchaser.promo_code}</Badge>
                            {purchaser.discount_amount && (
                              <span className="text-green-600 font-semibold">
                                -${Number(purchaser.discount_amount).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-muted-foreground mb-1">Assigned Tickets</p>
                        <span className="font-medium">{purchaser.assigned_tickets_count}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
