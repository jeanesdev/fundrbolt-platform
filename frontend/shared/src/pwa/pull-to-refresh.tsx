import { useEffect, useRef, useState } from "react";

export interface PullToRefreshProps {
  /**
   * Called when the user completes a pull-to-refresh gesture.
   * If it returns a promise, the spinner stays visible until it resolves.
   * Default: window.location.reload().
   */
  onRefresh?: () => void | Promise<void>;
  /**
   * Distance in px the user must pull past the top before the gesture
   * counts as a refresh on release. Defaults to 80.
   */
  threshold?: number;
  /**
   * Max distance the indicator can be dragged. Defaults to 120.
   */
  maxPull?: number;
  /**
   * Disable the gesture entirely (e.g. on desktop / non-touch).
   * Defaults to false (enabled on touch devices).
   */
  disabled?: boolean;
}

/**
 * iOS-standalone-PWA-safe pull-to-refresh.
 *
 * Native iOS Safari shows pull-to-refresh from the browser chrome, but
 * standalone PWAs strip the chrome and lose that affordance. This
 * component re-creates the gesture using touch events on `document.body`
 * (which is the scroller in this app — see styles/index.css where
 * `body { overflow-y: auto; overscroll-behavior-y: none }`).
 *
 * Behavior:
 *   - Only activates when the body is scrolled to the very top.
 *   - Shows a spinner that follows the finger with rubber-band damping.
 *   - Triggers `onRefresh` (defaults to `window.location.reload()`)
 *     when released past `threshold`.
 *   - Does nothing on non-touch devices.
 */
export function PullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mutable refs so the touch handlers (registered once) always see
  // the latest values without re-binding.
  const startYRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const distanceRef = useRef(0);

  useEffect(() => {
    if (disabled) return;
    // Touch-only — skip on desktop.
    if (typeof window === "undefined") return;
    if (!("ontouchstart" in window)) return;

    const scroller = document.scrollingElement || document.documentElement;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      // Only arm the gesture when we're already at the very top.
      if ((scroller?.scrollTop ?? 0) > 0) return;
      const touch = e.touches[0];
      if (!touch) return;
      startYRef.current = touch.clientY;
      isTrackingRef.current = true;
      distanceRef.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || isRefreshingRef.current) return;
      const touch = e.touches[0];
      if (!touch || startYRef.current == null) return;

      const rawDelta = touch.clientY - startYRef.current;

      // If user starts scrolling up (or any non-downward movement) cancel.
      if (rawDelta <= 0) {
        if (distanceRef.current !== 0) {
          distanceRef.current = 0;
          setPullDistance(0);
        }
        return;
      }

      // If they've scrolled away from the top in the meantime, cancel.
      if ((scroller?.scrollTop ?? 0) > 0) {
        isTrackingRef.current = false;
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      // Rubber-band damping so the indicator never feels uncapped.
      const damped = Math.min(maxPull, rawDelta * 0.55);
      distanceRef.current = damped;
      setPullDistance(damped);

      // Only prevent the default scroll once we're actually pulling —
      // otherwise we'd block normal taps/text-selection.
      if (damped > 4 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;
      const distance = distanceRef.current;
      startYRef.current = null;

      if (distance >= threshold && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(threshold);

        const finish = () => {
          // Brief delay before snapping back so the spinner is visible
          // (the reload, if used, replaces the page anyway).
          setTimeout(() => {
            isRefreshingRef.current = false;
            distanceRef.current = 0;
            setIsRefreshing(false);
            setPullDistance(0);
          }, 250);
        };

        try {
          const result = onRefresh
            ? onRefresh()
            : window.location.reload();
          if (result && typeof (result as Promise<void>).then === "function") {
            (result as Promise<void>).then(finish, finish);
          } else {
            finish();
          }
        } catch {
          finish();
        }
      } else {
        distanceRef.current = 0;
        setPullDistance(0);
      }
    };

    // Passive: false on touchmove so preventDefault works during the pull.
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, threshold, maxPull, onRefresh]);

  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(1, pullDistance / threshold);
  const triggered = pullDistance >= threshold || isRefreshing;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
        transition: isRefreshing ? "transform 150ms ease-out" : "none",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "9999px",
          background: "rgba(17, 24, 39, 0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isRefreshing
              ? "none"
              : `rotate(${progress * 270}deg)`,
            transition: "transform 60ms linear",
            animation: isRefreshing ? "ptr-spin 0.8s linear infinite" : "none",
            opacity: triggered ? 1 : 0.5 + progress * 0.5,
          }}
        >
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </div>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
