import apiClient from '@/lib/axios';
import { DiscountType, type PromoCodeCreate, type PromoCodeRead, type PromoCodeUpdate } from "@/types/ticket-management";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface PromoCodeFormDialogProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
  editingCode?: PromoCodeRead | null;
}

interface FormData {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_uses: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

export function PromoCodeFormDialog({
  eventId,
  open,
  onClose,
  editingCode,
}: PromoCodeFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingCode;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      code: "",
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 0,
      max_uses: null,
      valid_from: "",
      valid_until: "",
      is_active: true,
    },
  });

  const discountType = watch("discount_type");

  // Reset form when dialog opens/closes or editing code changes
  useEffect(() => {
    if (open) {
      if (editingCode) {
        reset({
          code: editingCode.code,
          discount_type: editingCode.discount_type,
          discount_value: Number(editingCode.discount_value),
          max_uses: editingCode.max_uses,
          valid_from: editingCode.valid_from
            ? new Date(editingCode.valid_from).toISOString().split("T")[0]
            : "",
          valid_until: editingCode.valid_until
            ? new Date(editingCode.valid_until).toISOString().split("T")[0]
            : "",
          is_active: editingCode.is_active,
        });
      } else {
        reset({
          code: "",
          discount_type: DiscountType.PERCENTAGE,
          discount_value: 0,
          max_uses: null,
          valid_from: "",
          valid_until: "",
          is_active: true,
        });
      }
    }
  }, [open, editingCode, reset]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PromoCodeCreate) => {
      const response = await apiClient.post<PromoCodeRead>(
        `/admin/events/${eventId}/promo-codes`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoCodes", eventId] });
      toast.success("Promo code created successfully");
      onClose();
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail || "Failed to create promo code");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PromoCodeUpdate) => {
      const response = await apiClient.patch<PromoCodeRead>(
        `/admin/events/${eventId}/promo-codes/${editingCode!.id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoCodes", eventId] });
      toast.success("Promo code updated successfully");
      onClose();
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail || "Failed to update promo code");
    },
  });

  const onSubmit = async (data: FormData) => {
    if (isEditing) {
      // Build update payload
      const updatePayload: PromoCodeUpdate = {
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses || null,
        valid_from: data.valid_from || null,
        valid_until: data.valid_until || null,
        is_active: data.is_active,
      };

      // Remove code and discount fields if promo has been used
      if (editingCode.used_count > 0) {
        delete updatePayload.discount_type;
        delete updatePayload.discount_value;
      }

      await updateMutation.mutateAsync(updatePayload);
    } else {
      // Build create payload
      const createPayload: PromoCodeCreate = {
        code: data.code.toUpperCase(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses || null,
        valid_from: data.valid_from || null,
        valid_until: data.valid_until || null,
        is_active: data.is_active,
      };

      await createMutation.mutateAsync(createPayload);
    }
  };

  if (!open) return null;

  const hasBeenUsed = editingCode && editingCode.used_count > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-md rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEditing ? "Edit Promo Code" : "Create Promo Code"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Warning for used codes */}
          {hasBeenUsed && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <strong>Note:</strong> This promo code has been used{" "}
              {editingCode.used_count} time(s). Code and discount amount cannot
              be modified.
            </div>
          )}

          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register("code", {
                required: "Code is required",
                pattern: {
                  value: /^[A-Z0-9]+$/i,
                  message: "Code must contain only letters and numbers",
                },
                maxLength: {
                  value: 20,
                  message: "Code must be 20 characters or less",
                },
              })}
              disabled={hasBeenUsed}
              className="w-full px-3 py-2 border rounded-md uppercase disabled:bg-muted disabled:cursor-not-allowed"
              placeholder="e.g., SUMMER2024"
            />
            {errors.code && (
              <p className="text-sm text-red-500 mt-1">{errors.code.message}</p>
            )}
          </div>

          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Discount Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("discount_type", { required: true })}
              disabled={hasBeenUsed}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground disabled:bg-muted disabled:cursor-not-allowed"
            >
              <option value={DiscountType.PERCENTAGE}>Percentage (%)</option>
              <option value={DiscountType.FIXED_AMOUNT}>
                Fixed Amount ($)
              </option>
            </select>
          </div>

          {/* Discount Value */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Discount Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={discountType === DiscountType.PERCENTAGE ? "100" : undefined}
              {...register("discount_value", {
                required: "Discount value is required",
                min: {
                  value: 0.01,
                  message: "Discount must be greater than 0",
                },
                validate: (value) => {
                  if (discountType === DiscountType.PERCENTAGE && value > 100) {
                    return "Percentage cannot exceed 100";
                  }
                  return true;
                },
              })}
              disabled={hasBeenUsed}
              className="w-full px-3 py-2 border rounded-md disabled:bg-muted disabled:cursor-not-allowed"
              placeholder={
                discountType === DiscountType.PERCENTAGE ? "e.g., 25" : "e.g., 10.00"
              }
            />
            {errors.discount_value && (
              <p className="text-sm text-red-500 mt-1">
                {errors.discount_value.message}
              </p>
            )}
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Maximum Uses
            </label>
            <input
              type="number"
              {...register("max_uses", {
                min: { value: 1, message: "Must be at least 1" },
              })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Leave empty for unlimited"
            />
            {errors.max_uses && (
              <p className="text-sm text-red-500 mt-1">
                {errors.max_uses.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty for unlimited uses
            </p>
          </div>

          {/* Valid From */}
          <div>
            <label className="block text-sm font-medium mb-1">Valid From</label>
            <input
              type="date"
              {...register("valid_from")}
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty to start immediately
            </p>
          </div>

          {/* Valid Until */}
          <div>
            <label className="block text-sm font-medium mb-1">Valid Until</label>
            <input
              type="date"
              {...register("valid_until")}
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty for no expiration
            </p>
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              {...register("is_active")}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm cursor-pointer">
              Active (can be used)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : isEditing
                  ? "Update"
                  : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
