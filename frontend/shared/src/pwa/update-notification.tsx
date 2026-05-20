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

  // Only show in installed/standalone PWA. In a regular browser tab
  // the user can just refresh and the new SW takes over on the next
  // navigation — the banner is just noise.
  if (typeof window !== "undefined") {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isStandalone) return null;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);

    // iOS standalone PWA notes:
    //  - `updateServiceWorker()` from vite-plugin-pwa is unreliable here.
    //  - Calling `window.location.reload()` immediately does NOT guarantee
    //    the new SW takes over before the page reloads — the browser can
    //    keep serving the previous bundle through the old controller.
    //
    // Correct sequence:
    //   1. postMessage SKIP_WAITING to the registered waiting SW.
    //   2. Listen for `controllerchange` — fires when the new SW is in
    //      control of this page. Reload AFTER that.
    //   3. Always have a hard timeout fallback so the user is never
    //      stuck on an "Updating…" button if anything goes wrong.

    const reload = () => window.location.reload();

    // Hard fallback: if nothing else happens in 1.5s, reload anyway.
    // The SW's activate handler is intentionally fast (no client
    // navigation work) so controllerchange should fire well before
    // this timer in normal cases.
    const fallback = window.setTimeout(reload, 1500);

    let didReload = false;
    const reloadOnce = () => {
      if (didReload) return;
      didReload = true;
      window.clearTimeout(fallback);
      reload();
    };

    // When the new SW takes control of this page, reload it.
    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      reloadOnce,
      { once: true },
    );

    try {
      const reg = await navigator.serviceWorker.getRegistration();

      // Sync any internal plugin state.
      await onRefresh().catch(() => { });

      if (reg?.waiting) {
        // The new SW is already installed and waiting — wake it up.
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else if (reg) {
        // No waiting SW found. Force a registration update; once the
        // new SW installs, fire SKIP_WAITING at it. If still nothing
        // installs, the fallback timer above will reload us anyway.
        try {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } else if (reg.installing) {
            reg.installing.addEventListener("statechange", () => {
              if (reg.waiting) {
                reg.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        } catch {
          // ignore — fallback timer will handle it
        }
      } else {
        // No SW at all — just reload.
        reloadOnce();
      }
    } catch {
      reloadOnce();
    }
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
