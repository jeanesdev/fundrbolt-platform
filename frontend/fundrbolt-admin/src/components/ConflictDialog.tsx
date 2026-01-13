import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ConflictDialogProps {
  isOpen: boolean;
  onRefresh: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

/**
 * Dialog shown when a 409 Conflict is detected (concurrent edit)
 *
 * Informs the user that the resource was modified by another user
 * and offers options to refresh the page or discard their changes
 *
 * @example
 * ```tsx
 * const [showConflict, setShowConflict] = useState(false);
 *
 * <ConflictDialog
 *   isOpen={showConflict}
 *   onRefresh={() => {
 *     queryClient.invalidateQueries();
 *     setShowConflict(false);
 *   }}
 *   onCancel={() => setShowConflict(false)}
 * />
 * ```
 */
export function ConflictDialog({
  isOpen,
  onRefresh,
  onCancel,
  title = 'Concurrent Edit Detected',
  description = 'This ticket package was modified by another user while you were editing it. Please refresh to see the latest changes and try again.',
}: ConflictDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Discard Changes
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRefresh}>
            Refresh and Try Again
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConflictDialog;
