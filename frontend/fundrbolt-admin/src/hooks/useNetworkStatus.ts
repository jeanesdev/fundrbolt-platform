import { useEffect, useState } from 'react';

/**
 * Hook to detect online/offline status
 *
 * Returns current network status and provides a way to subscribe to changes
 *
 * @returns Object with isOnline status
 *
 * @example
 * ```tsx
 * const { isOnline } = useNetworkStatus();
 *
 * if (!isOnline) {
 *   return <OfflineMessage />;
 * }
 *
 * return <TicketManagement />;
 * ```
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    // Handler for online event
    const handleOnline = () => {
      // eslint-disable-next-line no-console
      console.log('Network connection restored');
      setIsOnline(true);
    };

    // Handler for offline event
    const handleOffline = () => {
      // eslint-disable-next-line no-console
      console.log('Network connection lost');
      setIsOnline(false);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

export default useNetworkStatus;
