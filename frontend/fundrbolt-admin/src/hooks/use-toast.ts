import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  description?: string;
  duration?: number;
  variant?: 'default' | 'destructive';
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Hook for showing toast notifications
 *
 * Uses Sonner as the underlying toast library
 *
 * @returns Object with toast function
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 *
 * toast({
 *   title: 'Success',
 *   description: 'Operation completed',
 * });
 * ```
 */
export function useToast() {
  const toast = (options: {
    title?: string;
    description?: string;
    duration?: number;
    variant?: 'default' | 'destructive';
    action?: {
      label: string;
      onClick: () => void;
    };
  }) => {
    const { title, description, duration, variant, action } = options;

    if (variant === 'destructive') {
      sonnerToast.error(description || title || 'Error', {
        duration,
        action: action ? {
          label: action.label,
          onClick: action.onClick,
        } : undefined,
      });
    } else {
      sonnerToast.success(description || title || 'Success', {
        duration,
        action: action ? {
          label: action.label,
          onClick: action.onClick,
        } : undefined,
      });
    }
  };

  return { toast };
}
