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

    // The vite-plugin-pwa updateServiceWorker() helper is unreliable on
    // iOS standalone — it can silently no-op and the controllerchange
    // event often never fires. Bypass all of that and force the update
    // ourselves.
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      // Tell the waiting SW to take over.
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      // Clear ALL caches — the new HTML/JS must come fresh from the network.
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      // Unregister the active SW so the next page load installs the new one
      // cleanly without any race conditions.
      if (reg) {
        await reg.unregister();
      }
    } catch {
      // ignore — proceed to reload regardless
    }

    // Also call the hook's update function so its internal state syncs.
    try {
      await onRefresh();
    } catch {
      // ignore
    }

    // Hard navigate (not reload) with a cache-busting query param so iOS
    // Safari/standalone cannot serve the page from its HTTP cache. Using
    // window.location.replace prevents the broken page from being kept
    // in history.
    const url = new URL(window.location.href);
    url.searchParams.set("_swu", Date.now().toString());
    window.location.replace(url.toString());
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
