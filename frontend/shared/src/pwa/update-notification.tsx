import { useState } from "react";

export interface UpdateNotificationProps {
  /** Whether a new version is waiting to be activated */
  needRefresh: boolean;
  /** Called when the user taps "Refresh" to activate the new version */
  onRefresh: () => Promise<void>;
  /** Called when the user dismisses the notification */
  onDismiss: () => void;
}

/**
 * Non-blocking toast/banner shown at the top of the viewport
 * when a new app version is available.
 */
export function UpdateNotification({
  needRefresh,
  onRefresh,
  onDismiss,
}: UpdateNotificationProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!needRefresh) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);

    // Keep this MINIMAL. Previous versions of this handler tried to be
    // "bulletproof" by unregistering the SW and deleting every cache
    // before reloading. On iOS standalone that left the renderer in a
    // zombie state: the HTML loaded but lazy-loaded JS chunks failed
    // because the precache they expected was gone and the SW that
    // would have served them was mid-unregister. The page would render
    // but buttons wouldn't work and sections would be blank on scroll.
    //
    // The correct iOS-safe pattern is: tell the waiting SW to skip
    // waiting, then do a plain reload. The new SW's activate handler
    // calls cleanupOutdatedCaches() itself, and the next page load
    // installs everything cleanly with no race conditions.
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      // Let the hook update its internal state too (no-op if it can't).
      await onRefresh().catch(() => {});
    } catch {
      // ignore — reload anyway
    }

    // Plain reload — the new SW will be in control by the time the
    // new page parses.
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-x-0 z-50 animate-in slide-in-from-top border-b border-blue-200 bg-blue-50 duration-300"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
      role="alert"
    >
      <div className="px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <p className="text-sm font-medium text-blue-800">
            {isRefreshing ? "Updating…" : "A new version is available."}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {isRefreshing ? "Updating…" : "Refresh to update"}
            </button>
            <button
              onClick={onDismiss}
              className="rounded-full p-1 text-blue-400 transition-colors hover:text-blue-600"
              aria-label="Dismiss update notification"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
