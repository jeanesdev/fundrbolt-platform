import { useEffect, useState } from "react";

export interface UpdateNotificationProps {
  /** Whether a new version is waiting to be activated */
  needRefresh: boolean;
  /** Called when the user taps "Refresh" to activate the new version */
  onRefresh: () => Promise<void>;
  /** Called when the user dismisses the notification */
  onDismiss: () => void;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Non-blocking toast/banner shown at the top of the viewport
 * when a new app version is available.
 *
 * In standalone (installed) PWA mode: shows an explicit banner so the user
 * can choose when to refresh.
 *
 * In browser-tab mode: silently applies the update in the background and
 * reloads the page as soon as the new SW activates. The user will see a
 * brief reload, identical to what a normal browser refresh would do, but
 * this is necessary because Workbox's precache intercepts all navigations
 * and would otherwise keep serving the old bundle indefinitely.
 */
export function UpdateNotification({
  needRefresh,
  onRefresh,
  onDismiss,
}: UpdateNotificationProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // In browser-tab mode, silently trigger the update immediately — no banner.
  useEffect(() => {
    if (!needRefresh) return;
    if (isStandaloneMode()) return;
    // Fire-and-forget: apply the waiting SW so the next navigation loads
    // the new bundle. We don't reload forcefully here; the page will get
    // the new SW on the user's next navigation or refresh.
    void onRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRefresh]);

  if (!needRefresh) return null;

  // Only show the interactive banner in standalone (installed) mode.
  if (!isStandaloneMode()) return null;

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

    const reload = () => {
      // Force a hard reload (bypass cache) to ensure we get the new bundle.
      // This is especially important on iOS where SW activation can be flaky.
      try {
        window.location.reload();
      } catch {
        // Fallback for older browsers
        window.location.href = window.location.href;
      }
    };

    // Hard fallback timeout. iOS standalone apps need more time for SW
    // activation (clients.claim() + cache cleanup). 3 seconds gives iOS
    // enough time while still feeling responsive to the user.
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const timeoutMs = isIOS ? 3000 : 1500;
    const fallback = window.setTimeout(reload, timeoutMs);

    let didReload = false;
    const reloadOnce = () => {
      if (didReload) return;
      didReload = true;
      console.log('[UpdateNotification] Triggering reload');
      window.clearTimeout(fallback);
      reload();
    };

    // When the new SW takes control of this page, reload it.
    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      () => {
        console.log('[UpdateNotification] controllerchange event fired, new SW is now active');
        reloadOnce();
      },
      { once: true },
    );

    try {
      const reg = await navigator.serviceWorker.getRegistration();

      // Sync any internal plugin state.
      await onRefresh().catch(() => { });

      if (reg?.waiting) {
        // The new SW is already installed and waiting — wake it up.
        console.log('[UpdateNotification] Sending SKIP_WAITING to waiting SW');
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else if (reg) {
        // No waiting SW found. Force a registration update; once the
        // new SW installs, fire SKIP_WAITING at it. If still nothing
        // installs, the fallback timer above will reload us anyway.
        console.log('[UpdateNotification] No waiting SW, forcing update check');
        try {
          await reg.update();
          if (reg.waiting) {
            console.log('[UpdateNotification] Waiting SW found after update, sending SKIP_WAITING');
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } else if (reg.installing) {
            reg.installing.addEventListener("statechange", () => {
              if (reg.waiting) {
                console.log('[UpdateNotification] Installing SW became waiting, sending SKIP_WAITING');
                reg.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        } catch (err) {
          console.error('[UpdateNotification] Update check failed:', err);
          // ignore — fallback timer will handle it
        }
      } else {
        // No SW at all — just reload.
        console.log('[UpdateNotification] No SW registration found, reloading');
        reloadOnce();
      }
    } catch (err) {
      console.error('[UpdateNotification] Error during update:', err);
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
