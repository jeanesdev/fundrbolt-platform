import apiClient from '@/lib/axios';
import { DiscountType, type PromoCodeRead } from "@/types/ticket-management";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, DollarSign, Edit, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { PromoCodeFormDialog } from "./PromoCodeFormDialog";

interface PromoCodesManagerProps {
  eventId: string;
}

export function PromoCodesManager({ eventId }: PromoCodesManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCodeRead | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const queryClient = useQueryClient();

  // Fetch promo codes
  const { data: promoCodes = [], isLoading } = useQuery({
    queryKey: ["promoCodes", eventId, showInactive],
    queryFn: async () => {
      const response = await apiClient.get<PromoCodeRead[]>(
        `/api/v1/admin/events/${eventId}/promo-codes`,
        { params: { include_inactive: showInactive } }
      );
      return response.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (codeId: string) => {
      await apiClient.delete(
        `/api/v1/admin/events/${eventId}/promo-codes/${codeId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoCodes", eventId] });
    },
  });

  const handleEdit = (code: PromoCodeRead) => {
    setEditingCode(code);
    setIsFormOpen(true);
  };

  const handleDelete = async (code: PromoCodeRead) => {
    if (code.used_count > 0) {
      alert("Cannot delete a promo code that has been used.");
      return;
    }
    if (
      confirm(
        `Are you sure you want to delete promo code "${code.code}"? This action cannot be undone.`
      )
    ) {
      await deleteMutation.mutateAsync(code.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCode(null);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDiscount = (code: PromoCodeRead) => {
    if (code.discount_type === DiscountType.PERCENTAGE) {
      return `${code.discount_value}%`;
    }
    return `$${code.discount_value}`;
  };

  const getUsageStatus = (code: PromoCodeRead) => {
    if (code.max_uses === null) return "Unlimited";
    const remaining = code.max_uses - code.used_count;
    return `${code.used_count} / ${code.max_uses} used (${remaining} left)`;
  };

  const isExpired = (code: PromoCodeRead) => {
    if (!code.valid_until) return false;
    return new Date(code.valid_until) < new Date();
  };

  const isNotYetValid = (code: PromoCodeRead) => {
    if (!code.valid_from) return false;
    return new Date(code.valid_from) > new Date();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading promo codes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Promo Codes</h2>
          <p className="text-muted-foreground">
            Create and manage discount codes for ticket purchases
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Promo Code
        </button>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showInactive"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="rounded border-gray-300"
        />
        <label htmlFor="showInactive" className="text-sm cursor-pointer">
          Show inactive promo codes
        </label>
      </div>

      {/* Promo Codes Grid */}
      {promoCodes.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border border-dashed">
          <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No promo codes yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first promo code to offer discounts to attendees.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Promo Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promoCodes.map((code) => (
            <div
              key={code.id}
              className={`p-4 border rounded-lg space-y-3 ${!code.is_active || isExpired(code)
                ? "bg-muted/50 border-dashed"
                : "bg-card"
                }`}
            >
              {/* Code Header */}
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">
                      {code.code}
                    </span>
                    {!code.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-gray-200 rounded">
                        Inactive
                      </span>
                    )}
                    {isExpired(code) && code.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                        Expired
                      </span>
                    )}
                    {isNotYetValid(code) && code.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                        Not Yet Valid
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(code)}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(code)}
                    disabled={code.used_count > 0}
                    className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      code.used_count > 0
                        ? "Cannot delete used promo code"
                        : "Delete"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Discount Amount */}
              <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                {code.discount_type === DiscountType.PERCENTAGE ? (
                  <Percent className="h-5 w-5" />
                ) : (
                  <DollarSign className="h-5 w-5" />
                )}
                {formatDiscount(code)}
              </div>

              {/* Date Range */}
              {(code.valid_from || code.valid_until) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {code.valid_from && formatDate(code.valid_from)}
                    {code.valid_from && code.valid_until && " - "}
                    {code.valid_until && formatDate(code.valid_until)}
                  </span>
                </div>
              )}

              {/* Usage Stats */}
              <div className="text-sm">
                <span className="text-muted-foreground">Usage: </span>
                <span className="font-medium">{getUsageStatus(code)}</span>
              </div>

              {/* Usage Bar */}
              {code.max_uses !== null && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(code.used_count / code.max_uses) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <PromoCodeFormDialog
        eventId={eventId}
        open={isFormOpen}
        onClose={handleFormClose}
        editingCode={editingCode}
      />
    </div>
  );
}
