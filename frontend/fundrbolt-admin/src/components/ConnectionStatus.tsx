import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, WifiOff } from 'lucide-react';

/**
 * Displays a connection status banner
 *
 * Shows when the user is offline or has intermittent connectivity issues
 * Appears at the top of the page to inform users they may not be able to
 * save changes or access remote data
 *
 * @returns React component or null if online
 *
 * @example
 * ```tsx
 * <div>
 *   <ConnectionStatus />
 *   <TicketPackagesIndexPage />
 * </div>
 * ```
 */
export function ConnectionStatus() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="fixed top-0 left-0 right-0 z-50 rounded-none border-b-2 m-0"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      </div>
      <AlertDescription className="ml-0">
        <div className="font-semibold">No internet connection</div>
        <div className="text-sm opacity-90">
          You are offline. Changes may not be saved. Please check your connection.
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Wrapper component that prevents interaction when offline
 *
 * Useful for wrapping forms or interactive elements that require network
 *
 * @param children - Elements to wrap
 * @param fallback - Content to show when offline (optional)
 * @returns React component
 *
 * @example
 * ```tsx
 * <OfflineProtected>
 *   <TicketPackageForm />
 * </OfflineProtected>
 * ```
 */
export function OfflineProtected({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isOnline } = useNetworkStatus();

  if (!isOnline) {
    return (
      <div className="opacity-50 pointer-events-none">
        {fallback || (
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <WifiOff className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This action is unavailable while offline
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

export default ConnectionStatus;
